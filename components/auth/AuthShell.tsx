import type { ReactNode } from "react";
import Link from "next/link";
import { JetBrains_Mono } from "next/font/google";
import { Bot, ShieldCheck, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
});

type AuthMode = "sign-in" | "sign-up";

type AuthShellProps = {
  mode: AuthMode;
  title: string;
  subtitle: string;
  children: ReactNode;
};

const systemStats = [
  { label: "Gateway latency", value: "14ms" },
  { label: "Session hardening", value: "Enabled" },
  { label: "Workspace region", value: "IAD-01" },
];

const navByMode: Record<AuthMode, { href: string; label: string }> = {
  "sign-in": { href: "/sign-up", label: "Create account" },
  "sign-up": { href: "/sign-in", label: "Already registered" },
};

export default function AuthShell({
  mode,
  title,
  subtitle,
  children,
}: AuthShellProps) {
  const secondaryNav = navByMode[mode];

  return (
    <div
      className={cn(
        "dark relative min-h-screen overflow-hidden bg-[#0b0c0f] text-[#f4f4f4]",
        "selection:bg-white selection:text-black",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.12),transparent_24%),radial-gradient(circle_at_84%_78%,rgba(255,255,255,0.09),transparent_26%)]" />

      <header className="relative z-20 border-b border-white/10 bg-black/35 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[20px] font-black tracking-[0.32em]">
              LOGIC
            </Link>
            <span
              className={cn(
                "text-[10px] uppercase tracking-[0.2em] text-zinc-500",
                mono.className,
              )}
            >
              AUTH NODE
            </span>
          </div>

          <Link
            href={secondaryNav.href}
            className={cn(
              "text-[10px] uppercase tracking-[0.18em] text-zinc-300 transition-colors hover:text-white",
              mono.className,
            )}
          >
            {secondaryNav.label}
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-7xl items-center px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="grid w-full overflow-hidden border border-white/10 bg-black/35 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative border-b border-white/10 px-6 py-8 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-2 motion-safe:duration-500 sm:px-10 lg:border-b-0 lg:border-r lg:border-white/10 lg:px-12 lg:py-14">
            <div className="inline-flex items-center gap-2 border border-white/15 bg-black/50 px-3 py-1">
              <Sparkles className="size-3.5" />
              <span
                className={cn(
                  "text-[10px] uppercase tracking-[0.2em] text-zinc-400",
                  mono.className,
                )}
              >
                Secure UI generation workspace
              </span>
            </div>

            <h1 className="mt-5 text-3xl leading-[0.95] font-black tracking-tight text-white sm:mt-6 sm:text-5xl">
              ENTER THE
              <br />
              <span className="text-zinc-500">INTERFACE ENGINE</span>
            </h1>

            <p className="mt-6 max-w-xl border-l border-white/20 pl-4 text-sm leading-relaxed text-zinc-300 sm:text-base">
              Access your LOGIC workspace to generate production-grade UI flows,
              iterate visual systems, and ship structured design code with
              deterministic speed.
            </p>

            <div className="mt-7 hidden gap-3 sm:grid sm:grid-cols-3">
              {systemStats.map((item) => (
                <article
                  key={item.label}
                  className="border border-white/12 bg-black/45 px-4 py-4"
                >
                  <p
                    className={cn(
                      "text-[9px] uppercase tracking-[0.18em] text-zinc-500",
                      mono.className,
                    )}
                  >
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-zinc-100">
                    {item.value}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-8 hidden items-center gap-3 border border-white/12 bg-black/45 px-4 py-4 sm:flex">
              <div className="flex size-9 items-center justify-center border border-white/20 bg-black/70">
                <ShieldCheck className="size-4" />
              </div>
              <p
                className={cn(
                  "text-[11px] uppercase tracking-[0.16em] text-zinc-400",
                  mono.className,
                )}
              >
                Session policies and model access are audited in real time.
              </p>
            </div>
          </section>

          <section className="px-6 py-7 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 motion-safe:duration-500 sm:px-10 sm:py-10 lg:px-12 lg:py-14">
            <div className="mb-7 flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p
                  className={cn(
                    "text-[9px] uppercase tracking-[0.2em] text-zinc-500",
                    mono.className,
                  )}
                >
                  {mode === "sign-in"
                    ? "Credential verification"
                    : "Account provisioning"}
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                  {title}
                </h2>
                <p className="mt-2 max-w-md text-sm text-zinc-400">
                  {subtitle}
                </p>
              </div>

              <div className="hidden border border-white/12 bg-black/50 p-2 sm:flex">
                <Bot className="size-4 text-zinc-300" />
              </div>
            </div>

            {children}
          </section>
        </div>
      </main>
    </div>
  );
}
