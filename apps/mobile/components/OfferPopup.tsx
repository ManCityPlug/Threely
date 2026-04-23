import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { offersApi, type UserOffer } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useSubscription } from "@/lib/subscription-context";

const GOLD = "#D4A843";
const GOLD_DARK = "#B8862D";

function formatCountdown(expiresAt: string): { text: string; urgent: boolean } {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { text: "Expired", urgent: true };
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (days >= 1) return { text: `${days}d ${hours}h ${minutes}m`, urgent: false };
  return { text: `${hours}h ${minutes}m`, urgent: true };
}

function AnimatedGift({ size = 72 }: { size?: number }) {
  const scale = useRef(new Animated.Value(0)).current;
  const entranceRotate = useRef(new Animated.Value(0)).current;
  const wobble = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(entranceRotate, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(entranceRotate, {
          toValue: 0,
          duration: 260,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(wobble, {
            toValue: 1,
            duration: 120,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(wobble, {
            toValue: -1,
            duration: 240,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(wobble, {
            toValue: 1,
            duration: 240,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(wobble, {
            toValue: 0,
            duration: 120,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(2200),
        ])
      ).start();
    });

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.4,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [scale, entranceRotate, wobble, glow]);

  const rotate = Animated.add(
    entranceRotate.interpolate({ inputRange: [0, 1], outputRange: [0, -20] }),
    wobble.interpolate({ inputRange: [-1, 1], outputRange: [-14, 14] })
  ).interpolate({ inputRange: [-40, 40], outputRange: ["-40deg", "40deg"] });

  return (
    <View style={{ width: size * 1.8, height: size * 1.8, alignItems: "center", justifyContent: "center" }}>
      {/* Pulsing gold glow behind gift */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: size * 1.8,
          height: size * 1.8,
          borderRadius: size * 0.9,
          backgroundColor: GOLD,
          opacity: glow.interpolate({ inputRange: [0.4, 1], outputRange: [0.12, 0.32] }),
          transform: [{ scale: glow.interpolate({ inputRange: [0.4, 1], outputRange: [0.75, 1.05] }) }],
        }}
      />
      {/* Inner tighter glow */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: size * 1.2,
          height: size * 1.2,
          borderRadius: size * 0.6,
          backgroundColor: GOLD,
          opacity: glow.interpolate({ inputRange: [0.4, 1], outputRange: [0.18, 0.45] }),
          transform: [{ scale: glow.interpolate({ inputRange: [0.4, 1], outputRange: [0.85, 1.1] }) }],
        }}
      />
      <Animated.Text
        style={{
          fontSize: size,
          lineHeight: size * 1.1,
          transform: [{ scale }, { rotate }],
        }}
      >
        {"\uD83C\uDF81"}
      </Animated.Text>
    </View>
  );
}

function MiniGift({ size = 22 }: { size?: number }) {
  const wobble = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(wobble, { toValue: 1, duration: 110, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(wobble, { toValue: -1, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 1, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 0, duration: 110, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(2600),
      ])
    ).start();
  }, [wobble]);
  const rotate = wobble.interpolate({ inputRange: [-1, 1], outputRange: ["-12deg", "12deg"] });
  return (
    <Animated.Text style={{ fontSize: size, lineHeight: size * 1.1, transform: [{ rotate }] }}>
      {"\uD83C\uDF81"}
    </Animated.Text>
  );
}

export default function OfferPopup() {
  const { showToast } = useToast();
  const { refreshSubscription } = useSubscription();
  const [offer, setOffer] = useState<UserOffer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [countdown, setCountdown] = useState<{ text: string; urgent: boolean }>({ text: "", urgent: false });

  // Fetch pending offer on mount. Auto-open the modal first time the user
  // sees this offer (tracked via AsyncStorage, keyed by offer id).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await offersApi.me();
        if (cancelled || !res.offer) return;
        setOffer(res.offer);
        const seen = await AsyncStorage.getItem(`offer_seen_${res.offer.id}`);
        if (!seen) setModalOpen(true);
      } catch {
        // silently ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Countdown ticker
  useEffect(() => {
    if (!offer) return;
    const update = () => setCountdown(formatCountdown(offer.expiresAt));
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [offer]);

  async function dismiss() {
    if (offer) {
      try {
        await AsyncStorage.setItem(`offer_seen_${offer.id}`, "1");
      } catch { /* ignore */ }
    }
    setModalOpen(false);
  }

  async function handleClaim() {
    if (!offer) return;
    setClaiming(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await offersApi.claim(offer.id);
      showToast(`Offer applied! ${res.description}`, "success");
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      try {
        await AsyncStorage.setItem(`offer_seen_${offer.id}`, "1");
      } catch { /* ignore */ }
      await refreshSubscription();
      setOffer(null);
      setModalOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to claim";
      showToast(msg, "error");
    } finally {
      setClaiming(false);
    }
  }

  if (!offer) return null;

  return (
    <>
      {/* Persistent gold banner on dashboard */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setModalOpen(true)}
        style={styles.banner}
      >
        <View style={styles.bannerGiftWrap}>
          <MiniGift size={22} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle} numberOfLines={1}>
            Special offer: {offer.description}
          </Text>
          <Text style={[styles.bannerSub, countdown.urgent && { color: "#fee2e2" }]}>
            Expires in {countdown.text || "..."}
          </Text>
        </View>
        <View style={styles.bannerCta}>
          <Text style={styles.bannerCtaText}>Claim {"\u2192"}</Text>
        </View>
      </TouchableOpacity>

      {/* Auto-opening modal */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={dismiss}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={() => !claiming && dismiss()}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.giftRow}>
              <AnimatedGift size={72} />
            </View>
            <Text style={styles.heading}>We have a gift for you</Text>
            <Text style={styles.description}>{offer.description}</Text>

            <View style={styles.countdownBox}>
              <Text style={styles.countdownLabel}>EXPIRES IN</Text>
              <Text style={[styles.countdownValue, countdown.urgent && { color: "#f87171" }]}>
                {countdown.text || "..."}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleClaim}
              disabled={claiming}
              activeOpacity={0.85}
              style={[styles.claimBtn, claiming && { opacity: 0.7 }]}
            >
              <Text style={styles.claimBtnText}>
                {claiming ? "Applying..." : "Claim now"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={dismiss} disabled={claiming} style={styles.laterBtn}>
              <Text style={styles.laterBtnText}>Maybe later</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 16,
    backgroundColor: GOLD_DARK,
    // emulate the web's gold gradient with a solid mid-tone; iOS/Android gradient
    // would need a lib, and this keeps the component dependency-free.
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  bannerGiftWrap: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  bannerSub: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.88)",
  },
  bannerCta: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  bannerCtaText: {
    color: GOLD_DARK,
    fontSize: 13,
    fontWeight: "800",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#141414",
    borderWidth: 1.5,
    borderColor: GOLD,
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 14,
  },
  giftRow: {
    alignItems: "center",
    marginBottom: 4,
  },
  heading: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    fontWeight: "700",
    color: GOLD,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  countdownBox: {
    backgroundColor: "rgba(212,168,67,0.08)",
    borderWidth: 1,
    borderColor: "rgba(212,168,67,0.25)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  countdownLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#a1a1aa",
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  countdownValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    fontVariant: ["tabular-nums"],
  },
  claimBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: GOLD,
    alignItems: "center",
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  claimBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  laterBtn: {
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 6,
  },
  laterBtnText: {
    color: "#71717a",
    fontSize: 13,
    textDecorationLine: "underline",
  },
});
