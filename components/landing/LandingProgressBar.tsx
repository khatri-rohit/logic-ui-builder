"use client";

import { useEffect, useRef } from "react";
import styles from "./page.module.css";

export function LandingProgressBar() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) {
      return;
    }

    const updateProgress = () => {
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const maxScroll = Math.max(docHeight - winHeight, 1);
      const scrollPercent = Math.min(window.scrollY / maxScroll, 1);
      bar.style.transform = `scaleX(${scrollPercent})`;
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  return <div ref={barRef} className={styles.progressBar} aria-hidden />;
}
