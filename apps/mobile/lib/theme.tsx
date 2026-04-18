import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lightColors, darkColors } from "@/constants/theme";
import type { Colors } from "@/constants/theme";

export type ColorSchemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "@threely_color_scheme";

interface ThemeContextValue {
  colors: Colors;
  isDark: boolean;
  preference: ColorSchemePreference;
  setPreference: (pref: ColorSchemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  isDark: false,
  preference: "system",
  setPreference: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ColorSchemePreference>("system");
  const [loaded, setLoaded] = useState(false);

  // useColorScheme automatically listens to OS appearance changes
  const systemColorScheme = useColorScheme();

  // Load saved preference on startup (with timeout to prevent blank screen on iPad)
  useEffect(() => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        setLoaded(true); // Fall through with default "system" preference
      }
    }, 2000);

    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (!settled) {
          settled = true;
          const saved = v === "light" || v === "dark" || v === "system" ? v : "system";
          setPreferenceState(saved);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          setLoaded(true);
        }
      });

    return () => clearTimeout(timeout);
  }, []);

  // Force dark mode on mobile to match the web app (which is dark-only).
  // Preference still tracked for settings UI but no longer drives the colors.
  void preference; void systemColorScheme;
  const isDark = true;

  const colors = darkColors as unknown as Colors;

  const setPreference = useCallback(async (pref: ColorSchemePreference) => {
    setPreferenceState(pref);
    await AsyncStorage.setItem(STORAGE_KEY, pref);
  }, []);

  const value = useMemo(
    () => ({ colors, isDark, preference, setPreference }),
    [colors, isDark, preference, setPreference]
  );

  // Render children immediately — the `useMemo` already defaults to a valid
  // color set ("system" → light or dark), so there's no flash.  Returning null
  // here previously caused the entire app to render nothing while AsyncStorage
  // loaded, which appeared as a freeze on iPad (slower storage access).
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
