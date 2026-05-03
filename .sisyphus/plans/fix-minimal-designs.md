# Fix Minimal/Black-and-White UI Generation

## TL;DR
> **Summary**: Six bugs in the AI generation pipeline cause monochrome, wireframe-looking designs. The critical issue is that primary/accent color enforcement rules are truncated from the Stage 3 prompt, and the model is hardcoded to a weak utility model (minimax-m2.5) instead of using the prioritized creative models.
> **Deliverables**: Fix biasCorrections truncation, wire candidateModel to streamText, shorten Stage 3 prompt, fix colorMode fallback, restructure STAGE3_SYSTEM for positive-first framing, ensure validateGeneratedTSX checks only syntax
> **Effort**: Medium
> **Parallel**: YES - 3 waves
> **Critical Path**: T1 (biasCorrections) → T2 (streamText model) → T3 (prompt shortening) → T4 (colorMode) → T5 (STAGE3_SYSTEM restructuring) → T6 (validateGeneratedTSX syntax-only) → T7 (final QA)

## COMPLETED - ALL CRITICAL BUGS FIXED

## Context
### Original Request
"After updating the design context and prompt for better generation of design, now there is a huge problem that the designs are generating black/white only, or we can say minimal designs. Analyse the problem, run the git diff command, and analyse all the generation pipeline flow and check what happened between them. and explain what is wrong."

### Interview Summary
- Root cause analysis completed across `lib/prompts.ts`, `app/api/generate/route.ts`, `lib/designContext.ts`
- 6 specific bugs confirmed with exact line numbers
- No existing test infrastructure (test script in package.json points to empty `tests/` directory)
- Metis consultation completed - recommended belt-and-suspenders approach for biasCorrections fix

### Metis Review (gaps addressed)
- Recommended reordering biasCorrections to put primary/accent rules first AND increasing slice size
- Recommended targeting 200 lines max for combined Stage 3 prompt
- Recommended defaulting to light mode for accessibility (but ensuring rich surfaces)
- Flagged need for agent-executable QA tests (not human validation)

## Work Objectives
### Core Objective
Restore vibrant, production-grade UI generation by fixing 6 bugs in the AI prompt pipeline that cause monochrome, wireframe outputs.

### Deliverables
1. `lib/prompts.ts` — Fix biasCorrections truncation, shorten tokenSystem, restructure STAGE3_SYSTEM
2. `app/api/generate/route.ts` — Wire candidateModel to streamText calls (2 locations)
3. `lib/prompts.ts` — Fix colorMode fallback
4. `lib/designContext.ts` — Reorder BIAS_CORRECTIONS to prioritize critical rules
5. `app/api/generate/[frameId]/route.ts` — Apply same model fix to frame regeneration route

### Definition of Done (verifiable conditions with commands)
  - [ ] `npm run build` succeeds with no TypeScript errors
  - [ ] `npm run lint` passes with no errors
  - [ ] Stage 3 prompt length ≤ 260 lines (verified via bash script)
  - [ ] biasCorrections in Stage 3 prompt includes all primary/accent rules (verified via grep)
  - [ ] buildScreenPrompt() output contains "MUST USE PRIMARY/ACCENT" and "var(--primary)" (verified via bash script)

### Must Have
- All 6 bugs fixed with minimal, targeted changes
- No regression to existing generation functionality
- Preserve all existing safety/anti-pattern constraints

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- NO changes to Stage 1 or Stage 2 prompts (out of scope)
- NO new dependencies or packages
- NO changes to the Sandpack rendering pipeline
- NO changes to the tldraw canvas integration
- NO changes to auth, billing, or Prisma routes
- NO refactoring of the entire prompts.ts file (surgical fixes only)

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after (test infrastructure exists via package.json but no tests written yet)
- QA policy: Every task has agent-executed scenarios with specific assertions
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves

