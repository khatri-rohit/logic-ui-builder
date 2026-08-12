"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

interface CanvasScaleStore {
  getScale: () => number;
  setScale: (k: number) => void;
  subscribe: (listener: () => void) => () => void;
}

function createCanvasScaleStore(initial = 1): CanvasScaleStore {
  let scale = Math.max(initial, 0.001);
  const listeners = new Set<() => void>();

  return {
    getScale: () => scale,
    setScale: (k: number) => {
      const next = Math.max(k, 0.001);
      if (next === scale) return;
      scale = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const fallbackStore = createCanvasScaleStore(1);

const CanvasScaleContext = createContext<CanvasScaleStore | null>(null);

export function CanvasScaleProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<CanvasScaleStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createCanvasScaleStore(1);
  }

  return (
    <CanvasScaleContext.Provider value={storeRef.current}>
      {children}
    </CanvasScaleContext.Provider>
  );
}

export function useCanvasScaleStore() {
  return useContext(CanvasScaleContext) ?? fallbackStore;
}

/** Subscribe to scale for components that need re-render on zoom (rare). */
export function useCanvasScale(): number {
  const store = useCanvasScaleStore();
  return useSyncExternalStore(store.subscribe, store.getScale, () => 1);
}

/** Non-subscribing getter for pointer math inside event handlers. */
export function useCanvasScaleGetter() {
  const store = useCanvasScaleStore();
  return useCallback(() => store.getScale(), [store]);
}
