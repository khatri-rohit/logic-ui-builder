Make Studio changes for UI,
aadd Reminder for Future Session

Invoice / Receipt History (answer #13)
Users expect to see past invoices and receipts in their billing dashboard. This requires:

- Storing invoice objects from Razorpay webhooks (invoice.paid events)
- A new Invoice table with razorpayInvoiceId, subscriptionId, amount, status, periodStart, periodEnd, pdfUrl
- A GET /api/billing/invoices endpoint
- UI list in BillingPageClient

Here are the UI changes we need make

########## One Bug noticed On webhook complete it dones't set the palnId to subscribed Id it still shows Free.

Now I have a complete picture. Let me analyze the full architecture and design a strong fix.

  Key findings from the frame regeneration endpoint (app/api/generate/[frameId]/route.ts):
  - It already sends frameId in its events (frame_start, frame_reset, code_chunk, frame_done)
  - The client-side frame regeneration handler (handleFrame in ProjectStudioClient.tsx) uses id directly because it already knows the frame ID
  - The abort handler in the frame regeneration endpoint writes the failed frame properly (lines 576-600)

  So the frame regeneration flow is actually more correct than the full generation flow. The full generation flow is where the problems are.

  Now let me design the strong architecture fix:

  Core Architectural Issue

  The Generation.screens field is written by two independent actors (API and client) using different frame identifiers. This creates a split-brain problem where the database can end up with:
  - Frames the API knows about but the client doesn't
  - Frames the client knows about but the API doesn't
  - Partial overwrites that lose data

  Strong Architecture: Unified Generation Protocol

  Principle: The API is the single source of truth for frame identity and generation content. The client is the single source of truth for canvas geometry and user interactions. They communicate via a well-defined SSE
  protocol.

  Changes:

  1. API assigns frame IDs upfront and communicates them to the client
  2. Client uses API frame IDs for all local frame state
  3. API writes complete Generation.screens on both success and abort
  4. Server PATCH merges generation screens by frame ID when the generation is still RUNNING, to prevent concurrent overwrites from losing data
  5. Client properly aborts fetch on unmount and does an immediate final flush

  This doesn't require schema changes. It's a protocol and logic fix.

  Let me now enter plan mode and present this to the user for approval, then implement.

  Actually, the user said "apply fixes and fix the issues." They want me to implement. Let me create a task list and start working.

  Let me plan the implementation carefully:

  Files to modify:

  1. app/api/generate/route.ts
    - Generate frame IDs after position calculation
    - Add layout SSE event with screen name, frame ID, position, dimensions
    - Add frameId to screen_start, screen_reset, code_chunk, screen_done
    - In abort handler: ensure ALL screens (completed + interrupted) are in persistedScreens
    - Frame regeneration section already uses targetFrameId, include it in events
  2. components/projects/ProjectStudioClient.tsx
    - Update GenerationEvent type to add layout and frameId fields
    - Add layout event handler to create skeleton frames
    - Remove frame creation from spec handler (just store spec reference)
    - Update screen event handlers to use frameId directly
    - Add component-scoped AbortController for generation fetch
    - Restructure unmount cleanup to always flush snapshot
  3. app/api/projects/[id]/route.ts
    - Add mergeGenerationScreens utility
    - In PATCH, when updating generation screens and generation status is RUNNING, merge by frame ID instead of replacing
  4. lib/api/types.ts or wherever the event types need updating