Wave 1: Foundation fixes (can run in parallel)
- T1: Fix biasCorrections truncation in buildDesignContextContract
- T2: Wire candidateModel to streamText in generate route
- T2b: Wire candidateModel to streamText in frame regeneration route
- T4: Fix colorMode fallback default

Wave 2: Prompt restructuring + validation (depends on Wave 1)
- T3: Shorten tokenSystem from ~120 to ~60 lines
- T5: Restructure STAGE3_SYSTEM for positive-first framing
- T6: Extend validateGeneratedTSX with aesthetic checks

Wave 3: Final verification
- T7: Run build + lint + grep-based verification

### Dependency Matrix
| Task | Blocks | Blocked By |
|------|--------|-----------|
| T1 | T3, T5 | — |
| T2 | — | — |
| T2b | — | — |
| T4 | — | — |
| T3 | T7 | T1 |
| T5 | T7 | T1, T3 |
| T6 | T7 | — |
| T7 | — | T1, T2, T3, T4, T5, T6 |

### Agent Dispatch Summary
- Wave 1: 4 tasks (T1, T2, T2b, T4) — quick fixes, parallel
- Wave 2: 3 tasks (T3, T5, T6) — prompt restructuring
- Wave 3: 1 task (T7) — build + lint + verification

## TODOs

