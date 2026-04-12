import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import prisma from "@/lib/prisma";
import { NextResponse, NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "project.fetched",
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

    return NextResponse.json(
      {
        error: false,
        message: "Project fetched successfully",
        data: {
          id: project.id,
          title: project.title,
          status: project.status,
          initialPrompt: project.initialPrompt,
        },
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
        },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error: true,
        message: "An error occurred while fetching the project",
        data: null,
        details: error,
      },
      { status: 500 },
    );
  }
}
const ProjectStatus = ["PENDING", "GENERATING", "ACTIVE", "ARCHIVED"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "project.updated",
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
    const { status } = await req.json();
    if (!status || !ProjectStatus.includes(status)) {
      return NextResponse.json(
        {
          error: true,
          message: "Invalid status value",
          data: null,
        },
        { status: 400 },
      );
    }

    const project = await prisma.project.findUnique({
      where: { id, userId: authContext.appUserId },
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

    await prisma.project.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(
      {
        error: false,
        message: "Project status updated successfully",
        data: { status },
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
        },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error: true,
        message: "An error occurred while updating the project status",
        data: null,
        details: error,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "project.deleted",
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
    await prisma.project.delete({
      where: { id },
    });

    return NextResponse.json(
      {
        error: false,
        message: "Project deleted successfully",
        data: {
          error: false,
        },
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
        },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error: true,
        message: "An error occurred while deleting the project",
        data: null,
        details: error,
      },
      { status: 500 },
    );
  }
}
