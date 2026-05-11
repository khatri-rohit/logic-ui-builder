"use client";

import { createContext, useContext } from "react";

export type StudioThemeMode = "light" | "dark" | "system";

interface StudioThemeContextValue {
  mode: StudioThemeMode;
  isDark: boolean;
}

const StudioThemeContext = createContext<StudioThemeContextValue>({
  mode: "dark",
  isDark: true,
});

export const StudioThemeProvider = StudioThemeContext.Provider;
export const useStudioTheme = () => useContext(StudioThemeContext);
