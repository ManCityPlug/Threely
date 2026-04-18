import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  Platform,
  Modal,
  KeyboardAvoidingView,
  Linking,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SwipeNavigator } from "@/components/SwipeNavigator";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { statsApi, accountApi, tasksApi, summaryApi, type Stats, type DailyTask, type TaskItem, type WeeklySummary as WeeklySummaryType, type WeeklySummaryStatus } from "@/lib/api";
import { validatePassword } from "@/lib/validate-password";
import { TaskCard } from "@/components/TaskCard";

import { WeeklySummary } from "@/components/WeeklySummary";
import { SkeletonStatCard } from "@/components/Skeleton";
import { useCountUp } from "@/lib/animations";
import { useTheme } from "@/lib/theme";
import type { ColorSchemePreference } from "@/lib/theme";
import Paywall from "@/components/Paywall";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";
import {
  getNotifPreference,
  saveNotifPreference,
  type NotifTimePreference,
} from "@/lib/notifications";
import { useSubscription } from "@/lib/subscription-context";
import { useNotifications } from "@/lib/notification-context";
import { useWalkthroughRegistry } from "@/lib/walkthrough-registry";
import * as Haptics from "expo-haptics";

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTIF_PRESETS: (NotifTimePreference & { emoji: string; rangeLabel: string })[] = [
  { label: "Morning",   time: "7:00 AM",  hour: 7,  minute: 0, emoji: "🌅", rangeLabel: "6:00 – 9:00 AM" },
  { label: "Afternoon", time: "1:00 PM",  hour: 13, minute: 0, emoji: "☀️", rangeLabel: "12:00 – 3:00 PM" },
  { label: "Evening",   time: "7:00 PM",  hour: 19, minute: 0, emoji: "🌆", rangeLabel: "5:00 – 8:00 PM" },
  { label: "Night",     time: "9:00 PM",  hour: 21, minute: 0, emoji: "🌙", rangeLabel: "9:00 – 11:00 PM" },
];

const SCHEME_OPTIONS: { label: string; value: ColorSchemePreference; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: "Light",  value: "light",  icon: "sunny-outline" },
  { label: "Dark",   value: "dark",   icon: "moon-outline" },
  { label: "System", value: "system", icon: "phone-portrait-outline" },
];

// Custom time picker constants
const HOURS = [1,2,3,4,5,6,7,8,9,10,11,12];
const MINUTES = [0,15,30,45];
const PERIODS = ["AM","PM"];
const ITEM_H = 48;
const VISIBLE = 3;
const PICKER_H = ITEM_H * VISIBLE;

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  numericValue?: number;
  suffix?: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor?: string;
  loading?: boolean;
  colors: Colors;
  styles: ReturnType<typeof createStyles>;
}

function StatCard({ label, value, numericValue, suffix = "", icon, accentColor, loading, colors, styles }: StatCardProps) {
  const animatedValue = useCountUp(loading ? 0 : (numericValue ?? 0));
  const displayValue = numericValue !== undefined && !loading
    ? `${animatedValue}${suffix}`
    : value;
  const iconColor = accentColor ?? colors.primary;

  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, accentColor ? { backgroundColor: `${accentColor}18` } : undefined]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} size="small" style={{ marginVertical: 4 }} />
      ) : (
        <Text style={[styles.statValue, accentColor ? { color: accentColor } : undefined]}>{displayValue}</Text>
      )}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Scroll Picker Column ─────────────────────────────────────────────────────

function PickerCol<T>({
  items,
  selected,
  onSelect,
  format,
  colors,
}: {
  items: T[];
  selected: T;
  onSelect: (v: T) => void;
  format: (v: T) => string;
  colors: Colors;
}) {
  const ref = useRef<ScrollView>(null);
  const idx = items.indexOf(selected);

  return (
    <View style={{ flex: 1, position: "relative" }}>
      <ScrollView
        ref={ref}
        style={{ height: PICKER_H }}
        contentContainerStyle={{ paddingVertical: ITEM_H }}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onLayout={() => {
          ref.current?.scrollTo({ y: idx * ITEM_H, animated: false });
        }}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
          const clamped = Math.max(0, Math.min(i, items.length - 1));
          onSelect(items[clamped]);
        }}
      >
        {items.map((item) => (
          <View key={String(item)} style={{ height: ITEM_H, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: typography.lg, fontWeight: typography.semibold, color: colors.text }}>
              {format(item)}
            </Text>
          </View>
        ))}
      </ScrollView>
      {/* Selection highlight — rendered after ScrollView so text shows through */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: ITEM_H,
          height: ITEM_H,
          backgroundColor: "transparent",
          borderRadius: radius.sm,
          borderTopWidth: 1.5,
          borderBottomWidth: 1.5,
          borderColor: colors.primary,
        }}
      />
    </View>
  );
}

