import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: 465,
  secure: true,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendOrgInviteEmail(params: {
  to: string;
  inviterEmail: string;
  orgName: string;
  acceptUrl: string;
  expiresAt: Date;
}) {
  const expiryText = params.expiresAt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const orgNameHtml = escapeHtml(params.orgName);
  const inviterHtml = escapeHtml(params.inviterEmail);
  const acceptUrlHtml = escapeHtml(params.acceptUrl);

  await transporter.sendMail({
    from: `"LOGIC" <${process.env.EMAIL_USER}>`,
    to: params.to,
    subject: `${params.inviterEmail} invited you to join ${params.orgName} on LOGIC`,
    text: [
      `You have been invited to join "${orgNameHtml}" on LOGIC as a team member.`,
      "",
      "This gives you full Pro access — unlimited generations, all models, frame regeneration.",
      "",
      `Accept invitation: ${acceptUrlHtml}`,
      "",
      `This invitation expires on ${expiryText}.`,
      "",
      "If you did not expect this invitation, you can safely ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <p style="font-size: 20px; font-weight: 700; margin: 0 0 8px;">You're invited to join ${orgNameHtml}</p>
      <p style="color: '#555'; margin: 0 0 24px;">${inviterHtml} has invited you to join their organisation on LOGIC.</p>
        <p style="color: #222; margin: 0 0 8px;">As a team member you get:</p>
        <ul style="color: #555; margin: 0 0 24px; padding-left: 20px;">
          <li>Unlimited UI generations</li>
          <li>All Pro models including DeepSeek V3.2</li>
          <li>Frame regeneration on every project</li>
        </ul>
        <a href="${acceptUrlHtml}" style="display:inline-block;background:#000;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;">Accept Invitation</a>
        <p style="color: #888; font-size: 12px; margin: 24px 0 0;">Expires ${expiryText}. If you did not expect this, ignore this email.</p>
      </div>
    `,
  });
}
