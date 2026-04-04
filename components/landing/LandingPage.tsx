"use client";

import Image from "next/image";
import { JetBrains_Mono } from "next/font/google";
import { LandingFooter } from "@/components/landing/Footer";
import { LandingHeader } from "@/components/landing/Header";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { ReadyToDeploySection } from "@/components/landing/ReadyToDeploySection";
import styles from "./page.module.css";

const terminalFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-logic-mono",
});

const TYPING_TEXT = "Generate a sleek fintech mobile app...";

const LandingPage = () => {
  return (
    <div
      data-logic-root
      className={`${styles.logicRoot} ${terminalFont.variable}`}
    >
      <LandingHeader />

      <main className="space-y-0 pt-24">
        <section className="hero-section flex min-h-screen items-center justify-center border-b border-(--logic-border)">
          <div className="grid grid-cols-1 lg:grid-cols-12 mb-50">
            <div className="hero-left border-r border-(--logic-border) bg-white p-12 lg:col-span-5">
              <div className="hero-kicker mono mb-4 flex items-center gap-2 text-xs uppercase tracking-widest text-(--logic-muted)">
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
                  <span data-typing-target className="typing-text" />
                  <span
                    data-typing-cursor
                    className="typing-cursor inline-block w-2 bg-white"
                  />
                </div>
              </div>
            </div>

            <div
              className={`hero-grid-layer hero-canvas relative flex items-center justify-center overflow-hidden bg-white p-8 lg:col-span-7 ${styles.gridBg}`}
            >
              <div className="w-full max-w-2xl border border-black bg-(--logic-bg) shadow-[20px_20px_0px_0px_rgba(0,0,0,0.05)]">
                <div className="flex h-8 items-center gap-2 border-b border-(--logic-border) bg-(--logic-surface-muted) px-4">
                  <div className="h-2 w-2 rounded-full bg-(--logic-border)" />
                  <div className="h-2 w-2 rounded-full bg-(--logic-border)" />
                  <div className="h-2 w-2 rounded-full bg-(--logic-border)" />
                  <span className="mono ml-4 text-xs text-(--logic-muted)">
                    CANVAS_ACTIVE [0.0ms]
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 p-8">
                  <div className="stagger-card flex h-24 flex-col justify-between border border-(--logic-border) bg-white p-4">
                    <div className="line-sweep h-1 w-1/2 bg-(--logic-border)" />
                    <div className="h-8 w-8 rounded-full border border-(--logic-border)" />
                  </div>
                  <div className="stagger-card translate-y-4 border border-black bg-black p-4">
                    <div className="line-sweep h-1 w-2/3 bg-white/20" />
                  </div>
                  <div className="stagger-card -translate-x-4 border border-(--logic-border) bg-white p-4">
                    <div className="line-sweep h-4 w-full bg-(--logic-surface-subtle)" />
                  </div>
                  <div className="stagger-card col-span-2 -translate-y-8 translate-x-12 scale-95 border border-(--logic-border) bg-white p-6">
                    <div className="line-sweep h-1 w-full bg-(--logic-border)" />
                    <div className="line-sweep mt-2 h-1 w-3/4 bg-(--logic-border)" />
                    <div className="line-sweep mt-2 h-1 w-1/2 bg-(--logic-border)" />
                  </div>
                  <div className="stagger-card flex h-32 items-center justify-center border border-black bg-(--logic-surface-subtle) p-4">
                    <span className="mono text-3xl">METRICS</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-(--logic-border) bg-(--logic-bg)">
          <div className="grid grid-cols-1 divide-x divide-(--logic-border) md:grid-cols-2">
            <div className="scroll-item space-y-8 p-12">
              <div className="flex items-start justify-between">
                <h2 className="text-3xl font-black uppercase">Web Viewport</h2>
                <div className="mono bg-black px-2 py-1 text-xs text-white">
                  1440px x 900px
                </div>
              </div>
              <div className="relative aspect-video overflow-hidden border border-(--logic-border) bg-white">
                <Image
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="h-full w-full object-cover grayscale"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuC7HE3z3JuyRdugqGHc314nkIFT3jNYkiL52aXy-xZ9oR1i2iiaEG7I-Yrhb4L4guTFOYXk5Krz1nd4a0Z6JCr-8SQ03Gi9zF1H7uzM4YXzzPQTKaGQrb37QSflpgnQkHU-W1nwA-cEKNaXDJ0zuKwjAONc65o7fhCW4muDGlfcK6Cq43hDAJ_tRhdodcmo-Wc1jxUCfceyCCQw1SdQDgO7VnxctdKVQT_M6zEwriKJEK5BW6pW99Sw4IAlxuOIMngyQVhi8KqEat4v"
                  alt="Minimal desktop dashboard with monochrome charts"
                />
              </div>
              <div className="grid grid-cols-3 gap-1">
                <div className="mono border border-(--logic-border) p-4 text-xs text-(--logic-muted)">
                  flex-direction: column
                </div>
                <div className="mono border border-(--logic-border) p-4 text-xs text-(--logic-muted)">
                  auto-layout: true
                </div>
                <div className="mono border border-(--logic-border) p-4 text-xs text-(--logic-muted)">
                  gap: 32px
                </div>
              </div>
            </div>

            <div className="scroll-item space-y-8 bg-(--logic-surface-muted) p-12">
              <div className="flex items-start justify-between">
                <h2 className="text-3xl font-black uppercase">Mobile Sync</h2>
                <div className="mono bg-black px-2 py-1 text-xs text-white">
                  390px x 844px
                </div>
              </div>
              <div className="flex justify-center">
                <div className="relative h-96 w-48 overflow-hidden border-4 border-black bg-white">
                  <Image
                    fill
                    sizes="192px"
                    className="h-full w-full object-cover grayscale"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuA0sP-7OYGyRiEHTSFTisqPV0LtpVH4BPQFrx3i--zT5cA_58uk-D49RkFcYz6VVklFWJI_XXsKg3CsIl4Z1lj588bQ3i3tu2kQpZOMhoBG_eaO9tiHkiSRQBdsFsrmNMwDJIyUcMVakcIIwePOs13VjqQStWYXWcp0raqLMNriXRmKE442k9r7umdCj2VEOKr55WkqdjbH04x4hygWzw8w-iyTjFGVhXKypjXAMBpBkQUste6bw4QkT8QnOXpgVYU1BsM7wgNvNpts"
                    alt="Mobile finance design in black and white"
                  />
                </div>
              </div>
              <div className="mono flex items-center justify-between border border-(--logic-border) bg-white p-4 text-xs text-black">
                <span>SYNC_STATUS</span>
                <span className="font-bold">LIVE_REFLOW</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-8 border-b border-(--logic-border) bg-(--logic-surface-subtle) p-12 md:grid-cols-12">
          <div className="scroll-item space-y-4 md:col-span-8">
            <div className="mono text-xs uppercase tracking-[0.2em] text-(--logic-muted)">
              Model Performance Matrices
            </div>
            <h3 className="text-5xl leading-none font-black tracking-tighter">
              LATENCY VS. CREATIVE DEPTH
            </h3>
          </div>

          <div className="scroll-item flex h-64 flex-col justify-between border border-black bg-white p-8 md:col-span-6">
            <div>
              <span className="mono text-xs text-(--logic-muted)">
                NEURAL_CORE_01
              </span>
              <h4 className="mt-2 text-2xl font-black uppercase">
                Precision Speed
              </h4>
            </div>
            <div className="space-y-2">
              <div className="mono flex justify-between text-xs">
                <span>LATENCY</span>
                <span>12ms</span>
              </div>
              <div className="h-2 bg-(--logic-surface-subtle)">
                <div className="line-fill h-full w-[95%] bg-black" />
              </div>
            </div>
          </div>

          <div className="scroll-item flex h-64 flex-col justify-between border border-(--logic-border) bg-(--logic-bg) p-8 md:col-span-6">
            <div>
              <span className="mono text-xs text-(--logic-muted)">
                DEPTH_ENGINE_02
              </span>
              <h4 className="mt-2 text-2xl font-black uppercase">
                Creative Complexity
              </h4>
            </div>
            <div className="space-y-2">
              <div className="mono flex justify-between text-xs">
                <span>RECURSION_DEPTH</span>
                <span>8.4 / 10</span>
              </div>
              <div className="h-2 bg-(--logic-surface-subtle)">
                <div className="line-fill h-full w-[84%] bg-(--logic-border)" />
              </div>
            </div>
          </div>

          <div className="scroll-item h-80 overflow-hidden border border-(--logic-border) bg-black p-8 text-white md:col-span-4">
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

          <div
            className={`scroll-item relative h-80 border border-(--logic-border) bg-white p-12 md:col-span-8 ${styles.gridBg}`}
          >
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
        <ReadyToDeploySection />
      </main>

      <LandingFooter />
      <LandingMotion typingText={TYPING_TEXT} />
    </div>
  );
};

export default LandingPage;
