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
  Image,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases, { PurchasesOffering } from "react-native-purchases";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { spacing, typography, radius } from "@/constants/theme";
import { useSubscription } from "@/lib/subscription-context";

const { width: SCREEN_W } = Dimensions.get("window");

type Plan = "monthly" | "yearly";

const PLANS: { key: Plan; name: string; price: string; sub: string; badge?: string }[] = [
  { key: "yearly", name: "Yearly", price: "$69.99", sub: "$5.83/mo · billed annually", badge: "SAVE 55%" },
  { key: "monthly", name: "Monthly", price: "$12.99", sub: "per month" },
];

interface TrialFullScreenProps {
  visible: boolean;
  onDismiss: () => void;
  onSubscribed: () => void;
}

export function TrialFullScreen({ visible, onDismiss, onSubscribed }: TrialFullScreenProps) {
  const { refreshSubscription } = useSubscription();
  const [plan, setPlan] = useState<Plan>("yearly");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
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
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
      <LinearGradient colors={["#1A1040", "#635BFF"]} style={styles.container}>
        {/* Close button */}
        <TouchableOpacity
          onPress={onDismiss}
          style={styles.closeBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        {/* App icon */}
        <View style={styles.iconWrap}>
          <Image
            source={require("@/assets/icon.png")}
            style={styles.appIcon}
          />
        </View>

        {/* Copy */}
        <Text style={styles.heading}>
          Try Threely Pro{"\n"}
          <Text style={styles.headingBold}>free for 7 days</Text>
        </Text>
        <Text style={styles.subheading}>
          We offer 7 days free so everyone can achieve their goals.
          You'll get a reminder 2 days before your trial ends.
        </Text>

        {/* Plan selector */}
        <View style={styles.planContainer}>
          {PLANS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.planCard, plan === p.key && styles.planCardSelected]}
              onPress={() => setPlan(p.key)}
              activeOpacity={0.8}
            >
              <View style={styles.planRow}>
                <View style={[styles.planRadio, plan === p.key && styles.planRadioSelected]}>
                  {plan === p.key && <View style={styles.planRadioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.planNameRow}>
                    <Text style={styles.planName}>{p.name}</Text>
                    {p.badge && (
                      <View style={styles.planBadge}>
                        <Text style={styles.planBadgeText}>{p.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.planSub}>{p.sub}</Text>
                </View>
                <Text style={styles.planPrice}>{p.price}</Text>
              </View>
              <Text style={styles.trialLabel}>7-day free trial</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, (loading || !offerings) && { opacity: 0.7 }]}
          activeOpacity={0.85}
          onPress={handleSubscribe}
          disabled={loading || !offerings}
        >
          {loading ? (
            <ActivityIndicator color="#635BFF" size="small" />
          ) : (
            <Text style={styles.ctaBtnText}>Start Free Trial</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.ctaSub}>
          7-day free trial · then {selectedPlan.price}/{plan === "yearly" ? "year" : "month"}
        </Text>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={handleRestore} disabled={restoring} style={styles.restoreBtn}>
            {restoring ? (
              <ActivityIndicator color="rgba(255,255,255,0.5)" size="small" />
            ) : (
              <Text style={styles.restoreText}>Restore purchases</Text>
            )}
          </TouchableOpacity>
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
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    top: 56,
    right: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  iconWrap: {
    marginBottom: spacing.lg,
  },
  appIcon: {
    width: 100,
    height: 100,
    borderRadius: 24,
  },
  heading: {
    fontSize: typography.xxl,
    fontWeight: typography.regular,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  headingBold: {
    fontWeight: typography.bold,
  },
  subheading: {
    fontSize: typography.base,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xl,
    maxWidth: SCREEN_W * 0.85,
  },
  planContainer: {
    width: "100%",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  planCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
    padding: spacing.md,
  },
  planCardSelected: {
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(255,255,255,0.18)",
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
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  planRadioSelected: {
    borderColor: "#FFFFFF",
  },
  planRadioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
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
    color: "#FFFFFF",
  },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "#F59E0B",
  },
  planBadgeText: {
    fontSize: 9,
    fontWeight: typography.bold,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  planSub: {
    fontSize: typography.xs,
    color: "rgba(255,255,255,0.6)",
  },
  planPrice: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  trialLabel: {
    fontSize: typography.xs,
    color: "rgba(255,255,255,0.5)",
    marginTop: spacing.xs,
    textAlign: "center",
  },
  ctaBtn: {
    width: "100%",
    height: 56,
    backgroundColor: "#FFFFFF",
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  ctaBtnText: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: "#635BFF",
    letterSpacing: -0.2,
  },
  ctaSub: {
    fontSize: typography.xs,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  footer: {
    alignItems: "center",
    gap: spacing.sm,
  },
  restoreBtn: {
    paddingVertical: spacing.xs,
  },
  restoreText: {
    fontSize: typography.sm,
    color: "rgba(255,255,255,0.5)",
    fontWeight: typography.medium,
  },
  legalText: {
    fontSize: typography.xs,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
  },
  legalLink: {
    textDecorationLine: "underline",
  },
});