// iPad-friendly max content width
const MAX_CONTENT_WIDTH = 600;

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, preference, setPreference } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 768;
  const { register, registerScroll } = useWalkthroughRegistry();

  const [email, setEmail] = useState("");
  const [memberSince, setMemberSince] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Nickname (display only — set during onboarding)
  const [nickname, setNickname] = useState("");

  // Subscription
  const { isLimitedMode, hasPro, billingDate, refreshSubscription } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  // Weekly summary
  const [weeklySummaryOpen, setWeeklySummaryOpen] = useState(false);
  const [weeklyStatus, setWeeklyStatus] = useState<WeeklySummaryStatus | null>(null);
  const [weeklyFrozenData, setWeeklyFrozenData] = useState<WeeklySummaryType | null>(null);
  const [weeklyOpening, setWeeklyOpening] = useState(false);
  const [countdown, setCountdown] = useState("");

  // History
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTasks, setHistoryTasks] = useState<DailyTask[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Notification
  const [notifPref, setNotifPref] = useState<NotifTimePreference | null>(null);
  const [notifSheetOpen, setNotifSheetOpen] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customHour, setCustomHour] = useState(8);
  const [customMinute, setCustomMinute] = useState(0);
  const [customPeriod, setCustomPeriod] = useState<"AM" | "PM">("AM");
  const [customEndHour, setCustomEndHour] = useState(9);
  const [customEndMinute, setCustomEndMinute] = useState(0);
  const [customEndPeriod, setCustomEndPeriod] = useState<"AM" | "PM">("AM");

  // Appearance
  const [appearanceSheetOpen, setAppearanceSheetOpen] = useState(false);

  // Change password
  const [pwSheetOpen, setPwSheetOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [authProvider, setAuthProvider] = useState<"email" | "google" | "apple" | "other">("email");
  const [hasPassword, setHasPassword] = useState(true);

  // In-app notifications — shared context (synced with tab badge)
  const { notifications: appNotifications, unreadCount: notifUnreadCount, refresh: refreshNotifications, dismiss: dismissNotification } = useNotifications();
  const [notifCenterOpen, setNotifCenterOpen] = useState(false);

  const loadProfileData = useCallback(async () => {
    try {
      const [{ data: { user } }, statsRes, notifRes, savedNickname] = await Promise.all([
        supabase.auth.getUser(),
        statsApi.get(),
        getNotifPreference(),
        AsyncStorage.getItem("@threely_nickname"),
      ]);
      if (user) {
        setEmail(user.email ?? "");
        const d = new Date(user.created_at);
        setMemberSince(d.toLocaleDateString("en-US", { month: "long", year: "numeric" }));
        // Detect auth provider for password change flow
        const provider = user.app_metadata?.provider as string | undefined;
        if (provider === "google") setAuthProvider("google");
        else if (provider === "apple") setAuthProvider("apple");
        else if (provider === "email") setAuthProvider("email");
        else setAuthProvider("other");
        // Check if user has set a password (social login users may have set one later)
        const pwSet = await AsyncStorage.getItem("@threely_password_set");
        setHasPassword(provider === "email" || pwSet === "true");
      }
      setStats(statsRes);
      setNotifPref(notifRes);
      if (savedNickname) setNickname(savedNickname);
      // Refresh notifications via shared context
      await refreshNotifications();
    } catch {
      // silently keep previous values
    } finally {
      setStatsLoading(false);
    }
  }, [refreshNotifications]);

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [loadProfileData])
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadProfileData();
    setRefreshing(false);
  }

  // ── Weekly analysis status ───────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      summaryApi.weeklyStatus(tz).then((res) => {
        setWeeklyStatus(res);
        if (res.status === "available" && res.summary) {
          setWeeklyFrozenData(res.summary);
        }
      }).catch(() => {});
      return () => {};
    }, [])
  );

  // Countdown timer for locked/expired states (with client-side fallback)
  useEffect(() => {
    // Use server-provided unlocksAt, or compute next Monday locally as fallback
    let targetDate: string | undefined = weeklyStatus?.unlocksAt;

    if (!targetDate) {
      // Compute next Monday 00:00 local time
      const now = new Date();
      const day = now.getDay(); // 0=Sun
      const daysUntilMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
      const nextMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMon);
      targetDate = nextMon.toISOString();
    }

    const isLockState = !weeklyStatus || weeklyStatus.status === "locked" || weeklyStatus.status === "expired";
    if (!isLockState) {
      setCountdown("");
      return;
    }

    function updateCountdown() {
      const diff = new Date(targetDate!).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown("Available now");
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((diff / (1000 * 60)) % 60);
      if (days > 0) setCountdown(`Unlocks in ${days}d ${hours}h`);
      else if (hours > 0) setCountdown(`Unlocks in ${hours}h ${mins}m`);
      else setCountdown(`Unlocks in ${mins}m`);
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [weeklyStatus]);

  async function handleOpenWeekly() {
    // Gate behind subscription
    if (isLimitedMode) {
      setShowPaywall(true);
      return;
    }
    if (weeklyStatus?.status === "available" && weeklyFrozenData) {
      setWeeklySummaryOpen(true);
      return;
    }
    if (weeklyStatus?.status !== "ready") return;
    setWeeklyOpening(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const data = await summaryApi.weeklyOpen(tz);
      setWeeklyFrozenData(data);
      setWeeklyStatus({ status: "available", summary: data });
      setWeeklySummaryOpen(true);
    } catch (err) {
      if (err instanceof Error && err.message?.includes("pro_required")) {
        setShowPaywall(true);
      } else {
        Alert.alert("Error", "Failed to load weekly analysis.");
      }
    } finally {
      setWeeklyOpening(false);
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleSignOut() {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => supabase.auth.signOut() },
    ]);
  }

  async function openHistory() {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await tasksApi.history(30);
      setHistoryTasks(res.dailyTasks);
    } catch {
      // silently fail
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleSelectNotif(opt: NotifTimePreference | null) {
    setNotifSaving(true);
    try {
      await saveNotifPreference(opt);
      setNotifPref(opt);
      setCustomOpen(false);
      setNotifSheetOpen(false);
    } catch {
      Alert.alert("Error", "Could not update notification settings.");
    } finally {
      setNotifSaving(false);
    }
  }

  async function handleSaveCustomNotif() {
    // Convert 12h to 24h
    let h = customHour;
    if (customPeriod === "AM" && h === 12) h = 0;
    else if (customPeriod === "PM" && h !== 12) h = h + 12;

    let eh = customEndHour;
    if (customEndPeriod === "AM" && eh === 12) eh = 0;
    else if (customEndPeriod === "PM" && eh !== 12) eh = eh + 12;

    const minStr = customMinute === 0 ? "00" : String(customMinute);
    const endMinStr = customEndMinute === 0 ? "00" : String(customEndMinute);
    const startTime = `${customHour}:${minStr} ${customPeriod}`;
    const endTime = `${customEndHour}:${endMinStr} ${customEndPeriod}`;
    const displayTime = `${startTime} \u2013 ${endTime}`;

    await handleSelectNotif({
      label: "Custom",
      time: displayTime,
      hour: h,
      minute: customMinute,
    });
  }

  async function handleSelectScheme(pref: ColorSchemePreference) {
    await setPreference(pref);
    setAppearanceSheetOpen(false);
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your account, all goals, and all task history. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => {
            Alert.prompt(
              "Confirm with password",
              "Enter your password to permanently delete your account.",
              async (password) => {
                if (!password) return;
                try {
                  await accountApi.delete(password);
                  const { data: { user } } = await supabase.auth.getUser();
                  if (user) await AsyncStorage.removeItem(`@threely_onboarding_done_${user.id}`);
                  await supabase.auth.signOut();
                } catch (e: unknown) {
                  const msg = e instanceof Error ? e.message : "Failed to delete account.";
                  Alert.alert("Error", msg.includes("Incorrect") ? "Incorrect password" : msg);
                }
              },
              "secure-text"
            );
          },
        },
      ]
    );
  }

  // ── Derived display values ────────────────────────────────────────────────────

  const formatName = (raw: string) => raw.trim().replace(/\s+/g, " ").split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  const displayNameRaw = nickname || email;
  const displayName = displayNameRaw ? formatName(displayNameRaw) : "";
  const initials = displayName ? displayName[0].toUpperCase() : "?";

  const notifLabel = (() => {
    if (!notifPref) return "Off";
    const preset = NOTIF_PRESETS.find((p) => p.hour === notifPref.hour && p.minute === notifPref.minute);
    if (preset) return `${preset.emoji} ${preset.label} · ${preset.time}`;
    return `⏰ Custom · ${notifPref.time}`;
  })();

  const schemeCurrent = SCHEME_OPTIONS.find((s) => s.value === preference) ?? SCHEME_OPTIONS[2];

  const wideContentStyle = isWide ? { maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" as const, width: "100%" as const } : undefined;

  return (
    <SwipeNavigator currentIndex={2}>
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        ref={r => registerScroll("profile-scroll", r)}
        contentContainerStyle={[styles.scroll, wideContentStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>


        {/* Apple sign-in set-password CTA (shown when no password is set) */}
        {authProvider === "apple" && !hasPassword && (
          <TouchableOpacity
            style={{
              backgroundColor: colors.primaryLight,
              borderRadius: radius.lg,
              padding: spacing.md,
              marginBottom: spacing.lg,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              borderWidth: 1,
              borderColor: colors.primary,
            }}
            onPress={() => setPwSheetOpen(true)}
            activeOpacity={0.85}
          >
            <View style={{
              width: 36, height: 36, borderRadius: radius.md,
              backgroundColor: colors.primary,
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name="key" size={18} color={colors.primaryText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.primary, marginBottom: 2 }}>
                Set a password to log in on the web
              </Text>
              <Text style={{ fontSize: typography.xs, color: colors.textSecondary }}>
                You signed in with Apple. Add a password to sign in from any browser.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* Settings */}
        <Text style={styles.sectionLabel}>Settings</Text>
        <View style={styles.menuCard}>
          {/* Notifications */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setNotifSheetOpen(true)}
            activeOpacity={0.7}
          >
            <View style={styles.menuIcon}>
              <Ionicons name="notifications-outline" size={18} color={colors.text} />
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuLabel}>Notifications</Text>
              <Text style={styles.menuValue}>{notifLabel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Focus goal */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={async () => {
              if ((stats?.activeGoals ?? 0) <= 1) {
                Alert.alert(
                  "Only One Goal",
                  "You need at least 2 goals to change focus. Add another goal first!"
                );
                return;
              }
              const today = new Date().toISOString().slice(0, 10);
              await AsyncStorage.removeItem(`@threely_focus_${today}`);
              await AsyncStorage.setItem("@threely_open_focus_picker", "1");
              router.push("/(tabs)" as never);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.menuIcon}>
              <Ionicons name="flag-outline" size={18} color={colors.text} />
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuLabel}>Focus goal</Text>
              <Text style={styles.menuValue}>Change today's focus</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Appearance */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setAppearanceSheetOpen(true)}
            activeOpacity={0.7}
          >
            <View style={styles.menuIcon}>
              <Ionicons name={schemeCurrent.icon} size={18} color={colors.text} />
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuLabel}>Appearance</Text>
              <Text style={styles.menuValue}>{schemeCurrent.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Payments */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => {
              if (isLimitedMode) {
                setShowPaywall(true);
              } else {
                Linking.openURL("https://apps.apple.com/account/subscriptions");
              }
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.successLight }]}>
              <Ionicons name="card-outline" size={18} color={colors.success} />
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuLabel}>Subscription</Text>
              <Text style={styles.menuValue}>
                {hasPro && billingDate
                  ? `Billing on ${new Date(billingDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                  : "Subscribe"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Account */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => {
              const onChange = async (newEmail?: string) => {
                const trimmed = (newEmail ?? "").trim();
                if (!trimmed || trimmed === email) return;
                if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
                  Alert.alert("Invalid email", "That doesn't look like a valid email address.");
                  return;
                }
                try {
                  const { error } = await supabase.auth.updateUser({ email: trimmed });
                  if (error) throw error;
                  Alert.alert(
                    "Check your inbox",
                    `We sent a confirmation link to ${trimmed}. Your email won't change until you click it.`
                  );
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "Couldn't update email. Try again.";
                  Alert.alert("Couldn't change email", msg);
                }
              };
              if (Platform.OS === "ios" && typeof Alert.prompt === "function") {
                Alert.prompt(
                  "Change email",
                  `Current: ${email || "(none)"}\n\nWe'll send a confirmation link to the new address.`,
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Change", onPress: onChange },
                  ],
                  "plain-text",
                  email,
                  "email-address"
                );
              } else {
                Alert.alert(
                  "Change email",
                  `Your account email is ${email}. To change it on Android, contact support at support@threely.app.`,
                  [{ text: "OK", style: "cancel" }]
                );
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.menuIcon}>
              <Ionicons name="mail-outline" size={18} color={colors.text} />
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuLabel}>Email</Text>
              <Text style={styles.menuValue} numberOfLines={1}>{email || "—"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.menuRow} onPress={() => setPwSheetOpen(true)} activeOpacity={0.7}>
            <View style={styles.menuIcon}>
              <Ionicons name="key-outline" size={18} color={colors.text} />
            </View>
            <Text style={styles.menuLabel}>{hasPassword ? "Change password" : "Set password"}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.menuRow} onPress={handleSignOut} activeOpacity={0.7}>
            <View style={styles.menuIcon}>
              <Ionicons name="log-out-outline" size={18} color={colors.text} />
            </View>
            <Text style={styles.menuLabel}>Sign out</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.menuRow} onPress={handleDeleteAccount} activeOpacity={0.7}>
            <View style={[styles.menuIcon, { backgroundColor: colors.dangerLight }]}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.danger }]}>Delete account</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Threely v1.0.0</Text>
      </ScrollView>

      {/* ── History Sheet ──────────────────────────────────────────────────────── */}
      {historyOpen && (
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setHistoryOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.historySheet} onPress={() => {}}>
            <View style={styles.handle} />
            <View style={styles.historyHeaderRow}>
              <Text style={styles.sheetTitle}>Task History</Text>
              <TouchableOpacity onPress={() => setHistoryOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {historyLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
            ) : historyTasks.length === 0 ? (
              <Text style={styles.historyEmpty}>No history yet. Complete tasks to build your record.</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {(() => {
                  const byDate = new Map<string, DailyTask[]>();
                  for (const dt of historyTasks) {
                    const completedItems = (Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : []).filter((t) => t.isCompleted);
                    if (completedItems.length === 0) continue; // skip days with no completions
                    // Use the raw date string (YYYY-MM-DD) as key to avoid UTC→local timezone shift
                    const key = typeof dt.date === "string" ? dt.date.slice(0, 10) : new Date(dt.date).toISOString().slice(0, 10);
                    if (!byDate.has(key)) byDate.set(key, []);
                    byDate.get(key)!.push({ ...dt, tasks: completedItems });
                  }
                  if (byDate.size === 0) {
                    return <Text style={styles.historyEmpty}>No completed tasks yet.</Text>;
                  }
                  return Array.from(byDate.entries()).map(([dateStr, tasks]) => {
                    // Parse as local date to avoid UTC offset shifting the day
                    const [year, month, day] = dateStr.split("-").map(Number);
                    const d = new Date(year, month - 1, day);
                    const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                    return (
                      <View key={dateStr} style={styles.historyDay}>
                        <Text style={styles.historyDayLabel}>{label}</Text>
                        {tasks.map((dt) => {
                          const items = dt.tasks as TaskItem[];
                          return (
                            <View key={dt.id} style={styles.historyGoalSection}>
                              <View style={styles.historyGoalHeader}>
                                <Text style={styles.historyGoalName} numberOfLines={1}>{dt.goal?.title ?? "Goal"}</Text>
                                <Text style={styles.historyCount}>{items.length} completed</Text>
                              </View>
                              {items.map((task) => (
                                <TaskCard key={task.id} task={task} onToggle={() => {}} readonly />
                              ))}
                            </View>
                          );
                        })}
                      </View>
                    );
                  });
                })()}
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* ── Notifications Sheet ───────────────────────────────────────────────── */}
      <Modal visible={notifSheetOpen} transparent animationType="slide" onRequestClose={() => { setCustomOpen(false); setNotifSheetOpen(false); }}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          {/* Backdrop — separate sibling so it doesn't capture scroll events on sheet */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { setCustomOpen(false); setNotifSheetOpen(false); }} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Reminder time</Text>
            <Text style={styles.sheetSubtitle}>When should we remind you to check your tasks?</Text>

            {/* Presets */}
            {NOTIF_PRESETS.map((opt) => {
              const isSelected = !customOpen && notifPref?.hour === opt.hour && notifPref?.minute === opt.minute;
              return (
                <Pressable
                  key={opt.label}
                  style={[styles.notifRow, isSelected && styles.notifRowSelected]}
                  onPress={() => { setCustomOpen(false); handleSelectNotif(opt); }}
                  disabled={notifSaving}
                >
                  <Text style={styles.notifEmoji}>{opt.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifLabel, isSelected && styles.notifLabelSelected]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.notifSub}>{opt.rangeLabel}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                </Pressable>
              );
            })}

            {/* Custom */}
            <Pressable
              style={[styles.notifRow, customOpen && styles.notifRowSelected]}
              onPress={() => setCustomOpen((v) => !v)}
              disabled={notifSaving}
            >
              <Text style={styles.notifEmoji}>⚙️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifLabel, customOpen && styles.notifLabelSelected]}>Custom time</Text>
                <Text style={styles.notifSub}>Pick your exact reminder time</Text>
              </View>
              <Ionicons name={customOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textTertiary} />
            </Pressable>

            {/* Custom inline picker */}
            {customOpen && (
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: typography.xs, fontWeight: typography.semibold, color: colors.textSecondary, marginLeft: 4, marginTop: 4 }}>Start time</Text>
                <View style={styles.customPickerWrap}>
                  <PickerCol
                    items={HOURS}
                    selected={customHour}
                    onSelect={setCustomHour}
                    format={(v) => String(v)}
                    colors={colors}
                  />
                  <Text style={styles.colonSep}>:</Text>
                  <PickerCol
                    items={MINUTES}
                    selected={customMinute}
                    onSelect={setCustomMinute}
                    format={(v) => v === 0 ? "00" : String(v)}
                    colors={colors}
                  />
                  <PickerCol
                    items={PERIODS as ("AM" | "PM")[]}
                    selected={customPeriod}
                    onSelect={(v) => setCustomPeriod(v as "AM" | "PM")}
                    format={(v) => v}
                    colors={colors}
                  />
                </View>
                <Text style={{ fontSize: typography.xs, fontWeight: typography.semibold, color: colors.textSecondary, marginLeft: 4 }}>End time</Text>
                <View style={styles.customPickerWrap}>
                  <PickerCol
                    items={HOURS}
                    selected={customEndHour}
                    onSelect={setCustomEndHour}
                    format={(v) => String(v)}
                    colors={colors}
                  />
                  <Text style={styles.colonSep}>:</Text>
                  <PickerCol
                    items={MINUTES}
                    selected={customEndMinute}
                    onSelect={setCustomEndMinute}
                    format={(v) => v === 0 ? "00" : String(v)}
                    colors={colors}
                  />
                  <PickerCol
                    items={PERIODS as ("AM" | "PM")[]}
                    selected={customEndPeriod}
                    onSelect={(v) => setCustomEndPeriod(v as "AM" | "PM")}
                    format={(v) => v}
                    colors={colors}
                  />
                </View>
                <TouchableOpacity style={styles.customSaveBtn} onPress={handleSaveCustomNotif} disabled={notifSaving}>
                  <Text style={styles.customSaveBtnText}>Set custom range</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Turn off */}
            <Pressable
              style={[styles.notifRow, !notifPref && !customOpen && styles.notifRowSelected]}
              onPress={() => handleSelectNotif(null)}
              disabled={notifSaving}
            >
              <Text style={styles.notifEmoji}>🔕</Text>
              <Text style={[styles.notifLabel, !notifPref && !customOpen && styles.notifLabelSelected, { flex: 1 }]}>
                Turn off
              </Text>
              {!notifPref && !customOpen && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
            </Pressable>

            {notifSaving && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} />}
            {Platform.OS !== "web" && (
              <Text style={styles.sheetNote}>Notifications only work on physical devices.</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Appearance Sheet ──────────────────────────────────────────────────── */}
      {appearanceSheetOpen && (
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setAppearanceSheetOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Appearance</Text>
            <Text style={styles.sheetSubtitle}>Choose how Threely looks on your device.</Text>
            {SCHEME_OPTIONS.map((opt) => {
              const isSelected = preference === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.notifRow, isSelected && styles.notifRowSelected]}
                  onPress={() => handleSelectScheme(opt.value)}
                >
                  <View style={[styles.schemeIconWrap, isSelected && { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name={opt.icon} size={18} color={isSelected ? colors.primary : colors.textSecondary} />
                  </View>
                  <Text style={[styles.notifLabel, isSelected && styles.notifLabelSelected, { flex: 1 }]}>
                    {opt.label}
                  </Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                </Pressable>
              );
            })}
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* ── Change Password Modal (full screen) ─────────────────────────────────── */}
      {pwSheetOpen && (
        <Modal visible animationType="slide" presentationStyle="formSheet" onRequestClose={() => { setPwSheetOpen(false); setPwError(""); setCurrentPw(""); setNewPw(""); setConfirmPw(""); setShowCurrentPw(false); setShowNewPw(false); setShowConfirmPw(false); }}>
          <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.xl }} keyboardShouldPersistTaps="handled">
              <Text style={[styles.sheetTitle, { textAlign: "center", marginBottom: spacing.xs }]}>
                {hasPassword ? "Change password" : "Set a password"}
              </Text>
              <Text style={[styles.sheetSubtitle, { textAlign: "center", marginBottom: spacing.lg }]}>
                {hasPassword
                  ? "Enter your current password and choose a new one."
                  : `You signed in with ${authProvider === "google" ? "Google" : authProvider === "apple" ? "Apple" : "a social account"}. Set a password to also sign in with email.`}
              </Text>

              {hasPassword && (
                <View style={styles.pwInputRow}>
                  <TextInput
                    style={[styles.pwInput, { flex: 1, marginBottom: 0 }, pwError && currentPw === "" ? { borderColor: colors.danger } : {}]}
                    placeholder="Current password"
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry={!showCurrentPw}
                    value={currentPw}
                    onChangeText={setCurrentPw}
                    autoComplete="current-password"
                  />
                  <TouchableOpacity onPress={() => setShowCurrentPw(!showCurrentPw)} style={styles.pwEyeBtn} hitSlop={8}>
                    <Ionicons name={showCurrentPw ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.pwInputRow}>
                <TextInput
                  style={[styles.pwInput, { flex: 1, marginBottom: 0 }]}
                  placeholder="New password (min. 8 characters)"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry={!showNewPw}
                  value={newPw}
                  onChangeText={setNewPw}
                  autoComplete="new-password"
                />
                <TouchableOpacity onPress={() => setShowNewPw(!showNewPw)} style={styles.pwEyeBtn} hitSlop={8}>
                  <Ionicons name={showNewPw ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
              <View style={styles.pwInputRow}>
                <TextInput
                  style={[styles.pwInput, { flex: 1, marginBottom: 0 }]}
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry={!showConfirmPw}
                  value={confirmPw}
                  onChangeText={setConfirmPw}
                  autoComplete="new-password"
                />
                <TouchableOpacity onPress={() => setShowConfirmPw(!showConfirmPw)} style={styles.pwEyeBtn} hitSlop={8}>
                  <Ionicons name={showConfirmPw ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              {pwError ? (
                <View style={{ backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm }}>
                  <Text style={{ color: colors.danger, fontSize: typography.sm }}>{pwError}</Text>
                </View>
              ) : null}

              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                <TouchableOpacity
                  style={[styles.pwBtn, { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border }]}
                  onPress={() => { setPwSheetOpen(false); setPwError(""); setCurrentPw(""); setNewPw(""); setConfirmPw(""); setShowCurrentPw(false); setShowNewPw(false); setShowConfirmPw(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pwBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pwBtn, { backgroundColor: colors.primary }, pwLoading && { opacity: 0.6 }]}
                  onPress={async () => {
                    setPwError("");
                    if (hasPassword && !currentPw.trim()) { setPwError("Enter your current password."); return; }
                    const pwValidationError = validatePassword(newPw);
                    if (pwValidationError) { setPwError(`${pwValidationError}.`); return; }
                    if (newPw !== confirmPw) { setPwError("New passwords do not match."); return; }
                    setPwLoading(true);
                    try {
                      if (hasPassword) {
                        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPw });
                        if (signInErr) { setPwError("Current password is incorrect."); setPwLoading(false); return; }
                      }
                      const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
                      if (updateErr) { setPwError(updateErr.message); setPwLoading(false); return; }
                      setPwSheetOpen(false);
                      setCurrentPw(""); setNewPw(""); setConfirmPw(""); setPwError("");
                      // Mark password as set for future sessions
                      if (!hasPassword) {
                        await AsyncStorage.setItem("@threely_password_set", "true");
                        setHasPassword(true);
                      }
                      Alert.alert("Success", hasPassword ? "Your password has been updated." : "Password set! You can now sign in with email and password too.");
                    } catch {
                      setPwError("Something went wrong. Please try again.");
                    } finally {
                      setPwLoading(false);
                    }
                  }}
                  activeOpacity={0.85}
                  disabled={pwLoading}
                >
                  {pwLoading ? (
                    <ActivityIndicator color={colors.primaryText} size="small" />
                  ) : (
                    <Text style={[styles.pwBtnText, { color: colors.primaryText }]}>Update password</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* ── Weekly Summary Modal ───────────────────────────────────────────────── */}
      <WeeklySummary
        visible={weeklySummaryOpen}
        onClose={() => setWeeklySummaryOpen(false)}
        frozenData={weeklyFrozenData}
      />

      {/* ── Notification Center Modal ──────────────────────────────────────────── */}
      <Modal
        visible={notifCenterOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setNotifCenterOpen(false)}
      >
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" }} onPress={() => setNotifCenterOpen(false)}>
          <Pressable onPress={() => {}} style={{
            backgroundColor: colors.bgElevated,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            maxHeight: "70%",
            maxWidth: 600,
            alignSelf: "center" as const,
            width: "100%",
            paddingTop: spacing.lg,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xl,
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
              <Text style={{ fontSize: typography.lg, fontWeight: typography.bold as "700", color: colors.text }}>
                Notifications
              </Text>
              <TouchableOpacity onPress={() => setNotifCenterOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {appNotifications.length === 0 ? (
                <View style={{ paddingVertical: spacing.xl * 1.5, alignItems: "center" }}>
                  <Ionicons name="notifications-off-outline" size={44} color={colors.textTertiary} style={{ opacity: 0.4 }} />
                  <Text style={{ color: colors.textSecondary, marginTop: spacing.md, fontSize: typography.base, fontWeight: "600" }}>
                    No new notifications
                  </Text>
                  <Text style={{ color: colors.textTertiary, marginTop: 4, fontSize: typography.sm }}>
                    You're all caught up
                  </Text>
                </View>
              ) : (
                appNotifications.map(n => (
                  <View key={n.id} style={{
                    backgroundColor: colors.card,
                    borderRadius: radius.lg,
                    padding: spacing.md,
                    marginBottom: spacing.sm,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}>
                    <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm }}>
                      <View style={{
                        width: 36, height: 36, borderRadius: radius.md,
                        backgroundColor: colors.primaryLight,
                        alignItems: "center", justifyContent: "center",
                      }}>
                        <Ionicons name="notifications-outline" size={18} color={colors.text} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "700", fontSize: typography.base, color: colors.text, marginBottom: 2 }}>
                          {n.heading}
                        </Text>
                        <Text style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 20 }}>
                          {n.subheading}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: spacing.sm, paddingLeft: 36 + spacing.sm }}>
                      {n.linkUrl && n.linkUrl.trim() !== "" && n.linkUrl.trim() !== "/" && (
                        <TouchableOpacity
                          onPress={async () => {
                            const url = n.linkUrl!.trim();
                            try {
                              // Always use Linking.openURL — opens in Safari for https, handles all URL schemes
                              const canOpen = await Linking.canOpenURL(url);
                              if (canOpen) {
                                await Linking.openURL(url);
                              } else {
                                Alert.alert("Cannot open link", url);
                              }
                            } catch {
                              Alert.alert("Error", "Could not open link.");
                            }
                          }}
                          style={{
                            backgroundColor: colors.primary,
                            paddingHorizontal: spacing.md,
                            paddingVertical: spacing.xs + 2,
                            borderRadius: radius.md,
                          }}
                        >
                          <Text style={{ color: colors.primaryText, fontSize: typography.sm, fontWeight: "600" }}>
                            Open Link
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => dismissNotification(n.id)}
                        style={{
                          paddingHorizontal: spacing.md,
                          paddingVertical: spacing.xs + 2,
                          borderRadius: radius.md,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text style={{ color: colors.textSecondary, fontSize: typography.sm, fontWeight: "500" }}>
                          Dismiss
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <Paywall visible={showPaywall} onDismiss={() => { setShowPaywall(false); refreshSubscription(); }} />
    </SafeAreaView>
    </SwipeNavigator>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    header: { paddingTop: spacing.lg, marginBottom: spacing.lg },
    title: {
      fontSize: typography.xxl,
      fontWeight: typography.bold,
      color: c.text,
      letterSpacing: -0.5,
    },
    avatarSection: {
      alignItems: "center",
      marginBottom: spacing.xl,
      backgroundColor: c.card,
      borderRadius: radius.xl,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: c.border,
      ...shadow.sm,
    },
    avatar: {
      width: Platform.OS === "ios" && Platform.isPad ? 96 : 72,
      height: Platform.OS === "ios" && Platform.isPad ? 96 : 72,
      borderRadius: Platform.OS === "ios" && Platform.isPad ? 48 : 36,
      backgroundColor: c.primaryLight,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
      borderWidth: 2,
      borderColor: c.primary,
    },
    avatarText: {
      fontSize: Platform.OS === "ios" && Platform.isPad ? typography.xxxl : typography.xxl,
      fontWeight: typography.bold,
      color: c.primary,
    },
    displayName: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: c.text,
      marginBottom: 2,
    },
    emailSmall: {
      fontSize: typography.xs,
      color: c.textTertiary,
      marginBottom: 2,
    },
    memberSince: {
      fontSize: typography.sm,
      color: c.textSecondary,
      marginTop: 2,
    },
    sectionLabel: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: spacing.sm,
      marginTop: spacing.xs,
    },
    statsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.xl,
    },
    statCard: {
      flex: 1,
      backgroundColor: c.card,
      borderRadius: radius.lg,
      paddingVertical: spacing.sm + 4,
      paddingHorizontal: spacing.sm,
      alignItems: "center",
      gap: 3,
      borderWidth: 1,
      borderColor: c.border,
      ...shadow.sm,
    },
    statIconWrap: {
      width: 32,
      height: 32,
      borderRadius: radius.md,
      backgroundColor: c.primaryLight,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 1,
    },
    statValue: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: c.text,
      letterSpacing: -0.3,
    },
    statLabel: {
      fontSize: typography.xs - 1,
      color: c.textSecondary,
      textAlign: "center",
    },
    weeklyCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      gap: spacing.md,
      marginBottom: spacing.xl,
      ...shadow.sm,
    },
    weeklyIconWrap: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    menuCard: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      overflow: "hidden",
      marginBottom: spacing.xl,
      ...shadow.sm,
    },
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
      gap: spacing.md,
    },
    menuIcon: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.cardPressed,
    },
    menuText: { flex: 1 },
    menuLabel: {
      fontSize: typography.base,
      fontWeight: typography.medium,
      color: c.text,
    },
    menuValue: {
      fontSize: typography.xs,
      color: c.textSecondary,
      marginTop: 1,
    },
    divider: { height: 1, backgroundColor: c.border, marginLeft: spacing.md + 32 + spacing.md },
    version: {
      textAlign: "center",
      fontSize: typography.xs,
      color: c.textTertiary,
    },
    // ── Sheets ─────────────────────────────────────────────────────────────────
    overlay: {
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
      zIndex: 100,
    },
    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
      maxWidth: 600,
      alignSelf: "center" as const,
      width: "100%",
      zIndex: 200,
      ...shadow.lg,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: "center",
      marginBottom: spacing.lg,
    },
    sheetTitle: {
      fontSize: typography.xl,
      fontWeight: typography.bold,
      color: c.text,
      letterSpacing: -0.3,
      marginBottom: 4,
    },
    sheetSubtitle: {
      fontSize: typography.sm,
      color: c.textSecondary,
      marginBottom: spacing.lg,
    },
    sheetNote: {
      fontSize: typography.xs,
      color: c.textTertiary,
      textAlign: "center",
      marginTop: spacing.md,
    },
    rowGap: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    sheetBtn: {
      flex: 1,
      height: 48,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetBtnOutline: {
      borderWidth: 1.5,
      borderColor: c.border,
    },
    sheetBtnFilled: {
      backgroundColor: c.primary,
    },
    sheetBtnText: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
    },
    // ── History sheet ──────────────────────────────────────────────────────────
    historySheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
      maxHeight: "80%",
      maxWidth: 600,
      alignSelf: "center" as const,
      width: "100%",
      ...shadow.lg,
    },
    historyHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    historyEmpty: {
      fontSize: typography.base,
      color: c.textSecondary,
      textAlign: "center",
      marginTop: spacing.xl,
      lineHeight: 22,
    },
    historyDay: { marginBottom: spacing.lg },
    historyDayLabel: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: spacing.sm,
    },
    historyGoalSection: { marginBottom: spacing.md },
    historyGoalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
    },
    historyGoalName: {
      flex: 1,
      fontSize: typography.sm,
      color: c.textSecondary,
      fontWeight: typography.semibold,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    historyCount: {
      fontSize: typography.xs,
      color: c.textTertiary,
      fontWeight: typography.semibold,
    },
    // ── Notification rows ──────────────────────────────────────────────────────
    notifRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: 11,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      marginBottom: 2,
    },
    notifRowSelected: { backgroundColor: c.primaryLight },
    notifEmoji: { fontSize: 22, width: 28, textAlign: "center" },
    notifLabel: {
      fontSize: typography.base,
      fontWeight: typography.medium,
      color: c.text,
    },
    notifLabelSelected: { color: c.primary, fontWeight: typography.semibold },
    notifSub: { fontSize: typography.xs, color: c.textSecondary, marginTop: 1 },
    notifTime: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.textTertiary,
    },
    // ── Custom time picker ─────────────────────────────────────────────────────
    customPickerWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.bg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      marginVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    colonSep: {
      fontSize: typography.xl,
      fontWeight: typography.bold,
      color: c.text,
      paddingHorizontal: 4,
    },
    customSaveBtn: {
      backgroundColor: c.primary,
      borderRadius: radius.md,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      marginLeft: spacing.sm,
    },
    customSaveBtnText: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: c.primaryText,
    },
    // ── Appearance ─────────────────────────────────────────────────────────────
    schemeIconWrap: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: c.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    // ── Change Password ──────────────────────────────────────────────────────
    pwInputRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    pwInput: {
      backgroundColor: c.bg,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md,
      fontSize: typography.base,
      color: c.text,
      marginBottom: spacing.sm,
    },
    pwEyeBtn: {
      padding: spacing.sm,
    },
    pwBtn: {
      flex: 1,
      height: 46,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    pwBtnText: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
    },
  });
}
