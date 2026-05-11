"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
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

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const projectActions: Array<{ id: ProjectActionId; label: string; icon: LucideIcon }> =
  [
    { id: "all-projects", label: "Go to all projects", icon: ChevronLeft },
    { id: "share", label: "Share", icon: Share2 },
    { id: "download", label: "Download project", icon: Download },
    // { id: "export-png", label: "Export as PNG", icon: FileImage },
    { id: "edit", label: "Edit", icon: Pencil },
    { id: "delete", label: "Delete project", icon: Trash2 },
    { id: "feedback", label: "Send feedback", icon: MessageCirclePlus },
    //   { id: "duplicate", label: "Duplicate project", icon: SquareStack },
    //   { id: "help", label: "Help", icon: HelpCircle },
    //   { id: "settings", label: "Settings", icon: Settings2 },
    //   { id: "command-menu", label: "Command menu", icon: Command, meta: "Ctrl+K" },
    //   { id: "send-feedback", label: "Send feedback", icon: ExternalLink },
  ];

const themeOptions: Array<{ value: ThemeMode; label: string; icon: LucideIcon }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

interface ProjectMenuPanelProps {
  title: string;
  platform: "web" | "mobile";
  handleMenuClick: (action: ProjectActionId) => void;
  themeMode: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

export default function ProjectMenuPanel({
  title,
  platform,
  handleMenuClick,
  themeMode,
  onThemeChange,
}: ProjectMenuPanelProps) {
  const visibleActions =
    platform === "web"
      ? projectActions
      : projectActions.filter((a) => a.id !== "download");

  return (
    <div className="absolute inset-5 z-50 w-fit h-fit">
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-10 w-10 shrink-0 border border-border bg-card text-foreground shadow-none hover:bg-accent cursor-pointer"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={12}
            className="w-70 rounded-none border-border bg-card p-2 text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.65)] z-50"
          >
            {visibleActions.map((item) => {
              const Icon = item.icon;

              return (
                <React.Fragment key={item.id}>
                  <DropdownMenuItem
                    className={cn(
                      "flex cursor-pointer items-center rounded-none gap-3 px-3 py-3 text-[15px] text-foreground/90 outline-none transition-colors",
                      "focus:bg-accent focus:text-accent-foreground",
                    )}
                    onClick={() => handleMenuClick(item.id)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                  </DropdownMenuItem>
                </React.Fragment>
              );
            })}

            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                className={cn(
                  "flex cursor-default items-center rounded-none gap-3 px-3 py-3 text-[15px] text-foreground/90 outline-none transition-colors",
                  "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
                )}
              >
                <Monitor className="h-4 w-4 shrink-0" />
                <span className="flex-1">Appearance</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                sideOffset={8}
                className="w-48 rounded-none border-border bg-card p-2 text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.65)] z-50"
              >
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const isActive = themeMode === option.value;

                  return (
                    <DropdownMenuItem
                      key={option.value}
                      className={cn(
                        "flex cursor-pointer items-center rounded-none gap-3 px-3 py-2.5 text-[15px] text-foreground/90 outline-none transition-colors",
                        "focus:bg-accent focus:text-accent-foreground",
                      )}
                      onClick={() => onThemeChange(option.value)}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{option.label}</span>
                      {isActive && (
                        <Check className="h-4 w-4 shrink-0 text-foreground" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-semibold tracking-tight text-foreground sm:text-[18px]">
            {title}
          </h1>
        </div>
      </div>
    </div>
  );
}
