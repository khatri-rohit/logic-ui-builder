# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered UI design tool with an infinite canvas. Users describe UIs in natural language, and a multi-stage AI pipeline generates live Sandpack-rendered React components. Built on Next.js 16 (App Router) + React 19, tldraw canvas, Ollama local inference, Prisma ORM v7 + Supabase, Clerk auth, and Razorpay billing.

## Common Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start the development server (runs `prisma generate` first via `predev`) |
| `npm run build` | Production build (runs `prisma generate` first via `prebuild`) |
| `npm run lint` | Run ESLint with the project's custom config |
| `npm run test` | Run Node.js built-in tests with tsx: `node --import tsx --test "tests/**/*.test.ts"` |
| `npm run prisma:generate` | Regenerate Prisma client to `app/generated/prisma` |
| `npm run prisma:validate` | Validate Prisma schema |
| `npm run prisma:migrate:dev` | Run Prisma migration in dev mode |
| `npm run prisma:studio` | Open Prisma Studio GUI |
| `npx shadcn` | Add shadcn/ui components (do NOT use `npx shadcn@latest`) |

The dev server runs at `http://localhost:3000`.

## High-Level Architecture

### AI Generation Pipeline
The core of the application is a 4-stage pipeline orchestrated in `app/api/generate/route.ts`:

1. **Spec Extraction** (`lib/prompts.ts`): Parses user intent into a structured `WebAppSpec` (screens, nav pattern, color mode, design DNA).
2. **Layout Planning** (`lib/prompts.ts`): Plans component hierarchy as `ComponentTreeNode[]`.
3. **Code Synthesis** (`lib/prompts.ts`): Generates TSX code using design tokens and component intelligence.
4. **Design Quality Critique** (`lib/prompts.ts`): Validates generated code against quality criteria with a circuit breaker (max 3 iterations). Invalid code triggers regeneration with appended fix instructions.

Key pipeline files:
- `lib/prompts.ts` — Core prompts, validation, design tokens, and critique system for all stages.
- `lib/designContext.ts` — Design intelligence, token system, and bias corrections.
- `lib/promptEnhancer.ts` — Prompt enhancement with design context.
- `lib/canvasLayout.ts` — Layout geometry for canvas positioning.
- `lib/generatedCodeSanitizer.ts` — Post-processing for generated TSX.

### Infinite Canvas & Live Preview
- **Canvas**: tldraw powers the Figma-like infinite canvas (`components/canvas/InfiniteCanvas.tsx`).
- **Frames**: Phone-framed artboards (`components/canvas/CanvasFrame.tsx`) are draggable, resizable, and selectable.
- **Live Compilation**: CodeSandbox Sandpack Client renders generated TSX directly in the browser.
- **State**: Canvas state is managed via a Zustand store (`stores/project-studio.ts`). Server state (projects, generations) uses TanStack Query.

### Auth & Organizations
- **Auth**: Clerk with fully custom UI flows in `components/auth/`.
- **OAuth**: Google and GitHub via Clerk; callback at `/sign-in/sso-callback`.
- **Organizations**: PRO users can create organizations (`app/org/`) with member invites and role-based access (Owner/Admin/Member).

### Database & ORM
- **Prisma ORM v7** with Supabase Postgres.
- **Connection Strategy**: Runtime uses `DATABASE_URL` (pooled). Prisma CLI and migrations use `PRISMA_DIRECT_URL` (direct), configured in `prisma.config.ts`.
- **Client Output**: Prisma client is generated to `app/generated/prisma/` (not `node_modules`). Import via `@/app/generated/prisma/client`.
- **Key Models**: `User`, `Project`, `Generation`, `Subscription`, `UsagePeriod`, `Organisation`, `OrgMembership`, `OrgInvitation`.

### Billing
- **Provider**: Razorpay (not Stripe).
- **Plans**: FREE, STANDARD, PRO with usage-based limits (generations, projects).
- **Webhooks**: `/api/webhooks/razorpay` handles subscription lifecycle events.
- **Plan Guarding**: `lib/plan-guard.ts` enforces limits before generation requests.

