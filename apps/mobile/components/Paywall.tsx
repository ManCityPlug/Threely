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
import Purchases, { PurchasesOffering, INTRO_ELIGIBILITY_STATUS } from "react-native-purchases";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";
import { useSubscription } from "@/lib/subscription-context";

interface PaywallProps {
  visible: boolean;
  onDismiss: () => void;
}

const SHEET_MAX_WIDTH = 500;

export default function Paywall({ visible, onDismiss }: PaywallProps) {
  const { colors } = useTheme();
  const { refreshSubscription } = useSubscription();
  const { width: windowWidth } = useWindowDimensions();
  const isWideScreen = windowWidth > 600;
  const styles = useMemo(() => createStyles(colors), [colors]);

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

        if (off.current) {
          const productIds = [
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
              setTrialEligible(true);
            }
          }
        }
      } catch (e) {
        console.warn("Failed to load offerings:", e);
      }
    })();
  }, [visible]);

  const priceString = offerings?.monthly?.product?.priceString ?? "$15.99";

  async function handleSubscribe() {
    const pkg = offerings?.monthly;
    if (!pkg) {
      Alert.alert("Error", "Unable to load subscription options. Please try again.");
      return;
    }

    setLoading(true);
    try {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const purchasePromise = Purchases.purchasePackage(pkg);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Purchase timed out")), 120000)
      );

      const { customerInfo } = await Promise.race([purchasePromise, timeoutPromise]);
      if (
        customerInfo.entitlements.active["pro"] !== undefined ||
        customerInfo.entitlements.active["threely Pro"] !== undefined
      ) {
        await refreshSubscription();
        onDismiss();
      }
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err.userCancelled) {
        const message = err.message === "Purchase timed out"
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
      if (
        customerInfo.entitlements.active["pro"] !== undefined ||
        customerInfo.entitlements.active["threely Pro"] !== undefined
      ) {
        await refreshSubscription();
        onDismiss();
      } else {
        Alert.alert("No Purchases Found", "We couldn't find any previous purchases for this account.");
      }
    } catch {
      Alert.alert("Error", "Failed to restore purchases. Please try again.");
    } finally {
      setRestoring(false);
    }
  }

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

        {/* Heading */}
        <Text style={[styles.heading, { color: "#D4A843" }]}>Unlock Threely Pro</Text>
        <Text style={styles.subheading}>
          The #1 AI app that turns any goal into reality.{"\n"}Just tell us what you want — we'll get you there.
        </Text>

        {/* Monthly plan card — always selected */}
        <View style={[styles.planCard, styles.planCardSelected]}>
          <View style={styles.planRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.planName, { color: colors.text }]}>Monthly</Text>
              <Text style={styles.planSub}>
                {trialEligible ? "$1 to start · per month" : "per month"}
              </Text>
            </View>
            <Text style={[styles.planPrice, { color: colors.text }]}>
              {priceString}
            </Text>
          </View>
        </View>

        {/* Total due today */}
        {trialEligible && (
          <View style={[styles.totalDueRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.totalDueLabel, { color: colors.textSecondary }]}>Total due today</Text>
            <Text style={styles.totalDueAmount}>$1.00</Text>
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
            <ActivityIndicator color={colors.primaryText} size="small" />
          ) : (
            <Text style={styles.ctaBtnText}>{trialEligible ? "Start For $1" : "Subscribe"}</Text>
          )}
        </TouchableOpacity>

        {trialEligible ? (
          <>
            <Text style={styles.trialNote}>
              Cancel anytime in Settings.
            </Text>
            <Text style={styles.ctaSub}>
              Then {priceString}/month
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
    planName: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: c.text,
      marginBottom: 2,
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
      color: c.primaryText,
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
