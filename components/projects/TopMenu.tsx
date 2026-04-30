"use client";

import * as React from "react";
import {
  ChevronLeft,
  Download,
  FileImage,
  Menu,
  MessageCirclePlus,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const projectActions: Array<{ id: ProjectActionId; label: string; icon: any }> =
  [
    { id: "all-projects", label: "Go to all projects", icon: ChevronLeft },
    { id: "share", label: "Share", icon: Share2 },
    { id: "download", label: "Download project", icon: Download },
    { id: "export-png", label: "Export as PNG", icon: FileImage },
    { id: "edit", label: "Edit", icon: Pencil },
    { id: "delete", label: "Delete project", icon: Trash2 },
    { id: "feedback", label: "Send feedback", icon: MessageCirclePlus },
    //   { id: "duplicate", label: "Duplicate project", icon: SquareStack },
    //   { id: "help", label: "Help", icon: HelpCircle },
    //   { id: "appearance", label: "Appearance", icon: Monitor },
    //   { id: "settings", label: "Settings", icon: Settings2 },
    //   { id: "command-menu", label: "Command menu", icon: Command, meta: "Ctrl+K" },
    //   { id: "send-feedback", label: "Send feedback", icon: ExternalLink },
  ];

interface ProjectMenuPanelProps {
  title: string;
  handleMenuClick: (action: ProjectActionId) => void;
}

export default function ProjectMenuPanel({
  title,
  handleMenuClick,
}: ProjectMenuPanelProps) {
  return (
    <div className="dark absolute inset-5 z-50 w-fit h-fit">
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-10 w-10 shrink-0 border border-white/25 bg-[#181818] text-white shadow-none hover:bg-white/15 cursor-pointer"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={12}
            className="w-70 rounded-none border-white/10 bg-[#181818] p-2 text-white shadow-[0_24px_80px_rgba(0,0,0,0.65)] z-50"
          >
            {projectActions.map((item) => {
              const Icon = item.icon;

              return (
                <React.Fragment key={item.id}>
                  <DropdownMenuItem
                    className={cn(
                      "flex cursor-pointer items-center rounded-none gap-3 px-3 py-3 text-[15px] text-white/90 outline-none transition-colors",
                      "focus:bg-white/80 focus:text-black",
                    )}
                    onClick={() => handleMenuClick(item.id)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                  </DropdownMenuItem>
                </React.Fragment>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-semibold tracking-tight text-white sm:text-[18px]">
            {title}
          </h1>
        </div>
      </div>
    </div>
  );
}
