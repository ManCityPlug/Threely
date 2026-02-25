import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Session } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { supabase } from "@/lib/supabase";
import { subscriptionApi, profileApi } from "@/lib/api";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { ToastProvider } from "@/lib/toast";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  // Microsoft Clarity — requires native build. Uncomment after next `eas build`:
  // import("@microsoft/react-native-clarity").then((Clarity) => {
  //   Clarity.initialize("vm4n4qax20");
  // }).catch(() => {});
}

// ── Valid subscription statuses that allow app access ─────────────────────────
function isAccessGranted(status: string | null): boolean {
  return status === "trialing" || status === "active";
}

// ── DEV BYPASS: set to true to skip paywall in Expo Go ────────────────────────
const DEV_BYPASS_PAYWALL = __DEV__;

function AppContent() {
  const router = useRouter();
  const segments = useSegments();
  const { isDark } = useTheme();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const paywallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for notification responses (deep links)
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      if (data?.action === "weekly-summary") {
        AsyncStorage.setItem("@threely_open_weekly_summary", "1").then(() => {
          router.push("/(tabs)/profile" as never);
        });
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Recover existing session — catch invalid/expired refresh tokens
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (error) {
        console.warn("Session recovery failed:", error.message);
        supabase.auth.signOut().catch(() => {});
        setSession(null);
      } else {
        setSession(s);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;

    const inAuthGroup   = segments[0] === "(auth)";
    const inOnboarding  = segments[0] === "(onboarding)";
    const inPayment     = segments[0] === "payment";

    if (!session) {
      if (!inAuthGroup) router.replace("/(auth)/login");
      setReady(true);
      return;
    }

    const onboardingKey = `@threely_onboarding_done_${session.user.id}`;
    AsyncStorage.getItem(onboardingKey).then(async (done) => {
      // Not onboarded locally — check backend for existing profile
      if (!done) {
        try {
          const { profile } = await profileApi.get();
          if (profile) {
            // User already onboarded (different device / reinstall) — persist flag locally
            await AsyncStorage.setItem(onboardingKey, "true");
            done = "true";
          }
        } catch {
          // Backend unreachable — fall through to onboarding check below
        }
      }

      if (!done) {
        if (!inOnboarding) router.replace("/(onboarding)");
        setReady(true);
        return;
      }

      // Onboarded — check subscription gate
      if (DEV_BYPASS_PAYWALL) {
        if (inAuthGroup || inOnboarding || inPayment) router.replace("/(tabs)");
        setReady(true);
        return;
      }

      const cachedStatus = await AsyncStorage.getItem("@threely_subscription_status");

      if (isAccessGranted(cachedStatus)) {
        // Already verified — go to tabs
        if (inAuthGroup || inOnboarding || inPayment) router.replace("/(tabs)");
        setReady(true);
        return;
      }

      // Re-check with backend (catches trial expiry, cancellation, etc.)
      try {
        const { status } = await subscriptionApi.status();

        if (isAccessGranted(status)) {
          await AsyncStorage.setItem("@threely_subscription_status", status ?? "");
          if (inAuthGroup || inOnboarding || inPayment) router.replace("/(tabs)");
          setReady(true);
          return;
        }

        // No valid subscription — enforce paywall
        if (!inPayment) {
          const paywallShown = await AsyncStorage.getItem("@threely_paywall_shown");

          if (!paywallShown) {
            // First time — let them land on the tabs, then pop paywall after 10 s
            if (inAuthGroup || inOnboarding) router.replace("/(tabs)");
            setReady(true);
            paywallTimerRef.current = setTimeout(async () => {
              await AsyncStorage.setItem("@threely_paywall_shown", "true");
              router.replace("/payment" as never);
            }, 10000);
          } else {
            // Returning user with no valid sub — straight to paywall
            router.replace("/payment" as never);
            setReady(true);
          }
        } else {
          setReady(true);
        }
      } catch {
        // Backend unreachable — be lenient (don't block offline users)
        if (inAuthGroup || inOnboarding) router.replace("/(tabs)");
        setReady(true);
      }
    });

    return () => {
      if (paywallTimerRef.current) clearTimeout(paywallTimerRef.current);
    };
  }, [session, segments]);

  if (session === undefined || !ready) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  );
}
