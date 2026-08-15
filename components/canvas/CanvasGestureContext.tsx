"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface CanvasGestureStore {
  isActive: () => boolean;
  begin: () => void;
  end: () => void;
  reset: () => void;
  subscribe: (listener: () => void) => () => void;
}

export function createCanvasGestureStore(): CanvasGestureStore {
  let count = 0;
  const listeners = new Set<() => void>();

  const notify = () => {
    listeners.forEach((listener) => listener());
  };

  return {
    isActive: () => count > 0,
    begin: () => {
      count += 1;
      if (count === 1) notify();
    },
    end: () => {
      if (count === 0) return;
      count -= 1;
      if (count === 0) notify();
    },
    reset: () => {
      if (count === 0) return;
      count = 0;
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const fallbackStore = createCanvasGestureStore();

const CanvasGestureContext = createContext<CanvasGestureStore | null>(null);

export function CanvasGestureProvider({
  children,
  store: storeProp,
}: {
  children: ReactNode;
  store?: CanvasGestureStore;
}) {
  const [created] = useState(() => createCanvasGestureStore());
  const store = storeProp ?? created;

  useEffect(() => {
    const handlePointerUp = () => {
      store.reset();
    };
    const handleBlur = () => {
      store.reset();
    };

    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [store]);

  return (
    <CanvasGestureContext.Provider value={store}>
      {children}
    </CanvasGestureContext.Provider>
  );
}

export function useCanvasGestureStore() {
  return useContext(CanvasGestureContext) ?? fallbackStore;
}
