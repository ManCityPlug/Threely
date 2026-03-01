import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Image, Linking, LogBox, Modal, Platform, Text, TouchableOpacity, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";

// Keep native splash visible until we're ready
SplashScreen.preventAutoHideAsync().catch(() => {});

// Suppress network/API errors that show up in Expo Go when API points to production
LogBox.ignoreLogs([
  "Failed to fetch",
  "loadData error",
  "Goals load error",
  "Not authenticated",
  "Request failed",
  "Invalid Refresh Token",
  "AuthApiError",
  "No native splash screen",
]);
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Session } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Clarity from "@microsoft/react-native-clarity";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import { supabase } from "@/lib/supabase";
import { profileApi } from "@/lib/api";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { ToastProvider } from "@/lib/toast";
import { SubscriptionProvider, useSubscription } from "@/lib/subscription-context";
import { WalkthroughRegistryProvider } from "@/lib/walkthrough-registry";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { TrialBottomSheet } from "@/components/TrialBottomSheet";
import { spacing, radius, typography } from "@/constants/theme";

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  Clarity.initialize("vm4n4qax20");
}

// ── Forced-update helpers ─────────────────────────────────────────────────────

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
const APP_STORE_URL = "https://apps.apple.com/app/id6759625661";

function isVersionLessThan(current: string, minimum: string): boolean {
  const c = current.split(".").map(Number);
  const m = minimum.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((c[i] || 0) < (m[i] || 0)) return true;
    if ((c[i] || 0) > (m[i] || 0)) return false;
  }
  return false;
}

// Kept as no-op export for import compatibility
export function goBackToWelcome() {}

