/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { X, Maximize2 } from "lucide-react";

interface VideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
}

export function VideoModal({ open, onOpenChange, videoUrl }: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Pause video when modal closes
  useEffect(() => {
    if (!open && videoRef.current) {
      videoRef.current.pause();
    }
  }, [open]);

  // Request fullscreen for mobile
  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      } else if ((videoRef.current as any).webkitEnterFullscreen) {
        // iOS Safari
        (videoRef.current as any).webkitEnterFullscreen();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Overlay - More transparent on mobile for better performance */}
      <DialogOverlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

      {/* Content - Fully responsive with smooth animations */}
      <DialogContent
        showCloseButton={false}
        className="z-50 p-0 border-none bg-black shadow-2xl overflow-hidden
                    w-[calc(100%-1rem)] max-w-[98vw]
                    sm:w-[calc(100vw-3rem)] sm:max-w-[92vw] 
                    md:max-w-3xl 
                    lg:max-w-4xl 
                    xl:max-w-5xl
                    2xl:max-w-6xl
                    rounded-lg sm:rounded-xl md:rounded-2xl
                    data-[state=open]:animate-in data-[state=closed]:animate-out 
                    data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 
                    data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 
                    data-[state=closed]:slide-out-to-bottom-[5%] data-[state=open]:slide-in-from-bottom-[5%]
                    duration-300"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Demo Video</DialogTitle>
        <DialogDescription className="sr-only">
          Video player modal showing a project demonstration.
        </DialogDescription>

        {/* Control bar - Mobile optimized */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-2 sm:p-3 md:justify-end bg-linear-to-b from-black/60 to-transparent">
          {/* Fullscreen button - Only on mobile */}
          <button
            onClick={handleFullscreen}
            className="md:hidden rounded-full bg-black/50 backdrop-blur-sm p-2 
                            text-white/70 transition-colors hover:text-white hover:bg-black/70 
                            focus:outline-none focus:ring-2 focus:ring-white/20
                            active:scale-95"
            aria-label="Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          {/* Close button */}
          <DialogClose
            className="rounded-full bg-black/50 backdrop-blur-sm p-2 
                        text-white/70 transition-all hover:text-white hover:bg-black/70 
                        focus:outline-none focus:ring-2 focus:ring-white/20
                        active:scale-95"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        {/* Video container - Optimized for all devices */}
        <div className="relative aspect-video w-full overflow-hidden rounded-lg sm:rounded-xl md:rounded-2xl bg-black">
          <video
            ref={videoRef}
            src={videoUrl}
            className="h-full w-full object-contain"
            controls
            autoPlay
            muted
            playsInline // Critical for iOS Safari inline playback
            preload="metadata"
            controlsList="nodownload" // Optional: prevent download on some browsers
            title="Project demonstration video"
            aria-label="Project video showcase"
          />
        </div>

        {/* Optional: Loading state placeholder */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin opacity-0"
            style={{ animationDuration: "0.8s" }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
