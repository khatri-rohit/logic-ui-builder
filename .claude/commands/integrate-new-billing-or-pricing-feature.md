---
name: integrate-new-billing-or-pricing-feature
description: Workflow command scaffold for integrate-new-billing-or-pricing-feature in logic-ui-builder.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /integrate-new-billing-or-pricing-feature

Use this workflow when working on **integrate-new-billing-or-pricing-feature** in `logic-ui-builder`.

## Goal

Implements or updates billing, pricing, or subscription features, including backend API, models, and UI integration.

## Common Files

- `app/api/billing/*.ts`
- `components/billing/*.tsx`
- `components/dashboard/*.tsx`
- `lib/billing/*.ts`
- `lib/plans.ts`
- `lib/razorpay.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or update API route(s) under app/api/billing/
- Update or add new components under components/billing/ or components/dashboard/
- Modify or extend billing logic in lib/ (e.g., lib/billing, lib/plans, lib/razorpay)
- Update Prisma schema and generate new migration(s)
- Update or add relevant pages (e.g., app/billing/...)

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.