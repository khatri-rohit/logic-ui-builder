import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { z } from "zod";
import logger from "@/lib/logger";
import { sendOrgDissolvedEmail } from "@/lib/org-mail";

const bodySchema = z.object({
  email: z.string().email(),
  orgName: z.string(),
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

    const parsedBody = bodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid payload",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    await sendOrgDissolvedEmail({
      to: parsedBody.data.email,
      orgName: parsedBody.data.orgName,
    });

    logger.info("Org dissolution notification sent", {
      email: parsedBody.data.email,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    logger.error("Failed to send org dissolution notification", { error });
    return new Response(
      JSON.stringify({ success: false, message: "Failed to send notification" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
