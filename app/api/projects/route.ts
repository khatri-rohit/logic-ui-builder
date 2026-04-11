import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";

import prisma from "@/lib/prisma";
import { initializeOllama } from "@/lib/ollama";
import logger from "@/lib/logger";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";

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
    const platform =
      typeof body.platform === "string" ? body.platform.trim() : "";

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

    const spec = getSpecForPrompt(prompt);
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

    const newProject = await prisma.project.create({
      data: {
        userId: authContext.appUserId,
        title: projectTitle || "Untitled Project",
        description: projectDescription || "",
        initialPrompt: prompt,
        platform: platform ?? spec,
      },
    });

    // logger.info("Created new project from prompt", newProject);

    return NextResponse.json(
      {
        error: false,
        data: {
          projectId: newProject.id,
          // title: newProject.title,
          // description: newProject.description,
          // spec,
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
      },
      { status: 500 },
    );
  }
}

function getSpecForPrompt(prompt: string) {
  const lowerPrompt = prompt.toLowerCase();

  if (
    lowerPrompt.includes("web") ||
    lowerPrompt.includes("website") ||
    lowerPrompt.includes("web app")
  ) {
    return "web";
  } else if (
    lowerPrompt.includes("mobile") ||
    lowerPrompt.includes("ios") ||
    lowerPrompt.includes("iphone") ||
    lowerPrompt.includes("android") ||
    lowerPrompt.includes("app")
  ) {
    return "mobile";
  }

  return "web";
}
