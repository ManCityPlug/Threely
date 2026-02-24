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

  // Load saved preference on startup
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      const saved = v === "light" || v === "dark" || v === "system" ? v : "system";
      setPreferenceState(saved);
      setLoaded(true);
    });
  }, []);

  // Determine dark mode from preference + system scheme
  const isDark = preference === "dark"
    ? true
    : preference === "light"
      ? false
      : systemColorScheme === "dark";

  const colors: Colors = isDark ? darkColors : lightColors;

  const setPreference = useCallback(async (pref: ColorSchemePreference) => {
    setPreferenceState(pref);
    await AsyncStorage.setItem(STORAGE_KEY, pref);
  }, []);

  const value = useMemo(
    () => ({ colors, isDark, preference, setPreference }),
    [colors, isDark, preference, setPreference]
  );

  // Don't render until we've loaded the preference to avoid flash
  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
