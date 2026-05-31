"use client";

import { MoveLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { ProgressBar } from "./ProgressBar";
import { Button } from "@/components/ui/button";

interface OrgHeaderProps {
  name: string;
  slug: string;
  seatCount: number;
  maxSeats: number;
}

export function OrgHeader({ name, slug, seatCount, maxSeats }: OrgHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
          <span>@{slug}</span>
          <span>·</span>
          <ProgressBar current={seatCount} max={maxSeats} />
        </div>
      </div>
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/")}
        >
          <MoveLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>
    </div>
  );
}
