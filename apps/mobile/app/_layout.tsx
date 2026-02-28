import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, LogBox, Platform, Text, View } from "react-native";

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
import { LinearGradient } from "expo-linear-gradient";
// StripeProvider uses native modules (OnrampSdk etc.) that crash in Expo Go.
// Only import it for production/custom dev-client builds.
let StripeProvider: React.ComponentType<{ publishableKey: string; merchantIdentifier: string; children: React.ReactNode }> | null = null;
if (!__DEV__) {
  try {
    StripeProvider = require("@stripe/stripe-react-native").StripeProvider;
  } catch {
    // Not available (Expo Go) — leave null
  }
}
import { supabase } from "@/lib/supabase";
import { subscriptionApi, profileApi } from "@/lib/api";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { ToastProvider } from "@/lib/toast";
import { WelcomeScreen } from "@/components/WelcomeScreen";

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

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

// Allow auth screens to navigate back to the welcome flow
let _goBackToWelcome: (() => void) | null = null;
export function goBackToWelcome() {
  _goBackToWelcome?.();
}

function BrandedSplash() {
  return (
    <LinearGradient
      colors={["#1A1040", "#2D1B69", "#635BFF"]}
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      {/* Outer glow */}
      <View
        style={{
          width: 160,
          height: 160,
          borderRadius: 80,
          backgroundColor: "rgba(99, 91, 255, 0.25)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Logo container */}
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 36,
            backgroundColor: "#635BFF",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#635BFF",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 30,
            elevation: 15,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 64, fontWeight: "800" }}>3</Text>
        </View>
      </View>
    </LinearGradient>
  );
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

      // 1. Check cached subscription status
      const cachedStatus = await AsyncStorage.getItem("@threely_subscription_status");

      if (isAccessGranted(cachedStatus)) {
        if (inAuthGroup || inOnboarding || inPayment) router.replace("/(tabs)");
        setReady(true);
        return;
      }

      // 2. Re-check with backend (catches trial expiry, cancellation, etc.)
      try {
        const { status } = await subscriptionApi.status();

        if (isAccessGranted(status)) {
          await AsyncStorage.setItem("@threely_subscription_status", status ?? "");
          if (inAuthGroup || inOnboarding || inPayment) router.replace("/(tabs)");
          setReady(true);
          return;
        }

        // No valid subscription — show payment screen
        if (!inPayment) router.replace("/payment");
        setReady(true);
      } catch {
        // Backend unreachable — be lenient (don't block offline users)
        if (inAuthGroup || inOnboarding) router.replace("/(tabs)");
        setReady(true);
      }
    });
  }, [session, segments, welcomeDone]);

  // Still loading auth state
  if (session === undefined) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BrandedSplash />
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
        <BrandedSplash />
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
  const content = (
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  );

  if (StripeProvider) {
    return (
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} merchantIdentifier="merchant.com.threely.app">
        {content}
      </StripeProvider>
    );
  }

  return content;
}
