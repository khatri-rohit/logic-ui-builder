"use client";

import { useRouter } from "next/navigation";
import { JetBrains_Mono } from "next/font/google";
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

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
});

interface UserMenuProps {
  onOpenPricing: () => void;
}

export default function UserMenu({ onOpenPricing }: UserMenuProps) {
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const router = useRouter();
  const { data: org } = useOrgQuery();
  const { data: usage } = useUsageQuery();

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const name =
    user?.fullName || user?.firstName || email.split("@")[0] || "User";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center justify-center rounded-[2px] border border-[#2a2a2a] bg-[#111111] p-[3px]",
            "transition-colors duration-100 ease-out",
            "hover:border-[#3a3a3a] hover:bg-[#1a1a1a]",
            "focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#7f7f7f] focus-visible:outline-offset-1",
            "data-[state=open]:border-[#4a4a4a] data-[state=open]:bg-[#1a1a1a]",
          )}
        >
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt={name}
              className="h-[30px] w-[30px] rounded-[2px] border border-[#313131] object-cover"
            />
          ) : (
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[2px] border border-[#313131] bg-[#1a1a1a] text-[11px] font-bold uppercase text-foreground">
              {name[0]}
            </div>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={4}
        className={cn(
          "min-w-[236px] rounded-[2px] border border-[#272727] bg-[#111111] p-1",
          "shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_16px_34px_-22px_rgba(0,0,0,0.95)]",
        )}
      >
        {/* User header */}
        <div className="flex items-center gap-3 px-3 py-3">
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt={name}
              className="h-9 w-9 rounded-full border border-[#313131] object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#313131] bg-[#1a1a1a] text-sm font-bold uppercase text-foreground">
              {name[0]}
            </div>
          )}
          <div className="flex min-w-0 flex-col">
            <span
              className={cn(
                "truncate text-sm font-medium text-white",
                mono.className,
              )}
            >
              {name}
            </span>
            <span
              className={cn(
                "truncate text-xs text-muted-foreground",
                mono.className,
              )}
            >
              {email}
            </span>
          </div>
        </div>

        <div className="my-1 h-px bg-[#232323]" />

        {/* Menu items */}
        <div className="flex flex-col gap-1">
          {/* Manage Account */}
          <DropdownMenuItem
            onClick={() => openUserProfile()}
            className={cn(
              "relative flex cursor-pointer items-center gap-2 rounded-[2px] border border-[#3a3a3a] bg-[#1a1a1a] px-2 py-2 text-[#f2f2f2]",
              "select-none outline-hidden",
              "hover:border-[#4a4a4a] hover:bg-[#202020]",
              "focus:border-[#4a4a4a] focus:bg-[#202020] focus:text-[#f2f2f2]",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#818181] focus-visible:outline-offset-1",
              mono.className,
            )}
          >
            <Settings
              size={14}
              strokeWidth={1.8}
              className="shrink-0 text-[#d9d9d9]"
            />
            <span className="text-[11px] uppercase tracking-[0.14em]">
              Manage Account
            </span>
          </DropdownMenuItem>

          {/* Manage Subscription */}
          <DropdownMenuItem
            onClick={onOpenPricing}
            className={cn(
              "relative flex cursor-pointer items-center gap-2 rounded-[2px] border border-[#202020] bg-[#151515] px-2 py-2 text-[#f2f2f2]",
              "select-none outline-hidden",
              "hover:border-[#303030] hover:bg-[#202020]",
              "focus:border-[#303030] focus:bg-[#202020] focus:text-[#f2f2f2]",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#818181] focus-visible:outline-offset-1",
              mono.className,
            )}
          >
            <Crown
              size={14}
              strokeWidth={1.8}
              className="shrink-0 text-[#d9d9d9]"
            />
            <span className="text-[11px] uppercase tracking-[0.14em]">
              Manage Subscription
            </span>
          </DropdownMenuItem>

          {/* Billing */}
          <DropdownMenuItem
            onClick={() => router.push("/billing")}
            className={cn(
              "relative flex cursor-pointer items-center gap-2 rounded-[2px] border border-[#202020] bg-[#151515] px-2 py-2 text-[#f2f2f2]",
              "select-none outline-hidden",
              "hover:border-[#303030] hover:bg-[#202020]",
              "focus:border-[#303030] focus:bg-[#202020] focus:text-[#f2f2f2]",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#818181] focus-visible:outline-offset-1",
              mono.className,
            )}
          >
            <CreditCard
              size={14}
              strokeWidth={1.8}
              className="shrink-0 text-[#d9d9d9]"
            />
            <span className="text-[11px] uppercase tracking-[0.14em]">
              Billing
            </span>
          </DropdownMenuItem>

          {/* Organisations — conditional */}
          {(org || usage?.planId === "PRO") && (
            <DropdownMenuItem
              onClick={() => router.push("/org")}
              className={cn(
                "relative flex cursor-pointer items-center gap-2 rounded-[2px] border border-[#202020] bg-[#151515] px-2 py-2 text-[#f2f2f2]",
                "select-none outline-hidden",
                "hover:border-[#303030] hover:bg-[#202020]",
                "focus:border-[#303030] focus:bg-[#202020] focus:text-[#f2f2f2]",
                "focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#818181] focus-visible:outline-offset-1",
                mono.className,
              )}
            >
              <Building2
                size={14}
                strokeWidth={1.8}
                className="shrink-0 text-[#d9d9d9]"
              />
              <span className="text-[11px] uppercase tracking-[0.14em]">
                Organisations
              </span>
            </DropdownMenuItem>
          )}
        </div>

        <div className="my-1 h-px bg-[#232323]" />

        {/* Sign Out */}
        <DropdownMenuItem
          onClick={() => signOut()}
          className={cn(
            "relative flex cursor-pointer items-center gap-2 rounded-[2px] border border-[#202020] bg-[#151515] px-2 py-2 text-[#f2f2f2]",
            "select-none outline-hidden",
            "hover:border-[#303030] hover:bg-[#202020]",
            "focus:border-[#303030] focus:bg-[#202020] focus:text-[#f2f2f2]",
            "focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#818181] focus-visible:outline-offset-1",
            mono.className,
          )}
        >
          <LogOut
            size={14}
            strokeWidth={1.8}
            className="shrink-0 text-[#d9d9d9]"
          />
          <span className="text-[11px] uppercase tracking-[0.14em]">
            Sign Out
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
