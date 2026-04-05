"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { JetBrains_Mono } from "next/font/google";
import { useRouter } from "next/navigation";
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
  X,
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
import Link from "next/link";

gsap.registerPlugin(useGSAP);

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const titleWords = ["Welcome", "to", "Stitch."];

const navItems: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Recent", icon: History },
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

type DashboardPlatform = "web" | "mobile";

const quickActions: Array<{
  label: string;
  icon: LucideIcon;
  prompt: string;
  platform: DashboardPlatform;
}> = [
  {
    label: "Mobile friendly home...",
    icon: Smartphone,
    prompt:
      "Design a mobile-first homepage with onboarding, social proof, and a clear CTA section.",
    platform: "mobile",
  },
  {
    label: "Layered dashboard...",
    icon: Layers,
    prompt:
      "Build a layered analytics dashboard with KPI cards, trend charts, and a filter sidebar.",
    platform: "web",
  },
  {
    label: "React structure scaffold...",
    icon: Code2,
    prompt:
      "Generate a clean React app scaffold with reusable components, routes, and design tokens.",
    platform: "web",
  },
  {
    label: "System logs display...",
    icon: TerminalSquare,
    prompt:
      "Create an operations log screen with severity filters, search, and timeline grouping.",
    platform: "web",
  },
];

