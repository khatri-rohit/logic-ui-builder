import nodemailer, { type Transporter } from "nodemailer";

export interface FeedbackMailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

const transporter: Transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendFeedbackEmail({
  feedback,
  attachments,
  fromEmail,
  fromName,
  type = "feedback",
}: {
  feedback: string;
  attachments: FeedbackMailAttachment[];
  fromEmail?: string;
  fromName?: string;
  type?: "feedback" | "support";
}) {
  const isSupport = type === "support";
  const senderEmail = fromEmail || "unknown@logic.dev";
  const senderName = fromName || "Anonymous User";
  await transporter.sendMail({
    from: `"LOGIC ${isSupport ? "Support" : "Feedback"} <${process.env.EMAIL_USER}>`,
    to: process.env.FEEDBACK_RECEIVER_EMAIL,
    replyTo: `"${senderName}" <${senderEmail}>`,
    subject: `${isSupport ? "[Support]" : "[Feedback]"} from ${senderName} (${senderEmail})`,
    text: `From: ${senderName} <${senderEmail}>\nType: ${isSupport ? "Support Request" : "Feedback"}\n\n${feedback}`,
    attachments: attachments.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    })),
  });
}
