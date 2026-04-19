"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Inter, Manrope } from "next/font/google";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Check,
  Code2,
  MonitorSmartphone,
  PenLine,
  PlayCircle,
  Sparkles,
  Terminal,
  Wand2,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import styles from "./page.module.css";
import { Button } from "../ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useEffect, useRef, useState } from "react";
import { VideoModal } from "./VideoModal";

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

const DEFAULT_PROMPT =
  "Design a premium SaaS dashboard with responsive cards and analytics charts.";

type ProcessStep = {
  step: string;
  title: string;
  description: string;
  Icon: LucideIcon;
};

const PROCESS_STEPS: ProcessStep[] = [
  {
    step: "01",
    title: "Describe the Intent",
    description:
      "Input your requirements in plain language or structured JSON. LOGIC interprets the semantic intent of your layout.",
    Icon: PenLine,
  },
  {
    step: "02",
    title: "Generate & Refine",
    description:
      "The engine constructs the UI using your defined design system tokens, ensuring consistency across every breakpoint.",
    Icon: Wand2,
  },
  {
    step: "03",
    title: "Export Clean Code",
    description:
      "Output semantically precise HTML and Tailwind CSS, ready to be dropped into your production environment.",
    Icon: Terminal,
  },
];

const QUALITY_CHECKS = [
  "Strict token adherence",
  "Semantic HTML5 structures",
  "Accessible contrast ratios",
];

