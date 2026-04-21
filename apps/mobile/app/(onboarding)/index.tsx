import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { goalsApi, profileApi, tasksApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { spacing, typography, radius, shadow } from "@/constants/theme";
import type { Colors } from "@/constants/theme";
import { useTheme } from "@/lib/theme";

// ─── Constants ───────────────────────────────────────────────────────────────

const GOLD = "#D4A843";

type Category = "business" | "daytrading" | "health";
type EffortLevel = "Mild" | "Moderate" | "Heavy";

const EFFORT_MAP: Record<EffortLevel, { dailyTimeMinutes: number; intensityLevel: number }> = {
  Mild: { dailyTimeMinutes: 30, intensityLevel: 1 },
  Moderate: { dailyTimeMinutes: 60, intensityLevel: 2 },
  Heavy: { dailyTimeMinutes: 120, intensityLevel: 3 },
};

// Path options per category. The `path` string is the library path id stored
// on Goal.category — the runtime loader pulls tasks from the matching JSON.
interface PathOption { label: string; path: string; description?: string }

const PATH_OPTIONS: Record<Category, PathOption[]> = {
  daytrading: [
    { label: "Never traded", path: "daytrading_beginner", description: "Learn from scratch with paper trading" },
    { label: "I have experience", path: "daytrading_experienced", description: "Build discipline and consistency" },
  ],
  business: [
    { label: "Ecommerce — starting fresh", path: "business_ecommerce", description: "Physical product, Shopify, dropshipping" },
    { label: "Ecommerce — already have a store", path: "business_ecommerce_existing", description: "Grow traffic and revenue" },
    { label: "Service / freelancing", path: "business_service", description: "Trade skills for money" },
    { label: "Content / audience", path: "business_content", description: "TikTok, YouTube, IG, X" },
    { label: "Software / SaaS", path: "business_saas", description: "Digital product or SaaS" },
  ],
  health: [
    { label: "Lose weight", path: "health_weight_loss", description: "Calorie deficit + movement" },
    { label: "Build muscle", path: "health_muscle", description: "Progressive overload + protein" },
    { label: "Get fit / feel better", path: "health_general", description: "Daily habits and movement" },
  ],
};

function buildGoalTitleFromPath(category: Category, path: string, income: string): string {
  switch (category) {
    case "business":
      if (path === "business_ecommerce") return income ? `Make ${income}/Month (Ecommerce)` : "Start an Ecommerce Brand";
      if (path === "business_ecommerce_existing") return income ? `Grow My Store to ${income}/Month` : "Grow My Ecommerce Store";
      if (path === "business_service") return income ? `Make ${income}/Month (Service)` : "Start a Service Business";
      if (path === "business_content") return income ? `Build an Audience + ${income}/Month` : "Build a Content Brand";
      if (path === "business_saas") return income ? `Launch a SaaS + ${income}/Month` : "Launch a SaaS";
      return income ? `Make ${income}/Month` : "Start a Business";
    case "daytrading":
      if (path === "daytrading_beginner") return income ? `Learn Day Trading → ${income}/Month` : "Learn to Day Trade";
      if (path === "daytrading_experienced") return income ? `Day Trading → ${income}/Month` : "Day Trade With Discipline";
      return "Day Trading";
    case "health":
      if (path === "health_weight_loss") return "Lose Weight";
      if (path === "health_muscle") return "Build Muscle";
      if (path === "health_general") return "Get Fit + Feel Better";
      return "Health Goal";
  }
}

const BUILDING_STEPS = [
  "Understanding your situation…",
  "Mapping out your path…",
  "Creating today's tasks…",
  "Locking it in…",
];

function cleanFallbackTitle(rawInput: string): string {
  let text = rawInput.trim();
  const stripPatterns = [
    /^i\s+(want|need|would\s+like|plan|aim|intend|hope|wish)\s+to\s+/i,
    /^i'd\s+like\s+to\s+/i,
    /^i'm\s+(trying|going|planning|hoping|looking)\s+to\s+/i,
    /^my\s+goal\s+is\s+(to\s+)?/i,
    /^i\s+want\s+/i,
  ];
  for (const p of stripPatterns) text = text.replace(p, "");
  text = text.replace(/[.!?,;:\s]+$/, "").trim();
  if (text.length > 0) text = text.charAt(0).toUpperCase() + text.slice(1);
  if (text.length > 25) {
    const cut = text.slice(0, 25);
    const lastSpace = cut.lastIndexOf(" ");
    text = lastSpace > 10 ? cut.slice(0, lastSpace) : cut;
  }
  return text || "My Goal";
}

// ─── BuildingProgressMobile ──────────────────────────────────────────────────

function BuildingProgressMobile({ styles, colors }: { styles: any; colors: Colors }) {
  const [stepIdx, setStepIdx] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const GOLD = "#D4A843";

  useEffect(() => {
    // Step label rotates every 1.5s so all 4 steps show within the 6s window
    const interval = setInterval(() => {
      setStepIdx((prev) => Math.min(prev + 1, BUILDING_STEPS.length - 1));
    }, 1500);

    // Bar slides 0 -> 100% over 6 seconds (just for feel, not a real indicator)
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 6000,
      useNativeDriver: false,
    }).start();

    // Shimmer overlay on the bar
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1400,
        useNativeDriver: false,
      })
    );
    shimmerLoop.start();

    return () => {
      clearInterval(interval);
      shimmerLoop.stop();
    };
  }, [progressAnim, shimmerAnim]);

  const barFillWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });
  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 320],
  });

  return (
    <View style={styles.buildingCenter}>
      <Text style={styles.buildTitle}>Threely Intelligence is building your plan…</Text>
      <Text style={[styles.buildSubtitle, { marginBottom: spacing.lg }]}>
        {BUILDING_STEPS[stepIdx]}
      </Text>

      {/* Progress bar — 6s slide, shimmer overlay */}
      <View
        style={{
          width: "80%",
          maxWidth: 320,
          height: 8,
          borderRadius: 999,
          backgroundColor: "rgba(212,168,67,0.15)",
          overflow: "hidden",
          marginTop: spacing.sm,
        }}
      >
        <Animated.View
          style={{
            width: barFillWidth,
            height: "100%",
            borderRadius: 999,
            backgroundColor: GOLD,
            shadowColor: GOLD,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: 8,
          }}
        />
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 80,
            height: "100%",
            transform: [{ translateX: shimmerTranslate }],
            backgroundColor: "rgba(255,255,255,0.35)",
            borderRadius: 999,
          }}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Funnel state — all MC, no free text
  //   step 0 = category pick
  //   step 1 = path pick (sub-question)
  //   step 2 = income target (business/daytrading only, skipped for health)
  //   step 3 = effort level
  const [category, setCategory] = useState<Category | null>(null);
  const [funnelStep, setFunnelStep] = useState(0);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [incomeTarget, setIncomeTarget] = useState("");
  const [effortLevel, setEffortLevel] = useState<EffortLevel | null>(null);

  // Hype / building state
  const [showHype, setShowHype] = useState(false);
  const [buildDone, setBuildDone] = useState(false);
  const [buildError, setBuildError] = useState("");
  const [waitingForBuild, setWaitingForBuild] = useState(false);
  const buildPromiseRef = useRef<Promise<void> | null>(null);

  // Fade animation
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // User ID for onboarding flag
  const [userId, setUserId] = useState<string | null>(null);

  // Check Supabase user on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setUserId(user.id);
      } catch { /* ignore */ }
    })();
  }, []);

  // Auto-navigate when build finishes while user is on building progress screen
  useEffect(() => {
    if (buildDone && waitingForBuild) {
      router.replace("/(tabs)");
    }
  }, [buildDone, waitingForBuild]);

  // ─── Navigation helpers ────────────────────────────────────────────────────

  function animateTransition(callback: () => void) {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      callback();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  }

  function goNext() {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateTransition(() => setFunnelStep((s) => s + 1));
  }

  function goBack() {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateTransition(() => {
      if (funnelStep === 1) {
        setCategory(null);
        setFunnelStep(0);
        setSelectedPath("");
        setIncomeTarget("");
        setEffortLevel(null);
      } else {
        setFunnelStep((s) => s - 1);
      }
    });
  }

  function selectCategory(cat: Category) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    animateTransition(() => {
      setCategory(cat);
      setFunnelStep(1);
    });
  }

  function selectPath(path: string) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPath(path);
    // Health skips the income step (no $ target — the goal IS the path)
    if (category === "health") {
      animateTransition(() => setFunnelStep(3));
    } else {
      goNext();
    }
  }

  function selectIncome(amount: string) {
    setIncomeTarget(amount);
    goNext();
  }

  function selectEffort(level: EffortLevel) {
    setEffortLevel(level);
    // Kick off build once all answers are in
    handleFinishHype(level);
  }

  // ─── Build plan ────────────────────────────────────────────────────────────

  async function startBuild(effort: EffortLevel) {
    if (!category || !selectedPath) return;

    const goalTitle = buildGoalTitleFromPath(category, selectedPath, incomeTarget);
    const { dailyTimeMinutes, intensityLevel } = EFFORT_MAP[effort];

    setBuildDone(false);
    setBuildError("");

    const MAX_RETRIES = 3;
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
      let lastError: unknown;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          return await fn();
        } catch (e) {
          lastError = e;
          if (attempt < MAX_RETRIES - 1) await delay(2000 * (attempt + 1));
        }
      }
      throw lastError;
    }

    try {
      await withRetry(() => profileApi.save({ dailyTimeMinutes, intensityLevel }));

      // Goal.category stores the library path id — runtime loader uses it to pull tasks
      const goalResult = await withRetry(() => goalsApi.create(goalTitle, {
        rawInput: goalTitle,
        structuredSummary: goalTitle,
        category: selectedPath,
        dailyTimeMinutes,
        intensityLevel,
        workDays: [1, 2, 3, 4, 5, 6, 7],
        onboarding: true,
      }));

      await withRetry(() => tasksApi.generate(goalResult.goal.id, { onboarding: true }));

      const uid = userId ?? (await supabase.auth.getUser()).data.user?.id;
      if (uid) {
        await AsyncStorage.setItem(`@threely_onboarding_done_${uid}`, "true");
      }

      setBuildDone(true);
    } catch (e: unknown) {
      setBuildError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  }

  function handleFinishHype(effort: EffortLevel) {
    if (!category || !selectedPath) return;
    setShowHype(true);
    buildPromiseRef.current = startBuild(effort);
  }

  // After step 3, go to hype screen
  // ─── Progress dots ─────────────────────────────────────────────────────────

  function ProgressDots({ current, total }: { current: number; total: number }) {
    return (
      <View style={styles.progressDots}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i + 1 === current ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    );
  }

  // ─── Render: Category picker (step 0) ──────────────────────────────────────

  function renderCategoryPicker() {
    return (
      <View style={styles.centerContent}>
        <Text style={styles.stepTitle}>What are you working toward?</Text>
        <View style={styles.categoryList}>
          <TouchableOpacity
            style={styles.categoryBtn}
            onPress={() => selectCategory("daytrading")}
            activeOpacity={0.8}
          >
            <Text style={styles.categoryEmoji}>📈</Text>
            <View style={styles.categoryTextWrap}>
              <Text style={styles.categoryLabel}>Day Trading</Text>
              <Text style={styles.categoryDesc}>Grow a trading account</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryBtn}
            onPress={() => selectCategory("business")}
            activeOpacity={0.8}
          >
            <Text style={styles.categoryEmoji}>💼</Text>
            <View style={styles.categoryTextWrap}>
              <Text style={styles.categoryLabel}>Business</Text>
              <Text style={styles.categoryDesc}>Start or grow a business</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryBtn}
            onPress={() => selectCategory("health")}
            activeOpacity={0.8}
          >
            <Text style={styles.categoryEmoji}>💪</Text>
            <View style={styles.categoryTextWrap}>
              <Text style={styles.categoryLabel}>Health</Text>
              <Text style={styles.categoryDesc}>Transform your body</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Render: Step 1 (path MC, category-specific) ──────────────────────────

  function renderStep1() {
    if (!category) return null;
    const options = PATH_OPTIONS[category];
    const title = category === "daytrading"
      ? "Where are you starting?"
      : category === "business"
        ? "What are you building?"
        : "What's your goal?";
    const totalSteps = category === "health" ? 2 : 3;
    return (
      <View style={styles.stepContainer}>
        <ProgressDots current={1} total={totalSteps} />
        <Text style={styles.stepTitle}>{title}</Text>
        <View style={styles.optionList}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.path}
              style={styles.optionBtn}
              onPress={() => selectPath(opt.path)}
              activeOpacity={0.8}
            >
              <Text style={styles.optionBtnText}>{opt.label}</Text>
              {opt.description && (
                <Text style={styles.optionBtnSub}>{opt.description}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // ─── Render: Step 2 (income target — business/daytrading only) ────────────

  function renderStep2() {
    return (
      <View style={styles.stepContainer}>
        <ProgressDots current={2} total={3} />
        <Text style={styles.stepTitle}>How much do you want to make per month?</Text>
        <View style={styles.optionList}>
          {["$500", "$1K-$5K", "$10K+"].map((opt) => (
            <TouchableOpacity
              key={opt}
              style={styles.optionBtn}
              onPress={() => selectIncome(opt)}
              activeOpacity={0.8}
            >
              <Text style={styles.optionBtnText}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // ─── Render: Step 3 (effort level) ────────────────────────────────────────

  function renderStep3() {
    const totalSteps = category === "health" ? 2 : 3;
    const current = category === "health" ? 2 : 3;
    return (
      <View style={styles.stepContainer}>
        <ProgressDots current={current} total={totalSteps} />
        <Text style={styles.stepTitle}>Level of work?</Text>
        <View style={styles.optionList}>
          {(["Mild", "Moderate", "Heavy"] as EffortLevel[]).map((opt) => (
            <TouchableOpacity
              key={opt}
              style={styles.optionBtn}
              onPress={() => selectEffort(opt)}
              activeOpacity={0.8}
            >
              <Text style={styles.optionBtnText}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // ─── Render: Hype screen ───────────────────────────────────────────────────

  function renderHype() {
    // If build errored, show error
    if (buildError) {
      return (
        <View style={styles.buildingCenter}>
          <Text style={styles.hypeEmoji}>⚠</Text>
          <Text style={styles.buildTitle}>Something went wrong</Text>
          <Text style={styles.buildError}>{buildError}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              if (!effortLevel) return;
              setBuildError("");
              buildPromiseRef.current = startBuild(effortLevel);
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // User tapped "Show me my plan" but build isn't done yet — show building progress
    if (waitingForBuild && !buildDone) {
      return <BuildingProgressMobile styles={styles} colors={colors} />;
    }

    // Hype screen (build runs in background)
    return (
      <View style={styles.hypeContainer}>
        <View style={styles.hypeContent}>
          <Text style={styles.hypeEmoji}>🔥</Text>
          <Text style={styles.hypeTitle}>You're the perfect fit.</Text>
          <Text style={styles.hypeSubtitle}>
            Threely is building your personalized plan right now.
          </Text>
          {!buildDone && (
            <ActivityIndicator color={GOLD} style={{ marginTop: spacing.lg }} />
          )}
        </View>
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.hypeCta}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              if (buildDone) {
                router.replace("/(tabs)");
              } else {
                // Show building progress until done
                setWaitingForBuild(true);
              }
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.hypeCtaText}>Show me my plan →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Root render ───────────────────────────────────────────────────────────

  if (showHype) {
    return (
      <SafeAreaView style={styles.container}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {renderHype()}
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Back button */}
      {funnelStep > 0 && (
        <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={12}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
      )}

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {funnelStep === 0 && renderCategoryPicker()}
        {funnelStep === 1 && renderStep1()}
        {funnelStep === 2 && renderStep2()}
        {funnelStep === 3 && renderStep3()}
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(colors: Colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    // ─── Back button ─────────────────────────────────────────────────────────
    backBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    backText: {
      fontSize: typography.base,
      color: colors.text,
      fontWeight: typography.medium,
    },
    // ─── Progress dots ───────────────────────────────────────────────────────
    progressDots: {
      flexDirection: "row",
      justifyContent: "center",
      gap: spacing.sm,
      marginBottom: spacing.xl,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    dotActive: {
      backgroundColor: GOLD,
    },
    dotInactive: {
      backgroundColor: colors.border,
    },
    // ─── Shared layout ──────────────────────────────────────────────────────
    centerContent: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
    },
    stepContainer: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
    },
    stepTitle: {
      fontSize: typography.xxl,
      fontWeight: typography.bold,
      color: colors.text,
      letterSpacing: -0.5,
      lineHeight: 38,
      marginBottom: spacing.lg,
      textAlign: "center",
    },
    // ─── Category picker ─────────────────────────────────────────────────────
    categoryList: {
      gap: spacing.md,
      marginTop: spacing.md,
    },
    categoryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: spacing.lg,
      minHeight: 80,
      ...shadow.sm,
    },
    categoryEmoji: {
      fontSize: 32,
    },
    categoryTextWrap: {
      flex: 1,
      gap: 2,
    },
    categoryLabel: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
    },
    categoryDesc: {
      fontSize: typography.base,
      color: colors.textSecondary,
    },
    // ─── Option buttons ──────────────────────────────────────────────────────
    optionList: {
      gap: spacing.md,
    },
    optionBtn: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      minHeight: 56,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.sm,
    },
    optionBtnText: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
    },
    optionBtnSub: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      marginTop: 2,
    },
    // ─── Text input ──────────────────────────────────────────────────────────
    textInput: {
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.md,
      fontSize: typography.base,
      color: colors.text,
      lineHeight: 22,
      minHeight: 100,
      marginBottom: spacing.md,
    },
    // ─── Footer / continue button ────────────────────────────────────────────
    footer: {
      paddingVertical: spacing.lg,
      gap: spacing.sm,
    },
    continueBtn: {
      height: 56,
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.md,
    },
    continueBtnDisabled: {
      backgroundColor: colors.border,
      ...shadow.sm,
    },
    continueBtnText: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: colors.primaryText,
      letterSpacing: -0.2,
    },
    continueBtnTextDisabled: {
      color: colors.textTertiary,
    },
    // ─── Hype screen ─────────────────────────────────────────────────────────
    hypeContainer: {
      flex: 1,
      justifyContent: "space-between",
    },
    hypeContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
    },
    hypeEmoji: {
      fontSize: 72,
      marginBottom: spacing.lg,
    },
    hypeTitle: {
      fontSize: typography.xxxl,
      fontWeight: typography.bold,
      color: colors.text,
      textAlign: "center",
      letterSpacing: -0.5,
      marginBottom: spacing.md,
    },
    hypeSubtitle: {
      fontSize: typography.lg,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 28,
    },
    hypeCta: {
      height: 56,
      backgroundColor: GOLD,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      ...shadow.md,
    },
    hypeCtaText: {
      fontSize: typography.md,
      fontWeight: typography.bold,
      color: "#FFFFFF",
      letterSpacing: -0.2,
    },
    // ─── Building / progress ─────────────────────────────────────────────────
    buildingCenter: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
    },
    buildTitle: {
      fontSize: typography.xl,
      fontWeight: typography.bold,
      color: colors.text,
      letterSpacing: -0.3,
      marginBottom: spacing.sm,
      textAlign: "center",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    buildSubtitle: {
      fontSize: typography.base,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
    },
    buildError: {
      fontSize: typography.sm,
      color: colors.danger,
      textAlign: "center",
      marginTop: spacing.md,
      lineHeight: 20,
    },
    retryBtn: {
      marginTop: spacing.lg,
      height: 48,
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.md,
    },
    retryBtnText: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: colors.primaryText,
    },
  });
}
