/**
 * Payment / Paywall Screen
 * Shows 3-tier pricing with Stripe Payment Sheet integration.
 */

import { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePaymentSheet } from "@stripe/stripe-react-native";
import * as Application from "expo-application";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";
import { subscriptionApi } from "@/lib/api";

// ─── Price IDs (must match backend stripe.ts) ────────────────────────────────
const PRICE_IDS: Record<string, string> = {
  monthly: "price_1T2mnkQ3O0etrH9yHFjRpjtt",
  quarterly: "price_1T5qCcQ3O0etrH9yiHGixSSU",
  yearly: "price_1T2mo8Q3O0etrH9yOIxkMv7H",
};

// ─── Features list ────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: "sparkles-outline" as const,        text: "AI-powered tasks tailored to your goals" },
  { icon: "infinite-outline" as const,        text: "Unlimited goals & daily task generation" },
  { icon: "bar-chart-outline" as const,       text: "Progress tracking & full history" },
  { icon: "notifications-outline" as const,   text: "Daily reminders at your chosen time" },
  { icon: "refresh-circle-outline" as const,  text: "Generate new tasks as you complete them" },
];

type Plan = "monthly" | "quarterly" | "yearly";

const PLANS: { key: Plan; name: string; price: string; sub: string; badge?: string }[] = [
  { key: "monthly", name: "Monthly", price: "$11.99", sub: "per month" },
  { key: "yearly", name: "Yearly", price: "$59.99", sub: "$4.99/mo · billed annually", badge: "MOST POPULAR · SAVE 58%" },
  { key: "quarterly", name: "Quarterly", price: "$23.99", sub: "$7.99/mo · billed quarterly", badge: "SAVE 33%" },
];

