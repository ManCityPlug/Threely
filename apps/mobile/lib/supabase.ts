import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

// Guard env vars: missing values must NOT throw at module load because that
// crashes the app before Sentry or the ErrorBoundary can catch it (the whole
// JS bundle fails to evaluate). Auth calls made against the placeholder URL
// will fail with a recognizable network error instead.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://missing.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "missing-anon-key";

if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.error("[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
}

// Lazily import AsyncStorage only on native platforms to prevent
// "window is not defined" crashes during Expo web's SSR pre-render phase.
function getStorage() {
  if (Platform.OS === "web") {
    // In a browser, use localStorage (Supabase default for web)
    return typeof window !== "undefined" ? window.localStorage : undefined;
  }
  // On iOS / Android use AsyncStorage
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("@react-native-async-storage/async-storage").default;
  } catch {
    // If AsyncStorage fails to load, Supabase falls back to in-memory storage.
    return undefined;
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
