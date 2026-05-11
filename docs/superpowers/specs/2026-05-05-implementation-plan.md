# ui-ux-builder Audit Remediation — Implementation Plan

**Date:** 2026-05-05  
**Scope:** All 28 findings from the comprehensive audit, prioritized Critical → Low  
**Estimated Duration:** 3-4 weeks (1 developer full-time)  
**Phases:** 6 sequential phases with parallel workstreams where safe

---

## Guiding Principles

1. **Surgical changes only** — touch only what must change per finding
2. **Verify after every change** — run `npx tsc --noEmit` and `npm run build`
3. **No speculative abstractions** — extract shared code only after fixing the third duplicate
4. **Phase gates** — each phase must pass type-check + build before the next

---

## Phase 1: Critical Pipeline Fixes (Days 1-3)

### 1.1 Fix Idempotency Race Condition
**Files:** `app/api/generate/route.ts`, `lib/generation.ts` (new)  
**Finding:** #1  
**Change:**
- Extract `reserveGenerationWithIdempotency()` into `lib/generation.ts`
- Use `prisma.generation.upsert` with `create` + `update: {}` instead of find-then-create
- Return existing generation ID on conflict, skip pipeline entirely

**Verification:** Write a test that fires two concurrent requests with the same idempotency key; verify only one generation is created.

### 1.2 Fix Abort Cleanup — Orphaned RUNNING Records
**Files:** `app/api/generate/route.ts`  
**Finding:** #2  
**Change:**
- In the streaming IIFE catch block, check `abortController.signal.aborted`
- If aborted, update generation status to `FAILED` with `errorMessage: "Aborted by client disconnect"`
- Ensure `project.status` is reset to `ACTIVE` (not left as `GENERATING`)

**Verification:** Start a generation, disconnect the client mid-stream, verify DB shows `FAILED` status.

### 1.3 Implement Generation Slot Rollback on Failure
**Files:** `lib/usage.ts`, `app/api/generate/route.ts`  
**Finding:** #3  
**Change:**
- Add `releaseGenerationSlot(usagePeriodId: string)` to `lib/usage.ts`
- Decrement `generationsUsed` via `$executeRaw` in the error path
- Call it in the catch block of the generation pipeline when `finalResult.success === false`

**Verification:** Run a generation that fails; verify `generationsUsed` returns to its pre-request value.

### 1.4 Add Per-Stage AI Model Timeouts
**Files:** `app/api/generate/route.ts`, `app/api/generate/[frameId]/route.ts`  
**Finding:** #12  
**Change:**
- Pass `AbortSignal.timeout(120_000)` alongside `abortController.signal`
- Combine both signals using `AbortSignal.any()` (Node 20+) or a custom composite signal
- Log timeout events with the model name and stage

**Verification:** Mock a slow model response; verify the request times out after 120s with proper error logging.

---

## Phase 2: Critical Billing Fixes (Days 4-5)

### 2.1 Reset `chargeFailures` on Successful Charge
**Files:** `app/api/webhooks/razorpay/route.ts`  
**Finding:** #4  
**Change:**
- In the `subscription.charged` handler, add `chargeFailures: 0, chargeRetries: 0` to the `updateMany` data object

**Verification:** Manually trigger a `subscription.charged` webhook for a subscription with `chargeFailures > 0`; verify the counter resets.

### 2.2 Link Subscription to Customer in Razorpay
**Files:** `app/api/billing/checkout/route.ts`  
**Finding:** #6  
**Change:**
- Pass `customer_id: customerId` in `razorpay.subscriptions.create()`

**Verification:** Create a checkout, verify the Razorpay subscription shows the customer ID in the dashboard.

### 2.3 Add Missing Webhook Handlers
**Files:** `app/api/webhooks/razorpay/route.ts`  
**Finding:** #22, #23  
**Change:**
- Add `subscription.resumed` → `status: "ACTIVE"`
- Add `subscription.paused` → `status: "PAUSED"`
- Add `trialing` to `RAZORPAY_TO_STATUS` mapping → `status: "ACTIVE"` (or new `TRIALING` enum)
- Capture `trialStart`/`trialEnd` from webhook payload

**Verification:** Mock each webhook event and verify correct DB state transitions.

### 2.4 Fix Webhook Signature Verification
**Files:** `lib/razorpay.ts`  
**Finding:** #13  
**Change:**
- Use `crypto.timingSafeEqual` for signature comparison
- Or use Razorpay's official SDK `validateWebhookSignature` if available

