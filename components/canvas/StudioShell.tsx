"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface StudioShellProps {
  children: React.ReactNode;
  className?: string;
}

export function StudioShell({ children, className }: StudioShellProps) {
  return (
    <div
      className={cn(
        "relative h-screen w-full overflow-hidden bg-[var(--studio-bg)] text-[var(--studio-text-primary)]",
        "selection:bg-primary selection:text-primary-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
