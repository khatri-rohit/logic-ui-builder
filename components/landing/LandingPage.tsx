import Link from "next/link";
import { Inter, Manrope } from "next/font/google";
import styles from "./page.module.css";
import { LandingNav } from "./LandingNav";
import { HeroSection } from "./HeroSection";
import { ProcessSection } from "./ProcessSection";
import { DetailSection } from "./DetailSection";
import { PricingSection } from "./PricingSection";
import { CTASection } from "./CTASection";

const displayFont = Manrope({
  subsets: ["latin"],
  variable: "--font-logic-display",
  weight: ["400", "500", "700", "800"],
});

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-logic-body",
  weight: ["400", "500", "600", "700"],
});

const LandingPage = () => {
  return (
    <div
      data-logic-root
      className={`${styles.logicRoot} ${displayFont.variable} ${bodyFont.variable} selection:bg-(--logic-primary-fixed) selection:text-white`}
    >
      <LandingNav />
      <main className="overflow-hidden pt-12">
        <HeroSection />
        <ProcessSection />
        <DetailSection />
        <PricingSection />
        <CTASection />
      </main>

      <footer className="w-full border-t border-(--logic-border-soft) bg-(--logic-bg) py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-8 md:flex-row">
          <div className="text-xl font-black tracking-tighter text-(--logic-on-surface)">
            LOGIC
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-(--logic-secondary)">
            <Link href="/privacy" className="hover:text-(--logic-on-surface)">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-(--logic-on-surface)">
              Terms
            </Link>
            <Link href="/cookies" className="hover:text-(--logic-on-surface)">
              Cookies
            </Link>
            <Link
              href="/refund-policy"
              className="hover:text-(--logic-on-surface)"
            >
              Refunds
            </Link>
          </nav>
          <div className="logic-body text-sm tracking-wide text-(--logic-secondary)">
            © 2026 LOGIC. All rights reserved.
          </div>
        </div>
      </footer>

      <div
        className={`${styles.canvasNoise} pointer-events-none fixed inset-0`}
      />
    </div>
  );
};

export default LandingPage;