### Background Jobs & Rate Limiting
- **Queue**: Upstash QStash for scheduled background tasks (e.g., project metadata updates, feedback emails).
- **Rate Limiting**: Upstash Redis (`lib/ratelimit.ts`) guards AI generation endpoints.

### Styling & UI System
- **Tailwind CSS v4**: CSS-first configuration via `@theme` in `app/globals.css`. No `tailwind.config.js`.
- **shadcn/ui**: Components live in `components/ui/`. Configuration is in `components.json`.
- **Design Tokens**: Enforced in generated code via expanded token system in `lib/prompts.ts` (spacing, radius, shadows, semantic colors). ESLint plugin `eslint/design-tokens-plugin.js` bans hardcoded Tailwind colors and arbitrary spacing.
- **Icons**: Lucide React only (`lucide-react`). Emojis are banned in generated UI.

## Important Conventions

### Skill-First Workflow (Mandatory)
This repository uses a skill-first execution model defined in `.github/copilot-instructions.md`:
- **Before any action**, check if a workspace skill in `.github/skills/` or `.agents/skills/` applies.
- If a skill is relevant, invoke it first. Do not gather context or ask clarifying questions before checking skills.
- Read the skill source when used; do not rely on memory.
- Process skills (brainstorming, debugging) take priority over implementation skills.

### Code Conventions
- **TypeScript** throughout. Strict mode enabled.
- **Imports**: Use `@/` path aliases (e.g., `@/lib/prompts`, `@/components/ui/button`).
- **React Compiler**: Enabled in `next.config.ts`.
- **Sandpack Templates**: `lib/sandpackTemplate.ts` defines the runtime environment for generated code.
- **Canvas Persistence**: Auto-saved to canvas state and project `canvasState` JSON.

### Anti-Patterns to Avoid
- Do NOT modify `lib/prompts.ts` without reading the full file to understand stage interactions.
- Do NOT use `npx shadcn@latest` — use the local CLI: `npx shadcn`.
- Do NOT use hardcoded Tailwind color utilities (`bg-blue-500`, `text-gray-500`) or arbitrary pixel values in generated code.
- AVOID raw CSS in favor of Tailwind tokens.

## Directory Map

| Path | Purpose |
|------|---------|
| `app/` | Next.js App Router pages and API routes |
| `app/api/generate/` | Core AI generation pipeline endpoints |
| `app/api/webhooks/` | Clerk and Razorpay webhook handlers |
| `app/generated/prisma/` | Generated Prisma client and model types |
| `components/ui/` | shadcn/ui components |
| `components/canvas/` | tldraw canvas, frames, toolbar, error boundaries |
| `components/projects/` | Project studio UI, feedback form |
| `components/auth/` | Clerk custom auth flows |
| `lib/` | Core utilities, AI prompts, design context, billing logic |
| `lib/prompts.ts` | The 1,100+ line prompt and validation engine |
| `lib/api/` | HTTP client utilities |
| `lib/schemas/` | Zod schemas for API validation |
| `prisma/` | Schema, migrations, and Prisma config |
| `stores/` | Zustand stores (canvas state, user activity) |
| `providers/` | React context providers (Clerk, TanStack Query, themes) |
| `.github/skills/` | Workspace skills for skill-first workflow |
| `.agents/skills/` | Additional agent skills |
| `agent.md` | Comprehensive design generation audit and upgrade plan |
| `AGENTS.md` | Project knowledge base and code map |

## Environment Requirements

- **Node.js**: v20+
- **Ollama**: Local Ollama server must be running (`ollama serve`) for AI generation unless using cloud inference.
- **Database**: Supabase Postgres with pooled and direct connection strings.
- **Optional**: Upstash Redis and QStash for rate limiting and background jobs.

## Testing

Tests use Node.js built-in test runner with `tsx` for TypeScript execution. The `tests/` directory is currently empty; the project does not yet have test coverage.
