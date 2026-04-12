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
import { HelpCircle, CalendarDays, History, LucideIcon, X } from "lucide-react";
import { JetBrains_Mono } from "next/font/google";
import { Button } from "@/components/ui/button";
import { useProjectsQuery } from "@/lib/projects/queries";
import { useUserActivityStore } from "@/providers/zustand-provider";
import { Timeframe } from "@/stores/user-activity";
import { useRouter } from "next/navigation";
import Image from "next/image";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const FOCUSABLE_SELECTOR =
  "a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])";

const navItems: Array<{ label: Timeframe; icon: LucideIcon }> = [
  { label: "Recent", icon: History },
  { label: "Yesterday", icon: CalendarDays },
  { label: "Last 7 Days", icon: CalendarDays },
  { label: "Last 30 Days", icon: CalendarDays },
  // { label: "Examples", icon: FolderKanban },
];

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
  const selectedTimeframe = useUserActivityStore(
    (state) => state.selectedTimeframe,
  );
  const setSelectedTimeframe = useUserActivityStore(
    (state) => state.setSelectedTimeframe,
  );

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

  const { data: projects = [] } = useProjectsQuery();

  const filteredNavItems = useMemo(() => {
    if (projects.length === 0) {
      return [];
    }

    const now = Date.now();
    const yesterdayStart = new Date(now);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0);

    const yesterdayEnd = new Date(now);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const recentCutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const weekCutoff = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthCutoff = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    return projects.filter((item) => {
      if (selectedTimeframe === "Recent") {
        return item.updatedAt >= recentCutoff;
      }

      if (selectedTimeframe === "Yesterday") {
        return (
          item.updatedAt >= yesterdayStart.toISOString() &&
          item.updatedAt <= yesterdayEnd.toISOString()
        );
      }

      if (selectedTimeframe === "Last 7 Days") {
        return item.updatedAt >= weekCutoff;
      }

      return item.updatedAt >= monthCutoff;
    });
  }, [projects, selectedTimeframe]);

  const handleOpenProject = (projectId: string) => {
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

  return (
    <>
      <motion.aside
        className="logic-sidebar hidden w-full max-w-72 pt-14 shrink-0 border-r border-border bg-background md:flex"
        {...fadeLeft(0.06)}
      >
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
                  <motion.button
                    key={item.label}
                    type="button"
                    onClick={() => setSelectedTimeframe(item.label)}
                    aria-current={
                      selectedTimeframe === item.label ? "page" : undefined
                    }
                    className={cn(
                      "flex items-center gap-3 px-4 py-2 text-left transition-colors duration-75",
                      selectedTimeframe === item.label
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
                  </motion.button>
                );
              })}
            </nav>
          </div>

          <div className="mt-8 flex flex-1 flex-col gap-4 px-4 w-full max-w-72">
            {filteredNavItems.map((project, index) => (
              <motion.button
                key={project.id}
                type="button"
                className="logic-feed-item group w-full overflow-hidden rounded-lg border border-border bg-card/40 p-2 text-left hover:border-muted-foreground hover:bg-muted/40 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                {...fadeLeft(0.12 + index * 0.04)}
                onMouseEnter={() => router.prefetch(`/projects/${project.id}`)}
                onClick={() => handleOpenProject(project.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="size-10 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted/40">
                    <Image
                      src={project.thumbnailUrl ?? "/thumbnail.jpg"}
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
                    <p className="mt-1 truncate text-[11px] leading-4 text-muted-foreground">
                      {project.description}
                    </p>
                  </div>
                </div>
              </motion.button>
            ))}
            {filteredNavItems.length === 0 && (
              <div
                className={cn(
                  "text-[11px] text-muted-foreground px-3 leading-4 text-pretty",
                  mono.className,
                )}
              >
                No projects found for the selected timeframe.
              </div>
            )}
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
                      onClick={() => setSelectedTimeframe(item.label)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 text-left",
                        selectedTimeframe === item.label
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

              <div className="border-t border-border px-3 py-4 min-w-full">
                {filteredNavItems.map((project, index) => (
                  <motion.button
                    key={project.id}
                    type="button"
                    className="logic-feed-item group w-full overflow-hidden rounded-lg border border-border bg-card/40 p-2 text-left hover:border-muted-foreground hover:bg-muted/40 hover:-translate-y-1 hover:mb-3 transition-all duration-300 cursor-pointer"
                    {...fadeLeft(0.12 + index * 0.04)}
                    onMouseEnter={() =>
                      router.prefetch(`/projects/${project.id}`)
                    }
                    onClick={() => handleOpenProject(project.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="size-10 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted/40">
                        <Image
                          src={project.thumbnailUrl ?? "/thumbnail.jpg"}
                          alt={project.title}
                          width={56}
                          height={56}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <span className="truncate text-xs font-semibold">
                          {project.title}
                        </span>
                        <p className="mt-1 truncate text-[11px] leading-4 text-muted-foreground">
                          {project.description}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                ))}
                {filteredNavItems.length === 0 && (
                  <div
                    className={cn(
                      "px-1 text-[11px] leading-4 text-muted-foreground",
                      mono.className,
                    )}
                  >
                    No projects found for the selected timeframe.
                  </div>
                )}
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
};

export default SideBar;
