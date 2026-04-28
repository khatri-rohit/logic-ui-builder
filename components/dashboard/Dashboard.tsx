"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { JetBrains_Mono } from "next/font/google";
import { useRouter } from "next/navigation";
import { Crown, Loader2, LucideIcon } from "lucide-react";
import {
  ArrowUp,
  Bolt,
  Layers,
  Menu,
  Mic,
  Monitor,
  Plus,
  Smartphone,
  TerminalSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSpeechRecognition } from "../../lib/hooks/useSpeechRecognition";
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
import { UserButton } from "@clerk/nextjs";
import {
  clerkUserButtonAppearance,
  clerkUserProfileAppearance,
} from "@/lib/clerkAppearance";
import SideBar from "./SideBar";
import { useUserActivityStore } from "@/providers/zustand-provider";
import { useCreateProjectMutation } from "@/lib/projects/queries";
import { useOrgQuery } from "@/lib/org/queries";
import { PricingModal } from "./PricingModal";
import logger from "@/lib/logger";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const titleWords = ["Welcome", "to", "LOGIC."];

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
    label: "System logs display...",
    icon: TerminalSquare,
    prompt:
      "Create an operations log screen with severity filters, search, and timeline grouping.",
    platform: "web",
  },
];

const MAX_PROMPT_HEIGHT = 220;

