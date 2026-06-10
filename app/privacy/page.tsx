/* eslint-disable react/no-unescaped-entities */
import Link from "next/link";
import LegalPageLayout from "@/components/legal/LegalPageLayout";

export const metadata = {
  title: "Privacy Policy",
  description:
    "LOGIC's Privacy Policy explains how we collect, use, and protect your personal data.",
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="June 10, 2026">
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">1. Introduction</h2>
        <p className="mb-4 leading-relaxed">
          LOGIC Precision Instruments ("LOGIC," "we," "us," or "our") respects
          your privacy and is committed to protecting your personal data. This
          Privacy Policy explains how we collect, use, store, and share your
          information when you use our AI-powered UI/UX builder platform (the
          "Service").
        </p>
        <p className="mb-4 leading-relaxed">
          By using the Service, you consent to the practices described in this
          Privacy Policy. If you do not agree, please do not use the Service.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">
          2. Information We Collect
        </h2>
        <h3 className="mb-2 text-lg font-medium">2.1 Account Information</h3>
        <ul className="mb-4 list-disc space-y-1 pl-6 leading-relaxed">
          <li>Email address</li>
          <li>Full name</li>
          <li>Authentication provider (Google, GitHub, or Email)</li>
          <li>Clerk user ID</li>
          <li>Profile avatar (if provided by auth provider)</li>
        </ul>

        <h3 className="mb-2 text-lg font-medium">2.2 Session and Usage Data</h3>
        <ul className="mb-4 list-disc space-y-1 pl-6 leading-relaxed">
          <li>IP address</li>
          <li>User agent string</li>
          <li>Session timestamps and activity logs</li>
          <li>Authentication audit events</li>
        </ul>

        <h3 className="mb-2 text-lg font-medium">
          2.3 Project and Generation Data
        </h3>
        <ul className="mb-4 list-disc space-y-1 pl-6 leading-relaxed">
          <li>Project titles and descriptions</li>
          <li>User prompts submitted for AI generation</li>
          <li>Generated code, screens, and component trees</li>
          <li>Canvas state and layout configurations</li>
          <li>Project thumbnails and share tokens</li>
        </ul>

        <h3 className="mb-2 text-lg font-medium">2.4 Billing Information</h3>
        <ul className="mb-4 list-disc space-y-1 pl-6 leading-relaxed">
          <li>Razorpay customer and subscription IDs</li>
          <li>Payment IDs and invoice records</li>
          <li>Plan tier and usage counters</li>
          <li>Billing period dates</li>
          <li>Payment failure history</li>
        </ul>

        <h3 className="mb-2 text-lg font-medium">
          2.5 Organisation Data (PRO Users)
        </h3>
        <ul className="mb-4 list-disc space-y-1 pl-6 leading-relaxed">
          <li>Organisation name and slug</li>
          <li>Member roles and invite statuses</li>
          <li>Invitation email addresses</li>
        </ul>

        <h3 className="mb-2 text-lg font-medium">2.6 Telemetry</h3>
        <ul className="mb-4 list-disc space-y-1 pl-6 leading-relaxed">
          <li>Generation latency and token counts</li>
          <li>Model names and success/failure rates</li>
          <li>Screen classification data</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">
          3. How We Use Your Information
        </h2>
        <ul className="mb-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>Provide the Service:</strong> To authenticate you, process
            your prompts, generate UI/UX designs, and store your projects.
          </li>
          <li>
            <strong>Billing and Subscriptions:</strong> To manage your
            subscription plan, process payments via Razorpay, and enforce usage
            limits.
          </li>
          <li>
            <strong>Analytics and Improvements:</strong> To analyze usage
            patterns, improve generation quality, and optimize performance.
          </li>
          <li>
            <strong>Security:</strong> To detect fraud, prevent abuse, and
            maintain audit trails.
          </li>
          <li>
            <strong>Support:</strong> To respond to your inquiries and
            troubleshoot issues.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">
          4. Legal Basis for Processing
        </h2>
        <p className="mb-4 leading-relaxed">
          We process your data under the following legal bases:
        </p>
        <ul className="mb-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>Contract Performance:</strong> Processing necessary to
            provide the Service you signed up for.
          </li>
          <li>
            <strong>Legitimate Interests:</strong> Analytics, fraud prevention,
            and service improvement.
          </li>
          <li>
            <strong>Consent:</strong> Where required by law (e.g., marketing
            communications, non-essential cookies).
          </li>
          <li>
            <strong>Legal Obligation:</strong> Compliance with tax, regulatory,
            and law enforcement requests.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">
          5. Third-Party Processors
        </h2>
        <p className="mb-4 leading-relaxed">
          We share data with the following service providers to operate the
          Service:
        </p>
        <table className="mb-4 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-(--logic-border-soft)">
              <th className="py-2 pr-4 font-semibold">Provider</th>
              <th className="py-2 pr-4 font-semibold">Purpose</th>
              <th className="py-2 font-semibold">Data Shared</th>
            </tr>
          </thead>
          <tbody className="text-(--logic-secondary)">
            <tr className="border-b border-(--logic-border-soft)">
              <td className="py-2 pr-4">Clerk</td>
              <td className="py-2 pr-4">Authentication & session management</td>
              <td className="py-2">Email, name, auth provider</td>
            </tr>
            <tr className="border-b border-(--logic-border-soft)">
              <td className="py-2 pr-4">Razorpay</td>
              <td className="py-2 pr-4">Payment processing & billing</td>
              <td className="py-2">
                Email, subscription data, payment history
              </td>
            </tr>
            <tr className="border-b border-(--logic-border-soft)">
              <td className="py-2 pr-4">Supabase</td>
              <td className="py-2 pr-4">Database hosting</td>
              <td className="py-2">All user data</td>
            </tr>
            <tr className="border-b border-(--logic-border-soft)">
              <td className="py-2 pr-4">Upstash</td>
              <td className="py-2 pr-4">Redis caching & background jobs</td>
              <td className="py-2">Session tokens, subscription cache</td>
            </tr>
            <tr className="border-b border-(--logic-border-soft)">
              <td className="py-2 pr-4">Vercel</td>
              <td className="py-2 pr-4">Hosting & analytics</td>
              <td className="py-2">Usage analytics (if enabled)</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">6. Data Retention</h2>
        <ul className="mb-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>Account data:</strong> Retained for the duration of your
            account plus 30 days after deletion (for audit and legal purposes).
          </li>
          <li>
            <strong>Project data:</strong> Retained until you delete the project
            or your account.
          </li>
          <li>
            <strong>Billing data:</strong> Retained for 7 years per Indian tax
            law requirements.
          </li>
          <li>
            <strong>Telemetry:</strong> Aggregated and anonymized after 90 days.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">7. Your Rights</h2>
        <p className="mb-4 leading-relaxed">
          Depending on your jurisdiction, you may have the right to:
        </p>
        <ul className="mb-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>Access the personal data we hold about you</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your data (right to be forgotten)</li>
          <li>Request data portability</li>
          <li>Object to processing based on legitimate interests</li>
          <li>Withdraw consent where processing is based on consent</li>
        </ul>
        <p className="mb-4 leading-relaxed">
          To exercise these rights, contact us at{" "}
          <a
            href="mailto:rohitkhatri.dev@gmail.com"
            className="text-(--logic-primary-fixed) underline"
          >
            rohitkhatri.dev@gmail.com
          </a>
          .
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">8. Cookies and Tracking</h2>
        <p className="mb-4 leading-relaxed">
          We use essential cookies for authentication and session management.
          Analytics cookies (Vercel Analytics) are currently disabled. For more
          details, see our{" "}
          <Link
            href="/cookies"
            className="text-(--logic-primary-fixed) underline"
          >
            Cookie Policy
          </Link>
          .
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">9. Contact Us</h2>
        <p className="mb-4 leading-relaxed">
          If you have any questions about this Privacy Policy, please contact us
          at:{" "}
          <a
            href="mailto:rohitkhatri.dev@gmail.com"
            className="text-(--logic-primary-fixed) underline"
          >
            rohitkhatri.dev@gmail.com
          </a>
        </p>
      </section>
    </LegalPageLayout>
  );
}