function BrandedSplash() {
  useEffect(() => {
    // Hide native splash once this component is visible
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#1A1040", alignItems: "center", justifyContent: "center" }}>
      <Image
        source={require("@/assets/icon.png")}
        style={{
          width: 160,
          height: 160,
          borderRadius: 40,
        }}
      />
    </View>
  );
}

function AppContent() {
  const router = useRouter();
  const segments = useSegments();
  const { isDark, colors } = useTheme();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [authOverlay, setAuthOverlay] = useState(false);
  const [updateRequired, setUpdateRequired] = useState(false);
  const pendingDestination = useRef<"register" | "login" | null>(null);
  const routingResolved = useRef(false);

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

  // ── Forced app update check (runs once on launch) ──────────────────────────
  useEffect(() => {
    // Skip version gate during development
    if (__DEV__) return;

    const appVersion = Constants.expoConfig?.version ?? "0.0.0";

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/health`);
        if (!res.ok) return; // Fail open — don't block if API is down
        const data = await res.json();
        const minVersion: string | undefined = data.minAppVersion;
        if (minVersion && isVersionLessThan(appVersion, minVersion)) {
          setUpdateRequired(true);
        }
      } catch {
        // Network error — fail open, don't block the user
      }
    })();
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

    // Refresh session when app comes to foreground — keeps the user
    // logged in for up to 60 days of activity (each foreground resets the timer)
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        supabase.auth.refreshSession().catch(() => {});
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
      appStateSub.remove();
    };
  }, []);

  // Reset routing on actual login/logout transitions (not token refreshes)
  const prevSessionExists = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const exists = session != null;
    if (prevSessionExists.current !== undefined && prevSessionExists.current !== exists) {
      routingResolved.current = false;
      setReady(false);
      // On logout, reset welcomeDone so carousel shows again
      if (!exists) {
        setWelcomeDone(false);
      }
    }
    prevSessionExists.current = exists;
  }, [session]);

  useEffect(() => {
    if (session === undefined) return;
    // Once we've resolved the destination, don't re-run on segment changes
    if (routingResolved.current) return;

    const inAuthGroup   = segments[0] === "(auth)";
    const inOnboarding  = segments[0] === "(onboarding)";
    const inPayment     = segments[0] === "payment";

    if (!session) {
      if (welcomeDone) {
        const dest = pendingDestination.current;
        if (dest) {
          pendingDestination.current = null;
          routingResolved.current = true;
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
          setReady(true);
          return;
        }
      }

      // Not logged in and haven't completed welcome — show carousel
      // (carousel is rendered by the JSX check below, just mark ready)
      setReady(true);
      return;
    }

    // Initialize RevenueCat and link to Supabase user
    (async () => {
      try {
        if (__DEV__) {
          Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        }
        Purchases.configure({ apiKey: REVENUECAT_IOS_KEY });
        await Purchases.logIn(session.user.id);
      } catch (e) {
        console.warn("RevenueCat init failed:", e);
      }
    })();

    const onboardingKey = `@threely_onboarding_done_${session.user.id}`;
    AsyncStorage.getItem(onboardingKey).then(async (done) => {
      // Guard against race: another run may have resolved while we were awaiting
      if (routingResolved.current) return;

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

      if (routingResolved.current) return;

      if (!done) {
        routingResolved.current = true;
        if (!inOnboarding) router.replace("/(onboarding)");
        setReady(true);
        return;
      }

      // Onboarded — always route to /(tabs).
      // Subscription state is handled by SubscriptionProvider + paywall overlays,
      // not by route-blocking.
      routingResolved.current = true;
      if (inAuthGroup || inOnboarding || inPayment) router.replace("/(tabs)");
      setReady(true);
    }).catch(() => {
      // AsyncStorage failure — don't leave the user stuck on the splash screen
      if (!routingResolved.current) {
        routingResolved.current = true;
        router.replace("/(tabs)");
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

  // Not logged in — always show welcome carousel until they pick sign up/login
  if (!session && !welcomeDone) {
    // Hide native splash before showing welcome screen
    SplashScreen.hideAsync().catch(() => {});
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <WelcomeScreen onComplete={handleWelcomeComplete} />
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

  // Hide native splash when main app is ready
  SplashScreen.hideAsync().catch(() => {});

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

      {/* Bottom-sheet trial paywall (accessible from any screen) */}
      <TrialBottomSheetGate />

      {/* Forced update blocking modal */}
      <Modal
        visible={updateRequired}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          // Prevent Android back button from dismissing
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              backgroundColor: colors.bgElevated,
              borderRadius: radius.xl,
              padding: spacing.xl,
              width: "100%",
              maxWidth: 340,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 48, marginBottom: spacing.md }}>
              🚀
            </Text>
            <Text
              style={{
                fontSize: typography.xl,
                fontWeight: typography.bold,
                color: colors.text,
                textAlign: "center",
                marginBottom: spacing.sm,
              }}
            >
              Update Available
            </Text>
            <Text
              style={{
                fontSize: typography.base,
                fontWeight: typography.regular,
                color: colors.textSecondary,
                textAlign: "center",
                lineHeight: 22,
                marginBottom: spacing.lg,
              }}
            >
              A new version of Threely is available with important improvements.
              Please update to continue using the app.
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => Linking.openURL(APP_STORE_URL)}
              style={{
                backgroundColor: colors.primary,
                borderRadius: radius.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.xl,
                width: "100%",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.primaryText,
                  fontSize: typography.md,
                  fontWeight: typography.semibold,
                }}
              >
                Update Now
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

function TrialBottomSheetGate() {
  const { paywallType, dismissPaywall, refreshSubscription } = useSubscription();

  return (
    <TrialBottomSheet
      visible={paywallType === "bottomsheet"}
      onDismiss={dismissPaywall}
      onSubscribed={() => {
        dismissPaywall();
        refreshSubscription();
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppContentWithSubscription />
      </ToastProvider>
    </ThemeProvider>
  );
}

function AppContentWithSubscription() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <SubscriptionProvider userId={userId}>
      <WalkthroughRegistryProvider>
        <AppContent />
      </WalkthroughRegistryProvider>
    </SubscriptionProvider>
  );
}
