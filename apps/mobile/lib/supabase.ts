import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Lazily import AsyncStorage only on native platforms to prevent
// "window is not defined" crashes during Expo web's SSR pre-render phase.
function getStorage() {
  if (Platform.OS === "web") {
    // In a browser, use localStorage (Supabase default for web)
    return typeof window !== "undefined" ? window.localStorage : undefined;
  }
  // On iOS / Android use AsyncStorage
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("@react-native-async-storage/async-storage").default;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
