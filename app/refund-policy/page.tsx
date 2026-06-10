import LegalPageLayout from "@/components/legal/LegalPageLayout";

export const metadata = {
  title: "Cancellation and No-Refund Policy",
  description:
    "LOGIC's Cancellation and No-Refund Policy explains our stance on refunds and how cancellations are handled.",
};

export default function RefundPolicyPage() {
  return (
    <LegalPageLayout
      title="Cancellation and No-Refund Policy"
      lastUpdated="June 10, 2026"
    >
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">1. Overview</h2>
        <p className="mb-4 leading-relaxed">
          All purchases and subscription payments made through LOGIC are
          <strong> final and non-refundable</strong>. By subscribing to a paid
          plan, you acknowledge and agree that no refunds will be issued under
          any circumstances, including but not limited to change of mind,
          non-use, or dissatisfaction with the Service.
        </p>
        <p className="mb-4 leading-relaxed">
          All payments are processed through Razorpay, our payment partner.
          Razorpay acts as a payment facilitator only; LOGIC is solely
          responsible for all billing decisions and customer service.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">2. No Refunds</h2>
        <p className="mb-4 leading-relaxed">
          We do not offer refunds for any reason. This includes, without
          limitation:
        </p>
        <ul className="mb-4 list-disc space-y-2 pl-6 leading-relaxed">
          <li>Partial usage or non-use of the Service during a billing period</li>
          <li>Dissatisfaction with generated outputs or code quality</li>
          <li>Change of mind after purchase</li>
          <li>Failure to cancel before the next billing cycle</li>
          <li>Technical issues caused by third-party services</li>
          <li>Account suspension or termination due to Terms of Service violations</li>
        </ul>
        <p className="mb-4 leading-relaxed">
          We encourage you to make use of our FREE plan to evaluate the
          Service before upgrading to a paid subscription.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">3. Cancellation Policy</h2>
        <h3 className="mb-2 text-lg font-medium">3.1 How to Cancel</h3>
        <p className="mb-4 leading-relaxed">
          You can cancel your subscription at any time through the billing page
          in your account dashboard, or by contacting us at{" "}
          <a
            href="mailto:rohitkhatri.dev@gmail.com"
            className="text-(--logic-primary-fixed) underline"
          >
            rohitkhatri.dev@gmail.com
          </a>
          .
        </p>

        <h3 className="mb-2 text-lg font-medium">3.2 Grace Period</h3>
        <p className="mb-4 leading-relaxed">
          Upon cancellation, you will continue to have access to your paid plan
          features until the end of your current billing period. After this
          grace period, your account will automatically downgrade to the FREE
          plan. You will not be charged again unless you reactivate your
          subscription.
        </p>

        <h3 className="mb-2 text-lg font-medium">3.3 Scheduled Downgrades</h3>
        <p className="mb-4 leading-relaxed">
          You may schedule a downgrade to a lower-tier plan (e.g., from PRO to
          STANDARD). The downgrade will take effect at the end of your current
          billing period. Until then, you retain access to your current plan's
          features. No refunds or credits will be issued for the difference in
          plan pricing.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">4. Failed Payments</h2>
        <p className="mb-4 leading-relaxed">
          If a recurring payment fails, Razorpay will automatically retry the
          charge according to their retry schedule. After multiple failed
          attempts, your subscription may be moved to a "halted" status, and
          you will lose access to paid features. You can reactivate your
          subscription by updating your payment method in the billing dashboard.
          No refunds will be issued for any period of service interruption due to
          failed payments.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">5. Data Retention After Cancellation</h2>
        <p className="mb-4 leading-relaxed">
          After cancellation or downgrade, your projects and data remain
          accessible under the FREE plan limits. If your data exceeds FREE plan
          limits, you may need to delete projects to continue using the Service.
          We do not delete your data upon cancellation unless you explicitly
          request account deletion.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold">6. Contact</h2>
        <p className="mb-4 leading-relaxed">
          For any questions about cancellations or billing, please contact us
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
