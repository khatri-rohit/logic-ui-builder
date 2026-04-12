"use client";

import * as React from "react";
import {
  ChevronLeft,
  Download,
  Menu,
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
import { useRouter } from "next/navigation";

const projectActions = [
  { label: "Go to all projects", icon: ChevronLeft },
  { label: "Share", icon: Share2 },
  { label: "Download project", icon: Download },
  //   { label: "Duplicate project", icon: SquareStack },
  { label: "Edit", icon: Pencil },
  //   { label: "Help", icon: HelpCircle },
  //   { label: "Appearance", icon: Monitor },
  //   { label: "Settings", icon: Settings2 },
  { label: "Delete project", icon: Trash2 },
  //   { label: "Command menu", icon: Command, meta: "Ctrl+K" },
  //   { label: "Send feedback", icon: ExternalLink },
];

interface ProjectMenuPanelProps {
  title: string;
  handleMenuClick: (action: string) => void;
}

export default function ProjectMenuPanel({
  title,
  handleMenuClick,
}: ProjectMenuPanelProps) {
  return (
    <div className="dark absolute inset-5 z-50">
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
            {/* <DropdownMenuLabel className="px-3 py-2 text-xs font-medium uppercase tracking-[0.2em] text-white/45">
              Project actions
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-2 bg-white/10" /> */}

            {projectActions.map((item) => {
              const Icon = item.icon;

              return (
                <React.Fragment key={item.label}>
                  <DropdownMenuItem
                    className={cn(
                      "flex cursor-pointer items-center rounded-none gap-3 px-3 py-3 text-[15px] text-white/90 outline-none transition-colors",
                      "focus:bg-white/80 focus:text-black",
                    )}
                    onClick={() => handleMenuClick(item.label)}
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
