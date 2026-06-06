Make Studio changes for UI,
aadd Reminder for Future Session

Invoice / Receipt History (answer #13)
Users expect to see past invoices and receipts in their billing dashboard. This requires:

- Storing invoice objects from Razorpay webhooks (invoice.paid events)
- A new Invoice table with razorpayInvoiceId, subscriptionId, amount, status, periodStart, periodEnd, pdfUrl
- A GET /api/billing/invoices endpoint
- UI list in BillingPageClient

---

Remaining architecture observations

1. Stringly-typed Invoice.status: The Invoice model stores status as a plain String. For consistency with the rest of the schema (e.g. SubscriptionStatus enum), consider a InvoiceStatus enum (PAID, ISSUED, CANCELLED,
   EXPIRED). This would require a follow-up migration.
2. Webhook idempotency: The razorpayWebhookEvent table is used for idempotency, but subscription.charged invoice fetch is now fire-and-forget. If the fetch fails (network blip), the next duplicate webhook won't retry
   the fetch because the event is already marked processed. This is acceptable because the invoice data is supplementary, but if you need stronger guarantees, move invoice capture to a background job (e.g. Upstash
   QStash).
3. No PDF download: Confirmed Razorpay subscription invoices do not expose a receipt PDF. The in-app modal is the correct approach.
4. Dashboard navigation: Billing and Org links added to Clerk UserButton.MenuItems in Dashboard.tsx.

Do you want me to address the InvoiceStatus enum migration, or is the current implementation sufficient for now?

---

The current fixes are band-aids. For a scalable generation system, the architecture needs three decoupled layers: a Validation Engine, a Model Executor, and a Pipeline Orchestrator. Here's the architecture I'd  
 recommend:

1. Validation Engine (lib/validation/engine.ts)

Replace the inline validateGeneratedTSX regex with a dedicated two-phase validator:

- Structural Phase: Fast checks (brace balance, export presence) — O(n) string scan.
- Compilation Phase: ts.createSourceFile with ts.ScriptKind.TSX to catch real parse errors. This uses the same parser already powering generatedCodeSanitizer.ts, so we know it works.
- Sandbox Phase (future): Pipe the sanitized code through a lightweight esbuild or Sandpack compile to catch JSX transformation errors the TS parser misses.

Key benefit: validation is no longer heuristic. If the TS parser accepts it, the code is structurally valid. Self-closing tags, fragments, and conditional JSX will never false-positive again.

2. Model Executor (lib/execution/modelExecutor.ts)

Encapsulate every model call with explicit signal separation:

type ModelResult = { success: true; code: string; usage: Usage } | { success: false; reason: "timeout" | "client_abort" | "error"; error: Error };

- Client AbortSignal (req.signal): wired to the pipeline level. If triggered, the entire generation stops immediately.
- Model TimeoutSignal: per-call, configurable per model (e.g., qwen3-coder-next:cloud → 60s, kimi-k2.6:cloud → 300s). If triggered, only that model call fails, and the executor returns reason: "timeout" so the
  orchestrator can try the next model.
- Generation TimeoutSignal: hard ceiling (e.g., 10 minutes). If triggered, the entire generation fails with a clear error message.

This fixes the conflation bug where a 120s model timeout is currently misinterpreted as "client disconnect" and aborts the whole generation.

3. Pipeline Orchestrator (lib/execution/generationPipeline.ts)

Separate the retry/fallback strategy from the route handler:

async function generateScreen(pipeline: PipelineContext, screen: string): Promise<ScreenResult>

Strategy:

- On validation failure, do not burn 3 retries on the same model. Try once, then immediately fallback to the next model in stage3ModelPriority. If all models exhaust, return a fallback static screen — the generation
  still succeeds with a degraded frame rather than a hard error.
- On model failure/timeout, automatically advance to the next model. No retry loop on the same model.
- On client abort, immediately cascade cancellation to all in-flight model calls.

This prevents the token waste you see in the logs: instead of 3× ~14K token retries on kimi-k2.6, the pipeline tries kimi-k2.6 once, validates with the TS parser, and if valid, proceeds. If invalid, it falls back to
qwen3-coder-next (or whatever is next in priority).

4. Route Handler Refactor

Both app/api/generate/route.ts and app/api/generate/[frameId]/route.ts slim down to:

1. Parse request, guard plan limits.
2. Build PipelineContext (spec, tree, designContext, modelPriority, abortSignals).
3. Call generationPipeline.run(context) — the pipeline handles all model calls, validation, retries, and streaming.
4. Stream events back via the existing SSE writer.

The route handler should not contain retry loops, model iteration, or validation logic. It should only orchestrate the HTTP lifecycle.

Files to Create/Refactor

┌─────────────────────────────────────┬────────────────────────────────────────┐
│ New File │ Purpose │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ lib/validation/engine.ts │ TS-parser-based validation │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ lib/execution/modelExecutor.ts │ Per-model calls with separated signals │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ lib/execution/generationPipeline.ts │ Retry/fallback/orchestration logic │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ lib/execution/types.ts │ Shared types for the execution layer │
└─────────────────────────────────────┴────────────────────────────────────────┘

┌─────────────────────────────────────┬─────────────────────────────────────────────────────────────┐
│ Refactored File │ Change │
├─────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ lib/prompts.ts │ Remove validateGeneratedTSX, keep fast structural helpers │
├─────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ lib/generation.ts │ Remove createModelAbortSignal, keep model selection helpers │
├─────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ app/api/generate/route.ts │ Remove retry loops, delegate to pipeline │
├─────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ app/api/generate/[frameId]/route.ts │ Same simplification │
└─────────────────────────────────────┴─────────────────────────────────────────────────────────────┘

Should I implement this architecture? It will touch ~6 files, remove ~100 lines of duplicated retry logic from the route handlers, and eliminate both the false validation failures and the mid-generation aborts.

---

What Else Can Be Improved

Beyond the three-layer refactor, here are the highest-leverage opportunities I see in the codebase:

1. Pre-Sandpack Compile Validation (High Impact)

The TS parser catches structural syntax errors, but it does not catch invalid Tailwind classes, missing imports, or JSX transformation failures. Sandpack currently catches these client-side, which wastes a round-trip.

Scope: Add a lightweight esbuild or swc compile pass (without React runtime) after sanitizeGeneratedCode() in the pipeline. If compilation fails, fall back to the next model with the actual error diagnostics.

2. Parallel Screen Generation (Medium-High Impact)

app/api/generate/route.ts generates screens sequentially in a for...of loop. If a project has 4 screens, that's 4× latency.

Scope: Generate screens concurrently with a configurable concurrency limit (e.g., 2 at a time to avoid overwhelming Ollama). The SSE writer already supports interleaved code_chunk events per screen/frame.

3. Streaming Partial Validation (Medium Impact)

Currently, the entire ~6K token response is accumulated into currentCode before validateGeneratedTSX runs.

Scope: Stream the code into an incremental brace/tag balancer. If the opening brace depth goes negative or a tag is never closed by the time the stream ends, fail fast before calling sanitizeGeneratedCode. This doesn't
replace the full TS parse, but it prevents burning tokens on obviously truncated output.

4. Intelligent Model Routing (Medium Impact)

stage3ModelPriority is static: [preferredModel, ...defaults].

Scope: Route based on screen type. Dashboards with data tables → kimi-k2.6:cloud (better at structured code). Simple landing pages → qwen3-coder-next:cloud (faster, cheaper). This requires tracking historical success
rates per model per screen category.

5. Resume on Client Reconnect (Medium Impact)

If the user refreshes the page during a 3.5 min generation, the abortController kills everything and the generation is lost.

Scope: The server already has idempotencyKey and persists Generation records. The client could reconnect with the same idempotency key and the server could stream the existing generation progress (or the final result
if already complete) instead of restarting.

6. Diff-Based Repair Instead of Full Regeneration (High Impact, Harder)

buildCompileRepairPrompt tells the model: "Regenerate the full component from scratch." This is the most expensive possible repair strategy.

Scope: On validation failure, feed the broken code + specific diagnostics back to the model and ask for only the fixes (or a small patch). This requires the model to handle edit instructions, but it would cut repair
tokens by ~80%.

7. Frame Regeneration Context Reuse (Low-Medium Impact)

When regenerating a single frame (/api/generate/[frameId]), the route re-runs stage 1 (spec extraction) and stage 2 (component tree) even though the project spec hasn't changed.

Scope: Cache the WebAppSpec and ComponentTreeNode[] in the Generation record. Frame regeneration should skip straight to stage 3 with the cached context.

---

Recommended Priority

If you want the biggest ROI with the least risk:

1. Implement the three-layer architecture (validation engine + model executor + pipeline) — fixes the immediate fires.
2. Add the esbuild pre-compile pass — catches the remaining class of errors before they reach the user.
3. Parallel screen generation — cuts multi-screen latency in half.
4. Skip stage 1/2 on frame regeneration — trivial win, just read cached spec from the DB.

The diff-based repair (#6) is the highest long-term token saver but requires prompt engineering work. I'd defer it until the pipeline is stable.

Exclusions (Out of Scope for This Pass)

     - Resume on client reconnect: Requires idempotency streaming changes. Complex, deferred.
     - Diff-based repair prompts: Requires prompt engineering for patch generation. High impact but needs careful testing.
     - Intelligent model routing by screen type: Requires historical telemetry. Future optimization.
