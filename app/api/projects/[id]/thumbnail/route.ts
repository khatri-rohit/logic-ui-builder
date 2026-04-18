import { NextRequest, NextResponse } from "next/server";

import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import {
  projectRouteParamsSchema,
  toValidationIssues,
} from "@/lib/schemas/studio";
import { uploadProjectThumbnailToStorage } from "@/lib/supabase-storage";
import { z } from "zod";

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const MAX_THUMBNAIL_SIZE_BYTES = 5 * 1024 * 1024;

const thumbnailFormSchema = z.object({
  thumbnail: z
    .instanceof(File, { message: "Thumbnail file is required" })
    .refine((file) => SUPPORTED_IMAGE_TYPES.has(file.type), {
      message: "Unsupported thumbnail type. Use PNG, JPEG, or WebP.",
    })
    .refine((file) => file.size > 0 && file.size <= MAX_THUMBNAIL_SIZE_BYTES, {
      message: "Thumbnail size must be between 1 byte and 5 MB.",
    }),
});

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

    const parsedParams = projectRouteParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      return NextResponse.json(
        {
          error: true,
          code: "VALIDATION_ERROR",
          message: "Invalid project route parameters",
          issues: toValidationIssues(parsedParams.error),
          data: null,
        },
        { status: 400 },
      );
    }

    const { id } = parsedParams.data;

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
    const parsedFormData = thumbnailFormSchema.safeParse({
      thumbnail: formData.get("thumbnail"),
    });
    if (!parsedFormData.success) {
      return NextResponse.json(
        {
          error: true,
          code: "VALIDATION_ERROR",
          message: "Invalid thumbnail payload",
          issues: toValidationIssues(parsedFormData.error),
          data: null,
        },
        { status: 400 },
      );
    }

    const { thumbnail } = parsedFormData.data;

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
