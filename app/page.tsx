"use client";

import Link from "next/link";
import { useRef } from "react";
import { JetBrains_Mono } from "next/font/google";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

const terminalFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-logic-mono",
});

const TYPING_TEXT = "Generate a sleek fintech mobile app...";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function Home() {
  const rootRef = useRef<HTMLDivElement>(null);
  const typingRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (!rootRef.current) {
        return;
      }

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        if (typingRef.current) {
          typingRef.current.textContent = TYPING_TEXT;
        }
        return;
      }

      gsap.set([".hero-canvas", ".stagger-card", ".scroll-item"], {
        willChange: "transform, opacity",
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
        .from(
          ".hero-canvas",
          {
            y: 40,
            scale: 0.98,
            opacity: 0,
            duration: 0.8,
            force3D: true,
          },
          "-=0.4",
        )
        .from(
          ".stagger-card",
          {
            y: 24,
            opacity: 0,
            duration: 0.45,
            stagger: 0.08,
            force3D: true,
          },
          "-=0.35",
        );

      const typedState = { count: 0 };
      gsap.to(typedState, {
        count: TYPING_TEXT.length,
        duration: 2.6,
        ease: "none",
        onUpdate: () => {
          if (typingRef.current) {
            typingRef.current.textContent = TYPING_TEXT.slice(
              0,
              Math.floor(typedState.count),
            );
          }
        },
      });

      gsap.to(".typing-cursor", {
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
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className={`logic-root ${terminalFont.variable}`}>
      <nav className="logic-nav fixed left-0 top-0 z-50 flex w-full max-w-full items-center justify-between border-b border-[#EEEEEE] bg-[#f9f9f9] px-6 py-4">
        <div className="text-2xl font-black uppercase tracking-tighter text-black">
          LOGIC
        </div>
        <Link
          href="/mvp"
          className="border border-black bg-black px-4 py-2 font-bold text-white transition-all duration-100 ease-in-out hover:bg-white hover:text-black active:scale-95"
        >
          Try Now
        </Link>
      </nav>

      <main className="space-y-0 pt-24">
        <section className="hero-section min-h-screen border-b border-[#c6c6c6]">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="hero-left border-r border-[#c6c6c6] bg-white p-12 lg:col-span-5">
              <div className="hero-kicker mono mb-4 flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#777777]">
                <span className="h-2 w-2 animate-pulse bg-black" />
                SYSTEM_READY: v4.0.2
              </div>

              <h1 className="hero-title mb-8 text-[clamp(3rem,8vw,5rem)] leading-[0.9] font-black tracking-tighter">
                THE <span className="text-[#777777]">INTERFACE</span> ENGINE.
              </h1>

              <p className="hero-description mb-12 max-w-md border-l-2 border-black pl-6 text-lg">
                A digital scalpel for the high-performance architect. Generate
                layouts at the speed of thought with our neural CAD engine.
              </p>

              <div className="hero-terminal relative overflow-hidden bg-black p-6 text-sm text-white">
                <div className="mono mb-4 flex items-center gap-2 border-b border-zinc-800 pb-2 text-zinc-500">
                  TERMINAL prompt_input
                </div>
                <div className="mono flex gap-2">
                  <span className="text-[#5e5e5e]">&gt;</span>
                  <span ref={typingRef} className="typing-text" />
                  <span className="typing-cursor inline-block w-2 bg-white" />
                </div>
              </div>
            </div>

            <div className="hero-grid-layer hero-canvas grid-bg relative flex items-center justify-center overflow-hidden bg-white p-8 lg:col-span-7">
              <div className="w-full max-w-2xl border border-black bg-[#f9f9f9] shadow-[20px_20px_0px_0px_rgba(0,0,0,0.05)]">
                <div className="flex h-8 items-center gap-2 border-b border-[#c6c6c6] bg-[#f4f3f3] px-4">
                  <div className="h-2 w-2 rounded-full bg-[#c6c6c6]" />
                  <div className="h-2 w-2 rounded-full bg-[#c6c6c6]" />
                  <div className="h-2 w-2 rounded-full bg-[#c6c6c6]" />
                  <span className="mono ml-4 text-[10px] text-[#777777]">
                    CANVAS_ACTIVE [0.0ms]
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 p-8">
                  <div className="stagger-card flex h-24 flex-col justify-between border border-[#c6c6c6] bg-white p-4">
                    <div className="h-1 w-1/2 bg-[#c6c6c6]" />
                    <div className="h-8 w-8 rounded-full border border-[#c6c6c6]" />
                  </div>
                  <div className="stagger-card translate-y-4 border border-black bg-black p-4">
                    <div className="h-1 w-2/3 bg-white/20" />
                  </div>
                  <div className="stagger-card -translate-x-4 border border-[#c6c6c6] bg-white p-4">
                    <div className="h-4 w-full bg-[#eeeeee]" />
                  </div>
                  <div className="stagger-card col-span-2 -translate-y-8 translate-x-12 scale-95 border border-[#c6c6c6] bg-white p-6">
                    <div className="h-1 w-full bg-[#c6c6c6]" />
                    <div className="mt-2 h-1 w-3/4 bg-[#c6c6c6]" />
                    <div className="mt-2 h-1 w-1/2 bg-[#c6c6c6]" />
                  </div>
                  <div className="stagger-card flex h-32 items-center justify-center border border-black bg-[#e2e2e2] p-4">
                    <span className="mono text-3xl">METRICS</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#c6c6c6] bg-[#f9f9f9]">
          <div className="grid grid-cols-1 divide-x divide-[#c6c6c6] md:grid-cols-2">
            <div className="scroll-item space-y-8 p-12">
              <div className="flex items-start justify-between">
                <h2 className="text-3xl font-black uppercase">Web Viewport</h2>
                <div className="mono bg-black px-2 py-1 text-[10px] text-white">
                  1440px x 900px
                </div>
              </div>
              <div className="aspect-video overflow-hidden border border-[#c6c6c6] bg-white">
                <img
                  className="h-full w-full object-cover grayscale"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuC7HE3z3JuyRdugqGHc314nkIFT3jNYkiL52aXy-xZ9oR1i2iiaEG7I-Yrhb4L4guTFOYXk5Krz1nd4a0Z6JCr-8SQ03Gi9zF1H7uzM4YXzzPQTKaGQrb37QSflpgnQkHU-W1nwA-cEKNaXDJ0zuKwjAONc65o7fhCW4muDGlfcK6Cq43hDAJ_tRhdodcmo-Wc1jxUCfceyCCQw1SdQDgO7VnxctdKVQT_M6zEwriKJEK5BW6pW99Sw4IAlxuOIMngyQVhi8KqEat4v"
                  alt="Minimal desktop dashboard with monochrome charts"
                />
              </div>
              <div className="grid grid-cols-3 gap-1">
                <div className="mono border border-[#c6c6c6] p-4 text-[10px] text-[#777777]">
                  flex-direction: column
                </div>
                <div className="mono border border-[#c6c6c6] p-4 text-[10px] text-[#777777]">
                  auto-layout: true
                </div>
                <div className="mono border border-[#c6c6c6] p-4 text-[10px] text-[#777777]">
                  gap: 32px
                </div>
              </div>
            </div>

            <div className="scroll-item space-y-8 bg-[#f4f3f3] p-12">
              <div className="flex items-start justify-between">
                <h2 className="text-3xl font-black uppercase">Mobile Sync</h2>
                <div className="mono bg-black px-2 py-1 text-[10px] text-white">
                  390px x 844px
                </div>
              </div>
              <div className="flex justify-center">
                <div className="h-96 w-48 overflow-hidden border-4 border-black bg-white p-1">
                  <img
                    className="h-full w-full object-cover grayscale"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuA0sP-7OYGyRiEHTSFTisqPV0LtpVH4BPQFrx3i--zT5cA_58uk-D49RkFcYz6VVklFWJI_XXsKg3CsIl4Z1lj588bQ3i3tu2kQpZOMhoBG_eaO9tiHkiSRQBdsFsrmNMwDJIyUcMVakcIIwePOs13VjqQStWYXWcp0raqLMNriXRmKE442k9r7umdCj2VEOKr55WkqdjbH04x4hygWzw8w-iyTjFGVhXKypjXAMBpBkQUste6bw4QkT8QnOXpgVYU1BsM7wgNvNpts"
                    alt="Mobile finance design in black and white"
                  />
                </div>
              </div>
              <div className="mono flex items-center justify-between border border-[#c6c6c6] bg-white p-4 text-[10px] text-black">
                <span>SYNC_STATUS</span>
                <span className="font-bold">LIVE_REFLOW</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-8 border-b border-[#c6c6c6] bg-[#eeeeee] p-12 md:grid-cols-12">
          <div className="scroll-item space-y-4 md:col-span-8">
            <div className="mono text-xs uppercase tracking-[0.2em] text-[#777777]">
              Model Performance Matrices
            </div>
            <h3 className="text-5xl leading-none font-black tracking-tighter">
              LATENCY VS. CREATIVE DEPTH
            </h3>
          </div>

          <div className="scroll-item flex h-64 flex-col justify-between border border-black bg-white p-8 md:col-span-6">
            <div>
              <span className="mono text-xs text-[#777777]">
                NEURAL_CORE_01
              </span>
              <h4 className="mt-2 text-2xl font-black uppercase">
                Precision Speed
              </h4>
            </div>
            <div className="space-y-2">
              <div className="mono flex justify-between text-[10px]">
                <span>LATENCY</span>
                <span>12ms</span>
              </div>
              <div className="h-2 bg-[#eeeeee]">
                <div className="h-full w-[95%] bg-black" />
              </div>
            </div>
          </div>

          <div className="scroll-item flex h-64 flex-col justify-between border border-[#c6c6c6] bg-[#f9f9f9] p-8 md:col-span-6">
            <div>
              <span className="mono text-xs text-[#777777]">
                DEPTH_ENGINE_02
              </span>
              <h4 className="mt-2 text-2xl font-black uppercase">
                Creative Complexity
              </h4>
            </div>
            <div className="space-y-2">
              <div className="mono flex justify-between text-[10px]">
                <span>RECURSION_DEPTH</span>
                <span>8.4 / 10</span>
              </div>
              <div className="h-2 bg-[#eeeeee]">
                <div className="h-full w-[84%] bg-[#c6c6c6]" />
              </div>
            </div>
          </div>

          <div className="scroll-item h-80 overflow-hidden border border-[#c6c6c6] bg-black p-8 text-white md:col-span-4">
            <p className="mono text-xs leading-relaxed text-zinc-400">
              Proprietary layout algorithms that respect the rule of thirds
              while maximizing data density for expert-level operators.
            </p>
            <div className="mt-8 border-t border-zinc-800 pt-8">
              <div className="text-3xl font-bold tracking-tighter">
                99.9% ACCURACY
              </div>
            </div>
          </div>

          <div className="scroll-item grid-bg relative h-80 border border-[#c6c6c6] bg-white p-12 md:col-span-8">
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-10">
              <span className="text-[12rem] font-black">LOGIC</span>
            </div>
            <div className="relative z-10">
              <h4 className="mb-4 text-2xl font-black">OPTIMIZED OUTPUT</h4>
              <p className="max-w-md">
                Our models do not guess. They compute optimal UX flows based on
                millions of analyzed interface interactions.
              </p>
            </div>
          </div>
        </section>

        <section className="scroll-item relative flex min-h-[614px] flex-col items-center justify-center bg-white p-12">
          <div className="space-y-6 text-center">
            <h2 className="text-[clamp(2.5rem,8vw,5rem)] font-black tracking-tighter">
              READY TO DEPLOY?
            </h2>
            <p className="mono text-sm text-[#777777]">
              INITIALIZE_SESSION_REQUESTED
            </p>

            <div className="mx-auto mt-12 w-full max-w-2xl space-y-4">
              <div className="group border-2 border-black bg-black p-8 text-white transition-all duration-300 hover:bg-white hover:text-black">
                <div className="text-3xl font-black uppercase tracking-tighter">
                  Start Building for Free
                </div>
                <div className="mt-6 flex gap-2">
                  <input
                    className="mono w-full border-0 border-b border-current bg-transparent text-lg uppercase outline-none"
                    placeholder="ENTER WORK EMAIL"
                    type="email"
                    aria-label="Work email"
                  />
                  <button
                    type="button"
                    className="bg-black px-8 py-2 text-sm font-bold text-white transition-all hover:bg-neutral-800"
                  >
                    JOIN
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="mono flex items-center justify-center gap-2 border border-[#c6c6c6] p-2 text-xs">
                  GOOGLE_AUTH
                </div>
                <div className="mono flex items-center justify-center gap-2 border border-[#c6c6c6] p-2 text-xs">
                  GITHUB_AUTH
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="flex w-full flex-col items-center justify-between gap-4 border-t border-[#EEEEEE] bg-[#f9f9f9] px-6 py-8 md:flex-row">
        <div className="text-lg font-black uppercase tracking-tight text-black">
          LOGIC
        </div>
        <div className="mono text-[10px] uppercase tracking-widest text-[#777777]">
          (c) 2026 LOGIC PRECISION INSTRUMENTS. ALL RIGHTS RESERVED.
        </div>
      </footer>

      <style jsx>{`
        .logic-root {
          background: #f9f9f9;
          color: #1a1c1c;
        }

        .logic-root .mono {
          font-family: var(--font-logic-mono), monospace;
        }

        .logic-root .grid-bg {
          background-image:
            linear-gradient(#eeeeee 1px, transparent 1px),
            linear-gradient(90deg, #eeeeee 1px, transparent 1px);
          background-size: 32px 32px;
        }
      `}</style>
    </div>
  );
}
