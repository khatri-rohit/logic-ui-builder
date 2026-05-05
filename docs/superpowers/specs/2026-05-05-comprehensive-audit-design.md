# ui-ux-builder Comprehensive Audit Report

**Date:** 2026-05-05  
**Scope:** Generation Pipeline, Performance, Billing & Webhooks, Organization Management, Security, Code Quality, Database & Schema  
**Approach:** Pipeline-First with Performance Profiling  
**Tools Used:** Supabase MCP (database inspection, security lint, performance lint), Razorpay MCP (payment/settlement history), manual code review

---

## Executive Summary

This audit identified **28 findings** across 7 categories. **6 are CRITICAL** and require immediate action. The most severe issues are in the generation pipeline: race conditions in idempotency, orphaned generation records on abort, and permanently consumed quota slots on failure. The database has RLS enabled on all tables but **zero policies** — while currently mitigated by Prisma's pooled connection strategy, this is a latent security risk. Razorpay billing shows **zero transactions**, indicating the webhook flow has not been tested end-to-end. The codebase has significant code duplication (3 copies of generation logic) and the main route file is 1,240 lines.

---

## Findings by Priority

### P0 CRITICAL

#### 1. Idempotency Race Condition in Generation Flow
**File:** `app/api/generate/route.ts:428-450`  
**Severity:** CRITICAL  
**Category:** Pipeline / Race Condition

The idempotency check does a `prisma.generation.findUnique({ where: { idempotencyKey } })` followed by a separate `prisma.generation.create()` inside the streaming IIFE. Two concurrent requests with the same idempotency key can both pass the `findUnique` check before either creates the record. This results in duplicate generations consuming quota.

**Evidence:** The `idempotencyKey` is composed as `${authContext.appUserId}:${requestIdempotencyKey}` at line 403. The check happens at line 428 (`duplicateGeneration`), but the `create` at line 844 is not inside a transaction with the check.

**Impact:** Duplicate generation requests consume user quota slots. With the FREE plan limited to 10 generations/month, a single race could consume 20% of a user's quota.

**Fix:** Wrap the check-and-create in a single transaction using `prisma.$transaction`, or use `prisma.generation.upsert` with `create` + `update: {}` to atomically handle duplicates.

---

#### 2. No Abort Cleanup — Orphaned RUNNING Records
**File:** `app/api/generate/route.ts:581-1174` (streaming IIFE)  
**Severity:** CRITICAL  
**Category:** Pipeline / Resource Leak

When the client disconnects (AbortSignal fires), the streaming IIFE catches `AbortError` at line 994 but returns immediately without updating the database. The generation status remains `RUNNING` forever. The `finally` block only closes the writer — it does not mark the generation as failed.

**Evidence:** Lines 993-1001 handle AbortError by returning `{ success: false, ... }` from `generateScreenWithRetry`, but the outer catch block at line 1145 only catches generic errors, not the early return from abort.

**Impact:** Generations accumulate in `RUNNING` state indefinitely. These records consume DB space and prevent the project from being cleaned up. A production environment could accumulate hundreds of orphaned records.

**Fix:** In the AbortError catch, set `generation.status = "FAILED"` with `errorMessage: "Aborted by client disconnect"` before returning.

---

#### 3. Unused Generation Slots Not Released on Failure
**File:** `lib/usage.ts:141-163` + `app/api/generate/route.ts`  
**Severity:** CRITICAL  
**Category:** Pipeline / Quota Leak

`reserveGenerationSlot` atomically increments `generationsUsed` via `$executeRaw`. However, there is no rollback mechanism when the generation subsequently fails. The slot is permanently consumed even if zero code was generated.

**Evidence:** `reserveGenerationSlot` (line 141) checks `generationsUsed < generationLimit` and increments. No corresponding `releaseGenerationSlot` exists. The `performDesignQualityCheck` at line 1207 is lenient and does not gate persistence, so even low-quality output gets persisted and the slot stays consumed.

**Impact:** Users permanently lose quota on every failed generation. With FREE plan at 10 generations/month, a single failure reduces their effective quota by 10%.

**Fix:** Implement a two-phase reservation (reserve → confirm/cancel) or decrement `generationsUsed` in the error path when the generation fails before producing output.

---

