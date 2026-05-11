/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { HelpCircle, X } from "lucide-react";
import { JetBrains_Mono } from "next/font/google";
import { Button } from "@/components/ui/button";
import { useProjectsQuery } from "@/lib/projects/queries";
import { useRouter } from "next/navigation";
import Image from "next/image";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const FOCUSABLE_SELECTOR =
  "a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])";

interface SidebarProps {
  setIsMobileMenuOpen: Dispatch<SetStateAction<boolean>>;
  isMobileMenuOpen: boolean;
  launcherButtonRef: React.RefObject<HTMLButtonElement | null>;
}

const SideBar = ({
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  launcherButtonRef,
}: SidebarProps) => {
  const router = useRouter();

  const shouldReduceMotion = useReducedMotion();
  const mobileDrawerRef = useRef<HTMLElement | null>(null);

  const fadeLeft = (delay = 0) =>
    shouldReduceMotion
      ? {}
      : {
          initial: { opacity: 0, x: -24 },
          animate: { opacity: 1, x: 0 },
          transition: {
            delay,
            duration: 0.26,
            ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
          },
        };

  const { data: projects = [], isLoading, isFetching } = useProjectsQuery();
  const showProjectSkeletons = isLoading || (isFetching && projects.length === 0);

  const handleFocusPrompt = () => {
    setIsMobileMenuOpen(false);
    window.setTimeout(() => {
      document.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    }, 0);
  };

  const groupedProjects = useMemo(() => {
    const now = Date.now();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const groups: Record<string, typeof projects> = {
      Recent: [],
      Yesterday: [],
      "Last 7 Days": [],
      "Last 30 Days": [],
      "This Year": [],
    };

    for (const project of projects) {
      const updatedAt = new Date(project.updatedAt);

      if (updatedAt >= oneDayAgo) {
        groups.Recent.push(project);
      } else if (updatedAt >= twoDaysAgo) {
        groups.Yesterday.push(project);
      } else if (updatedAt >= sevenDaysAgo) {
        groups["Last 7 Days"].push(project);
      } else if (updatedAt >= thirtyDaysAgo) {
        groups["Last 30 Days"].push(project);
      } else {
        groups["This Year"].push(project);
      }
    }

    for (const key of Object.keys(groups)) {
      groups[key].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }

    return groups;
  }, [projects]);

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(dateStr));
  };

  const groupOrder = [
    "Recent",
    "Yesterday",
    "Last 7 Days",
    "Last 30 Days",
    "This Year",
  ];

  const handleOpenProject = (projectId: string) => {
    setIsMobileMenuOpen(false);
    router.push(`/projects/${projectId}`);
  };

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const fallbackLauncher = launcherButtonRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = mobileDrawerRef.current;

    const getFocusableElements = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      );

    const focusable = getFocusableElements();
    focusable[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMobileMenuOpen(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const currentFocusable = getFocusableElements();
      if (currentFocusable.length === 0) {
        return;
      }

      const first = currentFocusable[0];
      const last = currentFocusable[currentFocusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused) {
        previouslyFocused.focus();
        return;
      }

      fallbackLauncher?.focus();
    };
  }, [isMobileMenuOpen]);

  const renderProjectList = () => {
    if (showProjectSkeletons) {
      return <ProjectListSkeleton />;
    }

    if (projects.length === 0) {
      return (
        <SidebarEmptyState
          hasProjects={false}
          onGenerate={handleFocusPrompt}
        />
      );
    }

    let projectIndex = 0;

    return (
      <div className="flex flex-col gap-5">
        {groupOrder.map((group) => {
          const groupProjects = groupedProjects[group];
          if (groupProjects.length === 0) return null;

          return (
            <div key={group} className="flex flex-col gap-2">
              <p
                className={cn(
                  "px-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70",
                  mono.className,
                )}
              >
                {group}
              </p>
              <div className="flex flex-col gap-2">
                {groupProjects.map((project) => {
                  const currentIndex = projectIndex++;
                  return (
                    <motion.button
                      key={project.id}
                      type="button"
                      className="logic-feed-item group w-full overflow-hidden rounded-lg border border-border bg-card/40 p-2 text-left hover:border-muted-foreground hover:bg-muted/40 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                      {...fadeLeft(0.12 + currentIndex * 0.04)}
                      onMouseEnter={() =>
                        router.prefetch(`/projects/${project.id}`)
                      }
                      onClick={() => handleOpenProject(project.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="size-10 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted/40">
                          <Image
                            src={project.thumbnailUrl || "/thumbnail.jpg"}
                            alt={project.title}
                            width={64}
                            height={64}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col justify-center">
                          <span className="truncate text-xs font-semibold">
                            {project.title}
                          </span>
                          <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
                            {project.description}
                          </p>
                          <span className="mt-1 text-[10px] text-muted-foreground/60">
                            {formatDate(project.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <motion.aside
        className="logic-sidebar hidden w-full max-w-72 pt-14 shrink-0 border-r border-border bg-background md:flex"
        {...fadeLeft(0.06)}
      >
        <div className="flex h-full flex-col py-6 w-full">
          <div className="px-4">
            <p
              className={cn(
                "px-2 text-[11px] tracking-[0.22em] text-muted-foreground",
                mono.className,
              )}
            >
              PROJECTS
            </p>
          </div>

          <div className="mt-6 flex flex-1 flex-col gap-4 px-4 w-full max-w-72 overflow-y-auto">
            {renderProjectList()}
          </div>

          <div className="mt-auto border-t border-border px-4 pt-4">
            <motion.button
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <HelpCircle className="size-4 shrink-0" />
              <span
                className={cn(
                  "text-[11px] uppercase tracking-[0.16em]",
                  mono.className,
                )}
              >
                Support
              </span>
            </motion.button>
          </div>
        </div>
      </motion.aside>

      <AnimatePresence>
        {isMobileMenuOpen ? (
          <motion.div
            className="md:hidden flex fixed inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Close navigation menu backdrop"
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 border-0 bg-black/60 p-0 transition-none hover:bg-black/60"
            />

            <motion.aside
              ref={mobileDrawerRef}
              className="absolute right-0 top-0 flex h-full w-[85vw] max-w-sm flex-col border-l border-border bg-background"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-4">
                <span
                  className={cn(
                    "text-[11px] uppercase tracking-[0.18em]",
                    mono.className,
                  )}
                >
                  Projects
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

              <div className="flex-1 overflow-y-auto px-3 py-4">
                {renderProjectList()}
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
};

function ProjectListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="flex items-start gap-3 rounded-lg border border-border bg-card/30 p-2"
        >
          <div className="size-10 shrink-0 animate-pulse rounded-md bg-muted" />
          <div className="min-w-0 flex-1 space-y-2 py-1">
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-full animate-pulse rounded bg-muted/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SidebarEmptyState({
  hasProjects,
  onGenerate,
}: {
  hasProjects: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/30 p-4 text-sm">
      <p className="text-xs font-semibold text-foreground">
        {hasProjects ? "No projects here" : "No projects yet"}
      </p>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
        {hasProjects
          ? "Try a wider timeframe to find older work."
          : "Generate your first UI from the prompt box."}
      </p>
      {!hasProjects && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-3 w-full"
          onClick={onGenerate}
        >
          Generate your first UI
        </Button>
      )}
    </div>
  );
}

export default SideBar;
