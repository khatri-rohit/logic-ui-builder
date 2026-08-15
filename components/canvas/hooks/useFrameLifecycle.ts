import { RefObject, useCallback, useEffect, useRef } from "react";
import {
  loadSandpackClient,
  SandpackClient,
} from "@codesandbox/sandpack-client";
import { buildSandpackFiles } from "@/lib/sandpackTemplate";
import { FrameState } from "@/lib/canvas-state";
import logger from "@/lib/logger";
import { useCanvasGestureStore } from "@/components/canvas/CanvasGestureContext";

interface UseFrameLifecycleOptions {
  content: string;
  state: FrameState;
  containerRef: RefObject<HTMLDivElement | null>;
  iframeRef: RefObject<HTMLIFrameElement | null>;
}

const DESTROY_GRACE_MS = 5000;
const INTERSECTION_ROOT_MARGIN = "300px 300px";
const RECOVER_DEBOUNCE_MS = 80;
const RECOVER_SETTLE_MS = 1000;
const MAX_RECOVERS_PER_WINDOW = 3;
const RECOVER_WINDOW_MS = 10_000;

function getParentOrigin(): string {
  if (typeof window === "undefined") return "*";
  return window.location.origin;
}

export function useFrameLifecycle({
  content,
  state,
  containerRef,
  iframeRef,
}: UseFrameLifecycleOptions) {
  const clientRef = useRef<SandpackClient | null>(null);
  const isMountedRef = useRef(false);
  const isMountingRef = useRef(false);
  const mountTokenRef = useRef(0);
  const destroyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreIframeLoadUntilRef = useRef(0);
  const lastIntersectingRef = useRef(true);
  const recoverWindowRef = useRef({ startedAt: 0, count: 0 });
  const originRef = useRef(getParentOrigin());
  const contentRef = useRef(content);
  const gestureStore = useCanvasGestureStore();

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const clearDestroyTimer = useCallback(() => {
    if (!destroyTimerRef.current) return;
    clearTimeout(destroyTimerRef.current);
    destroyTimerRef.current = null;
  }, []);

  const clearRecoverTimer = useCallback(() => {
    if (!recoverTimerRef.current) return;
    clearTimeout(recoverTimerRef.current);
    recoverTimerRef.current = null;
  }, []);

  const mount = useCallback(async () => {
    const iframeElement = iframeRef.current;
    const nextContent = contentRef.current;
    if (!iframeElement || !nextContent) return;
    if (isMountedRef.current || isMountingRef.current) return;

    const mountToken = mountTokenRef.current + 1;
    mountTokenRef.current = mountToken;
    isMountingRef.current = true;

    try {
      const origin = originRef.current;
      const client = await loadSandpackClient(
        iframeElement,
        {
          files: buildSandpackFiles(nextContent, origin),
          entry: "/index.tsx",
          template: "create-react-app-typescript",
        },
        {
          showOpenInCodeSandbox: false,
          showErrorScreen: false,
          showLoadingScreen: true,
          // Required: CRA Sandpack template does not reliably serve /public/index.html
          // scripts, so Tailwind must be injected via externalResources.
          externalResources: [
            "https://cdn.tailwindcss.com?plugins=forms,typography,aspect-ratio,container-queries",
          ],
        },
      );

      client.listen((msg: unknown) => {
        const message = msg as Record<string, unknown>;
        if (message.type === "status") {
          logger.info("Sandbox status", { status: message.status });
        }
        if (message.type === "action" && message.action === "show-error") {
          logger.warn("Sandbox compile error", {
            message: message.message,
            path: message.path,
            line: message.line,
            code: nextContent.slice(0, 200),
          });
        }
        if (message.type === "done" && message.compilationError) {
          logger.warn("Sandbox compilation failed", {
            code: nextContent.slice(0, 200),
          });
        }
      });

      if (mountToken !== mountTokenRef.current) {
        client.destroy();
        return;
      }

      clientRef.current = client;
      isMountedRef.current = true;
      ignoreIframeLoadUntilRef.current = Date.now() + RECOVER_SETTLE_MS;
    } finally {
      if (mountToken === mountTokenRef.current) {
        isMountingRef.current = false;
      }
    }
  }, [iframeRef]);

  const destroy = useCallback(() => {
    mountTokenRef.current += 1;
    isMountingRef.current = false;
    clearRecoverTimer();
    clientRef.current?.destroy();
    clientRef.current = null;
    isMountedRef.current = false;

    if (iframeRef.current) {
      iframeRef.current.src = "about:blank";
    }
  }, [clearRecoverTimer, iframeRef]);

  const scheduleDestroy = useCallback(() => {
    if (gestureStore.isActive()) {
      clearDestroyTimer();
      return;
    }

    clearDestroyTimer();
    destroyTimerRef.current = setTimeout(() => {
      destroyTimerRef.current = null;
      if (gestureStore.isActive()) return;
      destroy();
    }, DESTROY_GRACE_MS);
  }, [clearDestroyTimer, destroy, gestureStore]);

  const scheduleRecover = useCallback(() => {
    const now = Date.now();
    if (now - recoverWindowRef.current.startedAt > RECOVER_WINDOW_MS) {
      recoverWindowRef.current = { startedAt: now, count: 0 };
    }
    if (recoverWindowRef.current.count >= MAX_RECOVERS_PER_WINDOW) {
      logger.warn("Sandbox iframe recover loop suppressed");
      return;
    }
    recoverWindowRef.current.count += 1;

    clearRecoverTimer();
    recoverTimerRef.current = setTimeout(() => {
      recoverTimerRef.current = null;
      mountTokenRef.current += 1;
      isMountingRef.current = false;
      clientRef.current?.destroy();
      clientRef.current = null;
      isMountedRef.current = false;
      void mount();
    }, RECOVER_DEBOUNCE_MS);
  }, [clearRecoverTimer, mount]);

  // Visibility-driven mount/destroy — content is NOT in deps to avoid
  // recreating the observer on every streaming chunk.
  useEffect(() => {
    if (state !== "done" || !containerRef.current) {
      clearDestroyTimer();
      destroy();
      return;
    }

    const iframeElement = iframeRef.current;

    const handleIframeLoad = () => {
      if (isMountingRef.current) return;
      if (!isMountedRef.current) return;
      if (Date.now() < ignoreIframeLoadUntilRef.current) return;
      scheduleRecover();
    };

    iframeElement?.addEventListener("load", handleIframeLoad);

    const observer = new IntersectionObserver(
      ([entry]) => {
        lastIntersectingRef.current = entry.isIntersecting;

        if (entry.isIntersecting) {
          clearDestroyTimer();
          void mount();
          return;
        }

        scheduleDestroy();
      },
      { rootMargin: INTERSECTION_ROOT_MARGIN, threshold: 0 },
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      iframeElement?.removeEventListener("load", handleIframeLoad);
      clearDestroyTimer();
    };
  }, [
    clearDestroyTimer,
    containerRef,
    destroy,
    iframeRef,
    mount,
    scheduleDestroy,
    scheduleRecover,
    state,
  ]);

  useEffect(() => {
    return gestureStore.subscribe(() => {
      if (gestureStore.isActive()) {
        clearDestroyTimer();
        return;
      }

      if (!lastIntersectingRef.current) {
        scheduleDestroy();
      }
    });
  }, [clearDestroyTimer, gestureStore, scheduleDestroy]);

  // Debounced content updates — avoids thrashing Sandpack during streaming
  useEffect(() => {
    if (!clientRef.current || !content || !isMountedRef.current) return;

    const timer = setTimeout(() => {
      clientRef.current?.updateSandbox({
        files: buildSandpackFiles(content, originRef.current),
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [content]);

  useEffect(() => {
    return () => {
      clearDestroyTimer();
      clearRecoverTimer();
      destroy();
    };
  }, [clearDestroyTimer, clearRecoverTimer, destroy]);

  return {
    clientRef,
    isMountedRef,
  };
}
