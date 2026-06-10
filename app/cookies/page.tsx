import LegalPageLayout from "@/components/legal/LegalPageLayout";

export const metadata = {
  title: "Cookie Policy",
  description:
    "LOGIC's Cookie Policy explains how we use cookies and similar technologies.",
};

export default function CookiesPage() {
  return (
    <LegalPageLayout title="Cookie Policy" lastUpdated="June 10, 2026">
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">1. What Are Cookies</h2>
        <p className="mb-4 leading-relaxed">
          Cookies are small text files that are stored on your device when you
          visit a website. They help websites recognize your device and store
          information about your preferences or past actions.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">2. How We Use Cookies</h2>
        <p className="mb-4 leading-relaxed">
          LOGIC uses cookies and similar technologies for the following purposes:
        </p>
        <ul className="mb-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>Essential Cookies:</strong> Required for the Service to
            function, including authentication and session management through
            Clerk.
          </li>
          <li>
            <strong>Analytics Cookies:</strong> Help us understand how visitors
            interact with our website. Currently disabled.
          </li>
          <li>
            <strong>Preference Cookies:</strong> Remember your settings and
            preferences for a better experience.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">3. Cookies We Use</h2>
        <table className="mb-4 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-(--logic-border-soft)">
              <th className="py-2 pr-4 font-semibold">Name</th>
              <th className="py-2 pr-4 font-semibold">Provider</th>
              <th className="py-2 pr-4 font-semibold">Purpose</th>
              <th className="py-2 font-semibold">Duration</th>
            </tr>
          </thead>
          <tbody className="text-(--logic-secondary)">
            <tr className="border-b border-(--logic-border-soft)">
              <td className="py-2 pr-4">__session</td>
              <td className="py-2 pr-4">Clerk</td>
              <td className="py-2 pr-4">Authentication session</td>
              <td className="py-2">Session</td>
            </tr>
            <tr className="border-b border-(--logic-border-soft)">
              <td className="py-2 pr-4">__client_uat</td>
              <td className="py-2 pr-4">Clerk</td>
              <td className="py-2 pr-4">Session token validation</td>
              <td className="py-2">Session</td>
            </tr>
            <tr className="border-b border-(--logic-border-soft)">
              <td className="py-2 pr-4">__clerk_db_jwt</td>
              <td className="py-2 pr-4">Clerk</td>
              <td className="py-2 pr-4">JWT token storage</td>
              <td className="py-2">Session</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">4. Managing Cookies</h2>
        <p className="mb-4 leading-relaxed">
          You can control and manage cookies through your browser settings.
          Most browsers allow you to refuse or delete cookies. However, please
          note that disabling essential cookies may prevent you from using
          certain features of the Service, including authentication.
        </p>
        <p className="mb-4 leading-relaxed">
          To learn more about managing cookies, visit the help pages of your
          browser:
        </p>
        <ul className="mb-4 list-disc space-y-1 pl-6 leading-relaxed">
          <li>
            <a
              href="https://support.google.com/chrome/answer/95647"
              target="_blank"
              rel="noopener noreferrer"
              className="text-(--logic-primary-fixed) underline"
            >
              Google Chrome
            </a>
          </li>
          <li>
            <a
              href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-(--logic-primary-fixed) underline"
            >
              Mozilla Firefox
            </a>
          </li>
          <li>
            <a
              href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac"
              target="_blank"
              rel="noopener noreferrer"
              className="text-(--logic-primary-fixed) underline"
            >
              Safari
            </a>
          </li>
          <li>
            <a
              href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
              target="_blank"
              rel="noopener noreferrer"
              className="text-(--logic-primary-fixed) underline"
            >
              Microsoft Edge
            </a>
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">5. Contact</h2>
        <p className="mb-4 leading-relaxed">
          If you have any questions about our Cookie Policy, please contact us
          at:{" "}
          <a
            href="mailto:support@logic.dev"
            className="text-(--logic-primary-fixed) underline"
          >
            support@logic.dev
          </a>
        </p>
      </section>
    </LegalPageLayout>
  );
}
