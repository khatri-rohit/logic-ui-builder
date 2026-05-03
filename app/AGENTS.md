# app/ - Next.js App Router

Pages, API routes, layouts.

## DIRECTORIES

| Directory | Purpose |
|----------|---------|
| `app/api/` | API routes (generate, auth, billing) |
| `app/org/` | Organization routes |
| `app/projects/[id]/` | Project routes |
| `app/generated/` | Prisma generated types |

## KEY ROUTES

- `/` - Landing page
- `/sign-in`, `/sign-up` - Auth pages
- `/org/` - Organization dashboard
- `/projects/[id]/` - Project canvas
- `/api/generate/` - AI generation endpoint

## API ROUTES

| Route | Purpose |
|-------|---------|
| `/api/generate/` | AI UI generation |
| `/api/db/health/` | Prisma health check |

## NOTES

- Uses Next.js 16 App Router
- Clerk auth middleware in `.clerk/`
- Prisma schema in `prisma/schema.prisma`