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
   The application will be accessible at `http://localhost:3000/`. You can proceed to `http://localhost:3000/mvp` (or the root page) to access the canvas.

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
