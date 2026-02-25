import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  AppState,
  TouchableOpacity,
  Animated,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import {
  tasksApi,
  goalsApi,
  profileApi,
  reviewsApi,
  insightsApi,
  statsApi,
  focusApi,
  type DailyTask,
  type Goal,
  type TaskItem,
  type GoalStat,
} from "@/lib/api";
import { TaskCard } from "@/components/TaskCard";
import { Button } from "@/components/ui/Button";
import { SkeletonCard } from "@/components/Skeleton";
import { Confetti } from "@/components/Confetti";
import { useToast } from "@/lib/toast";
import { useStaggeredEntrance, celebrationHaptic } from "@/lib/animations";
import { scheduleNotifications, onTaskCompleted, type NotifContext } from "@/lib/notifications";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(d: Date) {
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

type GoalSelection = string | "shuffle";

function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Review types ─────────────────────────────────────────────────────────────

type DifficultyRating = "too_easy" | "just_right" | "challenging" | "overwhelming";

const DIFFICULTY_OPTIONS: { value: DifficultyRating; emoji: string; label: string }[] = [
  { value: "too_easy", emoji: "😴", label: "Too easy" },
  { value: "just_right", emoji: "✅", label: "Just right" },
  { value: "challenging", emoji: "💪", label: "Challenging" },
  { value: "overwhelming", emoji: "🔥", label: "Overwhelming" },
];

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function stalenessLabel(days: number | null): string {
  if (days === null) return "Never worked on";
  if (days === 0) return "Worked today";
  if (days === 1) return "Worked yesterday";
  return `${days}d ago`;
}

type MixItem = { dailyTaskId: string; goalTitle: string; task: TaskItem };

function computeMixItems(dailyTasks: DailyTask[]): MixItem[] {
  const result: MixItem[] = [];
  let round = 0;
  while (result.length < 3) {
    let addedThisRound = 0;
    for (const dt of dailyTasks) {
      const tasks = (Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : []).slice(-3);
      if (tasks[round]) {
        result.push({
          dailyTaskId: dt.id,
          goalTitle: dt.goal?.title ?? "",
          task: tasks[round],
        });
        addedThisRound++;
        if (result.length >= 3) break;
      }
    }
    if (addedThisRound === 0) break;
    round++;
  }
  return result;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showToast } = useToast();

  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<DailyTask[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalStats, setGoalStats] = useState<GoalStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [selectedGoal, setSelectedGoal] = useState<GoalSelection>("shuffle");
  const [dailyTimeMinutes, setDailyTimeMinutes] = useState(0);
  const [goalPickerVisible, setGoalPickerVisible] = useState(false);
  const [goalPickerShownToday, setGoalPickerShownToday] = useState(false);
  const [overdueBannerDismissed, setOverdueBannerDismissed] = useState(false);
  // ─── Review state ──────────────────────────────────────────────────────────
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewStep, setReviewStep] = useState<1 | 2>(1);
  const [reviewDifficulty, setReviewDifficulty] = useState<DifficultyRating | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewDailyTaskId, setReviewDailyTaskId] = useState<string | null>(null);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // ─── Insight state ─────────────────────────────────────────────────────────
  const [insightText, setInsightText] = useState("");
  const [showInsightCard, setShowInsightCard] = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);

  // ─── Confetti state ─────────────────────────────────────────────────────────
  const [confettiActive, setConfettiActive] = useState(false);

  const hasLoadedOnce = useRef(false);
  const reviewShownForDate = useRef<string>("");

  const loadData = useCallback(async () => {
    try {
      const todayKey = `@threely_focus_${new Date().toISOString().slice(0, 10)}`;
      const bannerKey = `@threely_overdue_banner_${new Date().toISOString().slice(0, 10)}`;
      const [tasksRes, goalsRes, profileRes, statsRes, focusRes, { data: { user } }, savedNickname, savedFocus, bannerDismissed] = await Promise.all([
        tasksApi.today(true),
        goalsApi.list(),
        profileApi.get().catch(() => ({ profile: null })),
        statsApi.get().catch(() => ({ totalCompleted: 0, activeGoals: 0, streak: 0, goalStats: [] })),
        focusApi.get().catch(() => ({ focus: null })),
        supabase.auth.getUser(),
        AsyncStorage.getItem("@threely_nickname"),
        AsyncStorage.getItem(todayKey),
        AsyncStorage.getItem(bannerKey),
      ]);
      setDailyTasks(tasksRes.dailyTasks);
      setOverdueTasks(tasksRes.overdueTasks ?? []);
      setGoals(goalsRes.goals);
      setGoalStats(statsRes.goalStats ?? []);
      if (profileRes.profile) setDailyTimeMinutes(profileRes.profile.dailyTimeMinutes);
      if (user?.email) setUserEmail(user.email);
      if (savedNickname) setNickname(savedNickname);
      if (bannerDismissed) setOverdueBannerDismissed(true);

      // Restore saved focus: prefer server, fallback to AsyncStorage
      const serverFocus = focusRes.focus?.focusGoalId;
      const restoredFocus = serverFocus ?? savedFocus;
      if (restoredFocus) {
        setSelectedGoal(restoredFocus as GoalSelection);
        setGoalPickerShownToday(true);
        // Sync AsyncStorage with server
        if (serverFocus && !savedFocus) {
          await AsyncStorage.setItem(todayKey, serverFocus);
        }
      } else if (goalsRes.goals.length > 0) {
        // Default to first goal instead of "Mix all goals"
        setSelectedGoal(goalsRes.goals[0].id);
      }
    } catch (e) {
      console.error("loadData error", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnce.current) {
        hasLoadedOnce.current = true;
        loadData().finally(() => setLoading(false));
      } else {
        loadData();
      }
      // Check if profile "Change focus" flag was set
      AsyncStorage.getItem("@threely_open_goal_picker").then(val => {
        if (val) {
          AsyncStorage.removeItem("@threely_open_goal_picker");
          setGoalPickerVisible(true);
        }
      });
    }, [loadData])
  );

  // Refetch when app comes to foreground (sync across devices)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && hasLoadedOnce.current) loadData();
    });
    return () => sub.remove();
  }, [loadData]);

  useMemo(() => {
    if (goals.length >= 1 && !selectedGoal) setSelectedGoal(goals[0].id);
  }, [goals.length]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ─── Derived state ─────────────────────────────────────────────────────────

  const mixItems = useMemo<MixItem[]>(() => {
    if (selectedGoal !== "shuffle") return [];
    return computeMixItems(dailyTasks);
  }, [dailyTasks, selectedGoal]);

  const visibleTasks: DailyTask[] =
    selectedGoal === "shuffle"
      ? []
      : dailyTasks.filter((dt) => dt.goalId === selectedGoal);

  const allTaskItems =
    selectedGoal === "shuffle"
      ? mixItems.map((m) => m.task)
      : visibleTasks.flatMap((dt) => (Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : []));

  const displayVisibleTasks: DailyTask[] = visibleTasks.map((dt) => ({
    ...dt,
    tasks: (Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : []).slice(-3),
  }));

  const newTaskItems =
    selectedGoal === "shuffle"
      ? mixItems.map((m) => m.task)
      : displayVisibleTasks.flatMap((dt) => (Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : []));

  const allDone = newTaskItems.length > 0 && newTaskItems.every((t) => t.isCompleted);
  const completedCount = newTaskItems.filter((t) => t.isCompleted).length;
  const totalCount = newTaskItems.length;

  const totalEstimatedMinutes = (() => {
    // Use only the displayed/sliced tasks, not all accumulated tasks
    const displayed = selectedGoal === "shuffle"
      ? mixItems.map(m => m.task)
      : displayVisibleTasks.flatMap(dt => Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : []);
    return displayed
      .filter(t => !t.isCompleted)
      .reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
  })();

  const selectedLabel =
    selectedGoal === "shuffle"
      ? "Mix all goals"
      : goals.find((g) => g.id === selectedGoal)?.title ?? "Select goal";

  const hasAnyTasks = goals.length > 0;
  const hasVisibleTasks =
    selectedGoal === "shuffle" ? mixItems.length > 0 : visibleTasks.length > 0;

  // Overdue tasks for current goal
  const displayedOverdue = useMemo(() => {
    const tasks: { dailyTaskId: string; goalTitle: string; task: TaskItem }[] = [];
    const relevantOverdue = selectedGoal === "shuffle"
      ? overdueTasks
      : overdueTasks.filter(dt => dt.goalId === selectedGoal);
    for (const dt of relevantOverdue) {
      for (const task of (Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : [])) {
        if (!task.isCompleted && !task.isSkipped) {
          tasks.push({ dailyTaskId: dt.id, goalTitle: dt.goal?.title ?? "", task });
        }
      }
    }
    return tasks;
  }, [overdueTasks, selectedGoal]);

  // Overdue count on OTHER goals (for banner)
  const otherGoalsOverdueCount = useMemo(() => {
    if (selectedGoal === "shuffle") return 0;
    return overdueTasks
      .filter(dt => dt.goalId !== selectedGoal)
      .reduce((sum, dt) => {
        const items = Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : [];
        return sum + items.filter(t => !t.isCompleted && !t.isSkipped).length;
      }, 0);
  }, [overdueTasks, selectedGoal]);

  // Build notification context from current state
  const buildNotifContext = useCallback((): NotifContext => {
    const focusGoalName = selectedGoal === "shuffle"
      ? null
      : goals.find(g => g.id === selectedGoal)?.title ?? null;
    const incomplete = newTaskItems.filter(t => !t.isCompleted && !t.isSkipped);
    return {
      focusGoalName,
      totalTimeMinutes: incomplete.reduce((s, t) => s + (t.estimated_minutes || 0), 0),
      incompleteCount: incomplete.length,
      allDone,
      staleGoals: goalStats
        .map(s => ({ name: s.title, daysSince: daysSince(s.lastWorkedAt) ?? 999 }))
        .filter(s => s.daysSince >= 7),
    };
  }, [selectedGoal, goals, newTaskItems, allDone, goalStats]);

  // Schedule notifications after data loads
  useEffect(() => {
    if (!loading && goals.length > 0) {
      scheduleNotifications(buildNotifContext()).catch(() => {});
    }
  }, [loading, buildNotifContext, goals.length]);

  // Trigger confetti when all tasks become done
  const prevAllDone = useRef(false);
  useEffect(() => {
    if (allDone && !prevAllDone.current && newTaskItems.length > 0) {
      setConfettiActive(true);
      celebrationHaptic();
      setTimeout(() => setConfettiActive(false), 2500);
    }
    prevAllDone.current = allDone;
  }, [allDone, newTaskItems.length]);

  // Review is now triggered by "Give me more" button — no auto-open

  // ─── Goal picker ───────────────────────────────────────────────────────────

  async function persistFocus(val: GoalSelection) {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelectedGoal(val);
    setGoalPickerVisible(false);
    setGoalPickerShownToday(true);
    // Persist locally + server
    const todayKey = `@threely_focus_${new Date().toISOString().slice(0, 10)}`;
    await AsyncStorage.setItem(todayKey, val);
    // Compute shuffle task IDs if applicable
    const shuffleIds = val === "shuffle"
      ? computeMixItems(dailyTasks).map(m => m.task.id)
      : undefined;
    focusApi.save(val, shuffleIds).catch(() => {});

    // Auto-generate tasks if new goal has none for today
    if (val !== "shuffle") {
      const hasTasks = dailyTasks.some(dt => dt.goalId === val);
      if (!hasTasks) {
        setGenerating(true);
        try {
          const res = await tasksApi.generate(val, { focusShifted: true });
          setDailyTasks(prev => [...prev, ...res.dailyTasks]);
        } catch {
          // silently fail
        } finally {
          setGenerating(false);
        }
      }
    }
  }

  function selectGoal(val: GoalSelection) {
    if (goalPickerShownToday) {
      // Already set a focus today — confirm before switching
      Alert.alert(
        "Change focus?",
        "Switching your daily focus will update how today's progress is tracked.",
        [
          { text: "Cancel", style: "cancel", onPress: () => setGoalPickerVisible(false) },
          { text: "Change", onPress: () => persistFocus(val) },
        ]
      );
    } else {
      persistFocus(val);
    }
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handleFirstGenerate() {
    if (goals.length === 0) {
      router.navigate("/(tabs)/goals");
      return;
    }
    setGenerating(true);
    try {
      const goalId = selectedGoal === "shuffle" ? undefined : selectedGoal;
      const res = await tasksApi.generate(goalId);
      setDailyTasks((prev) => {
        const newIds = new Set(res.dailyTasks.map((dt) => dt.id));
        const updated = [
          ...prev.filter(
            (dt) => !newIds.has(dt.id) && res.dailyTasks.every((r) => r.goalId !== dt.goalId)
          ),
          ...res.dailyTasks,
        ];
        // Save shuffle task IDs after generation
        if (selectedGoal === "shuffle") {
          const shuffleIds = computeMixItems(updated).map(m => m.task.id);
          focusApi.save("shuffle", shuffleIds).catch(() => {});
        }
        return updated;
      });
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to generate tasks", "error");
    } finally {
      setGenerating(false);
    }
  }

  function handleGiveMoreTasks() {
    if (!allDone) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Force review before generating more tasks
    const targetDt = selectedGoal === "shuffle" ? dailyTasks[0] : visibleTasks[0];
    if (targetDt) {
      setReviewDailyTaskId(targetDt.id);
      setReviewOpen(true);
    }
  }

  async function handleToggleTask(dailyTaskId: string, taskItemId: string, isCompleted: boolean) {
    try {
      const res = await tasksApi.completeItem(dailyTaskId, taskItemId, isCompleted);
      setDailyTasks((prev) =>
        prev.map((dt) => (dt.id === dailyTaskId ? res.dailyTask : dt))
      );
      setOverdueTasks((prev) =>
        prev.map((dt) => (dt.id === dailyTaskId ? res.dailyTask : dt))
      );
      // Update notifications after task completion
      if (isCompleted) {
        onTaskCompleted(buildNotifContext()).catch(() => {});
      }
    } catch {
      showToast("Couldn't update task. Try again.", "error");
    }
  }

  async function handleSkipTask(dailyTaskId: string, taskItemId: string) {
    try {
      const res = await tasksApi.skip(dailyTaskId, taskItemId);
      setOverdueTasks((prev) =>
        prev.map((dt) => (dt.id === dailyTaskId ? res.dailyTask : dt))
      );
    } catch {
      showToast("Couldn't dismiss task. Try again.", "error");
    }
  }

  async function handleRescheduleTask(dailyTaskId: string, taskItemId: string) {
    try {
      const res = await tasksApi.reschedule(dailyTaskId, taskItemId);
      setOverdueTasks((prev) =>
        prev.map((dt) => (dt.id === dailyTaskId ? res.dailyTask : dt))
      );
      showToast("Task moved to tomorrow", "success");
    } catch {
      showToast("Couldn't reschedule task. Try again.", "error");
    }
  }

  async function handleEditTask(dailyTaskId: string, taskItemId: string, editData: { task?: string; description?: string }) {
    try {
      const res = await tasksApi.editItem(dailyTaskId, taskItemId, editData);
      setDailyTasks((prev) =>
        prev.map((dt) => (dt.id === dailyTaskId ? res.dailyTask : dt))
      );
      showToast("Task updated", "success");
    } catch {
      showToast("Couldn't update task. Try again.", "error");
    }
  }

  async function handleRefineTask(dailyTaskId: string, taskItemId: string, userRequest: string) {
    try {
      const res = await tasksApi.refineItem(dailyTaskId, taskItemId, userRequest);
      setDailyTasks((prev) =>
        prev.map((dt) => (dt.id === dailyTaskId ? res.dailyTask : dt))
      );
      showToast("Task refined by AI", "success");
    } catch {
      showToast("Couldn't refine task. Try again.", "error");
    }
  }

  async function handleCompleteAll() {
    const incompleteTasks = newTaskItems.filter((t) => !t.isCompleted);
    if (incompleteTasks.length < 2) return;

    try {
      for (const task of incompleteTasks) {
        // Find the dailyTaskId for this task
        let dtId: string | undefined;
        if (selectedGoal === "shuffle") {
          const mix = mixItems.find((m) => m.task.id === task.id);
          dtId = mix?.dailyTaskId;
        } else {
          for (const dt of visibleTasks) {
            const items = Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : [];
            if (items.find((t) => t.id === task.id)) {
              dtId = dt.id;
              break;
            }
          }
        }
        if (dtId) {
          const res = await tasksApi.completeItem(dtId, task.id, true);
          setDailyTasks((prev) =>
            prev.map((dt) => (dt.id === dtId ? res.dailyTask : dt))
          );
        }
      }
      // Trigger confetti and haptic
      setConfettiActive(true);
      celebrationHaptic();
      showToast("All tasks completed!", "success");
      setTimeout(() => setConfettiActive(false), 2500);
    } catch {
      showToast("Couldn't complete all tasks. Try again.", "error");
    }
  }

  async function dismissOverdueBanner() {
    setOverdueBannerDismissed(true);
    const bannerKey = `@threely_overdue_banner_${new Date().toISOString().slice(0, 10)}`;
    await AsyncStorage.setItem(bannerKey, "1");
  }

  // ─── Review handlers ───────────────────────────────────────────────────────

  function closeReview() {
    setReviewOpen(false);
    setReviewStep(1);
    setReviewDifficulty(null);
    setReviewNote("");
  }

  async function handleSubmitReview() {
    if (!reviewDailyTaskId || !reviewDifficulty) return;
    setReviewSubmitting(true);
    try {
      await reviewsApi.create({
        dailyTaskId: reviewDailyTaskId,
        difficultyRating: reviewDifficulty,
        userNote: reviewNote.trim() || undefined,
      });

      closeReview();
      setReviewSubmitted(true);

      // Generate insight then auto-generate next tasks
      setInsightLoading(true);
      setShowInsightCard(true);
      try {
        const res = await insightsApi.generate(reviewDailyTaskId);
        setInsightText(res.insight);
      } catch {
        setInsightText("Great work completing your tasks today! Keep the momentum going.");
      } finally {
        setInsightLoading(false);
      }

      // Auto-generate next tasks after review
      setGenerating(true);
      try {
        const goalId = selectedGoal === "shuffle" ? undefined : selectedGoal;
        const res = await tasksApi.generate(goalId, { postReview: true });
        setDailyTasks((prev) => {
          const updatedGoalIds = new Set(res.dailyTasks.map((dt) => dt.goalId));
          const updated = [
            ...prev.filter((dt) => !updatedGoalIds.has(dt.goalId)),
            ...res.dailyTasks,
          ];
          // Re-save shuffle task IDs after regeneration
          if (selectedGoal === "shuffle") {
            const newShuffleIds = computeMixItems(updated).map(m => m.task.id);
            focusApi.save("shuffle", newShuffleIds).catch(() => {});
          }
          return updated;
        });
      } catch {
        // silently fail — insight is still shown
      } finally {
        setGenerating(false);
      }
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save review");
    } finally {
      setReviewSubmitting(false);
    }
  }

  function dismissInsight() {
    setShowInsightCard(false);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const today = new Date();
  const firstName = nickname || userEmail.split("@")[0] || "there";

  // Staggered entrance animations for task cards
  const staggerAnims = useStaggeredEntrance(loading ? 0 : newTaskItems.length);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.date}>{formatDate(today)}</Text>
              <Text style={styles.greeting}>
                {getGreeting()}, {firstName}
              </Text>
            </View>
          </View>
        </View>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Confetti overlay */}
      <Confetti active={confettiActive} />

      {/* Fixed header — outside ScrollView so it never hides under Dynamic Island */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.date}>{formatDate(today)}</Text>
            <Text style={styles.greeting}>
              {getGreeting()}, {firstName}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >

        {/* Goal selector */}
        {goals.length > 0 && (
          <View style={styles.selectorRow}>
            <View style={styles.dropdown}>
              <Text style={styles.dropdownLabel} numberOfLines={1} ellipsizeMode="tail">
                {selectedLabel}
              </Text>
              {totalEstimatedMinutes > 0 && (
                <View style={styles.taskTimeBadge}>
                  <Text style={styles.taskTimeBadgeText}>
                    {formatMinutes(totalEstimatedMinutes)}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.shufflePill}
              onPress={() => setGoalPickerVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.shuffleText}>{goals.length > 1 ? "Change" : "Select"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Progress pill */}
        {totalCount > 0 && (
          <View style={styles.progressPill}>
            <View
              style={[
                styles.progressBar,
                { width: `${Math.round((completedCount / totalCount) * 100)}%` as `${number}%` },
              ]}
            />
            <Text style={styles.progressText}>
              {completedCount}/{totalCount} tasks complete
            </Text>
          </View>
        )}

        {/* Complete All button — shown when 2+ incomplete tasks remain */}
        {newTaskItems.length > 0 && newTaskItems.filter(t => !t.isCompleted).length >= 2 && !allDone && (
          <TouchableOpacity
            style={styles.completeAllBtn}
            onPress={handleCompleteAll}
            activeOpacity={0.85}
          >
            <Text style={styles.completeAllText}>Complete all tasks</Text>
          </TouchableOpacity>
        )}

        {/* Overdue banner for other goals */}
        {otherGoalsOverdueCount > 0 && !overdueBannerDismissed && (
          <TouchableOpacity
            style={styles.overdueBanner}
            onPress={dismissOverdueBanner}
            activeOpacity={0.85}
          >
            <Text style={styles.overdueBannerText}>
              You have <Text style={{ fontWeight: typography.bold }}>{otherGoalsOverdueCount}</Text> overdue task{otherGoalsOverdueCount > 1 ? "s" : ""} on other goals
            </Text>
            <Text style={styles.overdueBannerClose}>{"\u2715"}</Text>
          </TouchableOpacity>
        )}

        {/* Overdue tasks section */}
        {displayedOverdue.length > 0 && (
          <View style={styles.overdueSection}>
            <View style={styles.overdueHeader}>
              <Text style={styles.overdueLabel}>OVERDUE</Text>
              <View style={styles.overdueBadge}>
                <Text style={styles.overdueBadgeText}>{displayedOverdue.length}</Text>
              </View>
            </View>
            {displayedOverdue.map(({ dailyTaskId, goalTitle, task }) => (
              <View key={task.id} style={styles.overdueItem}>
                {goalTitle && selectedGoal === "shuffle" ? (
                  <Text style={styles.overdueGoalChip}>{goalTitle}</Text>
                ) : null}
                <View style={styles.overdueCard}>
                  <TouchableOpacity
                    style={styles.overdueCheckbox}
                    onPress={() => handleToggleTask(dailyTaskId, task.id, true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.overdueCheckIcon}>{"\u2713"}</Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.overdueTaskTitle} numberOfLines={2}>{task.task}</Text>
                    {task.description ? (
                      <Text style={styles.overdueTaskDesc} numberOfLines={1}>{task.description}</Text>
                    ) : null}
                  </View>
                  <View style={styles.overdueActions}>
                    <TouchableOpacity
                      style={styles.overdueRescheduleBtn}
                      onPress={() => handleRescheduleTask(dailyTaskId, task.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.overdueRescheduleText}>Tomorrow</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.overdueDismissBtn}
                      onPress={() => handleSkipTask(dailyTaskId, task.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.overdueDismissText}>{"\u2715"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Insight card — shown after review submission */}
        {showInsightCard && (
          <View style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <Text style={styles.insightIcon}>✦</Text>
              <Text style={styles.insightTitle}>Coach note</Text>
            </View>
            {insightLoading ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <>
                <Text style={styles.insightText}>{insightText}</Text>
                {generating ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.xs }}>
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>Generating next tasks…</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.insightBtn}
                    onPress={dismissInsight}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.insightBtnText}>Got it</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        {/* Task sections */}
        {goals.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{"\ud83c\udfaf"}</Text>
            <Text style={styles.emptyTitle}>Get started</Text>
            <Text style={styles.emptySubtitle}>
              Create your first goal and we'll generate daily tasks to help you achieve it.
            </Text>
            <Button
              title="Create your first goal"
              onPress={() => router.navigate("/(tabs)/goals")}
              style={styles.generateBtn}
            />
          </View>
        ) : !hasVisibleTasks ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✦</Text>
            <Text style={styles.emptyTitle}>No tasks for today</Text>
            <Text style={styles.emptySubtitle}>
              Tap below to generate 3 tasks for each of your goals.
            </Text>
            <Button
              title={generating ? "Generating…" : "Generate today's tasks"}
              onPress={handleFirstGenerate}
              loading={generating}
              style={styles.generateBtn}
            />
          </View>
        ) : (
          <>
            {selectedGoal === "shuffle" ? (
              <View style={styles.section}>
                {mixItems.map(({ dailyTaskId, goalTitle, task }, idx) => (
                  <Animated.View
                    key={task.id}
                    style={[
                      styles.mixItem,
                      staggerAnims[idx] ? {
                        opacity: staggerAnims[idx],
                        transform: [{ translateY: staggerAnims[idx].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
                      } : undefined,
                    ]}
                  >
                    {goalTitle ? (
                      <Text style={styles.mixGoalChip}>{goalTitle}</Text>
                    ) : null}
                    <TaskCard
                      task={task}
                      onToggle={(isCompleted) =>
                        handleToggleTask(dailyTaskId, task.id, isCompleted)
                      }

                      onRefine={(userRequest) => handleRefineTask(dailyTaskId, task.id, userRequest)}
                    />
                  </Animated.View>
                ))}
              </View>
            ) : (
              displayVisibleTasks.map((dt) => {
                let taskIdx = 0;
                return (
                  <View key={dt.id} style={styles.section}>
                    {(Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : []).map((task) => {
                      const animIdx = taskIdx++;
                      return (
                        <Animated.View
                          key={task.id}
                          style={staggerAnims[animIdx] ? {
                            opacity: staggerAnims[animIdx],
                            transform: [{ translateY: staggerAnims[animIdx].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
                          } : undefined}
                        >
                          <TaskCard
                            task={task}
                            onToggle={(isCompleted) =>
                              handleToggleTask(dt.id, task.id, isCompleted)
                            }

                            onRefine={(userRequest) => handleRefineTask(dt.id, task.id, userRequest)}
                          />
                        </Animated.View>
                      );
                    })}
                  </View>
                );
              })
            )}

            {/* Action buttons when all done */}
            <View style={styles.nextSection}>
              {allDone ? (
                <TouchableOpacity
                  style={styles.giveMeMoreBtn}
                  onPress={handleGiveMoreTasks}
                  disabled={generating}
                  activeOpacity={0.85}
                >
                  {generating ? (
                    <ActivityIndicator color={colors.primaryText} size="small" />
                  ) : (
                    <>
                      <Text style={styles.giveMeMoreIcon}>🚀</Text>
                      <Text style={styles.giveMeMoreText}>Give me more</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.nextButtonLocked}
                    disabled
                    activeOpacity={1}
                  >
                    <Text style={styles.lockIcon}>🔒</Text>
                    <Text style={styles.nextButtonTextLocked}>Give me more</Text>
                  </TouchableOpacity>
                  <Text style={styles.lockHint}>
                    Complete all {newTaskItems.length} tasks to unlock
                  </Text>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Review bottom sheet ─────────────────────────────────────────────── */}
      {reviewOpen && (
        <KeyboardAvoidingView
          style={styles.historyOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.reviewSheet}>

            <View style={styles.reviewHeaderRow}>
              <Text style={styles.reviewTitle}>Daily Review</Text>
            </View>

            {reviewStep === 1 && (
              <>
                <Text style={styles.reviewQuestion}>How did the difficulty feel?</Text>
                <View style={styles.reviewChips}>
                  {DIFFICULTY_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.reviewChip,
                        reviewDifficulty === opt.value && styles.reviewChipSelected,
                      ]}
                      onPress={() => {
                        if (Platform.OS !== "web") Haptics.selectionAsync();
                        setReviewDifficulty(opt.value);
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.reviewChipEmoji}>{opt.emoji}</Text>
                      <Text
                        style={[
                          styles.reviewChipLabel,
                          reviewDifficulty === opt.value && styles.reviewChipLabelSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={[
                    styles.reviewNextBtn,
                    !reviewDifficulty && styles.reviewNextBtnDisabled,
                  ]}
                  onPress={() => reviewDifficulty && setReviewStep(2)}
                  activeOpacity={reviewDifficulty ? 0.85 : 1}
                >
                  <Text
                    style={[
                      styles.reviewNextBtnText,
                      !reviewDifficulty && styles.reviewNextBtnTextDisabled,
                    ]}
                  >
                    Next
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {reviewStep === 2 && (
              <>
                <Text style={styles.reviewQuestion}>Anything Threely Intelligence should know for tomorrow?</Text>
                <TextInput
                  style={styles.reviewNoteInput}
                  placeholder="Optional — obstacles, wins, changes in your life…"
                  placeholderTextColor={colors.textTertiary}
                  value={reviewNote}
                  onChangeText={setReviewNote}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[styles.reviewNextBtn, reviewSubmitting && styles.reviewNextBtnDisabled]}
                  onPress={handleSubmitReview}
                  activeOpacity={reviewSubmitting ? 1 : 0.85}
                  disabled={reviewSubmitting}
                >
                  {reviewSubmitting ? (
                    <ActivityIndicator color={colors.primaryText} size="small" />
                  ) : (
                    <Text style={styles.reviewNextBtnText}>Submit review</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.reviewSkipBtn}
                  onPress={handleSubmitReview}
                  disabled={reviewSubmitting}
                  activeOpacity={0.7}
                >
                  <Text style={styles.reviewSkipText}>Skip note and submit</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Goal picker popup */}
      <Modal
        visible={goalPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGoalPickerVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setGoalPickerVisible(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <Text style={styles.pickerTitle}>What are you working on today?</Text>
            <Text style={styles.pickerSubtitle}>Pick a goal to focus on</Text>

            {/* Overdue section — show goals with overdue tasks first */}
            {(() => {
              const overdueGoalIds = new Set(
                overdueTasks.map(dt => dt.goalId).filter(id => goals.some(g => g.id === id))
              );
              const overdueGoals = goals.filter(g => overdueGoalIds.has(g.id));
              const regularGoals = goals.filter(g => !overdueGoalIds.has(g.id));

              const renderGoalRow = (goal: Goal) => {
                const isSelected = selectedGoal === goal.id;
                const goalTime = goal.dailyTimeMinutes;
                const stat = goalStats.find(s => s.goalId === goal.id);
                const days = daysSince(stat?.lastWorkedAt ?? null);
                const staleColor = days === null ? colors.textTertiary
                  : days < 7 ? colors.success
                  : days < 14 ? colors.warning
                  : colors.danger;
                return (
                  <TouchableOpacity
                    key={goal.id}
                    style={[styles.menuItem, isSelected && styles.menuItemSelected]}
                    onPress={() => selectGoal(goal.id)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.menuItemTextLarge, isSelected && styles.menuItemTextSelected]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {goal.title}
                      </Text>
                      <Text style={[styles.menuStaleness, { color: staleColor }]}>
                        {stalenessLabel(days)}
                      </Text>
                    </View>
                    <View style={styles.menuItemRight}>
                      {stat && stat.overdueCount > 0 && (
                        <View style={styles.menuOverdueBadge}>
                          <Text style={styles.menuOverdueBadgeText}>{stat.overdueCount} overdue</Text>
                        </View>
                      )}
                      {goalTime ? (
                        <View style={styles.menuTimeBadge}>
                          <Text style={styles.menuTimeBadgeText}>~{formatMinutes(goalTime)}/day</Text>
                        </View>
                      ) : null}
                      <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              };

              return (
                <>
                  {overdueGoals.length > 0 && (
                    <>
                      <Text style={styles.pickerSectionHeader}>OVERDUE</Text>
                      {overdueGoals.map(renderGoalRow)}
                      {regularGoals.length > 0 && <View style={styles.menuDivider} />}
                    </>
                  )}
                  {goals.length > 0 && (
                    <>
                      <Text style={styles.pickerSectionHeader}>YOUR GOALS</Text>
                      {(overdueGoals.length > 0 ? regularGoals : goals).map(renderGoalRow)}
                    </>
                  )}
                </>
              );
            })()}

            {goals.length > 1 && (
              <>
                <View style={styles.menuDivider} />
                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    selectedGoal === "shuffle" && styles.menuItemSelected,
                  ]}
                  onPress={() => selectGoal("shuffle")}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.menuItemTextLarge,
                      selectedGoal === "shuffle" && styles.menuItemTextSelected,
                    ]}
                  >
                    ✦ Mix all goals
                  </Text>
                  <View style={[styles.radioOuter, selectedGoal === "shuffle" && styles.radioOuterSelected]}>
                    {selectedGoal === "shuffle" && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { alignItems: "center", justifyContent: "center" },
    scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
    header: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: c.bg,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      paddingTop: spacing.sm,
    },
    date: {
      fontSize: typography.sm,
      fontWeight: typography.medium,
      color: c.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: spacing.xs,
    },
    greeting: {
      fontSize: typography.xxxl,
      fontWeight: typography.bold,
      color: c.text,
      letterSpacing: -0.8,
      lineHeight: 42,
    },
    selectorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    dropdown: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      gap: spacing.xs,
      ...shadow.sm,
    },
    dropdownLabel: {
      flex: 1,
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: c.text,
    },
    chevron: {
      fontSize: 18,
      color: c.textTertiary,
      transform: [{ rotate: "90deg" }],
      lineHeight: 20,
    },
    taskTimeBadge: {
      backgroundColor: c.primaryLight,
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
      flexShrink: 0,
    },
    taskTimeBadgeText: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.primary,
    },
    dailyTimePill: {
      backgroundColor: c.card,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: c.border,
      flexShrink: 0,
    },
    dailyTimePillText: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.textSecondary,
    },
    shufflePill: {
      backgroundColor: c.primaryLight,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: c.primary + "33",
    },
    shuffleText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.primary,
    },
    progressPill: {
      backgroundColor: c.card,
      borderRadius: 50,
      height: 36,
      marginBottom: spacing.lg,
      overflow: "hidden",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: c.border,
    },
    progressBar: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      backgroundColor: c.primaryLight,
      borderRadius: 50,
    },
    progressText: {
      textAlign: "center",
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.text,
    },
    completeAllBtn: {
      backgroundColor: c.successLight,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.success,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    completeAllText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.success,
    },
    // ── Insight card ────────────────────────────────────────────────────────
    insightCard: {
      backgroundColor: c.primaryLight,
      borderRadius: radius.xl,
      borderWidth: 1.5,
      borderColor: c.primary + "44",
      padding: spacing.md,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    insightHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    insightIcon: {
      fontSize: 16,
      color: c.primary,
    },
    insightTitle: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.primary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    insightText: {
      fontSize: typography.base,
      color: c.text,
      lineHeight: 22,
    },
    insightBtn: {
      backgroundColor: c.primary,
      borderRadius: radius.md,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing.xs,
      ...shadow.sm,
    },
    insightBtnText: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: c.primaryText,
    },
    section: { marginBottom: spacing.sm },
    mixItem: { marginBottom: spacing.xs },
    mixGoalChip: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.primary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 3,
      marginLeft: 2,
    },
    empty: { alignItems: "center", paddingVertical: spacing.xxl },
    emptyIcon: { fontSize: 40, marginBottom: spacing.md, color: c.primary },
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
    generateBtn: { width: "100%" },
    nextSection: { alignItems: "center", marginTop: spacing.xs, gap: spacing.sm },
    // Give me more (unlocked)
    giveMeMoreBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      width: "100%",
      height: 48,
      borderRadius: radius.md,
      backgroundColor: c.primary,
      ...shadow.md,
    },
    giveMeMoreIcon: { fontSize: 16 },
    giveMeMoreText: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: c.primaryText,
      letterSpacing: -0.2,
    },
    // Locked state
    nextButtonLocked: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      width: "100%",
      height: 48,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.card,
      opacity: 0.6,
    },
    lockIcon: { fontSize: 16 },
    nextButtonTextLocked: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: c.textSecondary,
      letterSpacing: -0.2,
    },
    lockHint: { fontSize: typography.sm, color: c.textTertiary, textAlign: "center" },
    reviewPromptBtn: {
      paddingVertical: spacing.sm,
    },
    reviewPromptText: {
      fontSize: typography.sm,
      color: c.primary,
      fontWeight: typography.medium,
      textDecorationLine: "underline",
    },
    // ── Goal picker modal ────────────────────────────────────────────────────
    modalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.overlay,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
    },
    pickerCard: {
      width: "100%",
      backgroundColor: c.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      ...shadow.lg,
    },
    pickerTitle: {
      fontSize: typography.xl,
      fontWeight: typography.bold,
      color: c.text,
      letterSpacing: -0.3,
      marginBottom: 4,
    },
    pickerSubtitle: {
      fontSize: typography.sm,
      color: c.textSecondary,
      marginBottom: spacing.lg,
    },
    menuHeader: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
    },
    menuItemSelected: { backgroundColor: c.primaryLight },
    menuItemText: {
      flex: 1,
      fontSize: typography.base,
      fontWeight: typography.medium,
      color: c.text,
    },
    menuItemTextLarge: {
      flex: 1,
      fontSize: typography.lg,
      fontWeight: typography.semibold,
      color: c.text,
    },
    menuItemTextSelected: { color: c.primary, fontWeight: typography.semibold },
    pickerSectionHeader: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: c.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    menuItemRight: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexShrink: 0 },
    menuNoTasksBadge: {
      fontSize: typography.xs,
      color: c.textTertiary,
      backgroundColor: c.bg,
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
      overflow: "hidden",
    },
    menuTimeBadge: {
      backgroundColor: c.primaryLight,
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
      flexShrink: 0,
    },
    menuTimeBadgeText: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.primary,
    },
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    radioOuterSelected: {
      borderColor: c.primary,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: c.primary,
    },
    menuStaleness: {
      fontSize: typography.xs,
      fontWeight: typography.medium,
      marginTop: 2,
    },
    menuOverdueBadge: {
      backgroundColor: c.warningLight,
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
      flexShrink: 0,
    },
    menuOverdueBadgeText: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.warning,
    },
    menuDivider: { height: 1, backgroundColor: c.border, marginHorizontal: spacing.md },
    // ── Overdue banner + section ──────────────────────────────────────────────
    overdueBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.warningLight,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.warning,
      padding: spacing.md,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    overdueBannerText: {
      flex: 1,
      fontSize: typography.sm,
      color: c.text,
    },
    overdueBannerClose: {
      fontSize: 14,
      color: c.textTertiary,
    },
    overdueSection: {
      marginBottom: spacing.lg,
    },
    overdueHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    overdueLabel: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: c.warning,
      letterSpacing: 0.8,
    },
    overdueBadge: {
      backgroundColor: c.warningLight,
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 1,
    },
    overdueBadgeText: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.warning,
    },
    overdueItem: {
      marginBottom: spacing.sm,
    },
    overdueGoalChip: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.warning,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 3,
      marginLeft: 2,
    },
    overdueCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.warning,
      padding: spacing.md,
      gap: spacing.md,
      ...shadow.sm,
    },
    overdueCheckbox: {
      width: 28,
      height: 28,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: c.success,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    overdueCheckIcon: {
      fontSize: 14,
      fontWeight: typography.bold,
      color: c.success,
    },
    overdueTaskTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: c.text,
      lineHeight: 21,
    },
    overdueTaskDesc: {
      fontSize: typography.sm,
      color: c.textSecondary,
      marginTop: 2,
    },
    overdueActions: {
      flexDirection: "column",
      alignItems: "center",
      gap: spacing.xs,
      flexShrink: 0,
    },
    overdueRescheduleBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.sm,
      backgroundColor: c.primaryLight,
    },
    overdueRescheduleText: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.primary,
    },
    overdueDismissBtn: {
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    overdueDismissText: {
      fontSize: 16,
      color: c.textTertiary,
    },
    // ── Review sheet ─────────────────────────────────────────────────────────
    historyOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.overlay,
      justifyContent: "flex-end",
    },
    reviewSheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
      ...shadow.lg,
    },
    reviewHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    reviewTitle: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: c.text,
      letterSpacing: -0.3,
    },
    reviewQuestion: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: c.text,
      marginBottom: spacing.md,
      lineHeight: 22,
    },
    reviewChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    reviewChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.bg,
    },
    reviewChipSelected: {
      borderColor: c.primary,
      backgroundColor: c.primaryLight,
    },
    reviewChipEmoji: { fontSize: 16 },
    reviewChipLabel: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.text,
    },
    reviewChipLabelSelected: { color: c.primary },
    reviewNextBtn: {
      height: 48,
      backgroundColor: c.primary,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.sm,
    },
    reviewNextBtnDisabled: {
      backgroundColor: c.border,
    },
    reviewNextBtnText: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: c.primaryText,
    },
    reviewNextBtnTextDisabled: { color: c.textTertiary },
    reviewNoteInput: {
      backgroundColor: c.bg,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md,
      fontSize: typography.base,
      color: c.text,
      lineHeight: 22,
      minHeight: 80,
      marginBottom: spacing.md,
    },
    reviewSkipBtn: {
      alignItems: "center",
      paddingVertical: spacing.sm,
      marginTop: spacing.xs,
    },
    reviewSkipText: {
      fontSize: typography.sm,
      color: c.textTertiary,
    },
    // ── History sheet ────────────────────────────────────────────────────────
    historySheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
      maxHeight: "80%",
      ...shadow.lg,
    },
    historyHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: "center",
      marginBottom: spacing.lg,
    },
    historyHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    historyTitle: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: c.text,
      letterSpacing: -0.3,
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
    historyGoalSection: {
      marginBottom: spacing.md,
    },
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
    viewAllBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      marginTop: spacing.lg,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    viewAllText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.primary,
    },
  });
}