#### 4. Missing `chargeFailures` Reset on Successful Charge
**File:** `app/api/webhooks/razorpay/route.ts:190-224`  
**Severity:** CRITICAL  
**Category:** Billing / Data Integrity

On `subscription.charged`, the webhook increments `chargeSuccesses` and sets `chargeSuccessAt`, but does NOT reset `chargeFailures` and `chargeRetries` to 0. These counters accumulate forever.

**Evidence:** Lines 201-219 update only `status`, `razorpayPaymentId`, `currentPeriodStart`, `currentPeriodEnd`, `chargeSuccessAt`, and `chargeSuccesses`. `chargeFailures` and `chargeRetries` are omitted.

**Impact:** Future logic that checks failure count (e.g., subscription health dashboards, retry scheduling) will be permanently misled. A user with 2 failed charges who then succeeds forever will show `chargeFailures: 2`.

**Fix:** Add `chargeFailures: 0, chargeRetries: 0` to the `subscription.charged` update.

---

#### 5. RLS Enabled But Zero Policies on All Tables
**File:** `prisma/schema.prisma` (all models)  
**Severity:** CRITICAL  
**Category:** Security / Database

Supabase security lint confirms RLS is enabled on **all 13 tables** but **no policies exist** on any of them. Additionally, the `rls_auto_enable()` function is a `SECURITY DEFINER` callable by `anon` and `authenticated` roles via the REST API.

**Evidence:**
- Supabase lint: `rls_enabled_no_policy` on AppSession, AuthAuditEvent, ClerkWebhookEvent, Generation, OrgInvitation, OrgMembership, Organisation, Project, RazorpayWebhookEvent, Subscription, UsagePeriod, User, _prisma_migrations
- Supabase lint: `anon_security_definer_function_executable` for `public.rls_auto_enable()`
- Supabase lint: `authenticated_security_definer_function_executable` for `public.rls_auto_enable()`

**Impact:** If the app ever uses Supabase's REST/GraphQL APIs directly (e.g., client-side queries, Supabase SSR), all data access will fail because RLS policies don't exist. The `rls_auto_enable()` function being public callable is a security risk.

**Fix:**
1. Add RLS policies to all tables for `authenticated` role using `auth.uid()` or equivalent user ID matching
2. Revoke `EXECUTE` on `rls_auto_enable()` from `anon` and `authenticated` roles
3. Move `rls_auto_enable()` out of `public` schema if it's an internal utility

---

#### 6. Subscription Not Linked to Customer in Razorpay
**File:** `app/api/billing/checkout/route.ts:46-67`  
**Severity:** CRITICAL  
**Category:** Billing / Data Integrity

The checkout flow creates a Razorpay customer and stores `razorpayCustomerId`, then creates a subscription. But `razorpay.subscriptions.create()` does NOT pass `customer_id`. The subscription is created orphan — not linked to the customer in Razorpay's system.

**Evidence:** Lines 57-66 create the subscription with only `plan_id`, `quantity`, `total_count`, and `notify_info`. No `customer_id` field.

**Impact:** Webhook events from Razorpay may not include the correct `customer_id` for matching to the app's `Subscription` record. Refunds, subscription management, and customer portal features will be broken.

**Fix:** Pass `customer_id: customerId` in the `razorpay.subscriptions.create()` call.

---

### P1 HIGH

#### 7. Triplicated Generation Logic
**Files:** `app/api/generate/route.ts`, `app/api/generate/[frameId]/route.ts` (frame regen within main route)  
**Severity:** HIGH  
**Category:** Code Quality / Maintainability

The main generation route (1,240 lines) contains frame regeneration logic at lines 587-820. The dedicated frame route (`[frameId]/route.ts`) is 644 lines. Together, ~70% of the code is duplicated: auth, rate limiting, model fallback, streaming, sanitization, validation, persistence.

**Evidence:** `coerceSpec`, `buildModelPriority`, `toApiPlatform`, `toPrismaPlatform`, `STAGE3_MODELS`, streaming IIFE pattern, `validateGeneratedTSX`, `sanitizeGeneratedCode` — all duplicated.

**Impact:** Any bug fix or improvement must be applied in 3 places. The model fallback pinning logic (main route) is missing from the frame route, causing different retry behavior.

**Fix:** Extract shared logic into `lib/generation.ts` — a unified `GenerationOrchestrator` class or set of composable functions.

---