**Verification:** Verify webhook acceptance with correct signature, rejection with modified signature.

---

## Phase 3: Security Hardening (Days 6-8)

### 3.1 Add RLS Policies to All Tables
**Files:** `prisma/migrations/20260505000001_add_rls_policies/migration.sql` (new)  
**Finding:** #5  
**Change:**
Use Supabase MCP or `execute_sql` to add policies. Pattern for user-owned data:

```sql
-- Example for Project table
CREATE POLICY "Users can only access their own projects"
  ON public."Project"
  FOR ALL
  USING ("userId" = auth.uid()::text);
```

Apply to: `User`, `Project`, `Generation`, `AppSession`, `AuthAuditEvent`, `Subscription`, `UsagePeriod`, `Organisation`, `OrgMembership`, `OrgInvitation`, `RazorpayWebhookEvent`, `ClerkWebhookEvent`

**Note:** The app uses Prisma with pooled connections, so `auth.uid()` won't work with the service role. Policies should be designed for Supabase Data API usage if/when the app switches. For now, use `current_setting('request.jwt.claims', true)::json->>'sub'` or similar.

**Alternative (Immediate Fix):** Since the app currently uses Prisma's pooled connection (service role), RLS policies would block all queries. Instead:
1. Revoke `anon` and `authenticated` access from all tables via Data API settings
2. Move `rls_auto_enable()` out of `public` schema
3. Add policies that match the service-role access pattern

**Verification:** Run `supabase db advisors` (MCP `get_advisors`) and confirm no `rls_enabled_no_policy` warnings.

### 3.2 Secure `rls_auto_enable()` Function
**Files:** Supabase SQL  
**Finding:** #5  
**Change:**
- Revoke `EXECUTE` on `public.rls_auto_enable()` from `anon` and `authenticated` roles
- Move function to a private schema (e.g., `internal`) if possible

**Verification:** Attempt to call the function via Supabase REST API as `anon`; verify 403 response.

### 3.3 Hash Org Invitation Tokens
**Files:** `lib/org.ts`, `app/api/org/invite/accept/route.ts`  
**Finding:** #21  
**Change:**
- In `createInvitation`, hash token with `bcrypt.hash(token, 10)` before storage
- In `acceptInvitation`, hash the incoming token and compare with `bcrypt.compare`
- Add migration to hash existing tokens (or invalidate and regenerate)

**Verification:** Create an invite, verify the token in the DB is hashed, accept the invite successfully.

### 3.4 Fix Org Slug Race Condition
**Files:** `lib/org.ts`  
**Finding:** #20  
**Change:**
- Wrap `ensureUniqueSlug` in try/catch
- On `P2002` (unique constraint violation), retry with the next suffix
- Use `prisma.$transaction` with `SERIALIZABLE` isolation for the create path

**Verification:** Simulate two concurrent org creations with the same name; verify one succeeds and the other gets a suffixed slug.

---

## Phase 4: Performance Optimization (Days 9-12)

### 4.1 Cache Full Auth Context in Redis
**Files:** `lib/get-auth.ts`  
**Finding:** #9  
**Change:**
- Add `getCachedAuthContext(clerkSessionId: string)` that returns `AppAuthContext | null`
- Cache for 60s TTL keyed by `auth:context:${clerkSessionId}`
- Invalidate on Clerk webhook events (`session.ended`, `session.revoked`, `user.deleted`)
- Fall back to full auth computation on cache miss

**Verification:** Make two rapid authenticated requests; verify the second uses Redis cache (check logs or Redis monitor).

### 4.2 Replace Zustand Map/Set with Serializable Structures
**Files:** `stores/project-studio.ts`  
**Finding:** #10  
**Change:**
- `frameIdsByScreen: Map<string, string[]>` → `frameIdsByScreen: Record<string, string[]>`
- `activeFrameIdsByScreen: Map<string, string>` → `activeFrameIdsByScreen: Record<string, string>`
- `screenBuffers: Map<string, string>` → `screenBuffers: Record<string, string>`
- `dirtyScreens: Set<string>` → `dirtyScreens: string[]` (or keep Set but use `subscribeWithSelector`)
- `generationReviewEntries: Map<string, Entry>` → `generationReviewEntries: Record<string, Entry>`

**Verification:** Profile canvas re-renders during streaming; verify fewer re-renders with React DevTools Profiler.

