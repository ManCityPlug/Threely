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
  Dimensions,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases, { PurchasesOffering } from "react-native-purchases";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";
import { useSubscription } from "@/lib/subscription-context";

type Plan = "monthly" | "yearly";

const PLANS: { key: Plan; name: string; price: string; sub: string; badge?: string }[] = [
  { key: "yearly", name: "Yearly", price: "$69.99", sub: "$5.83/mo · billed annually", badge: "SAVE 55%" },
  { key: "monthly", name: "Monthly", price: "$12.99", sub: "per month" },
];

interface TrialBottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  onSubscribed: () => void;
}

export function TrialBottomSheet({ visible, onDismiss, onSubscribed }: TrialBottomSheetProps) {
  const { colors } = useTheme();
  const { refreshSubscription } = useSubscription();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [plan, setPlan] = useState<Plan>("yearly");
  const [loading, setLoading] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const off = await Purchases.getOfferings();
        setOfferings(off.current);
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
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      if (typeof customerInfo.entitlements.active["pro"] !== "undefined") {
        await AsyncStorage.setItem("@threely_subscription_status", "active");
        await refreshSubscription();
        onSubscribed();
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert("Purchase failed", "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
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
      <View style={styles.sheet}>
        {/* Handle bar */}
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>

        {/* Icon + heading */}
        <Text style={styles.icon}>✦</Text>
        <Text style={styles.heading}>Unlock this with Threely Pro</Text>
        <Text style={styles.subheading}>
          10x your productivity and actually reach your goals.
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
                <Text style={styles.planSub}>{p.sub}</Text>
              </View>
              <Text style={[styles.planPrice, plan === p.key && { color: colors.primary }]}>{p.price}</Text>
            </View>
          </TouchableOpacity>
        ))}

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
            <Text style={styles.ctaBtnText}>Start Free Trial</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.trialNote}>
          No charge for 7 days. Cancel anytime in Settings.
        </Text>
        <Text style={styles.ctaSub}>
          Then {selectedPlan.price}/{plan === "yearly" ? "year" : "month"}
        </Text>

        {/* Dismiss */}
        <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
          <Text style={styles.dismissText}>Not now</Text>
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
      marginBottom: spacing.sm,
    },
    dismissText: {
      fontSize: typography.sm,
      color: c.textSecondary,
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
