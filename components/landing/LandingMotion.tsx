"use client";

import { useEffect } from "react";

type LandingMotionProps = {
  typingText: string;
};

export function LandingMotion({ typingText }: LandingMotionProps) {
  useEffect(() => {
    let disposed = false;
    let cleanupAnimation: (() => void) | undefined;
    let cleanupLenis: (() => void) | undefined;

    document.documentElement.classList.add("logic-scroll-theme");
    document.body.classList.add("logic-scroll-theme");

    const initMotion = async () => {
      const [{ animate, inView, scroll, stagger }, { default: Lenis }] =
        await Promise.all([import("motion"), import("lenis")]);

      if (disposed) {
        return;
      }

      const root = document.querySelector<HTMLElement>("[data-logic-root]");
      if (!root) {
        return;
      }

      const typingTarget = root.querySelector<HTMLElement>(
        "[data-typing-target]",
      );
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (typingTarget) {
        typingTarget.textContent = "";
      }

      if (!reducedMotion) {
        const lenis = new Lenis({
          duration: 1.05,
          smoothWheel: true,
          wheelMultiplier: 0.9,
          touchMultiplier: 1.4,
        });

        let frame = 0;
        const raf = (time: number) => {
          lenis.raf(time);
          frame = window.requestAnimationFrame(raf);
        };

        frame = window.requestAnimationFrame(raf);

        cleanupLenis = () => {
          window.cancelAnimationFrame(frame);
          lenis.destroy();
        };
      }

      if (reducedMotion) {
        if (typingTarget) {
          typingTarget.textContent = typingText;
        }
        return;
      }

      const animationControls: Array<{
        stop?: () => void;
        cancel?: () => void;
      }> = [];
      const cleanupTasks: Array<() => void> = [];

      const trackAnimation = (
        control: { stop?: () => void; cancel?: () => void } | undefined,
      ) => {
        if (!control) {
          return;
        }

        animationControls.push(control);
      };

      const setInlineStyle = (
        element: HTMLElement,
        property: string,
        value: string,
      ) => {
        const previousValue = element.style.getPropertyValue(property);

        cleanupTasks.push(() => {
          if (previousValue) {
            element.style.setProperty(property, previousValue);
            return;
          }

          element.style.removeProperty(property);
        });

        element.style.setProperty(property, value);
      };

      const powerThreeOut: [number, number, number, number] = [
        0.22, 1, 0.36, 1,
      ];
      const powerTwoOut: [number, number, number, number] = [0.25, 1, 0.5, 1];

      const lineSweeps = Array.from(
        root.querySelectorAll<HTMLElement>(".line-sweep"),
      );
      const scrollItems = Array.from(
        root.querySelectorAll<HTMLElement>(".scroll-item"),
      );
      const lineFills = Array.from(
        root.querySelectorAll<HTMLElement>(".line-fill"),
      );

      const perfTargets = Array.from(
        root.querySelectorAll<HTMLElement>(
          ".hero-canvas, .stagger-card, .scroll-item, .line-fill, .line-sweep",
        ),
      );

      perfTargets.forEach((element) => {
        setInlineStyle(element, "will-change", "transform, opacity");
      });

      lineSweeps.forEach((line) => {
        setInlineStyle(line, "transform-origin", "left center");
        setInlineStyle(line, "transform", "scaleX(0)");
      });

      scrollItems.forEach((item) => {
        setInlineStyle(item, "opacity", "0");
        setInlineStyle(item, "transform", "translateY(36px)");
      });

      lineFills.forEach((line) => {
        setInlineStyle(line, "transform-origin", "left center");
        setInlineStyle(line, "transform", "scaleX(0)");
      });

      const lineSweepStart = 0.95;
      const lineSweepEnd =
        lineSweeps.length > 0
          ? lineSweepStart + 0.6 + 0.08 * (lineSweeps.length - 1)
          : lineSweepStart + 0.6;
      const heroCanvasStart = lineSweepEnd - 0.35;
      const cardStart = heroCanvasStart + 0.5;

      trackAnimation(
        animate([
          [
            ".logic-nav",
            { y: [-24, 0], opacity: [0, 1] },
            { at: 0, duration: 0.45, ease: powerThreeOut },
          ],
          [
            ".hero-kicker, .hero-title, .hero-description, .hero-terminal",
            { y: [30, 0], opacity: [0, 1] },
            {
              at: 0.35,
              duration: 0.6,
              delay: stagger(0.1),
              ease: powerThreeOut,
            },
          ],
          [
            lineSweeps,
            { transform: ["scaleX(0)", "scaleX(1)"] },
            {
              at: lineSweepStart,
              duration: 0.6,
              delay: stagger(0.08),
              ease: powerTwoOut,
            },
          ],
          [
            ".hero-canvas",
            { y: [40, 0], scale: [0.98, 1], opacity: [0, 1] },
            { at: heroCanvasStart, duration: 0.8, ease: powerThreeOut },
          ],
          [
            ".stagger-card",
            { y: [24, 0], opacity: [0, 1] },
            {
              at: cardStart,
              duration: 0.5,
              delay: stagger(0.08),
              ease: powerThreeOut,
            },
          ],
        ]),
      );

      trackAnimation(
        animate(0, typingText.length, {
          duration: 2.6,
          ease: "linear",
          onUpdate: (latest) => {
            if (!typingTarget) {
              return;
            }

            typingTarget.textContent = typingText.slice(0, Math.floor(latest));
          },
        }),
      );

      trackAnimation(
        animate(
          "[data-typing-cursor]",
          { opacity: [1, 0] },
          {
            duration: 0.5,
            repeat: Number.POSITIVE_INFINITY,
            repeatType: "reverse",
            ease: "linear",
          },
        ),
      );

      const heroGridLayer = root.querySelector<HTMLElement>(".hero-grid-layer");
      const heroSection = root.querySelector<HTMLElement>(".hero-section");

      if (heroGridLayer && heroSection) {
        let parallaxTarget = 0;
        let parallaxCurrent = 0;
        let parallaxFrame = 0;

        setInlineStyle(heroGridLayer, "transform", "translateY(0%)");

        const syncParallax = () => {
          parallaxCurrent += (parallaxTarget - parallaxCurrent) * 0.12;
          heroGridLayer.style.setProperty(
            "transform",
            `translateY(${-8 * parallaxCurrent}%)`,
          );
          parallaxFrame = window.requestAnimationFrame(syncParallax);
        };

        parallaxFrame = window.requestAnimationFrame(syncParallax);

        cleanupTasks.push(
          scroll(
            (progress: number) => {
              parallaxTarget = progress;
            },
            {
              target: heroSection,
              offset: ["start start", "end start"],
              axis: "y",
            },
          ),
        );

        cleanupTasks.push(() => {
          window.cancelAnimationFrame(parallaxFrame);
        });
      }

      const revealedItems = new WeakSet<Element>();
      cleanupTasks.push(
        inView(
          scrollItems,
          (element) => {
            if (revealedItems.has(element)) {
              return;
            }

            revealedItems.add(element);
            trackAnimation(
              animate(
                element,
                { opacity: 1, transform: "translateY(0px)" },
                { duration: 0.7, ease: powerThreeOut },
              ),
            );
          },
          {
            margin: "0px 0px -18% 0px",
          },
        ),
      );

      const filledLines = new WeakSet<Element>();
      cleanupTasks.push(
        inView(
          lineFills,
          (element) => {
            if (filledLines.has(element)) {
              return;
            }

            filledLines.add(element);
            trackAnimation(
              animate(
                element,
                { transform: "scaleX(1)" },
                {
                  duration: 0.9,
                  ease: powerTwoOut,
                },
              ),
            );
          },
          {
            margin: "0px 0px -12% 0px",
          },
        ),
      );

      cleanupAnimation = () => {
        animationControls.forEach((control) => {
          control.stop?.();
          control.cancel?.();
        });

        cleanupTasks
          .slice()
          .reverse()
          .forEach((cleanup) => {
            cleanup();
          });
      };
    };

    void initMotion();

    return () => {
      disposed = true;
      cleanupAnimation?.();
      cleanupLenis?.();
      document.documentElement.classList.remove("logic-scroll-theme");
      document.body.classList.remove("logic-scroll-theme");
    };
  }, [typingText]);

  return null;
}
