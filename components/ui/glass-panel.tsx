import * as React from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "subtle";
  blur?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
}

export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  function GlassPanel(
    { className, variant = "default", blur = "xl", children, ...props },
    ref,
  ) {
    const blurClass = {
      sm: "backdrop-blur-sm",
      md: "backdrop-blur-md",
      lg: "backdrop-blur-lg",
      xl: "backdrop-blur-xl",
    }[blur];

    const variantClass = {
      default:
        "bg-[var(--studio-surface)] border-[var(--studio-border)] shadow-[var(--studio-shadow)]",
      elevated:
        "bg-[var(--studio-surface)] border-[var(--studio-border-strong)] shadow-[0_12px_48px_rgba(0,0,0,0.45)]",
      subtle:
        "bg-[var(--studio-surface)] border-transparent shadow-none",
    }[variant];

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-[var(--studio-radius)] border transition-colors duration-150",
          blurClass,
          variantClass,
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