const Dashboard = () => {
  const spec = useUserActivityStore((state) => state.spec);
  const setSpec = useUserActivityStore((state) => state.setSpec);
  const selectedModel = useUserActivityStore((state) => state.model);
  const setSelectedModel = useUserActivityStore((state) => state.setModel);

  const {
    mutateAsync: createProject,
    isPending: isCreatingProject,
    isIdle,
  } = useCreateProjectMutation();
  const router = useRouter();

  const shouldReduceMotion = useReducedMotion();
  const { data: org } = useOrgQuery();
  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPricingModalOpen, setPricingModalOpen] = useState(false);

  const commandInputRef = useRef<HTMLTextAreaElement | null>(null);
  const launcherButtonRef = useRef<HTMLButtonElement | null>(null);

  const {
    isListening,
    error: speechError,
    isSupported: isSpeechSupported,
    startListening,
    stopListening,
    clearTranscript,
    onTranscriptReady,
  } = useSpeechRecognition("en-US");
  // logger.log("Speech recognition support:", isSpeechSupported);
  // logger.log("Speech recognition speechError:", speechError);

  const canSubmit = command.trim().length > 0 && !isCreatingProject;

  const fadeUp = (delay = 0) =>
    shouldReduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: {
            delay,
            duration: 0.28,
            ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
          },
        };

  const scaleIn = (delay = 0) =>
    shouldReduceMotion
      ? {}
      : {
          initial: { opacity: 0, scale: 0.98 },
          animate: { opacity: 1, scale: 1 },
          transition: {
            delay,
            duration: 0.24,
            ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
          },
        };

  const handleQuickAction = (action: (typeof quickActions)[number]) => {
    setCommand(action.prompt);
    setSpec(action.platform);

    requestAnimationFrame(() => {
      commandInputRef.current?.focus();
    });
  };

  const handleSubmit = async () => {
    const normalizedPrompt = command.trim();

    if (!normalizedPrompt) {
      return;
    }

    setError(null);

    try {
      const createdProject = await createProject({
        prompt: normalizedPrompt,
      });

      if (!createdProject.projectId) {
        setError("Project created but failed to resolve project id.");
        return;
      }

      router.push(`/projects/${createdProject.projectId}`);
    } catch {
      setError(
        "Failed to initiate new design. Please check your connection and try again.",
      );
    }
  };

  useEffect(() => {
    const promptInput = commandInputRef.current;

    if (!promptInput) {
      return;
    }

    promptInput.style.height = "0px";
    const nextHeight = Math.min(promptInput.scrollHeight, MAX_PROMPT_HEIGHT);
    promptInput.style.height = `${nextHeight}px`;
    promptInput.style.overflowY =
      promptInput.scrollHeight > MAX_PROMPT_HEIGHT ? "auto" : "hidden";
  }, [command]);

  // Show toast error when speech recognition fails
  useEffect(() => {
    if (speechError) {
      toast.error(speechError);
    }
  }, [speechError]);

  // Set up callback for when speech is ready to be added to command
  useEffect(() => {
    onTranscriptReady((recognizedText: string) => {
      setCommand((prev) => `${prev.trim()} ${recognizedText}`.trim());
      clearTranscript();
    });
  }, [clearTranscript, onTranscriptReady]);

  return (
    <div
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
      <motion.header
        className="logic-topbar fixed top-0 z-40 flex h-14 w-full items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur-[1px]"
        {...fadeUp(0.02)}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-xl font-black tracking-[0.35em] text-primary"
          >
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

        {isPricingModalOpen && (
          <PricingModal
            open={isPricingModalOpen}
            onOpenChange={setPricingModalOpen}
          />
        )}
        {org && (
          <span
            className={cn(
              "hidden md:block text-[9px] uppercase tracking-[0.2em] px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-300/70",
              mono.className,
            )}
          >
            {org.seatCount}/{org.maxSeats} seats
          </span>
        )}
        <div className="flex items-center gap-2">
          <UserButton
            appearance={clerkUserButtonAppearance}
            userProfileProps={{ appearance: clerkUserProfileAppearance }}
          >
            <UserButton.Action label="manageAccount" />
            <UserButton.MenuItems>
              <UserButton.Action
                label="Manage Subscription"
                labelIcon={<Crown size={14} strokeWidth={1.8} />}
                onClick={() => setPricingModalOpen(true)}
              />
            </UserButton.MenuItems>
          </UserButton>

          <Button
            ref={launcherButtonRef}
            variant="default"
            size="icon-lg"
            aria-label="Open navigation menu"
            className={cn(
              "md:hidden flex h-9",
              isMobileMenuOpen && "pointer-events-none opacity-0",
            )}
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu />
          </Button>
        </div>
      </motion.header>

      <div className="flex h-screen overflow-hidden relative">
        <SideBar
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          isMobileMenuOpen={isMobileMenuOpen}
          launcherButtonRef={launcherButtonRef}
        />

        <main className="relative flex flex-1 flex-col overflow-y-auto bg-background">
          <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
            <motion.div
              className="logic-image-card absolute top-20 right-8 hidden h-64 w-48 rotate-3 border border-border bg-card md:block"
              {...scaleIn(0.2)}
            >
              <div className="h-full w-full bg-[linear-gradient(145deg,#1d1d1d_0%,#101010_42%,#262626_100%)]" />
              <div
                className={cn(
                  "absolute right-2 bottom-2 text-[9px] tracking-[0.16em] text-muted-foreground",
                  mono.className,
                )}
              >
                SYSTEM UI
              </div>
            </motion.div>
            <motion.div
              className="logic-image-card absolute bottom-36 left-8 hidden h-40 w-64 -rotate-6 border border-border bg-card md:block"
              {...scaleIn(0.26)}
            >
              <div className="h-full w-full bg-[radial-gradient(circle_at_22%_42%,#2d2d2d_0%,#151515_55%,#0d0d0d_100%)]" />
              <div
                className={cn(
                  "absolute right-2 bottom-2 text-[9px] tracking-[0.16em] text-muted-foreground",
                  mono.className,
                )}
              >
                CIRCUITRY
              </div>
            </motion.div>
          </div>

          <motion.section
            className="relative flex flex-1 w-full flex-col items-center justify-center gap-6 px-8 py-6 text-center"
            {...fadeUp(0.1)}
          >
            <motion.div {...fadeUp(0.12)}>
              <Bolt className="mb-2 size-10 text-muted-foreground" />
            </motion.div>

            <h1 className="logic-hero-title flex flex-wrap justify-center gap-x-3 gap-y-1 text-4xl font-black tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
              {titleWords.map((word, index) => (
                <span key={word} className="overflow-hidden">
                  <motion.span
                    className="logic-word inline-block"
                    {...fadeUp(0.14 + index * 0.05)}
                  >
                    {word}
                  </motion.span>
                </span>
              ))}
            </h1>

            <div className="mt-4 flex max-w-3xl flex-wrap justify-center gap-3">
              {quickActions.map((action, index) => {
                const Icon = action.icon;

                return (
                  <motion.div
                    key={action.label}
                    {...fadeUp(0.18 + index * 0.04)}
                  >
                    <Button
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
                  </motion.div>
                );
              })}
            </div>
            {/* Prompt Box */}
            <motion.section
              className="logic-console mt-6 w-full max-w-4xl text-left sm:px-6"
              {...fadeUp(0.28)}
            >
              <div className="border border-input bg-card/80 shadow-2xl shadow-black/30">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <div className="flex items-center gap-2 ">
                    <Button
                      variant={spec === "web" ? "secondary" : "ghost"}
                      size="xs"
                      className={cn(
                        "h-7 px-2",
                        spec === "mobile" && "text-muted-foreground",
                      )}
                      onClick={() => setSpec("web")}
                      aria-pressed={spec === "web"}
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
                      variant={spec === "mobile" ? "secondary" : "ghost"}
                      size="xs"
                      className={cn(
                        "h-7 px-2",
                        spec === "web" && "text-muted-foreground",
                      )}
                      onClick={() => setSpec("mobile")}
                      aria-pressed={spec === "mobile"}
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
                  <Select
                    value={selectedModel}
                    onValueChange={setSelectedModel}
                  >
                    <SelectTrigger
                      size="sm"
                      className={cn(
                        "h-8 min-w-35 border-input bg-muted text-[10px] tracking-[0.16em] uppercase",
                        mono.className,
                      )}
                    >
                      <SelectValue placeholder="gemma4" />
                    </SelectTrigger>
                    <SelectContent className="mt-10 min-w-35 border border-input bg-muted text-foreground">
                      <SelectGroup>
                        <SelectItem value="gemma4:31b">gemma4</SelectItem>
                        <SelectItem value="llama3.1:8b">llama3.1</SelectItem>
                        <SelectItem value="deepseek-v3.1:671b">
                          deepseek-v3.1
                        </SelectItem>
                        <SelectItem value="deepseek-v3.2:cloud">
                          deepseek-v3.2
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex min-h-16 items-end gap-1 p-2">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Add source"
                  >
                    <Plus />
                  </Button>

                  <textarea
                    ref={commandInputRef}
                    aria-label="Command input"
                    rows={1}
                    wrap="soft"
                    className={cn(
                      "max-h-55 min-h-10 w-full resize-none border-none bg-transparent px-2 py-2 text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground",
                      mono.className,
                    )}
                    placeholder="Design a dashboard with 3 KPI cards and a line chart showing revenue trends."
                    value={command}
                    onChange={(event) => setCommand(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleSubmit();
                      }
                    }}
                    autoComplete="off"
                  />

                  <div className="ml-1 flex items-center gap-1 border-l border-border pl-2">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={
                        isListening ? "Stop recording" : "Start voice input"
                      }
                      aria-pressed={isListening}
                      onClick={() => {
                        if (isListening) {
                          stopListening();
                          return;
                        }

                        startListening();
                      }}
                      disabled={!isSpeechSupported}
                      className={cn(
                        isListening && "bg-destructive/20 text-destructive",
                      )}
                      title={
                        !isSpeechSupported
                          ? "Speech recognition not supported in your browser"
                          : isListening
                            ? "Recording... Press to stop"
                            : "Click to start recording"
                      }
                    >
                      <Mic />
                    </Button>

                    <Button
                      size="icon-sm"
                      aria-label="Submit command"
                      onClick={() => {
                        if (!canSubmit) return;
                        void handleSubmit();
                      }}
                      disabled={!canSubmit}
                      className="cursor-pointer"
                    >
                      {isIdle ? (
                        <ArrowUp />
                      ) : (
                        <Loader2 className="animate-spin" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-2 rounded bg-destructive/50 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <motion.div
                className="logic-status mt-4 flex items-center justify-between gap-4 px-2"
                {...fadeUp(0.34)}
              >
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
                  {/* <span
                    className={cn(
                      "text-[9px] uppercase tracking-[0.2em] text-muted-foreground/75",
                      mono.className,
                    )}
                  >
                    Projects: 
                  </span> */}
                </div>

                {/* <span
                  className={cn(
                    "text-[9px] uppercase tracking-[0.2em] text-muted-foreground/75",
                    mono.className,
                  )}
                >
                  Tokens: 4.2k available
                </span> */}
              </motion.div>
            </motion.section>
          </motion.section>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
