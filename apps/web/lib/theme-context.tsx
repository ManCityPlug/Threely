"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getSupabase } from "./supabase-client";

type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolved: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "light",
  setMode: () => {},
  resolved: "light",
});

export function useTheme() {
  return useContext(ThemeContext);
}

async function fetchWithAuth(path: string, options?: RequestInit) {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...(options?.headers ?? {}),
    },
  });
  return res.ok ? res.json() : null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  // Load saved preference on mount, then sync with server
  useEffect(() => {
    const saved = localStorage.getItem("threely-theme") as ThemeMode | null;
    const initial = saved === "light" || saved === "dark" ? saved : "light";
    setModeState(initial);
    setResolved(initial);
    document.documentElement.setAttribute("data-theme", initial);

    // Fetch server-side preference and reconcile
    fetchWithAuth("/api/profile")
      .then((data) => {
        const serverTheme = data?.profile?.theme as ThemeMode | undefined;
        if (serverTheme && (serverTheme === "light" || serverTheme === "dark") && serverTheme !== initial) {
          setModeState(serverTheme);
          setResolved(serverTheme);
          document.documentElement.setAttribute("data-theme", serverTheme);
          localStorage.setItem("threely-theme", serverTheme);
        }
      })
      .catch(() => {});
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    setResolved(m);
    document.documentElement.setAttribute("data-theme", m);
    localStorage.setItem("threely-theme", m);

    // Persist to server (fire-and-forget)
    fetchWithAuth("/api/profile", {
      method: "POST",
      body: JSON.stringify({ theme: m }),
    }).catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, setMode, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}
