import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases, { PurchasesOffering, INTRO_ELIGIBILITY_STATUS } from "react-native-purchases";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";
import { useSubscription } from "@/lib/subscription-context";

type Plan = "monthly" | "yearly";

const PLANS: { key: Plan; name: string; price: string; sub: string; trialSub: string; badge?: string }[] = [
  { key: "yearly", name: "Yearly", price: "$99.99", sub: "$8.33/mo · billed annually", trialSub: "7 Day Free Trial · $8.33/mo · billed annually", badge: "SAVE 36%" },
  { key: "monthly", name: "Monthly", price: "$12.99", sub: "per month", trialSub: "7 Day Free Trial · per month" },
];

interface TrialBottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  onSubscribed: () => void;
}

const SHEET_MAX_WIDTH = 500;

export function TrialBottomSheet({ visible, onDismiss, onSubscribed }: TrialBottomSheetProps) {
  const { colors } = useTheme();
  const { refreshSubscription } = useSubscription();
  const { width: windowWidth } = useWindowDimensions();
  const isWideScreen = windowWidth > 600;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [plan, setPlan] = useState<Plan>("yearly");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [trialEligible, setTrialEligible] = useState(true);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const off = await Purchases.getOfferings();
        setOfferings(off.current);

        // Check trial eligibility
        if (off.current) {
          const productIds = [
            off.current.annual?.product?.identifier,
            off.current.monthly?.product?.identifier,
          ].filter(Boolean) as string[];

          if (productIds.length > 0) {
            try {
              const eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility(productIds);
              const isEligible = Object.values(eligibility).some(
                (e) => e.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE
              );
              setTrialEligible(isEligible);
            } catch {
              // If eligibility check fails, default to eligible
              setTrialEligible(true);
            }
          }
        }
      } catch (e) {
        console.warn("Failed to load offerings:", e);
      }
    })();
  }, [visible]);

  async function handleSubscribe() {
    const pkg = plan === "yearly" ? offerings?.annual : offerings?.monthly;
    if (!pkg) {
      Alert.alert("Error", "Unable to load subscription options. Please try again.");
      return;
    }

    setLoading(true);
    try {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Add a timeout so the purchase flow cannot hang indefinitely
      const purchasePromise = Purchases.purchasePackage(pkg);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Purchase timed out")), 120000)
      );

      const { customerInfo } = await Promise.race([purchasePromise, timeoutPromise]);
      if (typeof customerInfo.entitlements.active["pro"] !== "undefined") {
        await AsyncStorage.setItem("@threely_subscription_status", "active");
        await refreshSubscription();
        onSubscribed();
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        const message = e.message === "Purchase timed out"
          ? "The purchase is taking too long. Please check your connection and try again."
          : "Something went wrong. Please try again.";
        Alert.alert("Purchase failed", message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (typeof customerInfo.entitlements.active["pro"] !== "undefined") {
        await AsyncStorage.setItem("@threely_subscription_status", "active");
        await refreshSubscription();
        onSubscribed();
      } else {
        Alert.alert("No Purchases Found", "We couldn't find any previous purchases for this account.");
      }
    } catch {
      Alert.alert("Error", "Failed to restore purchases. Please try again.");
    } finally {
      setRestoring(false);
    }
  }

  const selectedPlan = PLANS.find((p) => p.key === plan)!;

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onDismiss}
      />

      {/* Sheet */}
      <View style={[
        styles.sheet,
        isWideScreen && { maxWidth: SHEET_MAX_WIDTH, alignSelf: "center", width: "100%", borderRadius: radius.xl },
      ]}>
        {/* Handle bar */}
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>

        {/* Icon + heading */}
        <Text style={styles.icon}>✦</Text>
        <Text style={styles.heading}>Unlock this with Threely Pro</Text>
        <Text style={styles.subheading}>
          The #1 AI app that turns any goal into reality.{"\n"}Just tell us what you want — we'll get you there.
        </Text>

        {/* Plan selector */}
        {PLANS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.planCard, plan === p.key && styles.planCardSelected]}
            onPress={() => setPlan(p.key)}
            activeOpacity={0.8}
          >
            <View style={styles.planRow}>
              <View style={[styles.planRadio, plan === p.key && styles.planRadioActive]}>
                {plan === p.key && <View style={[styles.planRadioDot, { backgroundColor: colors.primary }]} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.planNameRow}>
                  <Text style={[styles.planName, plan === p.key && { color: colors.primary }]}>{p.name}</Text>
                  {p.badge && (
                    <View style={[styles.planBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.planBadgeText}>{p.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.planSub}>{trialEligible ? p.trialSub : p.sub}</Text>
              </View>
              <Text style={[styles.planPrice, plan === p.key && { color: colors.primary }]}>{p.price}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Total due today */}
        {trialEligible && (
          <View style={[styles.totalDueRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.totalDueLabel, { color: colors.textSecondary }]}>Total due today</Text>
            <Text style={styles.totalDueAmount}>$0.00</Text>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, (loading || !offerings) && { opacity: 0.7 }]}
          activeOpacity={0.85}
          onPress={handleSubscribe}
          disabled={loading || !offerings}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.ctaBtnText}>{trialEligible ? "Start Free Trial" : "Subscribe"}</Text>
          )}
        </TouchableOpacity>

        {trialEligible ? (
          <>
            <Text style={styles.trialNote}>
              No charge for 7 days. Cancel anytime in Settings.
            </Text>
            <Text style={styles.ctaSub}>
              Then {selectedPlan.price}/{plan === "yearly" ? "year" : "month"}
            </Text>
          </>
        ) : (
          <Text style={styles.ctaSub}>
            Cancel anytime in Settings.
          </Text>
        )}

        {/* Dismiss */}
        <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
          <Text style={styles.dismissText}>Not now</Text>
        </TouchableOpacity>

        {/* Restore purchases */}
        <TouchableOpacity onPress={handleRestore} disabled={restoring} style={styles.restoreBtn}>
          {restoring ? (
            <ActivityIndicator color={colors.textTertiary} size="small" />
          ) : (
            <Text style={styles.restoreText}>Restore purchases</Text>
          )}
        </TouchableOpacity>

        {/* Legal */}
        <Text style={styles.legalText}>
          <Text style={styles.legalLink} onPress={() => Linking.openURL("https://threely.co/terms")}>
            Terms
          </Text>
          {"  ·  "}
          <Text style={styles.legalLink} onPress={() => Linking.openURL("https://threely.co/privacy")}>
            Privacy
          </Text>
          {"  ·  "}
          <Text style={styles.legalLink} onPress={() => Linking.openURL("https://threely.co/refund")}>
            Refund
          </Text>
        </Text>
      </View>
    </Modal>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    sheet: {
      backgroundColor: c.bgElevated,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingHorizontal: spacing.lg,
      paddingBottom: 40,
      ...shadow.lg,
    },
    handleWrap: {
      alignItems: "center",
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
    },
    icon: {
      fontSize: 36,
      color: c.primary,
      textAlign: "center",
      marginBottom: spacing.sm,
    },
    heading: {
      fontSize: typography.xl,
      fontWeight: typography.bold,
      color: c.text,
      textAlign: "center",
      letterSpacing: -0.5,
      marginBottom: spacing.xs,
    },
    subheading: {
      fontSize: typography.sm,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    planCard: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 2,
      borderColor: c.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    planCardSelected: {
      borderColor: c.primary,
      backgroundColor: c.primaryLight,
    },
    planRow: {
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
    planRadioActive: {
      borderColor: c.primary,
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
    planName: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: c.text,
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
    planSub: {
      fontSize: typography.xs,
      color: c.textTertiary,
    },
    planPrice: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: c.text,
      letterSpacing: -0.3,
    },
    totalDueRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: radius.md,
      borderWidth: 1,
      marginBottom: spacing.xs,
    },
    totalDueLabel: {
      fontSize: typography.sm,
      fontWeight: typography.medium,
    },
    totalDueAmount: {
      fontSize: typography.md,
      fontWeight: typography.bold,
      color: "#3ecf8e",
    },
    ctaBtn: {
      height: 56,
      backgroundColor: c.primary,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      ...shadow.md,
    },
    ctaBtnText: {
      fontSize: typography.md,
      fontWeight: typography.bold,
      color: "#fff",
      letterSpacing: -0.2,
    },
    trialNote: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.success,
      textAlign: "center",
      marginBottom: 4,
    },
    ctaSub: {
      fontSize: typography.xs,
      color: c.textTertiary,
      textAlign: "center",
      marginBottom: spacing.md,
    },
    dismissBtn: {
      alignSelf: "center",
      paddingVertical: spacing.sm,
      marginBottom: spacing.xs,
    },
    dismissText: {
      fontSize: typography.sm,
      color: c.textSecondary,
      fontWeight: typography.medium,
    },
    restoreBtn: {
      alignSelf: "center",
      paddingVertical: spacing.xs,
      marginBottom: spacing.sm,
    },
    restoreText: {
      fontSize: typography.xs,
      color: c.textTertiary,
      fontWeight: typography.medium,
    },
    legalText: {
      fontSize: typography.xs,
      color: c.textTertiary,
      textAlign: "center",
    },
    legalLink: {
      color: c.primary,
      textDecorationLine: "underline",
    },
  });
}
