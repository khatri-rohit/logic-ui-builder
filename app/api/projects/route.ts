import { NextRequest, NextResponse } from "next/server";
import { Client } from "@upstash/qstash";
import { revalidateTag } from "next/cache";

import {
  GenerationPlatform as PrismaGenerationPlatform,
} from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import { projectWriteRatelimit } from "@/lib/ratelimit";
import {
  createProjectBodySchema,
  toValidationIssues,
} from "@/lib/schemas/studio";

import logger from "@/lib/logger";
import { guardProjectCreation } from "@/lib/plan-guard";

const client = new Client({
  token: process.env.QSTASH_TOKEN,
  retry: {
    retries: 3,
    backoff: (retry_count) => 2 ** retry_count * 20,
  },
});

// This API route will handle project creation based on user prompts from the landing page.
export async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "project.created",
    });

    if (!authContext.appUserId) {
      return NextResponse.json(
        {
          error: true,
          message: "Unauthorized: Missing user ID in auth context",
          data: null,
        },
        { status: 401 },
      );
    }

    try {
      const { success, limit, remaining, reset } =
        await projectWriteRatelimit.limit(authContext.appUserId);

      if (!success) {
        return NextResponse.json(
          {
            error: true,
            message: "Rate limit exceeded",
            data: null,
          },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": remaining.toString(),
              "X-RateLimit-Reset": reset.toString(),
            },
          },
        );
      }
    } catch (rateLimitError) {
      logger.error("projectWriteRatelimit.limit failed ", rateLimitError);

      return NextResponse.json(
        {
          error: true,
          message:
            "Project creation is temporarily unavailable. Please try again.",
          data: null,
        },
        { status: 503 },
      );
    }

    let rawBody: unknown;

    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: true,
          message: "Request body must be valid JSON.",
        },
        { status: 400 },
      );
    }

    const parsedBody = createProjectBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: true,
          code: "VALIDATION_ERROR",
          message: "Invalid project creation payload",
          issues: toValidationIssues(parsedBody.error),
        },
        { status: 400 },
      );
    }

    const guardResult = await guardProjectCreation(authContext);
    if (!guardResult.allowed) return guardResult.response;

    const { prompt, platform } = parsedBody.data;

    const newProject = await prisma.project.create({
      data: {
        userId: authContext.appUserId,
        title: "Untitled Project",
        description: "",
        initialPrompt: prompt,
        status: "PENDING",
        platform: platform
          ? (platform.toUpperCase() as PrismaGenerationPlatform)
          : PrismaGenerationPlatform.WEB,
      },
    });

    revalidateTag("projects:list", { expire: 0 });

    try {
      const queueBaseUrl = process.env.BACKGROUND_TASK_QUEUE_PUBLIC_URL;
      if (!queueBaseUrl)
        throw new Error("Missing BACKGROUND_TASK_QUEUE_PUBLIC_URL");

      const result = await client.publishJSON({
        url: `${queueBaseUrl}/api/background-jobs/projects/${newProject.id}/meta-data`,
        body: { projectId: newProject.id, prompt },
      });

      logger.info("Published project meta-data task to QStash", {
        projectId: newProject.id,
        qstashResult: result,
      });
    } catch (queueError) {
      logger.error("Project created but failed to enqueue meta-data task", {
        projectId: newProject.id,
        error:
          queueError instanceof Error ? queueError.message : String(queueError),
      });
      // Do not fail creation after successful DB write.
    }

    return NextResponse.json(
      {
        error: false,
        data: {
          projectId: newProject.id,
          platform:
            newProject.platform === PrismaGenerationPlatform.MOBILE
              ? "mobile"
              : "web",
        },
        message: "New project created successfully.",
      },
      { status: 201 },
    );
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        {
          error: true,
          code: error.code,
          message: error.message,
        },
        { status: error.status },
      );
    }

    logger.error("Error creating project from prompt:", { error });

    return NextResponse.json(
      {
        error: true,
        message: "An error occurred while creating the project.",
        data: null,
      },
      { status: 500 },
    );
  }
}
