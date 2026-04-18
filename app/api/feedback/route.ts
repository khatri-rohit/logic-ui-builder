import { NextRequest } from "next/server";
import { Client } from "@upstash/qstash";
import logger from "@/lib/logger";
import { feedbackBodySchema, toValidationIssues } from "@/lib/schemas/studio";

const client = new Client({
  token: process.env.QSTASH_TOKEN,
  retry: {
    retries: 3,
    backoff: (retry_count) => 2 ** retry_count * 20,
  },
});

export async function POST(request: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Request body must be valid JSON" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const parsedBody = feedbackBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      logger.error("Validation error:", { error: parsedBody.error });
      return new Response(
        JSON.stringify({
          error: "Invalid feedback payload",
          code: "VALIDATION_ERROR",
          issues: toValidationIssues(parsedBody.error),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { feedback } = parsedBody.data;

    // Send email with feedback content through background job
    const result = await client.publishJSON({
      url: `${process.env.BACKGROUND_TASK_QUEUE_PUBLIC_URL}/api/background-jobs/send-feedback-email`,
      body: { feedback },
    });
    logger.info("Published feedback email job to QStash", { result });

    return new Response(
      JSON.stringify({ success: true, message: "Feedback received" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    logger.error("Error processing feedback:", { error });
    return new Response(
      JSON.stringify({ error: "An error occurred while processing feedback" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