const Dashboard = () => {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const commandInputRef = useRef<HTMLInputElement | null>(null);

  const [activeNavItem, setActiveNavItem] = useState(
    navItems[0]?.label ?? "Recent",
  );
  const [platform, setPlatform] = useState<DashboardPlatform>("web");
  const [command, setCommand] = useState("");
  const [selectedModel, setSelectedModel] = useState("flash");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const canSubmit = command.trim().length > 0;

  const handleQuickAction = (action: (typeof quickActions)[number]) => {
    setCommand(action.prompt);
    setPlatform(action.platform);

    requestAnimationFrame(() => {
      commandInputRef.current?.focus();
    });
  };

  const handleSubmit = () => {
    const normalizedPrompt = command.trim();

    if (!normalizedPrompt) {
      return;
    }

    const params = new URLSearchParams({
      prompt: normalizedPrompt,
      platform,
      model: selectedModel,
    });

    router.push(`/studio?${params.toString()}`);
  };

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
      const chipRevealFallback = window.setTimeout(() => {
        gsap.set(".logic-chip", {
          opacity: 1,
          y: 0,
          clearProps: "transform,opacity",
        });
      }, 1200);

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
        .fromTo(
          ".logic-chip",
          {
            y: 16,
            opacity: 0,
          },
          {
            y: 0,
            opacity: 1,
            stagger: 0.06,
            duration: 0.2,
            ease: "power4.out",
            force3D: true,
            immediateRender: false,
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
          window.clearTimeout(chipRevealFallback);
          gsap.set(animatedTargets, { clearProps: "willChange" });
        });

      return () => {
        window.clearTimeout(chipRevealFallback);
      };
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
          <Link href="/" className="text-xl font-black tracking-[0.35em] text-primary">
            LOGIC
          </Link>
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
                      onClick={() => setActiveNavItem(item.label)}
                      aria-current={
                        activeNavItem === item.label ? "page" : undefined
                      }
                      className={cn(
                        "flex items-center gap-3 px-4 py-2 text-left transition-colors duration-75",
                        activeNavItem === item.label
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

        <main className="relative flex flex-1 flex-col overflow-y-auto bg-background">
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

          <section className="relative flex flex-1 w-full flex-col items-center justify-center gap-6 px-8 py-6 text-center">
            <Bolt className="mb-2 size-10 text-muted-foreground" />

            <h1 className="logic-hero-title flex flex-wrap justify-center gap-x-3 gap-y-1 text-4xl font-black tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
              {titleWords.map((word) => (
                <span key={word} className="overflow-hidden">
                  <span className="logic-word inline-block">{word}</span>
                </span>
              ))}
            </h1>

            <div className="mt-4 flex max-w-3xl flex-wrap justify-center gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;

                return (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction(action)}
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
            {/* Prompt Box */}
            <section className="logic-console mt-6 w-full max-w-4xl text-left sm:px-6">
              <div className="border border-input bg-card/80 shadow-2xl shadow-black/30">
                <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                  <Button
                    variant={platform === "web" ? "secondary" : "ghost"}
                    size="xs"
                    className={cn(
                      "h-7 px-2",
                      platform === "mobile" && "text-muted-foreground",
                    )}
                    onClick={() => setPlatform("web")}
                    aria-pressed={platform === "web"}
                  >
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
                    variant={platform === "mobile" ? "secondary" : "ghost"}
                    size="xs"
                    className={cn(
                      "h-7 px-2",
                      platform === "web" && "text-muted-foreground",
                    )}
                    onClick={() => setPlatform("mobile")}
                    aria-pressed={platform === "mobile"}
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
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Add source"
                  >
                    <Plus />
                  </Button>

                  <input
                    ref={commandInputRef}
                    aria-label="Command input"
                    className={cn(
                      "h-10 w-full border-none bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground",
                      mono.className,
                    )}
                    placeholder="COMMAND: INPUT_NEW_DESIGN_PARAMETERS..."
                    type="text"
                    value={command}
                    onChange={(event) => setCommand(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleSubmit();
                      }
                    }}
                    autoComplete="off"
                  />

                  <div className="ml-1 flex items-center gap-1 border-l border-border pl-2">
                    <Select
                      value={selectedModel}
                      onValueChange={setSelectedModel}
                    >
                      <SelectTrigger
                        size="sm"
                        className={cn(
                          "h-8 min-w-32 border-input bg-muted text-[10px] tracking-[0.16em] uppercase",
                          mono.className,
                        )}
                      >
                        <SelectValue placeholder="3.0 FLASH" />
                      </SelectTrigger>
                      <SelectContent className="mt-10 min-w-32 border border-input bg-muted text-foreground">
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

                    <Button
                      size="icon-sm"
                      aria-label="Submit command"
                      onClick={handleSubmit}
                      disabled={!canSubmit}
                    >
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
                      {canSubmit ? "Prompt Ready" : "System Ready"}
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
          </section>
        </main>
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation menu backdrop"
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute inset-0 bg-black/60"
          />

          <aside className="absolute right-0 top-0 flex h-full w-[85vw] max-w-sm flex-col border-l border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <span
                className={cn(
                  "text-[11px] uppercase tracking-[0.18em]",
                  mono.className,
                )}
              >
                Navigation
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close navigation menu"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X />
              </Button>
            </div>

            <nav className="flex flex-col gap-1 px-3 py-4">
              {navItems.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={`mobile-${item.label}`}
                    type="button"
                    onClick={() => {
                      setActiveNavItem(item.label);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-left",
                      activeNavItem === item.label
                        ? "bg-primary text-primary-foreground"
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

            <div className="border-t border-border px-3 py-4">
              {projectFeed.map((project) => (
                <button
                  key={`mobile-feed-${project.name}`}
                  type="button"
                  className="mb-2 flex w-full flex-col border border-border p-3 text-left"
                >
                  <span className="truncate text-xs font-bold">
                    {project.name}
                  </span>
                  <span
                    className={cn(
                      "mt-1 text-[10px] text-muted-foreground",
                      mono.className,
                    )}
                  >
                    {project.time} - {project.detail}
                  </span>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}

      <Button
        variant="default"
        size="icon-lg"
        aria-label="Open navigation menu"
        className="fixed right-6 bottom-6 z-50 md:hidden"
        onClick={() => setIsMobileMenuOpen(true)}
      >
        <Menu />
      </Button>
    </div>
  );
};

export default Dashboard;
