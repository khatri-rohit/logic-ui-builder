# lib/ - Core Utilities

AI pipeline, design system, utilities.

## FILES

| File | Purpose |
|------|---------|
| `prompts.ts` | 42k - 3-stage AI pipeline |
| `designContext.ts` | Design tokens, 8pt grid |
| `ollama.ts` | Local AI inference |
| `types.ts` | Shared TypeScript types |

## KEY EXPORTS

- `buildScreenPrompt()` - Main prompt builder
- `DesignContext` class - Token management
- API utilities in `lib/api/`

## NOTES

- `prompts.ts` contains DeepSeek, Gemma4, Qwen, MiniMax fallbacks
- Design tokens in `buildScreenPrompt()` function
- Prisma client: `lib/prisma.ts`