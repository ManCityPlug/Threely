import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
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

type Category = "business" | "health" | "other";
type EffortLevel = "Mild" | "Moderate" | "Heavy";

const EFFORT_MAP: Record<EffortLevel, { dailyTimeMinutes: number; intensityLevel: number }> = {
  Mild: { dailyTimeMinutes: 30, intensityLevel: 1 },
  Moderate: { dailyTimeMinutes: 60, intensityLevel: 2 },
  Heavy: { dailyTimeMinutes: 120, intensityLevel: 3 },
};

const BUILDING_STEPS = [
  "Understanding your situation…",
  "Mapping out your path…",
  "Creating today's tasks…",
  "Locking it in…",
];

// ─── BuildingProgressMobile ──────────────────────────────────────────────────

function BuildingProgressMobile({ styles, colors }: { styles: any; colors: Colors }) {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIdx((prev) => Math.min(prev + 1, BUILDING_STEPS.length - 1));
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.buildingCenter}>
      <Text style={styles.buildTitle}>Threely Intelligence is building your plan…</Text>
      <Text style={styles.buildSubtitle}>{BUILDING_STEPS[stepIdx]}</Text>
      <View style={{ flexDirection: "row", gap: 6, marginTop: spacing.md, marginBottom: spacing.sm }}>
        {BUILDING_STEPS.map((_: string, i: number) => (
          <View key={i} style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: i <= stepIdx ? colors.primary : colors.border,
          }} />
        ))}
      </View>
      <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} />
    </View>
  );
}

// ─── Goal text builder ───────────────────────────────────────────────────────

