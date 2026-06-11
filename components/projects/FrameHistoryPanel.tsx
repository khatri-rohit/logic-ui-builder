"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useFrameHistoryQuery, FrameVersionItem } from "@/lib/projects/queries";
import { Clock, RotateCcw, X, History } from "lucide-react";

interface FrameHistoryPanelProps {
  projectId: string;
  frameId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isRestoring: boolean;
  onRestore: (versionNumber: number) => void;
}

function formatVersionDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function VersionCard({
  version,
  isRestoring,
  onRestore,
}: {
  version: FrameVersionItem;
  isRestoring: boolean;
  onRestore: () => void;
}) {
  const preview = version.content.slice(0, 80).replace(/\\s+/g, " ");
  const hasMore = version.content.length > 80;

  return (
    <div className="rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/30">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 min-w-6 items-center justify-center rounded bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
            v{version.versionNumber}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="size-3" />
            {formatVersionDate(version.createdAt)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-[11px]"
          onClick={onRestore}
          disabled={isRestoring}
        >
          <RotateCcw className="size-3" />
          {isRestoring ? "Restoring..." : "Restore"}
        </Button>
      </div>

      <p className="mt-2 truncate font-mono text-[10px] text-muted-foreground">
        {preview}
        {hasMore && "..."}
      </p>

      {version.prompt && (
        <p className="mt-1 truncate text-[10px] italic text-muted-foreground/70">
          &ldquo;{version.prompt}&rdquo;
        </p>
      )}
    </div>
  );
}

export function FrameHistoryPanel({
  projectId,
  frameId,
  open,
  onOpenChange,
  isRestoring,
  onRestore,
}: FrameHistoryPanelProps) {
  const { data, isLoading } = useFrameHistoryQuery(projectId, frameId);

  const versions = data?.versions ?? [];

  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="min-w-md border-border bg-background text-foreground sm:max-w-md">
        <DrawerHeader className="border-b border-border">
          <DrawerTitle className="flex items-center gap-2 text-foreground">
            <History className="size-4" />
            Frame History
          </DrawerTitle>
          <DrawerDescription>
            Previous versions of this frame. Restore any version to roll back.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Loading history...
            </div>
          )}

          {!isLoading && versions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
              <History className="mb-2 size-6 opacity-40" />
              <p>No history yet.</p>
              <p className="mt-1 text-xs">
                Regenerate this frame to create version snapshots.
              </p>
            </div>
          )}

          {versions.map((version) => (
            <VersionCard
              key={version.versionNumber}
              version={version}
              isRestoring={isRestoring}
              onRestore={() => onRestore(version.versionNumber)}
            />
          ))}
        </div>

        <DrawerFooter className="border-t border-border">
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
              Close
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