### 4.3 Debounce Sandpack Mount During Streaming
**Files:** `components/canvas/hooks/useFrameLifecycle.ts`  
**Finding:** #11  
**Change:**
- Split the effect into two: one for visibility/IntersectionObserver, one for content updates
- Debounce content updates with 500ms delay during `streaming` state
- Use `clientRef.current.updateSandbox()` for content changes without remounting

**Verification:** Stream a generation with multiple frames; verify Sandpack clients are not recreated on every token.

### 4.4 Add Select Projection to Hot Queries
**Files:** Multiple  
**Finding:** #18  
**Change:**
- `requireAuthContext`: Select only needed fields from User, Subscription
- Generation queries: Exclude `spec`, `tree`, `screens` unless needed
- Org queries: Exclude `memberships`/`invitations` nested data unless displaying

**Verification:** Log query execution plans or use Prisma's logging to verify smaller result sets.

### 4.5 Preload Design Context CSVs at Startup
**Files:** `lib/designContext.ts`  
**Finding:** #19  
**Change:**
- Call `loadSkillsIndex()` at module init time (top-level await or lazy init)
- Add a health check endpoint that validates files are loaded

**Verification:** First generation request after server start should not show file I/O in logs.

### 4.6 Add Rate Limiting to Org Endpoints
**Files:** `app/api/org/**/*.ts`  
**Finding:** #24  
**Change:**
- Create `orgRatelimit` in `lib/ratelimit.ts` (e.g., 20 requests/hour)
- Apply to all org mutation endpoints (invite, remove member, leave, dissolve)

**Verification:** Exceed the rate limit; verify 429 response.

---

## Phase 5: Code Quality & Deduplication (Days 13-15)

### 5.1 Extract Shared Generation Logic
**Files:** `lib/generation.ts` (new), `app/api/generate/route.ts`, `app/api/generate/[frameId]/route.ts`  
**Finding:** #7  
**Change:**
Create `lib/generation.ts` with:
- `GenerationOrchestrator` class or functional API
- `runModelFallback<T>(options)` — shared model fallback logic
- `createStreamWriter(readable, writable)` — SSE stream setup
- `persistGenerationResult(tx, generationId, screens)` — shared persistence
- Shared constants: `STAGE3_MODELS`, `MAX_CRITIQUE_ITERATIONS`
- Shared helpers: `coerceSpec`, `buildModelPriority`, `toApiPlatform`, `toPrismaPlatform`

**Verification:** Both routes still pass type-check and produce identical behavior.

### 5.2 Unify STAGE3_MODELS Constant
**Files:** `lib/generation.ts`  
**Finding:** #8  
**Change:**
- Move `STAGE3_MODELS` to `lib/generation.ts`
- Delete duplicates from both route files

### 5.3 Remove Vestigial Critique System
**Files:** `lib/prompts.ts`  
**Finding:** #15  
**Change:**
- Delete `STAGE4_CRITIQUE_SYSTEM` (lines 53-104)
- Delete `buildCritiquePrompt` (lines 1107-1134)
- Delete `performDesignQualityCheck` from `app/api/generate/route.ts` (lines 1207-1239) — or keep the minimal version and rename it

**Verification:** Build succeeds, prompt token count is reduced.

### 5.4 Fix File-Level `eslint-disable any`
**Files:** `lib/get-auth.ts`, `app/api/generate/route.ts`, `app/api/generate/[frameId]/route.ts`  
**Finding:** #25  
**Change:**
- Remove file-level `/* eslint-disable @typescript-eslint/no-explicit-any */`
- Replace `any` with `unknown` + type guards where possible
- For Clerk user objects, use `z.object()` schemas to validate shape
- Add line-level `eslint-disable-next-line` only where truly necessary

### 5.5 Unify Error Response Shapes
**Files:** `lib/api/errors.ts` (new), all API routes  
**Finding:** #26  
**Change:**
- Define `ApiErrorResponse` type:
  ```ts
  type ApiErrorResponse = {
    error: true;
    code: string;
    message: string;
    data?: Record<string, unknown> | null;
  };
  ```
- Create helper: `createErrorResponse(code, message, data?)`
- Update all routes to use the helper

### 5.6 Fix `plan-guard.ts` Type Lie
**Files:** `lib/plan-guard.ts`  
**Finding:** #27  
**Change:**
- Use discriminated union:
  ```ts
  type PlanGuardResult =
    | { allowed: true; usage: UsageContext }
    | { allowed: false; response: NextResponse };
  ```
