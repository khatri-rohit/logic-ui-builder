import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { generateText } from "ai";

import prisma from "@/lib/prisma";
import { initializeOllama } from "@/lib/ollama";
import logger from "@/lib/logger";
import { revalidateTag } from "next/cache";
import {
  projectMetadataJobBodySchema,
  projectRouteParamsSchema,
  toValidationIssues,
} from "@/lib/schemas/studio";

interface MetaDataRouteContext {
  params: Promise<{ id: string }>;
}

export const POST = verifySignatureAppRouter(
  async (req: Request, context: MetaDataRouteContext) => {
    const parsedParams = projectRouteParamsSchema.safeParse(
      await context.params,
    );
    if (!parsedParams.success) {
      return new Response(
        JSON.stringify({
          error: true,
          code: "VALIDATION_ERROR",
          message: "Invalid project route parameters",
          issues: toValidationIssues(parsedParams.error),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const routeProjectId = parsedParams.data.id;

    let rawBody: unknown;

    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: true,
          message: "Request body must be valid JSON",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const parsedBody = projectMetadataJobBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return new Response(
        JSON.stringify({
          error: true,
          code: "VALIDATION_ERROR",
          message: "Invalid project meta-data payload",
          issues: toValidationIssues(parsedBody.error),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { projectId, prompt } = parsedBody.data;

    if (projectId && projectId !== routeProjectId) {
      return new Response(
        JSON.stringify({
          error: true,
          message: "Route/body projectId mismatch",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
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

    revalidateTag("projects" + routeProjectId, "max");

    return new Response(
      "Background meta-data processing completed for project " + routeProjectId,
    );
  },
);