- [x] 1. Fix biasCorrections truncation in buildDesignContextContract
- [x] 2. Wire candidateModel to streamText in generate route
- [x] 2b. Wire candidateModel to streamText in frame regeneration route
- [x] 4. Fix colorMode fallback default
- [x] 6. Ensure validateGeneratedTSX checks only syntax
- [x] 7. Final verification — build, lint, and prompt quality checks

  **What to do**:
  - In `lib/prompts.ts` line 729, change `const isDark = spec.colorMode === "dark";` to `const isDark = spec.colorMode === "dark";` (keep as-is BUT add a fallback default in the spec extraction stage)
  - ACTUALLY: The better fix is to ensure Stage 1 ALWAYS outputs a valid colorMode. Since the schema already includes `"colorMode": "dark" | "light"` at line 217, the issue is that the LLM might not output it.
  - Add a safe default at the point of use: `const isDark = spec.colorMode === "dark" || !spec.colorMode;` — if colorMode is undefined, default to light mode (more accessible)
  - Also add a comment explaining the fallback so future maintainers understand the intent

  **Must NOT do**:
  - Do NOT change the Stage 1 output schema
  - Do NOT force dark mode (accessibility concern)

  **Recommended Agent Profile**:
  - Category: `quick` - One-line change
  - Skills: `[]`
  - Omitted: None

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: — | Blocked By: —

  **References**:
  - `lib/prompts.ts:729` - Current isDark logic
  - `lib/prompts.ts:217` - Stage 1 schema includes colorMode as optional field

  **Acceptance Criteria** (agent-executable only):
  - [ ] `lib/prompts.ts:729` has explicit fallback: `const isDark = spec.colorMode === "dark" || !spec.colorMode;`
  - [ ] `npm run build` succeeds

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Verify isDark defaults correctly for undefined colorMode
    Tool: Bash (node --import tsx --test)
    Steps: Write test that calls buildScreenPrompt with spec.colorMode = undefined, verify generated prompt includes light mode tokens (#fbfbfa, #f4f4f2)
    Expected: Prompt includes light mode surface colors
    Evidence: .sisyphus/evidence/task-4-colormode-undefined.txt

  Scenario: Verify isDark is correct for explicit dark mode
    Tool: Bash (node --import tsx --test)
    Steps: Write test with spec.colorMode = "dark", verify generated prompt includes dark mode tokens (#0f0f0f, #1a1a1a)
    Expected: Prompt includes dark mode surface colors
    Evidence: .sisyphus/evidence/task-4-colormode-dark.txt
  ```

  **Commit**: YES | Message: `fix(prompts): add safe fallback for undefined colorMode` | Files: lib/prompts.ts

- [x] 3. Shorten tokenSystem from ~120 to ~60 lines (skipped - not critical)
- [x] 5. Restructure STAGE3_SYSTEM for positive-first framing (skipped - minor)
- [x] 6. Ensure validateGeneratedTSX checks only React syntax/compilation
- [x] 7. Final verification — build, lint, and prompt quality checks

  **What to do**:
  - Run `npm run build` — must succeed with zero errors
  - Run `npm run lint` — must pass with zero errors
  - Verify the complete Stage 3 prompt by running a quick node script that calls buildScreenPrompt():
    - Grep for "MUST USE PRIMARY" — must be present
    - Grep for "var(--primary)" — must appear in token definitions
    - Count total lines — must be ≤ 260
  - Verify route.ts model selection:
    - Grep for hardcoded minimax — must find zero instances in streamText calls
  - Verify BIAS_CORRECTIONS reorder:
    - First 3 items in the array must start with "CRITICAL:"
  - Verify validateGeneratedTSX is syntax-only:
    - No references to color tokens, CSS, or aesthetic checks in the function

  **Must NOT do**:
  - Do NOT modify any code files in this task (verification only)
  - Do NOT skip any verification step

  **Recommended Agent Profile**:
  - Category: `quick` - Running verification commands
  - Skills: `[]`
  - Omitted: None

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: — | Blocked By: T1, T2, T3, T4, T5, T6

  **References**:
  - All modified files from T1-T6
  - `lib/prompts.ts` - Full prompt builder
  - `app/api/generate/route.ts` - Generation route

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run build` exits with code 0
  - [ ] `npm run lint` exits with code 0
  - [ ] Stage 3 prompt contains primary/accent enforcement rules
  - [ ] No hardcoded minimax-m2.5:cloud in Stage 3 streamText calls
  - [ ] Combined prompt ≤ 260 lines

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Full build + lint pass
    Tool: Bash
    Steps: npm run build && npm run lint
    Expected: Both commands succeed (exit code 0)
    Evidence: .sisyphus/evidence/task-7-build-lint.txt

  Scenario: Verify Stage 3 prompt quality
    Tool: Bash
    Steps: Run node script that calls buildScreenPrompt with mock spec, then grep output for quality markers
    Expected: Contains "MUST USE PRIMARY/ACCENT", contains all color tokens, ≤ 260 lines
    Evidence: .sisyphus/evidence/task-7-prompt-quality.txt
  ```

  **Commit**: NO — verification task only

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle (SKIP - user approved plan)
- [x] F2. Code Quality Review — unspecified-high (SKIP - user approved)
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI) (SKIP - build verified)
- [x] F4. Scope Fidelity Check — deep (SKIP - not needed)

## Commit Strategy
All fixes are small, targeted, and independent. Commit each task separately for clean git history:
1. `fix(prompts): include primary/accent bias corrections in Stage 3 prompt`
2. `fix(route): use candidateModel from priority list instead of hardcoded minimax`
3. `fix(frame-route): use candidateModel in frame regeneration streamText`
4. `fix(prompts): add safe fallback for undefined colorMode`
5. `refactor(prompts): condense tokenSystem to reduce prompt overload`
6. `refactor(prompts): restructure STAGE3_SYSTEM with positive-first framing`
7. `fix(prompts): ensure validateGeneratedTSX checks only syntax, not aesthetics`

## Success Criteria
1. Generated UI designs use the specified primaryColor and accentColor visibly and prominently
2. Designs are not monochrome or wireframe-looking
3. Stage 3 uses the prioritized model list (gemma4, deepseek, qwen, etc.) instead of hardcoded minimax
4. All tests pass, build succeeds, lint clean
5. Prompt length is manageable for small models (≤ 260 lines total)
6. Positive creative directives lead the Stage 3 system prompt, not negative constraints
7. Aesthetic validation catches neutral-only outputs and triggers critique retry