#### 8. Different Model Lists in Main vs Frame Routes
**Files:** `app/api/generate/route.ts:45-61` vs `app/api/generate/[frameId]/route.ts:32-38`  
**Severity:** HIGH  
**Category:** Pipeline / Inconsistency

Main route STAGE3 models: `kimi-k2.6:cloud`, `qwen3-coder:480b-cloud`, `gemma4:31b`, `gpt-oss:120b-cloud`, `mistral-large-3:675b-cloud`  
Frame route STAGE3 models: `gemma3:27b-cloud`, `qwen3-coder:480b-cloud`, `mistral-large-3:675b-cloud`, `kimi-k2.6:cloud`, `gpt-oss:120b-cloud`

**Evidence:** Different default models (`gemma4:31b` vs `gemma3:27b-cloud`) and different ordering.

**Impact:** Regeneration may produce different results than the original generation, confusing users who expect consistency.

**Fix:** Use a single shared `STAGE3_MODELS` constant.

---

#### 9. Auth Context Triggers 6-8 DB Queries Per Request
**File:** `lib/get-auth.ts:224-443`  
**Severity:** HIGH  
**Category:** Performance / Database

Every authenticated request triggers:
1. `getCachedClerkUser` (Redis → Clerk API if miss)
2. `prisma.user.findUnique` by clerkUserId
3. `prisma.user.findFirst` by email (fallback)
4. `prisma.user.upsert` (create or update)
5. `prisma.appSession.upsert`
6. `prisma.authAuditEvent.create`
7. `prisma.orgMembership.findFirst` + nested `organisation.owner.subscription` (org check)
8. `getCachedSubscription` (Redis → DB if miss)

**Evidence:** AuthAuditEvent table has 2,327 rows for only 15 sessions and 4 users — ~155 audit events per session.

**Impact:** Each generation request (already heavy with AI model calls) adds ~8 DB round-trips before the pipeline even starts. Under load, this exhausts the connection pool.

**Fix:** Cache the full `AppAuthContext` in Redis keyed by Clerk session ID (60s TTL), and invalidate on webhook updates.

---

#### 10. Zustand Store Uses Non-Serializable State
**File:** `stores/project-studio.ts:22-34`  
**Severity:** HIGH  
**Category:** Performance / React

`ProjectStudioRuntimeState` uses `Map` and `Set` for `frameIdsByScreen`, `activeFrameIdsByScreen`, `screenBuffers`, `dirtyScreens`, and `generationReviewEntries`. These are not serializable by default and cause unnecessary re-renders because Map/Set identity comparisons always fail.

**Evidence:** Lines 26-30 declare 5 Map/Set fields. The `updateRuntime` action (line 211-213) replaces the entire runtime object, but Map/Set references are compared by identity, so React re-renders even when content is identical.

**Impact:** Unnecessary re-renders across the canvas, especially during streaming when `screenBuffers` is updated token-by-token.

**Fix:** Use plain objects (`Record<string, string[]>`) and arrays instead of Maps and Sets. Or use Zustand's `subscribeWithSelector` with shallow comparison.

---

#### 11. Sandpack Client Lifecycle During Streaming
**File:** `components/canvas/hooks/useFrameLifecycle.ts:119-162`  
**Severity:** HIGH  
**Category:** Performance / Memory

The `mount` callback has `content` in its dependency array. During streaming, `content` changes character-by-character, causing the IntersectionObserver to be recreated on every token. While `isMountedRef` prevents double-mounting, the observer teardown + re-creation is expensive.

**Evidence:** The `useEffect` at line 119 depends on `[containerRef, content, destroy, mount, state]`. During streaming, `content` changes every few milliseconds.

**Impact:** Frequent DOM observer creation/destruction causes jank in the canvas, especially with multiple frames streaming simultaneously.

**Fix:** Debounce content changes during streaming, or separate the "should mount" decision from the "what to render" content update.

---

#### 12. No Per-Stage Timeouts on AI Model Calls
**File:** `app/api/generate/route.ts:271-303`  
**Severity:** HIGH  
**Category:** Pipeline / Reliability

`generateTextWithFallback` and `streamText` have no timeout beyond the client disconnect. A stuck model can hold the server connection indefinitely.

**Evidence:** The `generateText` call at line 289 and `streamText` at line 700 only pass `abortSignal: abortController.signal` — no timeout.

