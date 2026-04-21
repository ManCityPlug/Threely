import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  TextInput,
  Animated,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { SwipeNavigator } from "@/components/SwipeNavigator";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { goalsApi, profileApi, tasksApi, type Goal } from "@/lib/api";
import { GoalCard } from "@/components/GoalCard";
import { GoalTemplates } from "@/components/GoalTemplates";
import { MOCK_TUTORIAL_GOAL } from "@/lib/mock-tutorial-data";
import { SkeletonCard } from "@/components/Skeleton";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/lib/theme";
import { useSubscription } from "@/lib/subscription-context";
import { useWalkthroughRegistry } from "@/lib/walkthrough-registry";
import { cancelAllNotifications } from "@/lib/notifications";
import Paywall from "@/components/Paywall";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";
import {
  FUNNEL_STEPS,
  EFFORT_TO_MINUTES,
  EFFORT_TO_INTENSITY,
  buildGoalText,
  type FunnelCategory,
} from "@/constants/goal-templates";

// iPad-friendly max content width
const MAX_CONTENT_WIDTH = 600;
const GOLD = "#D4A843";

// Animated progress bar for the building step (matches onboarding's BuildingProgressMobile)
const BUILDING_STEPS = [
  "Understanding your situation\u2026",
  "Mapping out your path\u2026",
  "Creating today's tasks\u2026",
  "Locking it in\u2026",
];

function BuildingProgressMobile({ colors }: { colors: Colors }) {
  const [stepIdx, setStepIdx] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIdx((prev) => Math.min(prev + 1, BUILDING_STEPS.length - 1));
    }, 1500);

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 6000,
      useNativeDriver: false,
    }).start();

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
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg }}>
      <Text
        style={{
          fontSize: typography.xl,
          fontWeight: typography.bold,
          color: colors.text,
          letterSpacing: -0.3,
          marginBottom: spacing.sm,
          textAlign: "center",
        }}
      >
        Threely Intelligence is building your plan{"\u2026"}
      </Text>
      <Text
        style={{
          fontSize: typography.base,
          color: colors.textSecondary,
          textAlign: "center",
          lineHeight: 22,
          marginBottom: spacing.lg,
        }}
      >
        {BUILDING_STEPS[stepIdx]}
      </Text>

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

// ─── 3-Step AddGoalFlow (mirrors apps/web/app/(app)/goals/page.tsx AddGoalFlow) ──

interface AddGoalFlowProps {
  onDone: (goal: Goal) => void;
  onClose: () => void;
  onProRequired: () => void;
}

