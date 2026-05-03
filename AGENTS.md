# PROJECT KNOWLEDGE BASE

**Generated:** May 3, 2026
**Branch:** main

## OVERVIEW

AI-powered UI design tool with infinite canvas. Users describe UIs → AI generates live Sandpack-rendered components. Built on Next.js 16 + React 19, tldraw canvas, Ollama local inference.

## STRUCTURE
```
./
├── app/                 # Next.js App Router pages
├── components/
│   ├── canvas/        # tldraw integration
│   ├── ui/          # shadcn components
│   └── landing/     # Marketing pages
├── lib/               # Core: prompts.ts (42k), designContext.ts, AI utilities
├── prisma/            # ORM schema (Supabase)
├── providers/         # React contexts
└── stores/           # Zustand state
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|---------|-------|
| AI prompts | `lib/prompts.ts` | 42k file - 3-stage pipeline |
| Design context | `lib/designContext.ts` | Token system |
| Canvas logic | `components/canvas/` | tldraw integration |
| Auth | Clerk | `components/auth/` + `.clerk/` |
| DB schema | `prisma/schema.prisma` | Prisma 7 + Supabase |

## CODE MAP

| Symbol | Type | Location |
|--------|------|---------|
| `buildScreenPrompt()` | fn | `lib/prompts.ts:499` |
| `DesignContext` | class | `lib/designContext.ts` |
| `Canvas` | component | `components/canvas/canvas.tsx` |
| `generate` | API route | `app/api/generate/route.ts` |

## CONVENTIONS

- **shadcn/ui**: Components in `components/ui/` via `components.json`
- **Tailwind v4**: CSS-first, `@theme` in globals.css
- **AI pipeline**: 3-stage (Spec → Layout → Code) in `lib/prompts.ts`

## ANTI-PATTERNS (THIS PROJECT)

- DO NOT modify `lib/prompts.ts` without reading full 42k file
- DO NOT use `npx shadcn@latest` - use local CLI: `npx shadcn`
- AVOID raw CSS - use Tailwind tokens from `lib/designContext.ts`

## UNIQUE STYLES

- Sandpack live compilation for instant previews
- Ollama local inference (no external API required)
- Multi-model fallback: DeepSeek → Gemma4 → Qwen → MiniMax

## COMMANDS

```bash
npm run dev          # Start dev server
npm run build       # Production build
npm run lint       # ESLint
npm run prisma:studio  # DB GUI
```

## NOTES

- Local Ollama required for AI generation: `ollama serve`
- Supabase storage for project thumbnails
- Clerk for auth (custom UI in `components/auth/`)