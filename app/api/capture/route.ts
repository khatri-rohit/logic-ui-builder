import { NextRequest, NextResponse } from "next/server";
import { captureProjectThumbnail } from "@/lib/capture";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import logger from "@/lib/logger";
import prisma from "@/lib/prisma";

const PROJECT_ID_PATTERN = /^c[a-z0-9]{24}$/;

export const runtime = "nodejs";

function parseCapturePayload(payload: unknown): {
  projectId: string;
  url: string;
} | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as { projectId?: unknown; url?: unknown };

  if (
    typeof candidate.projectId !== "string" ||
    typeof candidate.url !== "string"
  ) {
    return null;
  }

  const projectId = candidate.projectId.trim();
  const url = candidate.url.trim();
  if (!projectId || !url) {
    return null;
  }

  return { projectId, url };
}

export async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "project.thumbnail.capture",
    });

    let rawPayload: unknown;
    try {
      rawPayload = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: true,
          code: "VALIDATION_ERROR",
          message: "Invalid JSON payload",
          data: null,
        },
        { status: 400 },
      );
    }

    const payload = parseCapturePayload(rawPayload);
    if (!payload) {
      return NextResponse.json(
        {
          error: true,
          code: "VALIDATION_ERROR",
          message: "projectId and url are required",
          data: null,
        },
        { status: 400 },
      );
    }

    const { projectId, url } = payload;

    if (!PROJECT_ID_PATTERN.test(projectId)) {
      return NextResponse.json(
        {
          error: true,
          code: "VALIDATION_ERROR",
          message: "Invalid project ID",
          data: null,
        },
        { status: 400 },
      );
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      return NextResponse.json(
        {
          error: true,
          code: "VALIDATION_ERROR",
          message: "Invalid capture URL",
          data: null,
        },
        { status: 400 },
      );
    }

    const requestOrigin = new URL(req.url).origin;
    if (targetUrl.origin !== requestOrigin) {
      return NextResponse.json(
        {
          error: true,
          code: "INVALID_CAPTURE_ORIGIN",
          message: "Capture URL must match the current app origin",
          data: null,
        },
        { status: 400 },
      );
    }

    if (targetUrl.pathname !== `/projects/${projectId}`) {
      return NextResponse.json(
        {
          error: true,
          code: "INVALID_CAPTURE_PATH",
          message: "Capture URL must target the current project page",
          data: null,
        },
        { status: 400 },
      );
    }

    const project = await prisma.project.findUnique({
      where: {
        id: projectId,
        userId: authContext.appUserId,
      },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        {
          error: true,
          message: "Project not found",
          data: null,
        },
        { status: 404 },
      );
    }

    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) {
      return NextResponse.json(
        {
          error: true,
          code: "AUTH_REQUIRED",
          message: "Missing authenticated session context for capture",
          data: null,
        },
        { status: 401 },
      );
    }

    logger.info("Capturing project thumbnail via Puppeteer", {
      projectId,
      userId: authContext.appUserId,
      url: targetUrl.toString(),
    });

    const buffer = await captureProjectThumbnail(targetUrl.toString(), {
      cookieHeader,
    });

    const screenshotBytes = Uint8Array.from(buffer);

    return new NextResponse(
      new Blob([screenshotBytes], { type: "image/jpeg" }),
      {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        {
          error: true,
          code: error.code,
          message: error.message,
          data: null,
        },
        { status: error.status },
      );
    }

    logger.error("Thumbnail capture API failed:", error);
    return NextResponse.json(
      {
        error: true,
        message: "Failed to capture thumbnail",
        data: null,
      },
      { status: 500 },
    );
  }
}
