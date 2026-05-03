# UI/UX Builder

## Vision & Project Goal

The **UI/UX Builder** is an experimental, enterprise-grade application aimed at revolutionizing mobile interface design and prototyping. By leveraging large language models (LLMs) and local AI inference tools via Ollama, the platform provides an intelligent, generative UI workflow directly within an infinite canvas environment.

Our goal is to dramatically reduce the time from conception to functioning prototype. Designers, product managers, and developers can input high-level prompts and instantly receive multiple functioning, side-by-side frontend screens. Rather than static images, the generated designs are rendered as interactive web components using a powerful Sandpack-based compiler, making it seamless to transition from design to actual source code.

## Architecture & Tech Stack

This project is built using modern web standards to ensure scalability, robust performance, and rapid iterations.

- **Framework**: Next.js 16 (App Router) & React 19
- **Infinite Canvas**: [tldraw](https://tldraw.dev) (Enabling a Figma-like workspace)
- **Live Code Compilation**: CodeSandbox Sandpack Client & Web Workers
- **AI Backend**: Vercel AI SDK (`ai`) paired with local inference (`ollama-ai-provider-v2`)
- **Styling & UI**: Tailwind CSS v4, Radix UI, and Shadcn components
- **Language**: TypeScript throughout

## Current Stage: Minimum Viable Product (Phase 1)

The platform is currently in its Phase 1 MVP status, focusing on the core generative and viewing capabilities:

- **Prompt-Driven Generation**: Input natural language prompts to automatically generate UI screens.
- **Multiple Screen Generation**: Build and output several views simultaneously.
- **Infinite Canvas Workspace**: A fully interactive canvas (powered by tldraw) natively supporting zooming and panning.
- **Drag & Drop Artboards**: Phone-framed artboards that can be manipulated freely across the workspace.
- **Side-by-Step Layout**: Live orchestration of screens positioned organically for UX flow mapping.
- **Immediate Live Previews**: Rendered using an in-browser compilation step (via Sandpack).

## Getting Started

### Prerequisites

- Node.js (v20+ recommended)
- Optional: Local [Ollama](https://github.com/jmorganca/ollama) server running if evaluating local open-source models

### Installation

1. Clone the repository and navigate into the workspace:

   ```bash
   cd ui-ux-builder
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:3000/`.

## Authentication and OAuth

Authentication is powered by Clerk with custom UI flows in `components/auth`.

- Email/password sign-in and sign-up are handled in custom forms.
- Google and GitHub OAuth are available inside custom sign-in and sign-up forms.
- Landing provider CTAs route through sign-in preselection:
  - `/sign-in?provider=google`
  - `/sign-in?provider=github`
- OAuth callback is handled at `/sign-in/sso-callback`.

Required auth environment variables:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SIGNING_SECRET=
```

Optional compatibility key:

```env
CLERK_WEBHOOK_SECRET=
```

Advanced optional overrides (only for non-default Clerk setups):

```env
CLERK_API_URL=
CLERK_API_VERSION=v1
CLERK_JWT_KEY=
```

## Prisma + Supabase (Prisma ORM v7)

This project is configured for Prisma ORM v7 with Supabase Postgres and separates runtime database access from Prisma CLI migrations.

- Runtime Prisma Client uses `DATABASE_URL` (pooled connection).
- Prisma CLI and migrations use `PRISMA_DIRECT_URL` (direct connection) via `prisma.config.ts`.

### Environment Variables

Copy `.env.example` values into your local `.env` and replace `[YOUR-PASSWORD]`:

```env
# Runtime Prisma Client usage (Supabase pooled connection)
DATABASE_URL="postgresql://postgres.grlntfzdslmklimerevx:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Prisma CLI and migrations (direct connection, preferred)
PRISMA_DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
```

If direct host access is not available (for example on IPv4-only environments),
you can use the Supabase session pooler on port `5432` as a fallback `PRISMA_DIRECT_URL`.

### Supabase Storage S3 (Project Thumbnails)

Project thumbnails are uploaded from the API route to Supabase Storage through the
S3-compatible endpoint.

Required environment variables:

```env
SUPABASE_STORAGE_S3_ENDPOINT="https://[YOUR-PROJECT-REF].storage.supabase.co/storage/v1/s3"
SUPABASE_STORAGE_S3_REGION="[YOUR-PROJECT-REGION]"
SUPABASE_STORAGE_S3_ACCESS_KEY_ID="[SUPABASE-S3-ACCESS-KEY-ID]"
SUPABASE_STORAGE_S3_SECRET_ACCESS_KEY="[SUPABASE-S3-SECRET-ACCESS-KEY]"
SUPABASE_STORAGE_BUCKET="[YOUR-PUBLIC-BUCKET]"
SUPABASE_STORAGE_PUBLIC_BASE_URL="https://[YOUR-PROJECT-REF].supabase.co/storage/v1/object/public"
```

Notes:

- Generate S3 access keys from Supabase Dashboard: Storage -> Settings -> S3 access keys.
- Use a public bucket for direct thumbnail rendering via `thumbnailUrl`.
- Keep S3 credentials server-only and never expose them in client-side code.

### Prisma Commands

```bash
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate:dev
npm run prisma:studio
```

### App Router Health Check Route

Use the App Router API route at `/api/db/health` to verify Prisma can query Supabase safely.

## Enterprise Roadmap

### Phase 2: Interactivity & Node-Level Editing

- Node and element selection tools.
- Granular Property Inspector (styling, properties, constraints).
- Drag-and-drop layer reordering.
- Fluid artboard resizing and customizable device templates.
- Target regeneration of a single selected screen without affecting the workflow.

### Phase 3: Systems & Exporting

- Flow connectors mapping user journeys between screens.
- Reusable component architecture and template libraries.
- Standardized exports to PNG, PDF, and React/Next.js package drops.

---

_Note: This platform pushes the boundaries of localized generative AI. Expect active updates as we stabilize the AI prompting and compiler pipelines._