export default function PaymentScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();

  const [plan, setPlan] = useState<Plan>("yearly");
  const [loading, setLoading] = useState(false);
  const selectedPlan = PLANS.find(p => p.key === plan)!;

  async function handleSubscribe() {
    setLoading(true);
    try {
      // Get a unique device ID for anti-abuse
      const deviceId = (Platform.OS === "ios"
        ? await Application.getIosIdForVendorAsync()
        : Application.androidId) ?? "unknown";

      // Call backend to create Stripe subscription + get payment sheet params
      const result = await subscriptionApi.create(PRICE_IDS[plan], deviceId);

      if (result.isResubscribe) {
        // Resubscribe flow — use PaymentIntent
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: result.setupIntentClientSecret,
          customerEphemeralKeySecret: result.ephemeralKeySecret,
          customerId: result.customerId,
          merchantDisplayName: "Threely",
          allowsDelayedPaymentMethods: false,
        });

        if (initError) {
          Alert.alert("Error", initError.message);
          return;
        }
      } else {
        // New subscription with trial — use SetupIntent (collect card, charge later)
        const { error: initError } = await initPaymentSheet({
          setupIntentClientSecret: result.setupIntentClientSecret,
          customerEphemeralKeySecret: result.ephemeralKeySecret,
          customerId: result.customerId,
          merchantDisplayName: "Threely",
          allowsDelayedPaymentMethods: false,
        });

        if (initError) {
          Alert.alert("Error", initError.message);
          return;
        }
      }

      // Present the payment sheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== "Canceled") {
          Alert.alert("Payment failed", presentError.message);
        }
        return;
      }

      // Success — save subscription status and navigate
      await AsyncStorage.setItem("@threely_subscription_status", "trialing");
      router.replace("/(tabs)");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Close button */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.closeBtn}
        activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="close" size={24} color={colors.textSecondary} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            <Text style={styles.logoIcon}>✦</Text>
          </View>
          <Text style={styles.heroTitle}>Subscribe to keep your{"\n"}momentum going</Text>
          <Text style={styles.heroSubtitle}>
            Your goals and progress are safe.{"\n"}Subscribe to unlock new AI-generated tasks.
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresCard}>
          {FEATURES.map(({ icon, text }) => (
            <View key={text} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Ionicons name={icon} size={18} color={colors.primary} />
              </View>
              <Text style={styles.featureText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* Plan selector — 3 tiers */}
        <Text style={styles.sectionLabel}>Choose your plan</Text>

        {PLANS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.planCard, plan === p.key && styles.planCardSelected]}
            onPress={() => setPlan(p.key)}
            activeOpacity={0.8}
          >
            <View style={styles.planCardInner}>
              <View style={styles.planRadio}>
                {plan === p.key && <View style={[styles.planRadioDot, { backgroundColor: colors.primary }]} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.planNameRow}>
                  <Text style={[styles.planName, plan === p.key && styles.planNameSelected]}>{p.name}</Text>
                  {p.badge && (
                    <View style={[styles.planBadge, { backgroundColor: p.key === "yearly" ? colors.primary : colors.success }]}>
                      <Text style={styles.planBadgeText}>{p.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.planSub, plan === p.key && styles.planSubSelected]}>{p.sub}</Text>
              </View>
              <Text style={[styles.planPrice, plan === p.key && styles.planPriceSelected]}>{p.price}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: spacing.lg }} />

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, loading && { opacity: 0.7 }]}
          activeOpacity={0.85}
          onPress={handleSubscribe}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.ctaBtnText}>Start Free Trial</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.ctaSub}>
          3-day free trial · then {selectedPlan.price}/{plan === "yearly" ? "year" : plan === "quarterly" ? "quarter" : "month"}
        </Text>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.legalText}>
            By continuing you agree to our{" "}
            <Text style={styles.legalLink} onPress={() => Linking.openURL("https://threely.co/terms")}>
              Terms
            </Text>
            {", "}
            <Text style={styles.legalLink} onPress={() => Linking.openURL("https://threely.co/privacy")}>
              Privacy Policy
            </Text>
            {" & "}
            <Text style={styles.legalLink} onPress={() => Linking.openURL("https://threely.co/refund")}>
              Refund Policy
            </Text>
            . Subscription renews automatically after trial.
          </Text>
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={async () => {
              // Check backend for existing subscription
              try {
                const { status } = await subscriptionApi.status();
                if (status === "trialing" || status === "active") {
                  await AsyncStorage.setItem("@threely_subscription_status", status);
                  router.replace("/(tabs)");
                } else {
                  Alert.alert("No active subscription", "We couldn't find an active subscription for your account.");
                }
              } catch {
                Alert.alert("Error", "Failed to check subscription status.");
              }
            }}
          >
            <Text style={styles.restoreText}>Restore purchases</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    closeBtn: {
      position: "absolute", top: spacing.xl + 44, right: spacing.lg,
      zIndex: 10, width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.card, alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: c.border, ...shadow.sm,
    },
    scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    hero: { alignItems: "center", paddingTop: spacing.xl, marginBottom: spacing.xl },
    logoWrap: {
      width: 80,
      height: 80,
      borderRadius: radius.xl,
      backgroundColor: c.primaryLight,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.lg,
      borderWidth: 2,
      borderColor: c.primary + "44",
    },
    logoIcon: { fontSize: 36, color: c.primary },
    heroTitle: {
      fontSize: typography.xxl,
      fontWeight: typography.bold,
      color: c.text,
      letterSpacing: -0.5,
      marginBottom: spacing.sm,
      textAlign: "center",
    },
    heroSubtitle: {
      fontSize: typography.base,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 22,
    },
    featuresCard: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      marginBottom: spacing.xl,
      gap: spacing.sm,
      ...shadow.sm,
    },
    featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    featureIconWrap: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: c.primaryLight,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    featureText: {
      flex: 1,
      fontSize: typography.sm,
      color: c.text,
      fontWeight: typography.medium,
      lineHeight: 20,
    },
    sectionLabel: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: spacing.sm,
    },
    planCard: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 2,
      borderColor: c.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...shadow.sm,
    },
    planCardSelected: {
      borderColor: c.primary,
      backgroundColor: c.primaryLight,
    },
    planCardInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    planRadio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    planRadioDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    planNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginBottom: 2,
    },
    planBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    planBadgeText: {
      fontSize: 9,
      fontWeight: typography.bold,
      color: "#fff",
      letterSpacing: 0.5,
    },
    planName: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: c.text,
    },
    planNameSelected: { color: c.primary },
    planPrice: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: c.text,
      letterSpacing: -0.3,
    },
    planPriceSelected: { color: c.primary },
    planSub: {
      fontSize: typography.xs,
      color: c.textTertiary,
    },
    planSubSelected: { color: c.primary + "BB" },
    ctaBtn: {
      height: 56,
      backgroundColor: c.primary,
      borderRadius: radius.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      marginBottom: spacing.sm,
      ...shadow.md,
    },
    ctaBtnText: {
      fontSize: typography.md,
      fontWeight: typography.bold,
      color: "#fff",
      letterSpacing: -0.2,
    },
    ctaSub: {
      fontSize: typography.xs,
      color: c.textTertiary,
      textAlign: "center",
      marginBottom: spacing.xl,
    },
    footer: { alignItems: "center", gap: spacing.md },
    legalText: {
      fontSize: typography.xs,
      color: c.textTertiary,
      textAlign: "center",
      lineHeight: 18,
    },
    legalLink: { color: c.primary, textDecorationLine: "underline" },
    restoreBtn: { paddingVertical: spacing.sm },
    restoreText: {
      fontSize: typography.sm,
      color: c.textSecondary,
      fontWeight: typography.medium,
    },
  });
}
