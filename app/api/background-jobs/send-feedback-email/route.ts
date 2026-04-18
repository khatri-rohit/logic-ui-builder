import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import nodemailer, { Transporter } from "nodemailer";
import logger from "@/lib/logger";
import { feedbackBodySchema, toValidationIssues } from "@/lib/schemas/studio";

const transporter: Transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const POST = verifySignatureAppRouter(async (req: Request) => {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Request body must be valid JSON",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const parsedBody = feedbackBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return new Response(
        JSON.stringify({
          success: false,
          code: "VALIDATION_ERROR",
          message: "Invalid feedback payload",
          issues: toValidationIssues(parsedBody.error),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { feedback } = parsedBody.data;

    await transporter.sendMail({
      from: `"UI/UX Builder Feedback" <${process.env.EMAIL_USER}>`,
      to: process.env.FEEDBACK_RECEIVER_EMAIL,
      subject: "New Feedback Received",
      text: feedback,
    });

    logger.info("Feedback email sent successfully");
    return new Response(
      JSON.stringify({ success: true, message: "Feedback email sent" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    logger.error("Error sending feedback email:", { error });
    return new Response(
      JSON.stringify({
        success: false,
        message: "Failed to send feedback email",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
