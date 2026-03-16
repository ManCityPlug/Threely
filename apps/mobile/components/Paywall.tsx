import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSubscription } from "@/lib/subscription-context";
import { spacing, typography, radius } from "@/constants/theme";
import { useTheme } from "@/lib/theme";

const FEATURES = [
  { icon: "checkmark-circle" as const, text: "3 personalized daily tasks" },
  { icon: "sparkles" as const, text: "AI-powered goal coaching" },
  { icon: "bar-chart" as const, text: "Progress tracking & insights" },
  { icon: "refresh" as const, text: "Daily task generation" },
];

export default function Paywall({ visible, onDismiss }: { visible: boolean; onDismiss?: () => void }) {
  const { colors } = useTheme();
  const { purchasePro, restorePurchases, currentPackage } = useSubscription();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const priceString = currentPackage?.product?.priceString ?? "$15.99";
  const introPrice = currentPackage?.product?.introPrice;
  const hasFreeTrial = introPrice?.price === 0;
  const trialDays = introPrice?.periodNumberOfUnits ?? 7;

  async function handlePurchase() {
    setPurchasing(true);
    try {
      const success = await purchasePro();
      if (success) {
        onDismiss?.();
      }
    } catch {
      Alert.alert("Purchase failed", "Something went wrong. Please try again.");
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        Alert.alert("Restored", "Your subscription has been restored.");
        onDismiss?.();
      } else {
        Alert.alert("No subscription found", "We couldn't find an active subscription for this account.");
      }
    } catch {
      Alert.alert("Restore failed", "Something went wrong. Please try again.");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <View style={styles.header}>
          {onDismiss && (
            <Pressable onPress={onDismiss} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={[styles.iconBadge, { backgroundColor: colors.primary + "15" }]}>
            <Ionicons name="star" size={32} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            Unlock Threely Pro
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Get the most out of your goals with personalized AI coaching.
          </Text>

          {/* Features */}
          <View style={styles.features}>
            {FEATURES.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Ionicons name={f.icon} size={20} color={colors.primary} />
                <Text style={[styles.featureText, { color: colors.text }]}>{f.text}</Text>
              </View>
            ))}
          </View>

          {/* Price */}
          <View style={[styles.priceCard, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
            <Text style={[styles.priceLabel, { color: colors.text }]}>Monthly</Text>
            <Text style={[styles.priceAmount, { color: colors.primary }]}>{priceString}/mo</Text>
            {hasFreeTrial && (
              <Text style={[styles.trialNote, { color: colors.success }]}>
                {trialDays}-day free trial included
              </Text>
            )}
          </View>
        </View>

        {/* CTA */}
        <View style={styles.footer}>
          <Pressable
            style={[styles.purchaseBtn, { backgroundColor: colors.primary }, (purchasing || restoring) && { opacity: 0.6 }]}
            onPress={handlePurchase}
            disabled={purchasing || restoring}
          >
            {purchasing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.purchaseBtnText}>
                {hasFreeTrial ? "Start Free Trial" : "Subscribe Now"}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.restoreBtn}
            onPress={handleRestore}
            disabled={purchasing || restoring}
          >
            {restoring ? (
              <ActivityIndicator color={colors.textSecondary} size="small" />
            ) : (
              <Text style={[styles.restoreBtnText, { color: colors.textSecondary }]}>
                Restore purchase
              </Text>
            )}
          </Pressable>

          <Text style={[styles.legal, { color: colors.textTertiary }]}>
            Payment will be charged to your Apple ID account at confirmation of purchase. Subscription automatically renews unless canceled at least 24 hours before the end of the current period.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  iconBadge: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.base,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  features: {
    alignSelf: "stretch",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  featureText: {
    fontSize: typography.base,
    fontWeight: typography.medium,
  },
  priceCard: {
    alignSelf: "stretch",
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
    alignItems: "center",
  },
  priceLabel: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    marginBottom: spacing.xs,
  },
  priceAmount: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    letterSpacing: -0.5,
  },
  trialNote: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    marginTop: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  purchaseBtn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  purchaseBtnText: {
    color: "#FFFFFF",
    fontSize: typography.md,
    fontWeight: typography.semibold,
    letterSpacing: -0.2,
  },
  restoreBtn: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  restoreBtnText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  legal: {
    fontSize: 10,
    textAlign: "center",
    lineHeight: 14,
    paddingHorizontal: spacing.sm,
  },
});
