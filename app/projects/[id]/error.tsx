"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface ProjectErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ProjectError({ error, reset }: ProjectErrorProps) {
  useEffect(() => {
    console.error("Project route error boundary", error);
  }, [error]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-xl rounded-md border border-input bg-card p-6">
        <h1 className="text-sm uppercase tracking-[0.18em]">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          We could not load this project right now.
        </p>

        <div className="mt-5">
          <Button onClick={reset} variant="secondary">
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}
