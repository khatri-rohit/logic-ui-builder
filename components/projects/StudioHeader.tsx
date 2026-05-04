"use client";

import { ElementType, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  Download,
  Menu,
  MessageCirclePlus,
  Monitor,
  Moon,
  Pencil,
  Share2,
  Sun,
  Trash2,
} from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { cn } from "@/lib/utils";

type ProjectActionId =
  | "all-projects"
  | "share"
  | "download"
  | "export-png"
  | "edit"
  | "delete"
  | "feedback";

export type ThemeMode = "light" | "dark" | "system";

interface StudioHeaderProps {
  title: string;
  platform: "web" | "mobile";
  themeMode: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  onAction: (action: ProjectActionId) => void;
  // setMenuOpen: (open: boolean) => void;
  // setThemeOpen: (open: boolean) => void;
  // menuOpen: boolean;
  // themeOpen: boolean;
  // menuRef: React.RefObject<HTMLDivElement | null>;
}

const projectActions: Array<{
  id: ProjectActionId;
  label: string;
  icon: ElementType;
}> = [
  { id: "all-projects", label: "Go to all projects", icon: ChevronLeft },
  { id: "share", label: "Share", icon: Share2 },
  { id: "download", label: "Download project", icon: Download },
  { id: "edit", label: "Edit", icon: Pencil },
  { id: "delete", label: "Delete project", icon: Trash2 },
  { id: "feedback", label: "Send feedback", icon: MessageCirclePlus },
];

const themeOptions: Array<{
  value: ThemeMode;
  label: string;
  icon: ElementType;
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function StudioHeader({
  title,
  platform,
  themeMode,
  onThemeChange,
  onAction,
  // setMenuOpen,
  // setThemeOpen,
  // menuOpen,
  // themeOpen,
  // menuRef,
}: StudioHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const visibleActions =
    platform === "web"
      ? projectActions
      : projectActions.filter((a) => a.id !== "download");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setThemeOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="pointer-events-auto absolute left-5 top-5 z-50">
      <GlassPanel
        variant="default"
        blur="xl"
        className="flex items-center gap-2 px-2 py-1.5 bg-(--studio-bg) bg-opacity-75"
      >
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-md text-(--studio-text-secondary) transition-all duration-150",
            "hover:bg-(--studio-surface-hover) hover:text-(--studio-text-primary) hover:scale-105 active:scale-95",
            menuOpen &&
              "bg-(--studio-surface-hover) text-(--studio-text-primary)",
          )}
          aria-label="Open menu"
          aria-expanded={menuOpen}
        >
          <Menu className="size-4" />
        </button>

        <div className="min-w-0 max-w-50">
          <h1 className="truncate text-sm font-medium tracking-tight text-(--studio-text-primary)">
            {title}
          </h1>
        </div>

        {menuOpen && (
          <div
            ref={menuRef}
            className="absolute left-0 top-full mt-2 w-64 animate-studio-fade-in bg-(--studio-bg) bg-opacity-75 rounded-md"
          >
            <GlassPanel
              variant="elevated"
              blur="xl"
              className="overflow-hidden py-1"
            >
              {visibleActions.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onAction(item.id);
                      setMenuOpen(false);
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-sm text-(--studio-text-primary) transition-colors duration-150",
                      "hover:bg-(--studio-surface-hover)",
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-(--studio-text-muted)" />
                    <span className="flex-1 text-left">{item.label}</span>
                  </button>
                );
              })}

              <div className="my-1 border-t border-(--studio-border)" />

              <button
                type="button"
                onClick={() => setThemeOpen(!themeOpen)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-sm text-(--studio-text-primary) transition-colors duration-150",
                  "hover:bg-(--studio-surface-hover)",
                  themeOpen && "bg-(--studio-surface-hover)",
                )}
              >
                <Monitor className="size-4 shrink-0 text-(--studio-text-muted)" />
                <span className="flex-1 text-left">Appearance</span>
                <span className="text-xs text-(--studio-text-muted)">
                  {themeMode}
                </span>
              </button>

              {themeOpen && (
                <div className="border-t border-(--studio-border) py-1">
                  {themeOptions.map((option) => {
                    const Icon = option.icon;
                    const isActive = themeMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          onThemeChange(option.value);
                          setThemeOpen(false);
                        }}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors duration-150",
                          "hover:bg-(--studio-surface-hover)",
                          isActive
                            ? "text-(--studio-text-primary)"
                            : "text-(--studio-text-secondary)",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="flex-1 text-left">{option.label}</span>
                        {isActive && (
                          <Check className="size-4 shrink-0 text-(--studio-accent)" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </GlassPanel>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
