import { SquareDashed, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "../ui/button";

interface CanvasToolbarProps {
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}

export function CanvasToolbar({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onFit,
}: CanvasToolbarProps) {
  return (
    <div className="pointer-events-auto absolute left-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 rounded-md border border-white/10 bg-black/60 p-2 backdrop-blur-sm ">
      <Button
        type="button"
        onClick={onFit}
        aria-label="Fit canvas to frames"
        title="Fit canvas to frames"
        className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/80 transition hover:bg-white/10"
      >
        <SquareDashed className="size-3.5" />
      </Button>
      <Button
        type="button"
        onClick={onZoomIn}
        aria-label="Zoom in"
        title="Zoom in"
        className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/80 transition hover:bg-white/10"
      >
        <ZoomIn className="size-3.5" />
      </Button>
      <Button
        type="button"
        onClick={onZoomOut}
        aria-label="Zoom out"
        title="Zoom out"
        className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/80 transition hover:bg-white/10"
      >
        <ZoomOut className="size-3.5" />
      </Button>
      <div className="rounded border border-white/10 bg-white/5 px-2 py-1 text-center text-[10px] text-white/60">
        {zoomPercent}%
      </div>
    </div>
  );
}
