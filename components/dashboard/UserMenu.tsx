/* eslint-disable @next/next/no-img-element */
"use client";

import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { Crown, CreditCard, Building2, LogOut, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrgQuery } from "@/lib/org/queries";
import { useUsageQuery } from "@/lib/billing/queries";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  onOpenPricing: () => void;
}

const planBadgeStyles: Record<string, string> = {
  PRO: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  STANDARD: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  FREE: "bg-muted text-muted-foreground border-border",
};

const menuItemBase = cn(
  "relative flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium",
  "select-none outline-hidden transition-colors duration-100",
  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-1",
  "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:rounded-full before:content-['']",
  "before:opacity-0 before:transition-opacity before:duration-150",
  "hover:before:opacity-100 focus:before:opacity-100 data-[highlighted]:before:opacity-100",
  "font-sans",
);

export default function UserMenu({ onOpenPricing }: UserMenuProps) {
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const router = useRouter();
  const { data: org } = useOrgQuery();
  const { data: usage } = useUsageQuery();

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const name =
    user?.fullName || user?.firstName || email.split("@")[0] || "User";
  const planId = usage?.planId as string | undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="User menu"
          className={cn(
            "flex items-center justify-center rounded-lg border border-border bg-card p-0.75",
            "transition-all duration-150 ease-out",
            "hover:border-border/80 hover:bg-accent",
            "focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-1",
            "data-[state=open]:border-border/80 data-[state=open]:bg-accent",
          )}
        >
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt={name}
              className="h-7.5 w-7.5 rounded-md border border-border object-cover"
            />
          ) : (
            <div className="flex h-7.5 w-7.5 items-center justify-center rounded-md border border-border bg-card text-[11px] font-bold uppercase text-foreground font-sans">
              {name[0]}
            </div>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className={cn(
          "min-w-65 rounded-xl border border-border bg-card p-1.5",
          "shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_24px_48px_-16px_rgba(0,0,0,0.85)]",
        )}
      >
        {/* User header */}
        <div className="flex items-center gap-3 px-3 py-3">
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt={name}
              className="h-9 w-9 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-sm font-bold uppercase text-foreground font-sans">
              {name[0]}
            </div>
          )}
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground font-sans">
                {name}
              </span>
              {planId && (
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wider",
                    planBadgeStyles[planId] ?? planBadgeStyles.FREE,
                  )}
                >
                  {planId}
                </span>
              )}
            </div>
            <span className="truncate text-xs text-muted-foreground font-mono">
              {email}
            </span>
          </div>
        </div>

        <div className="my-1 h-px bg-border" />

        {/* Menu items */}
        <div className="flex flex-col gap-0.5">
          {/* Manage Account */}
          <DropdownMenuItem
            onClick={() => openUserProfile()}
            className={cn(
              menuItemBase,
              "text-foreground bg-muted/40",
              "hover:bg-muted hover:text-foreground",
              "focus:bg-muted focus:text-foreground",
              "data-highlighted:bg-muted data-highlighted:text-foreground",
              "before:bg-amber-500",
            )}
          >
            <Settings
              size={15}
              strokeWidth={1.8}
              className="shrink-0 text-muted-foreground"
            />
            <span className="uppercase tracking-[0.12em] text-[11px] font-medium">
              Manage Account
            </span>
          </DropdownMenuItem>

          {/* Manage Subscription */}
          <DropdownMenuItem
            onClick={onOpenPricing}
            className={cn(
              menuItemBase,
              "text-muted-foreground",
              "hover:bg-muted hover:text-foreground",
              "focus:bg-muted focus:text-foreground",
              "data-highlighted:bg-muted data-highlighted:text-foreground",
              "before:bg-amber-500",
            )}
          >
            <Crown
              size={15}
              strokeWidth={1.8}
              className="shrink-0 text-muted-foreground/60"
            />
            <span className="uppercase tracking-[0.12em] text-[11px] font-medium">
              Manage Subscription
            </span>
          </DropdownMenuItem>

          {/* Billing */}
          <DropdownMenuItem
            onClick={() => router.push("/billing")}
            className={cn(
              menuItemBase,
              "text-muted-foreground",
              "hover:bg-muted hover:text-foreground",
              "focus:bg-muted focus:text-foreground",
              "data-highlighted:bg-muted data-highlighted:text-foreground",
              "before:bg-amber-500",
            )}
          >
            <CreditCard
              size={15}
              strokeWidth={1.8}
              className="shrink-0 text-muted-foreground/60"
            />
            <span className="uppercase tracking-[0.12em] text-[11px] font-medium">
              Billing
            </span>
          </DropdownMenuItem>

          {/* Organisations — conditional */}
          {(org || planId === "PRO") && (
            <DropdownMenuItem
              onClick={() => router.push("/org")}
              className={cn(
                menuItemBase,
                "text-muted-foreground",
                "hover:bg-muted hover:text-foreground",
                "focus:bg-muted focus:text-foreground",
                "data-highlighted:bg-muted data-highlighted:text-foreground",
                "before:bg-amber-500",
              )}
            >
              <Building2
                size={15}
                strokeWidth={1.8}
                className="shrink-0 text-muted-foreground/60"
              />
              <span className="uppercase tracking-[0.12em] text-[11px] font-medium">
                Organisations
              </span>
            </DropdownMenuItem>
          )}
        </div>

        <div className="my-1 h-px bg-border" />

        {/* Sign Out */}
        <DropdownMenuItem
          onClick={() => signOut()}
          className={cn(
            menuItemBase,
            "text-muted-foreground",
            "hover:bg-muted hover:text-red-400",
            "focus:bg-muted focus:text-red-400",
            "data-highlighted:bg-muted data-highlighted:text-red-400",
            "before:bg-red-500",
          )}
        >
          <LogOut
            size={15}
            strokeWidth={1.8}
            className="shrink-0 text-muted-foreground/60"
          />
          <span className="uppercase tracking-[0.12em] text-[11px] font-medium">
            Sign Out
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
