---
name: add-new-ui-section-or-component
description: Workflow command scaffold for add-new-ui-section-or-component in logic-ui-builder.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-new-ui-section-or-component

Use this workflow when working on **add-new-ui-section-or-component** in `logic-ui-builder`.

## Goal

Adds a new UI section or component to a page, often as part of feature or landing page development.

## Common Files

- `components/landing/*.tsx`
- `components/dashboard/*.tsx`
- `components/billing/*.tsx`
- `components/projects/*.tsx`
- `components/[area]/*.tsx`
- `components/landing/page.module.css`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create new component file(s) under components/[area]/
- Update the parent page/component to include the new section/component
- Optionally update related style files (e.g., page.module.css)
- Optionally update navigation or related UI

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.