const LandingPage = () => {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const standardEase: [number, number, number, number] = [0.22, 1, 0.36, 1];
  const [isNavHidden, setIsNavHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const navHiddenRef = useRef(false);
  const [open, setOpen] = useState(false);

  const reveal = (delay = 0) =>
    shouldReduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 28 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.2 },
          transition: {
            duration: 0.6,
            delay,
            ease: standardEase,
          },
        };

  const heroVisualReveal = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, x: 42, scale: 0.98 },
        animate: { opacity: 1, x: 0, scale: 1 },
        transition: { duration: 0.8, delay: 0.2, ease: standardEase },
      };

  const startOnboarding = () => {
    try {
      sessionStorage.setItem("initialPrompt", DEFAULT_PROMPT);
    } catch {
      // Continue if session storage is unavailable.
    }

    router.push("/sign-up");
  };

  const goToProcessSection = () => {
    setOpen(true);
    // document.getElementById("logic-process")?.scrollIntoView({
    //   behavior: shouldReduceMotion ? "auto" : "smooth",
    //   block: "start",
    // });
  };

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const isScrollingDown = currentScrollY > lastScrollYRef.current;
      const shouldHide = isScrollingDown && currentScrollY > 80;

      if (shouldHide !== navHiddenRef.current) {
        navHiddenRef.current = shouldHide;
        setIsNavHidden(shouldHide);
      }

      lastScrollYRef.current = currentScrollY;
    };

    lastScrollYRef.current = window.scrollY;
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div
      data-logic-root
      className={`${styles.logicRoot} ${displayFont.variable} ${bodyFont.variable} selection:bg-(--logic-primary-fixed) selection:text-white`}
    >
      <nav
        className={`fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 ${shouldReduceMotion ? "" : "transition-transform duration-300 ease-out"} ${isNavHidden ? "-translate-y-[140%]" : "translate-y-0"}`}
      >
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between rounded-xl border border-(--logic-border-soft) bg-(--logic-surface-container-lowest)/90 px-3 shadow-[0_14px_36px_rgba(5,10,18,0.08)] backdrop-blur-xl sm:px-5">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-black tracking-tight text-(--logic-on-surface) sm:text-xl">
              LOGIC
            </span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-(--logic-secondary) md:inline">
              Interface Engine
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle className="border-(--logic-border) bg-(--logic-surface-container-lowest) text-(--logic-on-surface) hover:bg-(--logic-surface-container-low)" />
            <Link
              href="/sign-up"
              className="inline-flex h-9 items-center rounded-md border border-transparent bg-(--logic-on-surface) px-3.5 text-xs font-semibold uppercase tracking-[0.08em] text-(--logic-surface-container-lowest) transition-colors hover:bg-(--logic-primary-fixed) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--logic-on-surface) focus-visible:ring-offset-2 focus-visible:ring-offset-(--logic-surface-container-lowest)"
            >
              Try Now
            </Link>
          </div>
        </div>
      </nav>

      {open && (
        <VideoModal
          open={open}
          onOpenChange={setOpen}
          videoUrl="/Logic_ui-builder-final.mp4"
        />
      )}

      <main className="overflow-hidden pt-12">
        <motion.section
          className="relative mx-auto md:m-0 flex min-h-screen w-full flex-col items-center gap-16 overflow-hidden px-6 py-20 lg:flex-row lg:gap-24 lg:px-8 xl:px-12 lg:py-0"
          {...reveal()}
        >
          <motion.div
            className="z-10 flex w-full flex-col justify-center space-y-10 pt-12 lg:w-1/2 lg:flex-1 lg:pt-0 lg:px-15 xl:px-24"
            {...reveal(0.08)}
          >
            <div className="inline-flex w-max items-center space-x-2 rounded-full bg-(--logic-surface-container-low) px-4 py-2">
              <Sparkles
                className="h-4 w-4 text-(--logic-primary-fixed)"
                aria-hidden
              />
              <span
                className={`${styles.labelText} logic-body text-xs font-bold text-(--logic-secondary)`}
              >
                AI-Powered Design
              </span>
            </div>

            <h1
              className={`${styles.displayText} text-5xl font-extrabold text-(--logic-on-surface) lg:text-5xl xl:text-6xl 2xl:text-7xl`}
            >
              Turn ideas into <br />
              <span className={styles.gradientText}>production-ready</span>{" "}
              <br />
              UI instantly.
            </h1>

            <p className="logic-body max-w-lg text-lg leading-relaxed text-(--logic-secondary) lg:text-base xl:text-xl">
              Skip the boilerplate. Describe your vision, and our engine
              generates modular, responsive components ready for your codebase.
            </p>

            <div className="flex flex-col items-start gap-6 pt-4 sm:flex-row sm:items-center">
              <Button
                type="button"
                onClick={startOnboarding}
                className={`${styles.btnPrimary} logic-body inline-flex items-center gap-2 rounded-md px-8 py-6.5 text-base font-semibold cursor-pointer`}
              >
                <span>Build your first UI free</span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                onClick={goToProcessSection}
                className="logic-body bg-transparent inline-flex items-center gap-2 font-medium text-(--logic-secondary) transition-colors duration-200 hover:bg-transparent hover:text-(--logic-on-surface) cursor-pointer"
              >
                <PlayCircle className="h-5 w-5" aria-hidden />
                <span>Watch Demo</span>
              </Button>
            </div>
          </motion.div>

          <motion.div
            className={`relative flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded-2xl bg-(--logic-surface-container-low) p-4 sm:p-6 md:p-8 lg:w-10/12 lg:flex-1 ${styles.ambientShadow}`}
            {...heroVisualReveal}
          >
            <div className="absolute inset-0 bg-linear-to-br from-[rgba(133,130,255,0.2)] to-transparent mix-blend-multiply" />
            <div
              className={`relative flex h-full w-full flex-col overflow-hidden rounded-xl bg-(--logic-surface-container-lowest) ${styles.cardShadow}`}
            >
              <div className="flex h-10 items-center gap-2 border-b border-[rgba(169,180,185,0.25)] bg-(--logic-surface-container-low) px-4">
                <div className="h-2.5 w-2.5 rounded-full bg-[rgba(169,180,185,0.5)]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[rgba(169,180,185,0.5)]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[rgba(169,180,185,0.5)]" />
              </div>
              <div className="relative min-h-0 flex-1 w-full">
                <Image
                  fill
                  priority
                  sizes="(min-width: 1280px) 42vw, (min-width: 1024px) 46vw, (min-width: 640px) 88vw, 92vw"
                  src="/hero-section.png"
                  alt="Production UI preview with layered interface panels"
                  className="object-cover object-center"
                />
              </div>
            </div>
          </motion.div>
        </motion.section>

        <section id="logic-process" className="bg-(--logic-surface) py-32">
          <div className="mx-auto max-w-7xl px-8 lg:px-24">
            <motion.div className="mb-24 max-w-2xl" {...reveal()}>
              <h2
                className={`${styles.displayText} mb-6 text-4xl font-bold text-(--logic-on-surface) lg:text-5xl`}
              >
                The Process
              </h2>
              <p className="logic-body text-lg text-(--logic-secondary)">
                A deliberate, structured approach to generating structural
                interfaces without the boilerplate.
              </p>
            </motion.div>

            <div className="flex flex-col gap-24">
              {PROCESS_STEPS.map((step, index) => {
                const Icon = step.Icon;

                return (
                  <motion.article
                    key={step.step}
                    className="group flex flex-col items-start gap-12 lg:flex-row"
                    {...reveal(index * 0.08)}
                  >
                    <div className="text-8xl font-black text-(--logic-surface-container-high) transition-colors duration-200 group-hover:text-(--logic-primary-fixed)">
                      {step.step}
                    </div>
                    <div className="flex-1 pt-4">
                      <div className="mb-4 flex items-center gap-4">
                        <Icon
                          className="h-5 w-5 text-(--logic-primary-fixed)"
                          aria-hidden
                        />
                        <h3 className="text-2xl font-bold text-(--logic-on-surface)">
                          {step.title}
                        </h3>
                      </div>
                      <p className="logic-body max-w-md leading-relaxed text-(--logic-secondary)">
                        {step.description}
                      </p>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-(--logic-surface-container-low) py-32">
          <div className="mx-auto max-w-7xl px-8 lg:px-24">
            <div className="flex flex-col items-center gap-24 lg:flex-row">
              <motion.div className="w-full lg:w-1/2" {...reveal()}>
                <h2
                  className={`${styles.displayText} mb-6 text-4xl font-bold text-(--logic-on-surface) lg:text-5xl`}
                >
                  Obsessive Detail.
                </h2>
                <p className="logic-body mb-12 max-w-md text-lg text-(--logic-secondary)">
                  We do not just output divs. Every component respects
                  typographic hierarchy, accessibility standards, and responsive
                  behaviors out of the box.
                </p>
                <ul className="space-y-6">
                  {QUALITY_CHECKS.map((item) => (
                    <li
                      key={item}
                      className="logic-body flex items-center gap-4 font-medium text-(--logic-on-surface)"
                    >
                      <Check
                        className="h-5 w-5 text-(--logic-secondary)"
                        aria-hidden
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                className="grid w-full grid-cols-2 gap-4 lg:w-1/2"
                {...reveal(0.08)}
              >
                <div
                  className={`col-span-2 flex flex-col justify-center rounded-xl bg-(--logic-surface-container-lowest) p-8 ${styles.ambientShadow}`}
                >
                  <span
                    className={`${styles.labelText} logic-body mb-4 text-xs text-(--logic-secondary)`}
                  >
                    Typography Scale
                  </span>
                  <div className="space-y-2">
                    <div className="text-4xl font-extrabold text-(--logic-on-surface)">
                      Display
                    </div>
                    <div className="text-2xl font-bold text-(--logic-on-surface)">
                      Headline
                    </div>
                    <div className="logic-body text-lg font-semibold text-(--logic-secondary)">
                      Title
                    </div>
                    <div className="logic-body text-sm text-(--logic-secondary)">
                      Body
                    </div>
                  </div>
                </div>

                <div
                  className={`flex min-h-40 flex-col items-center justify-center rounded-xl bg-(--logic-surface-container-lowest) p-6 ${styles.ambientShadow}`}
                >
                  <MonitorSmartphone
                    className="mb-2 h-8 w-8 text-(--logic-secondary)"
                    aria-hidden
                  />
                  <span className="logic-body text-center text-sm font-semibold text-(--logic-on-surface)">
                    Responsive By Default
                  </span>
                </div>

                <div
                  className={`flex min-h-40 flex-col items-start justify-center rounded-xl bg-(--logic-surface-container-lowest) p-6 ${styles.ambientShadow}`}
                >
                  <Code2
                    className="mb-2 h-6 w-6 text-(--logic-primary-fixed)"
                    aria-hidden
                  />
                  <div className="mb-2 h-8 w-8 rounded bg-(--logic-primary-fixed)" />
                  <div className="mb-2 h-8 w-8 rounded bg-(--logic-surface-container-high)" />
                  <span className="logic-body text-xs font-medium text-(--logic-secondary)">
                    Token Mapping
                  </span>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <motion.section
          className="flex items-center justify-center bg-(--logic-surface) px-8 py-48 text-center"
          {...reveal()}
        >
          <div className="max-w-3xl">
            <h2
              className={`${styles.displayText} mb-12 text-5xl font-extrabold text-(--logic-on-surface) lg:text-7xl`}
            >
              Ready to build?
            </h2>
            <Button
              type="button"
              onClick={startOnboarding}
              className={`${styles.btnPrimary} logic-body rounded-md px-12 py-8 text-lg font-bold`}
            >
              Generate your first UI
            </Button>
          </div>
        </motion.section>
      </main>

      <footer className="w-full border-t border-(--logic-border-soft) bg-(--logic-bg) py-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8">
          <div className="text-xl font-black tracking-tighter text-(--logic-on-surface)">
            LOGIC
          </div>
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
