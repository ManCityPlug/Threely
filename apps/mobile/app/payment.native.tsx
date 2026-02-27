/**
 * Payment / Paywall Screen
 * Shows 3-tier pricing after the 3-day free trial ends.
 * NOTE: Stripe (stripe-react-native) requires a dev build and is disabled in Expo Go.
 */

import { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";
import { markPaywallSkipped } from "./_layout";

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
  { key: "quarterly", name: "Quarterly", price: "$23.99", sub: "$7.99/mo · billed quarterly", badge: "SAVE 33%" },
  { key: "yearly", name: "Yearly", price: "$59.99", sub: "$4.99/mo · billed annually", badge: "MOST POPULAR" },
];

export default function PaymentScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [plan, setPlan] = useState<Plan>("yearly");
  const selectedPlan = PLANS.find(p => p.key === plan)!;

  return (
    <SafeAreaView style={styles.container}>
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
          style={styles.ctaBtn}
          activeOpacity={0.85}
          onPress={async () => {
            // TODO: Integrate Stripe payment flow in production builds
            markPaywallSkipped();
            await AsyncStorage.setItem("@threely_paywall_skipped", "true");
            router.replace("/(tabs)");
          }}
        >
          <Text style={styles.ctaBtnText}>Subscribe Now</Text>
        </TouchableOpacity>

        <Text style={styles.ctaSub}>
          {selectedPlan.price}/{plan === "yearly" ? "year" : plan === "quarterly" ? "quarter" : "month"}
        </Text>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.legalText}>
            By continuing you agree to our{" "}
            <Text style={styles.legalLink} onPress={() => Linking.openURL("https://threely.app/terms")}>
              Terms
            </Text>
            {" & "}
            <Text style={styles.legalLink} onPress={() => Linking.openURL("https://threely.app/privacy")}>
              Privacy Policy
            </Text>
            . Subscription renews automatically.
          </Text>
          <TouchableOpacity
            onPress={async () => {
              markPaywallSkipped();
              await AsyncStorage.setItem("@threely_paywall_skipped", "true");
              router.replace("/(tabs)");
            }}
            style={styles.restoreBtn}
          >
            <Text style={styles.restoreText}>Skip for now (dev only)</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
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