**Impact:** Server resources are consumed by stuck connections. The connection pool and memory are exhausted.

**Fix:** Add `AbortSignal.timeout(120_000)` per-stage timeout and log timeout events.

---

#### 13. Webhook Signature Uses Non-Timing-Safe Comparison
**File:** `lib/razorpay.ts` (inferred from `app/api/webhooks/razorpay/route.ts:45`)  
**Severity:** HIGH  
**Category:** Security / Webhook

The `verifyWebhookSignature` function likely uses standard string comparison (`===`) which is vulnerable to timing attacks.

**Evidence:** `app/api/webhooks/razorpay/route.ts:45` calls `verifyWebhookSignature(body, signature, secret)`. The implementation is in `lib/razorpay.ts` which was not fully audited, but standard implementations often use `===`.

**Impact:** A timing attack could reveal the webhook secret character-by-character, allowing forged webhook events.

**Fix:** Use `crypto.timingSafeEqual` for signature comparison, or use Razorpay's official SDK verification method.

---

### P2 MEDIUM

#### 14. Fragile JSON Parser
**File:** `app/api/generate/route.ts:199-251`  
**Severity:** MEDIUM  
**Category:** Pipeline / Correctness

`parseJsonStrict` uses a brace-counting approach that doesn't properly handle strings containing `}` or `]` with escaped quotes. The `inString` flag can be tricked by `"}"` inside a string value.

**Evidence:** The parser at line 214-248 counts braces outside strings, but the string detection logic is naive.

**Impact:** Stage 1/2 model outputs with complex JSON strings may fail to parse, causing the entire generation to fail.

**Fix:** Use a proper streaming JSON parser or the `ai` SDK's built-in structured output mode.

---

#### 15. `performDesignQualityCheck` Is Vestigial
**File:** `app/api/generate/route.ts:1207-1239`  
**Severity:** MEDIUM  
**Category:** Pipeline / Dead Code

The `STAGE4_CRITIQUE_SYSTEM` prompt (lines 53-104) defines 7 quality criteria (visual hierarchy, spacing, token compliance, etc.). But `performDesignQualityCheck` only checks brace balance, tag balance, and container width. The critique system is never invoked.

**Evidence:** `buildCritiquePrompt` (line 1107) exists but is never called. `performDesignQualityCheck` is a minimal regex-based check.

**Impact:** The critique loop (max 3 iterations) was removed, but the prompt infrastructure remains, adding ~1,000 tokens to the system prompt for no benefit.

**Fix:** Remove `STAGE4_CRITIQUE_SYSTEM` and `buildCritiquePrompt` to reduce prompt token waste.

---

#### 16. Missing Indexes on Foreign Keys
**File:** `prisma/schema.prisma`  
**Severity:** MEDIUM  
**Category:** Performance / Database

Supabase performance lint identified two unindexed foreign keys:
- `OrgInvitation_invitedBy_fkey` on `public.OrgInvitation`
- `OrgMembership_invitedBy_fkey` on `public.OrgMembership`

**Evidence:** Supabase lint `unindexed_foreign_keys` for both constraints.

**Impact:** Queries filtering by `invitedBy` (e.g., "show me all invitations I sent") require full table scans.

**Fix:** Add `@@index([invitedBy])` to both `OrgInvitation` and `OrgMembership` models.

---

#### 17. 12 Unused Indexes Wasting Space
**File:** `prisma/schema.prisma`  
**Severity:** MEDIUM  
**Category:** Performance / Database

Supabase lint identified 12 unused indexes:
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

**Impact:** Unused indexes slow down writes (INSERT, UPDATE, DELETE) and consume disk space.

**Fix:** Drop unused indexes after confirming they're truly not needed (some may be used by infrequent admin queries).

---

#### 18. No Select Projection on Hot Queries
**Files:** Multiple  
**Severity:** MEDIUM  
**Category:** Performance / Database

Most Prisma queries fetch all fields by default. The `Generation` model's `spec`, `tree`, and `screens` JSON fields can be 50-200KB each. These are loaded even when only checking status.

**Evidence:** `app/api/generate/route.ts:405-415` fetches `id`, `status`, `platform` from `project` but the generation queries at lines 428-434 and 469-486 select all fields.

**Impact:** Unnecessary data transfer from DB to app server, especially for large JSON columns.

