import { NextRequest } from "next/server";
// import { Client } from "@upstash/qstash";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import logger from "@/lib/logger";
import { feedbackRatelimit } from "@/lib/ratelimit";
import { sendFeedbackEmail } from "@/lib/feedback-mail";
import {
  feedbackFormBodySchema,
  toValidationIssues,
} from "@/lib/schemas/studio";

export const runtime = "nodejs";

// const client = new Client({
//   token: process.env.QSTASH_TOKEN,
//   retry: {
//     retries: 3,
//     backoff: (retry_count) => 2 ** retry_count * 20,
//   },
// });

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request,
      eventType: "feedback.submitted",
    });

    if (!authContext.appUserId) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized: Missing user ID in auth context",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    try {
      const { success, limit, remaining, reset } =
        await feedbackRatelimit.limit(authContext.appUserId);

      if (!success) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded",
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": remaining.toString(),
              "X-RateLimit-Reset": reset.toString(),
            },
          },
        );
      }
    } catch (rateLimitError) {
      logger.error(
        `feedbackRatelimit.limit failed for appUserId=${authContext.appUserId}`,
        rateLimitError,
      );

      return new Response(
        JSON.stringify({
          error:
            "Feedback submission is temporarily unavailable. Please try again.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return new Response(
        JSON.stringify({
          error:
            "Request must be multipart form-data with feedback and optional attachments",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const parsedBody = feedbackFormBodySchema.safeParse({
      feedback: formData.get("feedback"),
      attachments: formData.getAll("attachments"),
    });

    if (!parsedBody.success) {
      logger.error("Validation error:", { error: parsedBody.error });
      return new Response(
        JSON.stringify({
          error: "Invalid feedback form payload",
          code: "VALIDATION_ERROR",
          issues: toValidationIssues(parsedBody.error),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { feedback, attachments } = parsedBody.data;

    const emailAttachments = await Promise.all(
      attachments.map(async (attachmentFile) => ({
        filename: attachmentFile.name || "attachment",
        contentType: attachmentFile.type,
        content: Buffer.from(await attachmentFile.arrayBuffer()),
      })),
    );

    // // Can't use QStash for this job right now because the max payload size is 1MB and we want to allow up to 25MB of attachments. Instead, we'll send the email directly from this API route for now. We can revisit using QStash or another background job.
    // try {
    //   const queueBaseUrl = process.env.BACKGROUND_TASK_QUEUE_PUBLIC_URL;
    //   if (!queueBaseUrl)
    //     throw new Error("Missing BACKGROUND_TASK_QUEUE_PUBLIC_URL");

    //   const result = await client.publishJSON({
    //     url: `${queueBaseUrl}/api/background-jobs/send-feedback-email`,
    //     body: { feedback, attachments: emailAttachments },
    //   });

    //   logger.info("Published feedback email task to QStash", {
    //     qstashResult: result,
    //   });
    // } catch (queueError) {
    //   logger.error("Feedback submitted but failed to enqueue email task", {
    //     error:
    //       queueError instanceof Error ? queueError.message : String(queueError),
    //   });
    //   return new Response(
    //     JSON.stringify({
    //       error: "An error occurred while processing feedback",
    //     }),
    //     { status: 500, headers: { "Content-Type": "application/json" } },
    //   );
    //   // Do not fail submission after successful DB write.
    // }

    await sendFeedbackEmail({
      feedback,
      attachments: emailAttachments,
    });
    logger.info("Feedback email sent to backend queue", {
      attachments: emailAttachments.length,
    });

    return new Response(
      JSON.stringify({ success: true, message: "Feedback received" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    if (isAuthError(error)) {
      return new Response(
        JSON.stringify({
          error: true,
          code: error.code,
          message: error.message,
        }),
        {
          status: error.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    logger.error("Error processing feedback:", { error });
    return new Response(
      JSON.stringify({ error: "An error occurred while processing feedback" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
