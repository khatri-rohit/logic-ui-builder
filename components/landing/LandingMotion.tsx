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
      const [{ default: gsap }, { ScrollTrigger }, { default: Lenis }] =
        await Promise.all([
          import("gsap"),
          import("gsap/ScrollTrigger"),
          import("lenis"),
        ]);

      if (disposed) {
        return;
      }

      gsap.registerPlugin(ScrollTrigger);

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
        lenis.on("scroll", ScrollTrigger.update);

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

      const context = gsap.context(() => {
        gsap.set(
          [
            ".hero-canvas",
            ".stagger-card",
            ".scroll-item",
            ".line-fill",
            ".line-sweep",
          ],
          {
            willChange: "transform, opacity",
          },
        );

        gsap.set([".line-fill", ".line-sweep"], {
          transformOrigin: "left center",
          scaleX: 0,
        });

        const heroTimeline = gsap.timeline({
          defaults: { ease: "power3.out" },
        });

        heroTimeline
          .from(".logic-nav", {
            y: -24,
            opacity: 0,
            duration: 0.45,
            force3D: true,
          })
          .from(
            [
              ".hero-kicker",
              ".hero-title",
              ".hero-description",
              ".hero-terminal",
            ],
            {
              y: 30,
              opacity: 0,
              duration: 0.6,
              stagger: 0.1,
              force3D: true,
            },
            "-=0.1",
          )
          .to(
            ".line-sweep",
            {
              scaleX: 1,
              duration: 0.6,
              stagger: 0.08,
              ease: "power2.out",
            },
            "-=0.3",
          )
          .from(
            ".hero-canvas",
            {
              y: 40,
              scale: 0.98,
              opacity: 0,
              duration: 0.8,
              force3D: true,
            },
            "-=0.35",
          )
          .from(
            ".stagger-card",
            {
              y: 24,
              opacity: 0,
              //   duration: 0.45,
              stagger: 0.08,
              force3D: true,
            },
            "-=0.3",
          );

        const typedState = { count: 0 };
        gsap.to(typedState, {
          count: typingText.length,
          duration: 2.6,
          ease: "none",
          onUpdate: () => {
            if (!typingTarget) {
              return;
            }

            typingTarget.textContent = typingText.slice(
              0,
              Math.floor(typedState.count),
            );
          },
        });

        gsap.to("[data-typing-cursor]", {
          opacity: 0,
          duration: 0.5,
          repeat: -1,
          yoyo: true,
          ease: "none",
        });

        gsap.to(".hero-grid-layer", {
          yPercent: -8,
          ease: "none",
          scrollTrigger: {
            trigger: ".hero-section",
            start: "top top",
            end: "bottom top",
            scrub: 1,
          },
        });

        gsap.utils.toArray<HTMLElement>(".scroll-item").forEach((element) => {
          gsap.from(element, {
            y: 36,
            opacity: 0,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: {
              trigger: element,
              start: "top 82%",
            },
          });
        });

        gsap.utils.toArray<HTMLElement>(".line-fill").forEach((line) => {
          gsap.to(line, {
            scaleX: 1,
            duration: 0.9,
            ease: "power2.out",
            scrollTrigger: {
              trigger: line,
              start: "top 88%",
            },
          });
        });
      }, root);

      cleanupAnimation = () => context.revert();
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
