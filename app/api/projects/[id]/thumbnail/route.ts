import { NextRequest, NextResponse } from "next/server";

import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import { uploadProjectThumbnailToStorage } from "@/lib/supabase-storage";

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const MAX_THUMBNAIL_SIZE_BYTES = 5 * 1024 * 1024;

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "project.thumbnail.updated",
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

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        {
          error: true,
          message: "Project ID is required",
          data: null,
        },
        { status: 400 },
      );
    }

    const project = await prisma.project.findUnique({
      where: { id, userId: authContext.appUserId },
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

    const formData = await req.formData();
    const thumbnail = formData.get("thumbnail");

    if (!(thumbnail instanceof File)) {
      return NextResponse.json(
        {
          error: true,
          message: "Thumbnail file is required",
          data: null,
        },
        { status: 400 },
      );
    }

    if (!SUPPORTED_IMAGE_TYPES.has(thumbnail.type)) {
      return NextResponse.json(
        {
          error: true,
          message: "Unsupported thumbnail type. Use PNG, JPEG, or WebP.",
          data: null,
        },
        { status: 400 },
      );
    }

    if (thumbnail.size <= 0 || thumbnail.size > MAX_THUMBNAIL_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: true,
          message: "Thumbnail size must be between 1 byte and 5 MB.",
          data: null,
        },
        { status: 400 },
      );
    }

    const thumbnailBytes = Buffer.from(await thumbnail.arrayBuffer());
    const thumbnailUrl = await uploadProjectThumbnailToStorage({
      projectId: id,
      bytes: thumbnailBytes,
      contentType: thumbnail.type,
    });

    await prisma.project.update({
      where: { id },
      data: { thumbnailUrl },
    });

    return NextResponse.json(
      {
        error: false,
        message: "Project thumbnail updated successfully",
        data: { thumbnailUrl },
      },
      { status: 200 },
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

    logger.error("Error updating project thumbnail:", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: true,
        message: "An error occurred while updating the project thumbnail.",
        data: null,
      },
      { status: 500 },
    );
  }
}
