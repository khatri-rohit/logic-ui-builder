import { RefObject, useCallback, useEffect, useRef } from "react";
import {
  loadSandpackClient,
  SandpackClient,
} from "@codesandbox/sandpack-client";
import { useSandpack } from "@codesandbox/sandpack-react";
import { buildSandpackFiles } from "@/lib/sandpackTemplate";
import { FrameState } from "@/lib/canvas-state";
import logger from "@/lib/logger";

interface UseFrameLifecycleOptions {
  content: string;
  state: FrameState;
  containerRef: RefObject<HTMLDivElement | null>;
  iframeRef: RefObject<HTMLIFrameElement | null>;
}

const DESTROY_GRACE_MS = 5000;
const INTERSECTION_ROOT_MARGIN = "300px 300px";

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

  const { sandpack } = useSandpack();
  const { error } = sandpack;

  const mount = useCallback(async () => {
    logger.info("mount: ", content);
    // logger.info("mount: ", iframeRef.current);
    const iframeElement = iframeRef.current;
    if (!iframeElement || !content) return;
    if (isMountedRef.current || isMountingRef.current) return;

    const mountToken = mountTokenRef.current + 1;
    mountTokenRef.current = mountToken;
    isMountingRef.current = true;

    try {
      const client = await loadSandpackClient(
        iframeElement,
        {
          files: buildSandpackFiles(content),
          entry: "/index.tsx",
          template: "create-react-app-typescript",
        },
        {
          showOpenInCodeSandbox: false,
          showErrorScreen: true,
          showLoadingScreen: true,
          externalResources: [
            "https://cdn.tailwindcss.com?plugins=forms,typography,aspect-ratio,container-queries",
          ],
        },
      );

      if (mountToken !== mountTokenRef.current) {
        client.destroy();
        return;
      }

      clientRef.current = client;
      isMountedRef.current = true;
    } finally {
      if (mountToken === mountTokenRef.current) {
        isMountingRef.current = false;
      }
    }
  }, [content, iframeRef]);

  const destroy = useCallback(() => {
    mountTokenRef.current += 1;
    isMountingRef.current = false;
    clientRef.current?.destroy();
    clientRef.current = null;
    isMountedRef.current = false;

    if (iframeRef.current) {
      iframeRef.current.src = "about:blank";
    }
  }, [iframeRef]);

  useEffect(() => {
    if (state !== "done" || !content || !containerRef.current) {
      if (destroyTimerRef.current) {
        clearTimeout(destroyTimerRef.current);
        destroyTimerRef.current = null;
      }
      destroy();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (destroyTimerRef.current) {
            clearTimeout(destroyTimerRef.current);
            destroyTimerRef.current = null;
          }

          void mount();
          return;
        }

        if (destroyTimerRef.current) {
          clearTimeout(destroyTimerRef.current);
        }

        destroyTimerRef.current = setTimeout(() => {
          destroy();
          destroyTimerRef.current = null;
        }, DESTROY_GRACE_MS);
      },
      { rootMargin: INTERSECTION_ROOT_MARGIN, threshold: 0 },
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      if (destroyTimerRef.current) {
        clearTimeout(destroyTimerRef.current);
        destroyTimerRef.current = null;
      }
    };
  }, [containerRef, content, destroy, mount, state]);

  useEffect(() => {
    if (!clientRef.current || !content || !isMountedRef.current) return;

    clientRef.current.updateSandbox({ files: buildSandpackFiles(content) });
  }, [content]);

  useEffect(() => {
    if (error) {
      logger.error("Sandbox error: ", error);
      destroy();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (destroyTimerRef.current) {
        clearTimeout(destroyTimerRef.current);
        destroyTimerRef.current = null;
      }
      destroy();
    };
  }, [destroy]);

  return {
    clientRef,
    isMountedRef,
  };
}
