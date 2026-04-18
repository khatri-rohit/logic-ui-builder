import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { toValidationIssues } from "@/lib/schemas/studio";

const frameRouteParamsSchema = z.object({
  frameId: z.string().cuid(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ frameId: string }> },
) {
  const parsedParams = frameRouteParamsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json(
      {
        error: true,
        code: "VALIDATION_ERROR",
        message: "Invalid frame route parameters",
        issues: toValidationIssues(parsedParams.error),
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      error: true,
      message: "Frame-based generation endpoint is not implemented",
      data: {
        frameId: parsedParams.data.frameId,
      },
    },
    { status: 501 },
  );
}
