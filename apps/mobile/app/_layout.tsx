import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, LogBox, Platform, View } from "react-native";

// Suppress network/API errors that show up in Expo Go when API points to production
LogBox.ignoreLogs([
  "Failed to fetch",
  "loadData error",
  "Goals load error",
  "Not authenticated",
  "Request failed",
]);
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Session } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
// TODO: Uncomment for production builds — not supported in Expo Go
// import * as Clarity from "@microsoft/react-native-clarity";
import { supabase } from "@/lib/supabase";
import { subscriptionApi, profileApi } from "@/lib/api";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { ToastProvider } from "@/lib/toast";
import { WelcomeScreen } from "@/components/WelcomeScreen";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  // TODO: Uncomment for production builds — not supported in Expo Go
  // Clarity.initialize("vm4n4qax20");
}

// ── Valid subscription statuses that allow app access ─────────────────────────
function isAccessGranted(status: string | null): boolean {
  return status === "trialing" || status === "active";
}

// ── Paywall skip: persisted flag so the "Skip" button actually sticks ─────────
const PAYWALL_SKIP_KEY = "@threely_paywall_skipped";

// In-memory flag set by the payment screen before navigating, so the layout
// effect sees it synchronously and doesn't race with AsyncStorage reads.
let _paywallSkippedGlobal = false;
export function markPaywallSkipped() {
  _paywallSkippedGlobal = true;
}

// Allow auth screens to navigate back to the welcome flow
let _goBackToWelcome: (() => void) | null = null;
export function goBackToWelcome() {
  _goBackToWelcome?.();
}

function AppContent() {
  const router = useRouter();
  const segments = useSegments();
  const { isDark } = useTheme();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [authOverlay, setAuthOverlay] = useState(false);
  const [welcomeInitialPage, setWelcomeInitialPage] = useState(0);
  const pendingDestination = useRef<"register" | "login" | null>(null);
  const paywallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paywallSkippedRef = useRef(false);

  // Register the "go back to welcome" callback for auth screens
  useEffect(() => {
    _goBackToWelcome = () => {
      setWelcomeDone(false);
      setWelcomeInitialPage(3); // Return to auth page
      pendingDestination.current = null;
      setAuthOverlay(false);
    };
    return () => { _goBackToWelcome = null; };
  }, []);

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

  const handleWelcomeComplete = useCallback(
    (destination?: "register" | "login") => {
      if (destination) {
        pendingDestination.current = destination;
        setAuthOverlay(true); // Dark overlay prevents flash of default route
        setReady(true);
        setWelcomeDone(true);
      }
    },
    []
  );

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
      if (welcomeDone) {
        const dest = pendingDestination.current;
        if (dest) {
          pendingDestination.current = null;
          const route = dest === "register" ? "/(auth)/register" : "/(auth)/login";
          if (!inAuthGroup) {
            setTimeout(() => {
              router.replace(route);
              // Remove overlay once navigation settles
              setTimeout(() => setAuthOverlay(false), 150);
            }, 50);
          } else {
            setAuthOverlay(false);
          }
          return;
        }
      }
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

      // 1. Check if user pressed "Skip" on the paywall (persists across restarts)
      //    Also check the in-memory ref to avoid race conditions when navigating
      //    away from the payment screen (segments change triggers this effect again
      //    before AsyncStorage read resolves).
      if (paywallSkippedRef.current || _paywallSkippedGlobal || __DEV__) {
        if (inAuthGroup || inOnboarding || inPayment) router.replace("/(tabs)");
        setReady(true);
        return;
      }
      const skipped = await AsyncStorage.getItem(PAYWALL_SKIP_KEY);
      if (skipped) {
        paywallSkippedRef.current = true;
        if (inAuthGroup || inOnboarding || inPayment) router.replace("/(tabs)");
        setReady(true);
        return;
      }

      // 2. Check cached subscription status
      const cachedStatus = await AsyncStorage.getItem("@threely_subscription_status");

      if (isAccessGranted(cachedStatus)) {
        if (inAuthGroup || inOnboarding || inPayment) router.replace("/(tabs)");
        setReady(true);
        return;
      }

      // 3. Re-check with backend (catches trial expiry, cancellation, etc.)
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
  }, [session, segments, welcomeDone]);

  // Still loading auth state
  if (session === undefined) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      </GestureHandlerRootView>
    );
  }

  // Not logged in — show welcome flow, then transition to auth Stack
  if (!session && !welcomeDone) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <WelcomeScreen onComplete={handleWelcomeComplete} initialPage={welcomeInitialPage} />
      </GestureHandlerRootView>
    );
  }

  if (!ready) {
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
      {authOverlay && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#1A1040",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
          }}
        >
          <ActivityIndicator color="#FFFFFF" />
        </View>
      )}
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
