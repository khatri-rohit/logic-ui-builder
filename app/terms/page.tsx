import LegalPageLayout from "@/components/legal/LegalPageLayout";

export const metadata = {
  title: "Terms of Service",
  description:
    "LOGIC's Terms of Service govern your use of our AI-powered UI/UX builder platform.",
};

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="June 10, 2026">
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">1. Acceptance of Terms</h2>
        <p className="mb-4 leading-relaxed">
          By accessing or using LOGIC (the "Service"), you agree to be bound by
          these Terms of Service ("Terms"). If you do not agree to these Terms,
          you may not use the Service. These Terms constitute a legally binding
          agreement between you and LOGIC Precision Instruments ("LOGIC," "we,"
          "us," or "our").
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">2. Eligibility</h2>
        <p className="mb-4 leading-relaxed">
          You must be at least 18 years old and have the legal capacity to enter
          into binding contracts to use the Service. By using the Service, you
          represent and warrant that you meet these requirements.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">3. Account Registration and Security</h2>
        <p className="mb-4 leading-relaxed">
          To use certain features of the Service, you must register for an
          account. You agree to provide accurate, current, and complete
          information during registration and to keep this information updated.
        </p>
        <p className="mb-4 leading-relaxed">
          You are responsible for maintaining the confidentiality of your account
          credentials and for all activities that occur under your account. You
          agree to notify us immediately of any unauthorized use of your
          account.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">4. Subscription Plans and Billing</h2>
        <p className="mb-4 leading-relaxed">
          The Service offers three subscription tiers: FREE, STANDARD, and PRO.
          Billing is processed through Razorpay, our payment partner. By
          subscribing to a paid plan, you agree to pay all applicable fees as
          described on our pricing page.
        </p>
        <ul className="mb-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>FREE:</strong> Up to 10 generations per billing period.
          </li>
          <li>
            <strong>STANDARD:</strong> Up to 100 generations per billing
            period.
          </li>
          <li>
            <strong>PRO:</strong> Unlimited generations with organization
            features.
          </li>
        </ul>
        <p className="mb-4 leading-relaxed">
          All fees are non-refundable except as expressly stated in our{" "}
          <a
            href="/refund-policy"
            className="text-(--logic-primary-fixed) underline"
          >
            Refund Policy
          </a>
          . We reserve the right to change pricing with 30 days' advance notice.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">5. Acceptable Use Policy</h2>
        <p className="mb-4 leading-relaxed">You agree not to use the Service to:</p>
        <ul className="mb-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>Generate content that is illegal, harmful, threatening, abusive, or defamatory</li>
          <li>Infringe on any intellectual property rights of third parties</li>
          <li>Reverse engineer, decompile, or attempt to discover the source code of the Service</li>
          <li>Use the Service to build a competing product or service</li>
          <li>Abuse the AI generation system through automated requests or prompt injection</li>
          <li>Share your account credentials with unauthorized users</li>
          <li>Upload or transmit viruses, malware, or other harmful code</li>
          <li>Engage in any activity that violates applicable laws or regulations</li>
        </ul>
        <p className="mb-4 leading-relaxed">
          We reserve the right to suspend or terminate your account for any
          violation of this Acceptable Use Policy.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">6. Intellectual Property</h2>
        <h3 className="mb-2 text-lg font-medium">6.1 Your Content</h3>
        <p className="mb-4 leading-relaxed">
          You retain all ownership rights to the prompts you submit and the
          generated code output ("Your Content"). By using the Service, you
          grant us a limited, non-exclusive license to use Your Content solely
          to provide, maintain, and improve the Service.
        </p>
        <h3 className="mb-2 text-lg font-medium">6.2 Generated Code License</h3>
        <p className="mb-4 leading-relaxed">
          The code generated by our AI systems is provided to you on an "as-is"
          basis. You may use, modify, and distribute the generated code in your
          own projects, subject to any third-party dependencies or licenses
          referenced in the generated code.
        </p>
        <h3 className="mb-2 text-lg font-medium">6.3 Service IP</h3>
        <p className="mb-4 leading-relaxed">
          All intellectual property rights in the Service itself, including but
          not limited to software, algorithms, designs, logos, and trademarks,
          are owned by LOGIC and its licensors. These Terms do not grant you any
          rights to use our trademarks or branding without prior written consent.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">7. Service Availability and Disclaimers</h2>
        <p className="mb-4 leading-relaxed">
          The Service is provided on an "as is" and "as available" basis. We do
          not guarantee that the Service will be uninterrupted, timely, secure, or
          error-free. AI-generated code may contain errors or inaccuracies, and
          you are solely responsible for reviewing and testing any generated code
          before using it in production.
        </p>
        <p className="mb-4 leading-relaxed">
          We reserve the right to modify, suspend, or discontinue the Service
          (or any part thereof) at any time, with or without notice. We shall
          not be liable to you or any third party for any modification,
          suspension, or discontinuation.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">8. Termination</h2>
        <h3 className="mb-2 text-lg font-medium">8.1 By You</h3>
        <p className="mb-4 leading-relaxed">
          You may terminate your account at any time by contacting us at{" "}
          <a
            href="mailto:rohitkhatri.dev@gmail.com"
            className="text-(--logic-primary-fixed) underline"
          >
            rohitkhatri.dev@gmail.com
          </a>
          . Upon termination, your right to use the Service will immediately
          cease.
        </p>
        <h3 className="mb-2 text-lg font-medium">8.2 By Us</h3>
        <p className="mb-4 leading-relaxed">
          We may suspend or terminate your account if you violate these Terms,
          fail to pay fees when due, or if required by law. We will provide
          notice where practicable.
        </p>
        <h3 className="mb-2 text-lg font-medium">8.3 Effect of Termination</h3>
        <p className="mb-4 leading-relaxed">
          Upon termination, we will retain your data for 30 days (for billing and
          audit purposes) before permanent deletion, unless longer retention is
          required by law. You may request an export of your data before
          termination.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">9. Limitation of Liability</h2>
        <p className="mb-4 leading-relaxed">
          To the maximum extent permitted by applicable law, LOGIC and its
          affiliates, officers, employees, and agents shall not be liable for
          any indirect, incidental, special, consequential, or punitive damages,
          including but not limited to loss of profits, data, or goodwill,
          arising out of or in connection with your use of the Service.
        </p>
        <p className="mb-4 leading-relaxed">
          Our total liability to you for any claims arising under these Terms
          shall not exceed the amount you paid to us in the 12 months preceding
          the claim, or INR 1,000 if you have not made any payments.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">10. Governing Law and Dispute Resolution</h2>
        <p className="mb-4 leading-relaxed">
          These Terms shall be governed by and construed in accordance with the
          laws of India. Any disputes arising under these Terms shall be subject
          to the exclusive jurisdiction of the courts in Bengaluru, Karnataka.
        </p>
        <p className="mb-4 leading-relaxed">
          Before initiating any legal proceedings, you agree to attempt to
          resolve the dispute informally by contacting us at{" "}
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
        <h2 className="mb-4 text-2xl font-semibold">11. Changes to Terms</h2>
        <p className="mb-4 leading-relaxed">
          We may update these Terms from time to time. Material changes will be
          notified via email or a prominent notice on the Service. Your continued
          use of the Service after such changes constitutes acceptance of the
          updated Terms.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">12. Contact</h2>
        <p className="mb-4 leading-relaxed">
          For any questions about these Terms, please contact us at:{" "}
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