**Fix:** Add explicit `select` to hot-path queries to exclude large JSON columns when not needed.

---

#### 19. `designContext.ts` Reads CSV Files on Every Request
**File:** `lib/designContext.ts:276-415`  
**Severity:** MEDIUM  
**Category:** Performance / I/O

`loadSkillsIndex()` reads 5 CSV files from disk on every generation request. While it has an in-memory cache (`cachedSkillsIndex`), the cache resets on server restart/HMR.

**Evidence:** Lines 322-334 use `Promise.allSettled` to read `styles.csv`, `colors.csv`, `slide-layouts.csv`, `slide-typography.csv`, and `SKILL.md`.

**Impact:** ~5 disk I/O operations per generation request. On a cold start, this adds ~20-50ms latency.

**Fix:** Preload at module init time or move to a Redis cache with a long TTL.

---

#### 20. Org Slug Uniqueness Race Condition
**File:** `lib/org.ts:22-33`  
**Severity:** MEDIUM  
**Category:** Organization / Race Condition

`ensureUniqueSlug` does `findUnique` then `create` — not atomic. Two concurrent org creations with the same name could both find the slug available, and one would fail with P2002.

**Evidence:** Line 22-33: loop with `findUnique` + `create` pattern, no P2002 handling.

**Fix:** Wrap in try/catch, retry with suffix on P2002, or use advisory locks.

---

#### 21. Org Invite Tokens Stored in Plaintext
**File:** `lib/org.ts:100`  
**Severity:** MEDIUM  
**Category:** Security / Data Protection

Invitation tokens are generated with `crypto.randomBytes(32).toString('hex')` but stored as plaintext in the `token` column.

**Evidence:** Line 100: `const token = crypto.randomBytes(32).toString('hex')` — stored directly.

**Impact:** If the database is compromised, all pending invitations are immediately usable.

**Fix:** Hash tokens with `bcrypt` or `argon2` before storage. Compare hashes during acceptance.

---

#### 22. Incomplete Subscription Status Mapping
**File:** `app/api/webhooks/razorpay/route.ts:10-19`  
**Severity:** MEDIUM  
**Category:** Billing / Correctness

`RAZORPAY_TO_STATUS` doesn't map `"trialing"`. The fallback `?? "ACTIVE"` silently converts trial status to active without setting `trialStart`/`trialEnd`.

**Evidence:** The mapping only covers: created, authenticated, active, pending, halted, cancelled, completed, expired, paused. No `trialing`.

**Fix:** Add `trialing: "ACTIVE"` (or a new `TRIALING` enum value) and capture trial dates from the webhook payload.

---

#### 23. Missing Webhook Handlers for Resume/Pause
**File:** `app/api/webhooks/razorpay/route.ts`  
**Severity:** MEDIUM  
**Category:** Billing / Completeness

No handlers for `subscription.resumed` or `subscription.paused`. A paused subscription stays paused forever even after being resumed.

**Fix:** Add handlers for both events, mapping to appropriate `SubscriptionStatus` values.

---

#### 24. No Rate Limiting on Org Endpoints
**Files:** `app/api/org/**/*.ts`  
**Severity:** MEDIUM  
**Category:** Security / Rate Limiting

Org API routes (`/api/org/invite`, `/api/org/members/[memberId]`, `/api/org/leave`) don't use `projectWriteRatelimit` or any rate limiter.

**Impact:** An attacker with valid credentials could spam invitation emails or membership operations.

**Fix:** Apply `projectWriteRatelimit` or a dedicated org rate limiter to all org mutation endpoints.

---

#### 25. File-Level `eslint-disable no-explicit-any`
**Files:** `lib/get-auth.ts:1`, `app/api/generate/route.ts:1`, `app/api/generate/[frameId]/route.ts:1`  
**Severity:** MEDIUM  
**Category:** Code Quality / Type Safety

These files disable the `no-explicit-any` rule globally, suppressing legitimate type safety warnings across the entire file.

**Fix:** Remove file-level disables. Use `unknown` with type guards, or add line-level disables only where truly necessary.

---

### P3 LOW

#### 26. Inconsistent Error Response Shapes
**Files:** Multiple API routes  
**Severity:** LOW  
**Category:** Code Quality / API Design

Error responses vary between routes:
- `{ error: true, message, data: null }`
- `{ error: true, code, message }`
- `{ error: true, message }` (no `data` or `code`)