function buildGoalText(
  category: Category,
  answers: { q1: string; effort: EffortLevel; q3: string },
): string {
  const effortLower = answers.effort.toLowerCase();
  if (category === "business") {
    const idea = answers.q3.trim() || "no specific idea yet";
    return `I want to make ${answers.q1} per month. I can put in ${effortLower} work. My business idea: ${idea}`;
  }
  if (category === "health") {
    const target = answers.q3.trim() || "no specific target";
    return `I want to ${answers.q1.toLowerCase()}. I can put in ${effortLower} work. My target: ${target}`;
  }
  // other
  const details = answers.q3.trim() || "no specific details";
  return `My goal: ${answers.q1}. I can put in ${effortLower} work. Details: ${details}`;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Funnel state
  const [category, setCategory] = useState<Category | null>(null);
  const [funnelStep, setFunnelStep] = useState(0); // 0 = category, 1-3 = questions
  const [q1Answer, setQ1Answer] = useState("");
  const [effortLevel, setEffortLevel] = useState<EffortLevel | null>(null);
  const [q3Input, setQ3Input] = useState("");

  // For "Other" category, step 1 uses a text input
  const [otherGoalInput, setOtherGoalInput] = useState("");

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
        // Go back to category picker
        setCategory(null);
        setFunnelStep(0);
        setQ1Answer("");
        setEffortLevel(null);
        setQ3Input("");
        setOtherGoalInput("");
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

  function selectQ1(answer: string) {
    setQ1Answer(answer);
    goNext();
  }

  function selectEffort(level: EffortLevel) {
    setEffortLevel(level);
    goNext();
  }

  // ─── Build plan ────────────────────────────────────────────────────────────

  async function startBuild() {
    if (!category || !effortLevel) return;

    const q1 = category === "other" ? otherGoalInput.trim() : q1Answer;
    const goalText = buildGoalText(category, { q1, effort: effortLevel, q3: q3Input });
    const { dailyTimeMinutes, intensityLevel } = EFFORT_MAP[effortLevel];

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
      // 1. Parse goal
      const parsed = await withRetry(() => goalsApi.parse(goalText));

      // 2. Save profile
      await withRetry(() => profileApi.save({ dailyTimeMinutes, intensityLevel }));

      // 3. Create goal
      const goalTitle = parsed.short_title ?? goalText.slice(0, 40);
      const goalResult = await withRetry(() => goalsApi.create(goalTitle, {
        rawInput: goalText,
        structuredSummary: parsed.structured_summary ?? undefined,
        category: parsed.category ?? category,
        deadline: parsed.deadline_detected ?? undefined,
        dailyTimeMinutes,
        intensityLevel,
        workDays: parsed.work_days_detected ?? [1, 2, 3, 4, 5, 6, 7],
        onboarding: true,
      }));

      // 4. Generate tasks
      await withRetry(() => tasksApi.generate(goalResult.goal.id, { onboarding: true }));

      // 5. Mark onboarded
      const uid = userId ?? (await supabase.auth.getUser()).data.user?.id;
      if (uid) {
        await AsyncStorage.setItem(`@threely_onboarding_done_${uid}`, "true");
      }

      setBuildDone(true);
    } catch (e: unknown) {
      setBuildError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  }

  function handleFinishHype() {
    if (!category || !effortLevel) return;

    setShowHype(true);
    // Start building in the background
    buildPromiseRef.current = startBuild();
  }

  // After step 3, go to hype screen
  function handleStep3Continue() {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateTransition(() => handleFinishHype());
  }

  function handleStep3Skip() {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQ3Input("");
    animateTransition(() => handleFinishHype());
  }

  // ─── Progress dots ─────────────────────────────────────────────────────────

  function ProgressDots({ current }: { current: number }) {
    return (
      <View style={styles.progressDots}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === current ? styles.dotActive : styles.dotInactive,
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
            onPress={() => selectCategory("business")}
            activeOpacity={0.8}
          >
            <Text style={styles.categoryEmoji}>🤑</Text>
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

          <TouchableOpacity
            style={styles.categoryBtn}
            onPress={() => selectCategory("other")}
            activeOpacity={0.8}
          >
            <Text style={styles.categoryEmoji}>✨</Text>
            <View style={styles.categoryTextWrap}>
              <Text style={styles.categoryLabel}>Other</Text>
              <Text style={styles.categoryDesc}>Set any goal</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Render: Step 1 ────────────────────────────────────────────────────────

  function renderStep1() {
    if (category === "business") {
      return (
        <View style={styles.stepContainer}>
          <ProgressDots current={1} />
          <Text style={styles.stepTitle}>How much do you want to make per month?</Text>
          <View style={styles.optionList}>
            {["$500", "$1K-$5K", "$10K+"].map((opt) => (
              <TouchableOpacity
                key={opt}
                style={styles.optionBtn}
                onPress={() => selectQ1(opt)}
                activeOpacity={0.8}
              >
                <Text style={styles.optionBtnText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    if (category === "health") {
      return (
        <View style={styles.stepContainer}>
          <ProgressDots current={1} />
          <Text style={styles.stepTitle}>What do you want?</Text>
          <View style={styles.optionList}>
            {["Lose weight", "Glow up", "Gain more muscle"].map((opt) => (
              <TouchableOpacity
                key={opt}
                style={styles.optionBtn}
                onPress={() => selectQ1(opt)}
                activeOpacity={0.8}
              >
                <Text style={styles.optionBtnText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    // Other
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <View style={styles.stepContainer}>
          <ProgressDots current={1} />
          <Text style={styles.stepTitle}>What's your goal?</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Learn to play guitar"
            placeholderTextColor={colors.textTertiary}
            value={otherGoalInput}
            onChangeText={setOtherGoalInput}
            autoFocus
            returnKeyType="done"
            multiline
            textAlignVertical="top"
          />
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.continueBtn, !otherGoalInput.trim() && styles.continueBtnDisabled]}
              onPress={() => {
                if (otherGoalInput.trim()) {
                  setQ1Answer(otherGoalInput.trim());
                  goNext();
                }
              }}
              activeOpacity={otherGoalInput.trim() ? 0.85 : 1}
            >
              <Text style={[styles.continueBtnText, !otherGoalInput.trim() && styles.continueBtnTextDisabled]}>
                Continue
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ─── Render: Step 2 (effort level) ─────────────────────────────────────────

  function renderStep2() {
    return (
      <View style={styles.stepContainer}>
        <ProgressDots current={2} />
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
              <Text style={styles.optionBtnSub}>
                {opt === "Mild" ? "~30 min/day" : opt === "Moderate" ? "~1 hr/day" : "~2 hrs/day"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // ─── Render: Step 3 (text input) ───────────────────────────────────────────

  function renderStep3() {
    const prompt =
      category === "business"
        ? "Got a business idea?"
        : category === "health"
          ? "Do you have a specific target goal?"
          : "Anything specific?";

    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <View style={styles.stepContainer}>
          <ProgressDots current={3} />
          <Text style={styles.stepTitle}>{prompt}</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Type here (optional)"
            placeholderTextColor={colors.textTertiary}
            value={q3Input}
            onChangeText={setQ3Input}
            autoFocus
            multiline
            textAlignVertical="top"
          />
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.continueBtn}
              onPress={q3Input.trim() ? handleStep3Continue : handleStep3Skip}
              activeOpacity={0.85}
            >
              <Text style={styles.continueBtnText}>
                {q3Input.trim() ? "Continue" : "Skip"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
              setBuildError("");
              buildPromiseRef.current = startBuild();
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
