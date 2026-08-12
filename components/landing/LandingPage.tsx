import { DM_Sans, Staatliches, JetBrains_Mono } from "next/font/google";
import styles from "./page.module.css";
import { Header } from "./Header";
import { LandingFooter } from "./Footer";
import { HeroSection } from "./HeroSection";
import { ProcessSection } from "./ProcessSection";
import { DetailSection } from "./DetailSection";
import { PricingSection } from "./PricingSection";
import { CTASection } from "./CTASection";

const displayFont = Staatliches({
  subsets: ["latin"],
  variable: "--font-logic-display",
  weight: ["400"],
});

const bodyFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-logic-body",
  weight: ["400", "500", "600", "700"],
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-logic-mono",
  weight: ["400", "500", "700"],
});

const LandingPage = () => {
  return (
    <div
      data-logic-root
      className={`${styles.logicRoot} ${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} selection:bg-(--logic-accent) selection:text-white`}
    >
      <Header />
      <div className={styles.decorativeLine} aria-hidden />

      <main className="overflow-hidden pt-14">
        <HeroSection />
        <ProcessSection />
        <DetailSection />
        <PricingSection />
        <CTASection />
      </main>

      <LandingFooter />

      <div
        className={`${styles.canvasNoise} pointer-events-none fixed inset-0`}
        aria-hidden
      />
    </div>
  );
};

export default LandingPage;