- For org guards that don't need usage, return a dummy `UsageContext` with sensible defaults, or refactor callers

---

## Phase 6: Database Maintenance (Days 16-17)

### 6.1 Add Missing Indexes on Foreign Keys
**Files:** `prisma/schema.prisma`  
**Finding:** #16  
**Change:**
```prisma
model OrgInvitation {
  // ...existing fields...
  @@index([invitedBy])
}

model OrgMembership {
  // ...existing fields...
  @@index([invitedBy])
}
```

### 6.2 Drop Unused Indexes
**Files:** `prisma/schema.prisma`  
**Finding:** #17  
**Change:**
Remove unused indexes:
- `Generation_status_createdAt_idx`
- `AppSession_status_idx`
- `AuthAuditEvent_clerkUserId_createdAt_idx`
- `AuthAuditEvent_clerkSessionId_createdAt_idx`
- `Subscription_razorpayCustomerId_idx`
- `Subscription_planId_status_idx`
- `UsagePeriod_userId_periodStart_idx`
- `RazorpayWebhookEvent_type_processedAt_idx`
- `OrgInvitation_email_status_idx`
- `Subscription_razorpayPlanId_idx`

**Note:** Confirm these are truly unused by checking query patterns in production logs before dropping.

### 6.3 Fix Fragile JSON Parser
**Files:** `lib/prompts.ts` or `app/api/generate/route.ts`  
**Finding:** #14  
**Change:**
- Replace `parseJsonStrict` with a proper streaming JSON parser
- Or use the `ai` SDK's `experimental_generateObject` / structured output mode
- Add unit tests for edge cases (strings with braces, escaped quotes, nested objects)

---

## Rollback Plan

Each phase is designed to be independently reversible:
1. **Database migrations** use Prisma's migration system — roll back with `npx prisma migrate deploy` to previous version
2. **Code changes** are committed per-phase — revert individual commits
3. **RLS policies** can be disabled with `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`
4. **Rate limit changes** are additive — removing them restores previous behavior

---

## Verification Checklist (Per Phase)

- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes
- [ ] `npm run test` passes (or existing tests don't break)
- [ ] Supabase security lint shows zero `rls_enabled_no_policy` warnings (after Phase 3)
- [ ] Supabase performance lint shows zero `unindexed_foreign_keys` warnings (after Phase 6)
- [ ] Manual smoke test: create project → generate → view canvas → regenerate frame
- [ ] Manual billing test: initiate checkout → verify subscription record → verify Razorpay webhook handling

---

## Risk Assessment

| Phase | Risk | Mitigation |
|-------|------|------------|
| Phase 1 | Idempotency fix changes duplicate behavior | Add feature flag, test in staging |
| Phase 1 | Slot rollback could under-count on edge cases | Add audit logging, monitor quotas |
| Phase 3 | RLS policies could block Prisma queries | Test with service role, verify access |
| Phase 3 | Token hashing breaks existing invites | Invalidate old tokens, send new invites |
| Phase 4 | Auth cache could serve stale roles | Short TTL (60s), invalidate on webhooks |
| Phase 5 | Deduplication could change behavior | Comprehensive integration tests |

---

## Appendix: File Inventory

### Modified Files (by phase)

**Phase 1:**
- `app/api/generate/route.ts`
- `app/api/generate/[frameId]/route.ts`
- `lib/usage.ts`
- `lib/generation.ts` (new)

**Phase 2:**
- `app/api/webhooks/razorpay/route.ts`
- `app/api/billing/checkout/route.ts`
- `lib/razorpay.ts`

**Phase 3:**
- `lib/org.ts`
- `app/api/org/invite/accept/route.ts`
- Supabase SQL (RLS policies, function permissions)

**Phase 4:**
- `lib/get-auth.ts`
- `stores/project-studio.ts`
- `components/canvas/hooks/useFrameLifecycle.ts`
- `lib/designContext.ts`
- `lib/ratelimit.ts`
- Multiple API routes (select projection)

**Phase 5:**
- `lib/generation.ts`
- `lib/prompts.ts`
- `lib/plan-guard.ts`
- `lib/api/errors.ts` (new)
- All API routes (error shapes)

**Phase 6:**
- `prisma/schema.prisma`
- New migration files
- `lib/prompts.ts` (JSON parser)