function AddGoalFlow({ onDone, onClose, onProRequired }: AddGoalFlowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [category, setCategory] = useState<FunnelCategory | null>(null);
  const [funnelStep, setFunnelStep] = useState(0); // 0 = category, 1-n = questions
  const [answers, setAnswers] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState("");
  const fadeAnim = useRef(new Animated.Value(1)).current;

  function animateTransition(next: () => void) {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      next();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  }

  function handleCategorySelect(cat: FunnelCategory) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    animateTransition(() => {
      setCategory(cat);
      setAnswers([]);
      setSelectedPath("");
      setFunnelStep(1);
    });
  }

  function handleButtonAnswer(answer: string, path?: string) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);
    // Step 1 is always the path selector — capture path and move forward
    const nextPath = path || selectedPath;
    if (path) setSelectedPath(path);
    // Health skips the income question (step 2)
    const totalSteps = category === "health" ? 2 : 3;
    if (newAnswers.length >= totalSteps) {
      startBuild(category!, newAnswers, nextPath);
    } else if (category === "health" && funnelStep === 1) {
      // Skip from path → effort (step 3 equivalent)
      animateTransition(() => setFunnelStep(3));
    } else {
      animateTransition(() => setFunnelStep(funnelStep + 1));
    }
  }

  function handleBack() {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (funnelStep === 1) {
      animateTransition(() => {
        setCategory(null);
        setAnswers([]);
        setSelectedPath("");
        setFunnelStep(0);
      });
    } else if (funnelStep > 1) {
      animateTransition(() => {
        setAnswers((prev) => prev.slice(0, -1));
        const prevStep = category === "health" && funnelStep === 3 ? 1 : funnelStep - 1;
        setFunnelStep(prevStep);
      });
    }
  }

  async function startBuild(cat: FunnelCategory, allAnswers: string[], path: string) {
    setBuilding(true);
    setBuildError("");

    const goalText = buildGoalText(cat, allAnswers, path);
    const effortAnswer = cat === "health" ? allAnswers[1] : allAnswers[2];
    const effortKey = (effortAnswer ?? "moderate").toLowerCase();
    const dailyMinutes = EFFORT_TO_MINUTES[effortKey] ?? 60;
    const intensity = EFFORT_TO_INTENSITY[effortKey] ?? 2;

    try {
      // 1. Parse the goal
      const parsed = await goalsApi.parse(goalText);

      // 2. Save profile preferences
      await profileApi.save({ dailyTimeMinutes: dailyMinutes, intensityLevel: intensity });

      // 3. Create the goal — category field stores the library path id
      const { goal } = await goalsApi.create(goalText, {
        rawInput: goalText,
        structuredSummary: parsed.structured_summary ?? undefined,
        category: path,
        deadline: parsed.deadline_detected ?? undefined,
        dailyTimeMinutes: dailyMinutes,
        intensityLevel: intensity,
        workDays:
          parsed.work_days_detected && parsed.work_days_detected.length > 0
            ? parsed.work_days_detected
            : [1, 2, 3, 4, 5, 6, 7],
      });

      // 4. Generate tasks
      await tasksApi.generate(goal.id);

      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone(goal);
    } catch (e) {
      if (e instanceof Error && e.message?.includes("pro_required")) {
        onProRequired();
      } else {
        setBuildError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
        setBuilding(false);
      }
    }
  }

  const currentStepConfig =
    category && funnelStep >= 1 && funnelStep <= 3 ? FUNNEL_STEPS[category][funnelStep - 1] : null;

  return (
    <View style={[styles.addFlowOverlay, { paddingTop: insets.top }]}>
      {/* Building state */}
      {building && (
        <View style={{ flex: 1 }}>
          <BuildingProgressMobile colors={colors} />
          {buildError ? (
            <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
              <Text style={{ color: colors.danger, textAlign: "center", marginBottom: spacing.md }}>
                {buildError}
              </Text>
              <TouchableOpacity
                style={styles.continueBtn}
                onPress={() => {
                  if (category) startBuild(category, answers, selectedPath);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.continueBtnText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      )}

      {/* Category picker */}
      {!building && funnelStep === 0 && (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <GoalTemplates onSelect={handleCategorySelect} onClose={onClose} />
        </Animated.View>
      )}

      {/* Steps 1-3: Funnel questions */}
      {!building && funnelStep >= 1 && funnelStep <= 3 && currentStepConfig && (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {/* Header: Back button */}
          <View style={styles.funnelHeader}>
            <TouchableOpacity
              onPress={handleBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
              style={styles.backBtnWrap}
            >
              <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            <View style={{ width: 60 }} />
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
          >
            <ScrollView
              contentContainerStyle={styles.stepScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Question + progress dots */}
              <Text style={styles.stepTitle}>{currentStepConfig.question}</Text>
              <View style={styles.progressDots}>
                {[1, 2, 3].map((dot) => (
                  <View
                    key={dot}
                    style={[
                      styles.dot,
                      dot <= funnelStep ? styles.dotActive : styles.dotInactive,
                    ]}
                  />
                ))}
              </View>

              {/* Button-style answers (MC only — no free text) */}
              {currentStepConfig.buttons && (
                <View style={styles.optionList}>
                  {currentStepConfig.buttons.map((btn) => (
                    <TouchableOpacity
                      key={btn.label}
                      style={styles.optionBtn}
                      onPress={() => handleButtonAnswer(btn.label, btn.path || undefined)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.optionBtnText}>{btn.label}</Text>
                      {btn.description && (
                        <Text style={styles.optionBtnSub}>{btn.description}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function GoalsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 768;
  const router = useRouter();
  const { isLimitedMode, walkthroughActive, refreshSubscription } = useSubscription();
  const { register, registerScroll } = useWalkthroughRegistry();

  const [showPaywall, setShowPaywall] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const hasLoadedOnce = useRef(false);

  const loadGoals = useCallback(async () => {
    try {
      const res = await goalsApi.list();
      // Active (non-paused) goals only
      setGoals(res.goals.filter((g) => !g.isPaused));
    } catch (e) {
      console.warn("Goals load error", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnce.current) {
        hasLoadedOnce.current = true;
        loadGoals().finally(() => setLoading(false));
      } else {
        loadGoals();
      }
    }, [loadGoals])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadGoals();
    setRefreshing(false);
  }, [loadGoals]);

  function openAddFlow() {
    // Allow first goal free — only gate if user already has goals
    if (isLimitedMode && !walkthroughActive && goals.length > 0) {
      setShowPaywall(true);
      return;
    }
    // 3-goal limit
    if (goals.length >= 3) {
      Alert.alert(
        "3 Goals. Total Focus.",
        "Threely gives you 3 tasks per goal, per day \u2014 designed for deep focus and real progress. More than 3 active goals spreads you too thin.\n\nPause or complete a goal to make room for a new one.",
        [{ text: "Got it", style: "default" }]
      );
      return;
    }
    setShowAdd(true);
  }

  function handleGoalCreated(goal: Goal) {
    setShowAdd(false);
    setGoals((prev) => [goal, ...prev]);
    // Remember which goal was just created so the Today tab focuses on it.
    AsyncStorage.setItem(
      `@threely_focus_${new Date().toLocaleDateString("en-CA")}`,
      goal.id
    ).catch(() => {});
    // Navigate to Today tab so the user sees their freshly generated tasks.
    router.push("/(tabs)");
  }

  async function handleDelete(goal: Goal) {
    Alert.alert(
      "Delete this goal?",
      "This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await goalsApi.delete(goal.id);
              setGoals((prev) => prev.filter((g) => g.id !== goal.id));
              cancelAllNotifications().catch(() => {});
              try {
                const keys = await AsyncStorage.getAllKeys();
                const orphaned = keys.filter(
                  (k) =>
                    k.startsWith(`@threely_started_${goal.id}_`) ||
                    k.includes(`_${goal.id}_d`)
                );
                if (orphaned.length > 0) await AsyncStorage.multiRemove(orphaned);
              } catch {
                // best-effort cleanup
              }
            } catch (e) {
              Alert.alert(
                "Error",
                e instanceof Error ? e.message : "Failed to delete goal"
              );
            }
          },
        },
      ]
    );
  }

  // During tutorial walkthrough, always use mock data for consistent spotlight targets
  const effectiveGoals = walkthroughActive ? [MOCK_TUTORIAL_GOAL] : goals;
  const wideContentStyle = isWide
    ? ({ maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" as const, width: "100%" as const })
    : undefined;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={[styles.headerRow, wideContentStyle]}>
          <View>
            <Text style={styles.title}>Goals</Text>
            <Text style={styles.subtitle}>Loading...</Text>
          </View>
        </View>
        <View style={[{ paddingHorizontal: spacing.lg, gap: spacing.sm }, wideContentStyle]}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SwipeNavigator currentIndex={1}>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Header */}
        <View style={[styles.headerRow, wideContentStyle]}>
          <View>
            <Text style={styles.title}>Goals</Text>
            <Text style={styles.subtitle}>
              {effectiveGoals.length} active
            </Text>
          </View>
          <TouchableOpacity style={styles.fab} onPress={openAddFlow} activeOpacity={0.85}>
            <Ionicons name="add" size={24} color={colors.primaryText} />
          </TouchableOpacity>
        </View>

        {/* Goal list */}
        <ScrollView
          ref={(r) => registerScroll("goals-scroll", r)}
          contentContainerStyle={[styles.scroll, wideContentStyle]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {effectiveGoals.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>{"\u{1F680}"}</Text>
              <Text style={styles.emptyTitle}>What will you achieve?</Text>
              <Text style={styles.emptySubtitle}>
                Set a goal and your AI coach will break it into 3 small daily tasks — the proven way to make real progress.
              </Text>
              <Button title="Create your first goal" onPress={openAddFlow} style={styles.emptyBtn} />
            </View>
          ) : (
            effectiveGoals.map((goal, goalIdx) => {
              const isMock = goal.id === MOCK_TUTORIAL_GOAL.id;
              const card = (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onPress={() => {
                    if (!isMock) {
                      AsyncStorage.setItem("@threely_switch_goal", goal.id).catch(() => {});
                      router.push("/(tabs)");
                    }
                  }}
                  onDelete={isMock ? undefined : () => handleDelete(goal)}
                />
              );
              return goalIdx === 0 ? (
                <View
                  key={goal.id}
                  ref={(r) => register("first-goal-card", r)}
                  collapsable={false}
                >
                  {card}
                </View>
              ) : (
                card
              );
            })
          )}
        </ScrollView>

        {/* Add-goal funnel overlay */}
        {showAdd && (
          <AddGoalFlow
            onDone={handleGoalCreated}
            onClose={() => setShowAdd(false)}
            onProRequired={() => {
              setShowAdd(false);
              setShowPaywall(true);
            }}
          />
        )}

        <Paywall
          visible={showPaywall}
          onDismiss={() => {
            setShowPaywall(false);
            refreshSubscription();
          }}
        />
      </SafeAreaView>
    </SwipeNavigator>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    title: {
      fontSize: typography.xxl,
      fontWeight: typography.bold,
      color: c.text,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: typography.sm,
      color: c.textSecondary,
      marginTop: 2,
    },
    fab: {
      width: 44,
      height: 44,
      borderRadius: radius.full,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.md,
    },
    scroll: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
      gap: spacing.sm,
    },
    empty: {
      alignItems: "center",
      paddingVertical: spacing.xxl,
      paddingTop: spacing.xxl,
    },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md },
    emptyTitle: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: c.text,
      marginBottom: spacing.sm,
    },
    emptySubtitle: {
      fontSize: typography.base,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.xl,
    },
    emptyBtn: { width: "100%" },

    // ── Add-goal full-screen overlay ─────────────────────────────────────────
    addFlowOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.bg,
      zIndex: 200,
      flex: 1,
    },
    funnelHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      minHeight: 48,
    },
    backBtnWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      minHeight: 44,
      paddingRight: spacing.sm,
    },
    backText: {
      fontSize: typography.base,
      color: c.textSecondary,
      fontWeight: typography.medium,
    },

    // ── Funnel step layout ───────────────────────────────────────────────────
    stepScroll: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    stepTitle: {
      fontSize: typography.xxl,
      fontWeight: typography.bold,
      color: c.text,
      letterSpacing: -0.5,
      lineHeight: 38,
      textAlign: "center",
      marginBottom: spacing.md,
    },
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
      backgroundColor: c.border,
    },

    optionList: {
      gap: spacing.md,
    },
    optionBtn: {
      backgroundColor: c.card,
      borderRadius: radius.xl,
      borderWidth: 1.5,
      borderColor: c.border,
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
      color: c.text,
    },
    optionBtnSub: {
      fontSize: typography.sm,
      color: c.textSecondary,
      marginTop: 2,
      textAlign: "center",
    },

    textInput: {
      backgroundColor: c.card,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.md,
      fontSize: typography.base,
      color: c.text,
      lineHeight: 22,
      minHeight: 100,
    },

    continueBtn: {
      height: 56,
      backgroundColor: c.primary,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.md,
    },
    continueBtnDisabled: {
      backgroundColor: c.border,
      ...shadow.sm,
    },
    continueBtnText: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: c.primaryText,
      letterSpacing: -0.2,
    },
    continueBtnTextDisabled: {
      color: c.textTertiary,
    },
  });
}
