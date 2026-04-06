"use client";

import { createContext, useContext, useEffect } from "react";

type ThemeMode = "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolved: ThemeMode;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  setMode: () => {},
  resolved: "dark",
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // App is dark mode only — force it on every render
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.style.colorScheme = "dark";
    try { localStorage.setItem("threely-theme", "dark"); } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ mode: "dark", setMode: () => {}, resolved: "dark" }}>
      {children}
    </ThemeContext.Provider>
  );
}