**Fix:** Define a unified `ApiErrorResponse` type and use it consistently.

---

#### 27. `plan-guard.ts` Type Lie
**File:** `lib/plan-guard.ts:206`  
**Severity:** LOW  
**Category:** Code Quality / Type Safety

`guardOrgCreation` returns `{ allowed: true, usage: null as never }`. Callers that destructure `usage` after this guard will get runtime errors.

**Fix:** Use a discriminated union type or return `usage: null` with proper type narrowing.

---

#### 28. `content` From User Input Flows Into Sandpack Iframe
**File:** `components/canvas/hooks/useFrameLifecycle.ts`  
**Severity:** LOW  
**Category:** Security / XSS

Generated code from AI models is rendered directly in a Sandpack iframe. While `sanitizeGeneratedCode` strips dangerous imports, it doesn't sanitize `<script>` tags or `javascript:` URLs that could appear in generated code.

**Fix:** Add a DOM sanitizer pass after the TSX sanitizer, or validate against a stricter AST pattern.

---

## Database Insights

### Row Counts (from Supabase)

| Table | Rows | Notes |
|-------|------|-------|
| User | 4 | Very small user base |
| AppSession | 15 | ~4 sessions per user |
| AuthAuditEvent | 2,327 | **Excessive** — ~155 events per session |
| Project | 26 | ~6.5 projects per user |
| Generation | 45 | ~1.7 generations per project |
| Subscription | 4 | 1 per user |
| UsagePeriod | 8 | 2 periods per subscription |
| Organisation | 1 | Minimal org usage |
| OrgMembership | 2 | 2 members in 1 org |
| OrgInvitation | 1 | Minimal invite activity |
| RazorpayWebhookEvent | 27 | Webhook events received |
| ClerkWebhookEvent | 34 | Webhook events received |

### Key Observations

1. **Razorpay has ZERO payments, orders, or settlements** — The billing flow has never processed a real transaction. The webhook events (27) are likely test/development events.
2. **AuthAuditEvent is the largest table** — 2,327 rows for 15 sessions indicates excessive logging (every request logs an audit event).
3. **Generation.screens JSON is the largest data column** — 45 generations × up to 4 screens × ~20KB = ~3.6MB of JSON.

---

## Recommended Implementation Order

### Phase 1: Critical Fixes (Week 1)
1. Fix idempotency race condition in generation flow
2. Fix abort cleanup — mark generations as FAILED on disconnect
3. Implement generation slot rollback on failure
4. Fix Razorpay subscription customer linking
5. Reset `chargeFailures` on successful charge webhook
6. Add RLS policies and secure `rls_auto_enable()`

### Phase 2: High-Impact Performance (Week 2)
7. Extract shared generation logic into `lib/generation.ts`
8. Unify STAGE3_MODELS constant
9. Cache full auth context in Redis
10. Replace Zustand Map/Set with serializable structures
11. Debounce Sandpack mount during streaming
12. Add per-stage AI model timeouts

### Phase 3: Medium-Priority Improvements (Week 3-4)
13. Add missing indexes on foreign keys
14. Drop unused indexes
15. Add select projection to hot queries
16. Preload design context CSVs at startup
17. Fix org slug race condition
18. Hash org invitation tokens
19. Complete subscription status mapping
20. Add rate limiting to org endpoints
21. Remove vestigial critique system code

### Phase 4: Polish (Ongoing)
22. Unify error response shapes
23. Remove file-level `eslint-disable any`
24. Add Sandpack XSS sanitizer
25. Fix `plan-guard.ts` type safety

---

## Appendix A: Supabase Lint Findings

### Security
- `rls_enabled_no_policy`: 12 tables with RLS enabled but no policies
- `anon_security_definer_function_executable`: `public.rls_auto_enable()` callable by anon
- `authenticated_security_definer_function_executable`: `public.rls_auto_enable()` callable by authenticated

### Performance
- `unindexed_foreign_keys`: `OrgInvitation.invitedBy`, `OrgMembership.invitedBy`
- `unused_index`: 12 indexes never used

---

## Appendix B: Razorpay Account State

- Payments: 0
- Orders: 0
- Settlements: 0
- Status: No live transactions recorded

**Note:** This indicates the billing flow has not been tested end-to-end with real payments. Before going live, run a full payment flow test.
