"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { JetBrains_Mono } from "next/font/google";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUp,
  Bolt,
  CalendarDays,
  Code2,
  FolderKanban,
  HelpCircle,
  History,
  Layers,
  Menu,
  Mic,
  Monitor,
  MoreVertical,
  Plus,
  Settings,
  Smartphone,
  TerminalSquare,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const titleWords = ["Welcome", "to", "Stitch."];

const navItems: Array<{ label: string; icon: LucideIcon; active?: boolean }> = [
  { label: "Recent", icon: History, active: true },
  { label: "Yesterday", icon: CalendarDays },
  { label: "Last 30 Days", icon: CalendarDays },
  { label: "Examples", icon: FolderKanban },
];

const projectFeed: Array<{ name: string; time: string; detail: string }> = [
  {
    name: "CORE_ENGINE_V1",
    time: "08:42",
    detail: "Optimizing shader passes...",
  },
  {
    name: "UI_SCAFFOLD_PROTOTYPE",
    time: "YEST",
    detail: "Refactoring flexbox grid...",
  },
  {
    name: "DATA_VIZ_EXPERIMENTAL",
    time: "12.04",
    detail: "Canvas API implementation",
  },
];

const quickActions: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Mobile friendly home...", icon: Smartphone },
  { label: "Layered dashboard...", icon: Layers },
  { label: "React structure scaffold...", icon: Code2 },
  { label: "System logs display...", icon: TerminalSquare },
];

