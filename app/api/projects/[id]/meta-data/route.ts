import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { generateText } from "ai";

import prisma from "@/lib/prisma";
import { initializeOllama } from "@/lib/ollama";
import logger from "@/lib/logger";

const PROJECT_ID_PATTERN = /^c[a-z0-9]{24}$/;
const MAX_METADATA_PROMPT_LENGTH = 10000;

interface MetaDataRouteContext {
  params: Promise<{ id: string }>;
}

export const POST = verifySignatureAppRouter(
  async (req: Request, context: MetaDataRouteContext) => {
    let body: { projectId?: unknown; prompt?: unknown };

    try {
      body = (await req.json()) as { projectId?: unknown; prompt?: unknown };
    } catch {
      return new Response("Request body must be valid JSON", { status: 400 });
    }

    const projectId =
      typeof body.projectId === "string" ? body.projectId.trim() : "";
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    const { id: routeProjectId } = await context.params;

    if (!routeProjectId || !PROJECT_ID_PATTERN.test(routeProjectId)) {
      return new Response("Invalid project route", { status: 400 });
    }

    if (projectId && projectId !== routeProjectId) {
      return new Response("Route/body projectId mismatch", { status: 400 });
    }

    if (!prompt) {
      return new Response("Prompt is required", { status: 400 });
    }

    if (prompt.length > MAX_METADATA_PROMPT_LENGTH) {
      return new Response(
        `Prompt is too long. Maximum ${MAX_METADATA_PROMPT_LENGTH} characters.`,
        { status: 400 },
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: routeProjectId },
      select: { id: true },
    });

    if (!project) {
      return new Response("Project not found", { status: 404 });
    }

    // Project meta-data processing logic
    const ollama = initializeOllama();
    const { text: projectTitle } = await generateText({
      model: ollama("gemma4:31b-cloud"),
      system:
        "Generate exactly one concise, descriptive project title from the user's prompt. Return only the title text as a single line. Do not provide options, explanations, discussion, quotes, numbering, labels, or any extra text.",
      prompt,
    });

    const { text: projectDescription } = await generateText({
      model: ollama("gemma4:31b-cloud"),
      system:
        "You are a helpful assistant that generates a very short description for a design project based on the user's prompt. The description should be concise and descriptive.",
      prompt,
    });

    logger.info("Generated project meta-data from prompt", {
      projectId: routeProjectId,
      projectTitle,
      projectDescription,
    });

    const normalizedTitle = projectTitle.trim() || "Untitled Project";
    const normalizedDescription = projectDescription.trim();

    await prisma.project.update({
      where: { id: routeProjectId },
      data: {
        title: normalizedTitle,
        description: normalizedDescription || null,
      },
    });

    return new Response(
      "Background meta-data processing completed for project " + routeProjectId,
    );
  },
);
