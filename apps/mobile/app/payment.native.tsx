/**
 * Payment / Paywall Screen
 * NOTE: Stripe (stripe-react-native) requires a dev build and is disabled in Expo Go.
 * This stub shows the paywall UI without payment processing.
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
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";

// ─── Features list ────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: "sparkles-outline" as const,        text: "AI-powered tasks tailored to your goals" },
  { icon: "infinite-outline" as const,        text: "Unlimited goals & daily task generation" },
  { icon: "bar-chart-outline" as const,       text: "Progress tracking & full history" },
  { icon: "notifications-outline" as const,   text: "Daily reminders at your chosen time" },
  { icon: "refresh-circle-outline" as const,  text: "Generate new tasks as you complete them" },
];

export default function PaymentScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");

  const monthlyPrice = "$7.99";
  const yearlyPrice  = "$70.00";
  const yearlyMonthly = "$5.83";

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
          <Text style={styles.heroTitle}>Start Your Free Trial</Text>
          <Text style={styles.heroSubtitle}>
            7 days free, then your chosen plan.{"\n"}Cancel anytime before the trial ends.
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

        {/* Plan selector */}
        <Text style={styles.sectionLabel}>Choose your plan</Text>
        <View style={styles.planRow}>
          <TouchableOpacity
            style={[styles.planCard, plan === "monthly" && styles.planCardSelected]}
            onPress={() => setPlan("monthly")}
            activeOpacity={0.8}
          >
            <Text style={[styles.planName, plan === "monthly" && styles.planNameSelected]}>Monthly</Text>
            <Text style={[styles.planPrice, plan === "monthly" && styles.planPriceSelected]}>{monthlyPrice}</Text>
            <Text style={[styles.planSub, plan === "monthly" && styles.planSubSelected]}>per month</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.planCard, styles.planCardYearly, plan === "yearly" && styles.planCardSelected]}
            onPress={() => setPlan("yearly")}
            activeOpacity={0.8}
          >
            <View style={styles.badgeWrap}>
              <Text style={styles.badge}>BEST VALUE</Text>
            </View>
            <Text style={[styles.planName, plan === "yearly" && styles.planNameSelected]}>Yearly</Text>
            <Text style={[styles.planPrice, plan === "yearly" && styles.planPriceSelected]}>{yearlyPrice}</Text>
            <Text style={[styles.planSub, plan === "yearly" && styles.planSubSelected]}>{yearlyMonthly}/mo · billed annually</Text>
          </TouchableOpacity>
        </View>

        {/* Trial summary */}
        <View style={styles.trialCard}>
          <View style={styles.trialRow}>
            <Ionicons name="gift-outline" size={18} color={colors.success} />
            <Text style={styles.trialText}>7-day free trial — no charge today</Text>
          </View>
          <View style={styles.trialRow}>
            <Ionicons name="close-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.trialTextSub}>Cancel anytime in Settings before trial ends</Text>
          </View>
        </View>

        {/* Dev notice banner */}
        <View style={styles.devBanner}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.devBannerText}>
            Payment processing requires the full release build. Running in Expo Go preview mode.
          </Text>
        </View>

        {/* CTA — disabled in Expo Go */}
        <TouchableOpacity
          style={[styles.ctaBtn, { opacity: 0.5 }]}
          disabled
          activeOpacity={0.85}
        >
          <Text style={styles.ctaBtnText}>Start Free Trial</Text>
        </TouchableOpacity>

        <Text style={styles.ctaSub}>
          {plan === "yearly"
            ? `Then ${yearlyPrice}/year after 7 days`
            : `Then ${monthlyPrice}/month after 7 days`}
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
          <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={styles.restoreBtn}>
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
    planRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg },
    planCard: {
      flex: 1,
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 2,
      borderColor: c.border,
      padding: spacing.md,
      alignItems: "center",
      gap: 3,
      ...shadow.sm,
    },
    planCardYearly: { paddingTop: 28 },
    planCardSelected: {
      borderColor: c.primary,
      backgroundColor: c.primaryLight,
    },
    badgeWrap: {
      position: "absolute",
      top: -1,
      left: -1,
      right: -1,
      backgroundColor: c.primary,
      borderTopLeftRadius: radius.lg - 2,
      borderTopRightRadius: radius.lg - 2,
      paddingVertical: 3,
      alignItems: "center",
    },
    badge: {
      fontSize: 10,
      fontWeight: typography.bold,
      color: "#fff",
      letterSpacing: 0.8,
    },
    planName: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.textSecondary,
    },
    planNameSelected: { color: c.primary },
    planPrice: {
      fontSize: typography.xl,
      fontWeight: typography.bold,
      color: c.text,
      letterSpacing: -0.3,
    },
    planPriceSelected: { color: c.primary },
    planSub: {
      fontSize: typography.xs,
      color: c.textTertiary,
      textAlign: "center",
    },
    planSubSelected: { color: c.primary + "BB" },
    trialCard: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    trialRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    trialText: {
      fontSize: typography.sm,
      fontWeight: typography.medium,
      color: c.success,
    },
    trialTextSub: {
      fontSize: typography.sm,
      color: c.textSecondary,
    },
    devBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.xs,
      backgroundColor: c.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.sm,
      marginBottom: spacing.lg,
    },
    devBannerText: {
      flex: 1,
      fontSize: typography.xs,
      color: c.textSecondary,
      lineHeight: 17,
    },
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
