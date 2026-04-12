import { NextRequest, NextResponse } from "next/server";
import { Client } from "@upstash/qstash";

import prisma from "@/lib/prisma";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";

import logger from "@/lib/logger";

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

    const body = (await req.json()) as { prompt?: unknown; platform?: unknown };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json(
        {
          error: true,
          message:
            "Invalid prompt. Please provide a prompt to create a design.",
        },
        { status: 400 },
      );
    }

    const newProject = await prisma.project.create({
      data: {
        userId: authContext.appUserId,
        title: "Untitled Project",
        description: "",
        initialPrompt: prompt,
        status: "PENDING",
      },
    });

    // Schedule a background task to process the project's meta-data (title, description) using the initial prompt.
    const result = await client.publishJSON({
      url: `${process.env.BACKGROUND_TASK_QUEUE_PUBLIC_URL}/api/projects/${newProject.id}/meta-data`,
      body: { projectId: newProject.id, prompt },
    });

    logger.info("Published project meta-data task to QStash", {
      projectId: newProject.id,
      qstashResult: result,
    });

    return NextResponse.json(
      {
        error: false,
        data: {
          projectId: newProject.id,
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

    logger.error("Error creating project from prompt:", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: true,
        message: "An error occurred while creating the project.",
        data: null,
        details: error,
      },
      { status: 500 },
    );
  }
}
