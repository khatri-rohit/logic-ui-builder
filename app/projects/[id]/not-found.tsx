import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ProjectNotFound() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-xl rounded-md border border-input bg-card p-6">
        <h1 className="text-sm uppercase tracking-[0.18em]">
          Project not found
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This project may have been deleted or you no longer have access.
        </p>

        <div className="mt-5">
          <Button asChild variant="secondary">
            <Link href="/">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