const Dashboard = () => {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      const animatedTargets = [
        ".logic-topbar",
        ".logic-sidebar",
        ".logic-word",
        ".logic-chip",
        ".logic-console",
        ".logic-status",
        ".logic-image-card",
      ];

      gsap.set(animatedTargets, { willChange: "transform,opacity" });

      const timeline = gsap.timeline();

      timeline
        .from(".logic-topbar", {
          y: -26,
          opacity: 0,
          duration: 0.24,
          ease: "power4.out",
          force3D: true,
        })
        .from(
          ".logic-sidebar",
          {
            x: -52,
            opacity: 0,
            duration: 0.25,
            ease: "power4.out",
            force3D: true,
          },
          "<0.05",
        )
        .from(
          ".logic-word",
          {
            yPercent: 115,
            opacity: 0,
            stagger: 0.06,
            duration: 0.34,
            ease: "power4.out",
            force3D: true,
          },
          "<0.06",
        )
        .from(
          ".logic-chip",
          {
            y: 18,
            opacity: 0,
            stagger: 0.05,
            duration: 0.2,
            ease: "power4.out",
            force3D: true,
          },
          "<0.03",
        )
        .from(
          ".logic-console",
          {
            y: 30,
            opacity: 0,
            duration: 0.24,
            ease: "expo.out",
            force3D: true,
          },
          "<0.04",
        )
        .from(
          ".logic-status",
          {
            y: 14,
            opacity: 0,
            duration: 0.18,
            ease: "power4.out",
            force3D: true,
          },
          "<0.03",
        )
        .from(
          ".logic-image-card",
          {
            scale: 0.96,
            opacity: 0,
            stagger: 0.08,
            duration: 0.22,
            ease: "expo.out",
            force3D: true,
          },
          "<",
        )
        .from(
          ".logic-feed-item",
          {
            x: -12,
            opacity: 0,
            stagger: 0.05,
            duration: 0.18,
            ease: "power2.out",
            force3D: true,
          },
          "<0.08",
        )
        .add(() => {
          gsap.set(animatedTargets, { clearProps: "willChange" });
        });
    },
    { scope: rootRef },
  );

  return (
    <div
      ref={rootRef}
      className={cn(
        "dark relative min-h-screen overflow-hidden bg-background text-foreground",
        "selection:bg-primary selection:text-primary-foreground",
        "[--radius:2px] [--background:#111111] [--foreground:#e2e2e2]",
        "[--card:#1a1a1a] [--card-foreground:#e2e2e2] [--popover:#1a1a1a] [--popover-foreground:#f9f9f9]",
        "[--primary:#ffffff] [--primary-foreground:#000000] [--secondary:#1a1a1a] [--secondary-foreground:#f1f1f1]",
        "[--muted:#1a1a1a] [--muted-foreground:#777777] [--accent:#222222] [--accent-foreground:#f9f9f9]",
        "[--destructive:#ba1a1a] [--border:#222222] [--input:#333333] [--ring:#777777]",
      )}
    >
      <header className="logic-topbar fixed top-0 z-40 flex h-14 w-full items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur-[1px]">
        <div className="flex items-center gap-4">
          <span className="text-xl font-black tracking-[0.35em] text-primary">
            LOGIC
          </span>
          <div className="h-4 w-px bg-border" />
          <span
            className={cn(
              "text-[10px] tracking-[0.2em] text-muted-foreground",
              mono.className,
            )}
          >
            V2.0.4-STABLE
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open account panel"
          >
            <UserRound />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Open more options">
            <MoreVertical />
          </Button>
        </div>
      </header>

      <div className="flex h-screen overflow-hidden pt-14">
        <aside className="logic-sidebar hidden w-64 shrink-0 border-r border-border bg-background md:flex">
          <div className="flex h-full flex-col py-6">
            <div className="px-4">
              <p
                className={cn(
                  "px-2 text-[11px] tracking-[0.22em] text-muted-foreground",
                  mono.className,
                )}
              >
                PROJECTS
              </p>

              <nav className="mt-4 flex flex-col gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.label}
                      type="button"
                      className={cn(
                        "flex items-center gap-3 px-4 py-2 text-left transition-colors duration-75",
                        item.active
                          ? "border-l-4 border-primary bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      <span
                        className={cn(
                          "text-[11px] uppercase tracking-[0.16em]",
                          mono.className,
                        )}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="mt-8 flex flex-1 flex-col gap-4 px-4">
              {projectFeed.map((project) => (
                <button
                  key={project.name}
                  type="button"
                  className="logic-feed-item border border-border p-3 text-left transition-colors hover:border-muted-foreground"
                >
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <span className="truncate text-xs font-bold">
                      {project.name}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] text-muted-foreground",
                        mono.className,
                      )}
                    >
                      {project.time}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {project.detail}
                  </p>
                </button>
              ))}
            </div>

            <div className="mt-auto border-t border-border px-4 pt-6">
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Settings className="size-4" />
                <span
                  className={cn(
                    "text-[11px] tracking-[0.16em] uppercase",
                    mono.className,
                  )}
                >
                  Settings
                </span>
              </button>
              <button
                type="button"
                className="mt-1 flex w-full items-center gap-3 px-4 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <HelpCircle className="size-4" />
                <span
                  className={cn(
                    "text-[11px] tracking-[0.16em] uppercase",
                    mono.className,
                  )}
                >
                  Support
                </span>
              </button>
            </div>
          </div>
        </aside>

        <main className="relative flex flex-1 flex-col bg-background">
          
          <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
            <div className="logic-image-card absolute top-20 right-8 hidden h-64 w-48 rotate-3 border border-border bg-card md:block">
              <div className="h-full w-full bg-[linear-gradient(145deg,#1d1d1d_0%,#101010_42%,#262626_100%)]" />
              <div
                className={cn(
                  "absolute right-2 bottom-2 text-[9px] tracking-[0.16em] text-muted-foreground",
                  mono.className,
                )}
              >
                SYSTEM UI
              </div>
            </div>
            <div className="logic-image-card absolute bottom-36 left-8 hidden h-40 w-64 -rotate-6 border border-border bg-card md:block">
              <div className="h-full w-full bg-[radial-gradient(circle_at_22%_42%,#2d2d2d_0%,#151515_55%,#0d0d0d_100%)]" />
              <div
                className={cn(
                  "absolute right-2 bottom-2 text-[9px] tracking-[0.16em] text-muted-foreground",
                  mono.className,
                )}
              >
                CIRCUITRY
              </div>
            </div>
          </div>

          <section className="relative flex flex-1 flex-col items-center justify-center px-8 text-center">
            <Bolt className="mb-6 size-10 text-muted-foreground" />

            <h1 className="logic-hero-title flex flex-wrap justify-center gap-x-3 gap-y-1 text-5xl font-black tracking-tight text-foreground md:text-7xl">
              {titleWords.map((word) => (
                <span key={word} className="overflow-hidden">
                  <span className="logic-word inline-block">{word}</span>
                </span>
              ))}
            </h1>

            <div className="mt-8 flex max-w-3xl flex-wrap justify-center gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;

                return (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    className="logic-chip h-10 border-border bg-card/70 px-4"
                  >
                    <Icon data-icon="inline-start" />
                    <span
                      className={cn(
                        "text-[11px] uppercase tracking-[0.16em] text-muted-foreground",
                        mono.className,
                      )}
                    >
                      {action.label}
                    </span>
                  </Button>
                );
              })}
            </div>
          </section>

          {/* Prompt Box */}
          <section className="logic-console w-full max-w-4xl px-6 pb-8">
            <div className="border border-input bg-card/80 shadow-2xl shadow-black/30">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Button variant="secondary" size="xs" className="h-7 px-2">
                  <Monitor data-icon="inline-start" />
                  <span
                    className={cn(
                      "text-[10px] tracking-[0.18em] uppercase",
                      mono.className,
                    )}
                  >
                    Web
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-7 px-2 text-muted-foreground"
                >
                  <Smartphone data-icon="inline-start" />
                  <span
                    className={cn(
                      "text-[10px] tracking-[0.18em] uppercase",
                      mono.className,
                    )}
                  >
                    App
                  </span>
                </Button>
              </div>

              <div className="flex min-h-16 items-center gap-1 p-2">
                <Button variant="ghost" size="icon-sm" aria-label="Add source">
                  <Plus />
                </Button>

                <input
                  aria-label="Command input"
                  className={cn(
                    "h-10 w-full border-none bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground",
                    mono.className,
                  )}
                  placeholder="COMMAND: INPUT_NEW_DESIGN_PARAMETERS..."
                  type="text"
                  autoComplete="off"
                />

                <div className="ml-1 flex items-center gap-1 border-l border-border pl-2">
                  <Select defaultValue="flash">
                    <SelectTrigger
                      size="sm"
                      className={cn(
                        "h-8 min-w-32 border-input bg-muted text-[10px] tracking-[0.16em] uppercase",
                        mono.className,
                      )}
                    >
                      <SelectValue placeholder="3.0 FLASH" />
                    </SelectTrigger>
                    <SelectContent className="border border-input bg-card text-foreground">
                      <SelectGroup>
                        <SelectItem value="flash">3.0 FLASH</SelectItem>
                        <SelectItem value="pro">3.0 PRO</SelectItem>
                        <SelectItem value="ultra">4.0 ULTRA</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Voice input"
                  >
                    <Mic />
                  </Button>

                  <Button size="icon-sm" aria-label="Submit command">
                    <ArrowUp />
                  </Button>
                </div>
              </div>
            </div>

            <div className="logic-status mt-4 flex items-center justify-between gap-4 px-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="size-1.5 bg-primary" />
                  <span
                    className={cn(
                      "text-[9px] uppercase tracking-[0.2em] text-muted-foreground",
                      mono.className,
                    )}
                  >
                    System Ready
                  </span>
                </div>
                <span
                  className={cn(
                    "text-[9px] uppercase tracking-[0.2em] text-muted-foreground/75",
                    mono.className,
                  )}
                >
                  Latency: 14ms
                </span>
              </div>

              <span
                className={cn(
                  "text-[9px] uppercase tracking-[0.2em] text-muted-foreground/75",
                  mono.className,
                )}
              >
                Tokens: 4.2k available
              </span>
            </div>
          </section>
        </main>
      </div>

      <Button
        variant="default"
        size="icon-lg"
        aria-label="Open navigation menu"
        className="fixed right-6 bottom-6 z-50 md:hidden"
      >
        <Menu />
      </Button>
    </div>
  );
};

export default Dashboard;
