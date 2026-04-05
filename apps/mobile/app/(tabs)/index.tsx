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
  LayoutAnimation,
  UIManager,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SwipeNavigator } from "@/components/SwipeNavigator";
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
import { AppTutorial } from "@/components/AppTutorial";
import { MOCK_TUTORIAL_GOAL, MOCK_TUTORIAL_DAILY_TASK } from "@/lib/mock-tutorial-data";
import { Button } from "@/components/ui/Button";
import { SkeletonCard } from "@/components/Skeleton";
import { useToast } from "@/lib/toast";
import { useStaggeredEntrance } from "@/lib/animations";
import { scheduleNotifications, onTaskCompleted, sendInstantNotification, type NotifContext } from "@/lib/notifications";
import { useTheme } from "@/lib/theme";
import { useSubscription } from "@/lib/subscription-context";
import { useWalkthroughRegistry } from "@/lib/walkthrough-registry";
import Paywall from "@/components/Paywall";
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

function getTodayIsoDay(): number {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

function isGoalWorkDay(workDays: number[] | undefined): boolean {
  if (!workDays || workDays.length === 0 || workDays.length === 7) return true;
  return workDays.includes(getTodayIsoDay());
}

function formatWorkDaysList(workDays: number[]): string {
  const names = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return [...workDays].sort((a, b) => a - b).map(d => names[d]).join(", ");
}

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// iPad-friendly max content width
const MAX_CONTENT_WIDTH = 600;

export default function DashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 768;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showToast } = useToast();
  const { register, registerScroll } = useWalkthroughRegistry();

  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalStats, setGoalStats] = useState<GoalStat[]>([]);
  const [restDay, setRestDay] = useState(false);
  const [restDayPickerOpen, setRestDayPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [selectedGoal, setSelectedGoal] = useState("");
  const [dailyTimeMinutes, setDailyTimeMinutes] = useState(0);
  const [goalPickerVisible, setGoalPickerVisible] = useState(false);
  const [goalPickerShownToday, setGoalPickerShownToday] = useState(false);
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


  // ─── Pro / trial state ────────────────────────────────────────────────────────
  const [showTutorial, setShowTutorial] = useState(false);
  const [showGenLimit, setShowGenLimit] = useState(false);
  const { isLimitedMode, walkthroughActive, setWalkthroughActive, refreshSubscription } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);

  const hasLoadedOnce = useRef(false);
  const hasAutoGenerated = useRef(false);
  const pendingSwitchGoal = useRef<string | null>(null);
  const reviewShownForDate = useRef<string>("");
  const recentlyToggledRef = useRef<Set<string>>(new Set());
  const userIdRef = useRef<string>("");
  const [sortTrigger, setSortTrigger] = useState(0);

  // Load nickname + email eagerly (outside loadData) so greeting never shows "there"
  useEffect(() => {
    (async () => {
      const [saved, { data: sessionData }] = await Promise.all([
        AsyncStorage.getItem("@threely_nickname"),
        supabase.auth.getSession(),
      ]);
      if (saved) {
        setNickname(saved);
      } else {
        // Fallback: check Supabase user metadata for name (e.g. from Apple Sign In)
        const meta = sessionData?.session?.user?.user_metadata;
        const metaName = meta?.display_name || meta?.full_name || meta?.name;
        if (metaName) {
          setNickname(metaName);
          AsyncStorage.setItem("@threely_nickname", metaName);
        }
      }
      if (sessionData?.session?.user?.email) setUserEmail(sessionData.session.user.email);
    })();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const todayKey = `@threely_focus_${new Date().toISOString().slice(0, 10)}`;
      const [tasksRes, goalsRes, profileRes, statsRes, focusRes, savedFocus] = await Promise.all([
        tasksApi.today(false),
        goalsApi.list(),
        profileApi.get().catch(() => ({ profile: null })),
        statsApi.get().catch(() => ({ totalCompleted: 0, activeGoals: 0, streak: 0, goalStats: [] })),
        focusApi.get().catch(() => ({ focus: null })),
        AsyncStorage.getItem(`@threely_focus_${new Date().toISOString().slice(0, 10)}`),
      ]);
      setDailyTasks(tasksRes.dailyTasks);
      setGoals(goalsRes.goals);
      setGoalStats(statsRes.goalStats ?? []);
      if (profileRes.profile) setDailyTimeMinutes(profileRes.profile.dailyTimeMinutes);

      // Check if any generate is in progress (user may have closed/backgrounded app)
      const todayStr = new Date().toISOString().slice(0, 10);
      const restGenFlag = await AsyncStorage.getItem(`@threely_restday_gen_${todayStr}`);
      const moreGenFlag = await AsyncStorage.getItem(`@threely_generating_${todayStr}`);
      const activeGenFlag = restGenFlag || moreGenFlag;
      const flagKey = restGenFlag ? `@threely_restday_gen_${todayStr}` : `@threely_generating_${todayStr}`;

      if (activeGenFlag && !pollingRef.current) {
        const startedAt = parseInt(activeGenFlag, 10);
        const elapsed = Date.now() - startedAt;
        if (elapsed < 90_000) {
          setGenerating(true);
          setRestDay(false);
          const prevTaskCount = tasksRes.dailyTasks.length;
          pollingRef.current = setInterval(async () => {
            try {
              const poll = await tasksApi.today(false);
              if (poll.dailyTasks.length > prevTaskCount || (prevTaskCount === 0 && poll.dailyTasks.length > 0)) {
                setDailyTasks(poll.dailyTasks);
                setGenerating(false);
                setRestDay(false);
                await AsyncStorage.removeItem(flagKey);
                if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
              }
            } catch { /* ignore poll errors */ }
          }, 5000);
          setTimeout(() => {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
              setGenerating(false);
              AsyncStorage.removeItem(flagKey);
              tasksApi.today(false).then(r => {
                setDailyTasks(r.dailyTasks);
                setRestDay(r.restDay ?? false);
              }).catch(() => {});
            }
          }, Math.max(0, 90_000 - elapsed));
        } else {
          await AsyncStorage.removeItem(flagKey);
          setRestDay(tasksRes.restDay ?? false);
        }
      } else {
        setRestDay(tasksRes.restDay ?? false);
      }

      // Restore saved focus: prefer server, fallback to AsyncStorage
      const serverFocus = focusRes.focus?.focusGoalId;
      const restoredFocus = serverFocus ?? savedFocus;
      const activeGoalIds = new Set(goalsRes.goals.map(g => g.id));
      const isValidFocus = restoredFocus && activeGoalIds.has(restoredFocus);
      if (isValidFocus) {
        setSelectedGoal(restoredFocus);
        setGoalPickerShownToday(true);
        // Sync AsyncStorage with server
        if (serverFocus && !savedFocus) {
          await AsyncStorage.setItem(todayKey, serverFocus);
        }
      } else if (goalsRes.goals.length === 1) {
        // Only one goal — auto-select it, no need to show picker
        setSelectedGoal(goalsRes.goals[0].id);
        setGoalPickerShownToday(true);
      } else if (goalsRes.goals.length > 1) {
        // Multiple goals, no valid focus — auto-open the focus picker on first visit
        setSelectedGoal(goalsRes.goals[0].id);
        if (!hasLoadedOnce.current) {
          setGoalPickerShownToday(false);
        }
      }

      // Auto-generate tasks if none exist and user has goals
      // Skip if already generating (polling in progress) or already auto-generated
      if (
        tasksRes.dailyTasks.length === 0 &&
        goalsRes.goals.length > 0 &&
        !tasksRes.restDay &&
        !hasAutoGenerated.current &&
        !activeGenFlag
      ) {
        hasAutoGenerated.current = true;
        setGenerating(true);
        const autoGenKey = `@threely_generating_${todayStr}`;
        AsyncStorage.setItem(autoGenKey, String(Date.now()));
        try {
          const res = await tasksApi.generate();
          AsyncStorage.removeItem(autoGenKey);
          if (res.restDay) {
            setRestDay(true);
          } else {
            setDailyTasks(res.dailyTasks);
            sendInstantNotification(
              "Your tasks are ready!",
              "Your personalized daily tasks have been generated. Open Threely to get started."
            );
          }
        } catch (err: unknown) {
          AsyncStorage.removeItem(autoGenKey);
          if (err instanceof Error && err.message?.includes("pro_required")) {
            setShowPaywall(true);
          }
        } finally {
          setGenerating(false);
        }
      }

      // Apply pending goal switch from "View Tasks" in Goals tab (must happen after focus restoration)
      if (pendingSwitchGoal.current) {
        setSelectedGoal(pendingSwitchGoal.current);
        setGoalPickerShownToday(true);
        pendingSwitchGoal.current = null;
      }
    } catch (e) {
      console.warn("loadData error", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Check if we should switch to a specific goal (from Goals tab "View today's tasks")
      AsyncStorage.getItem("@threely_switch_goal").then((switchGoalId) => {
        if (switchGoalId) {
          AsyncStorage.removeItem("@threely_switch_goal");
          // Set it AFTER loadData so it doesn't get overwritten by focus restoration
          pendingSwitchGoal.current = switchGoalId;
        }
      });
      if (!hasLoadedOnce.current) {
        hasLoadedOnce.current = true;
        loadData().finally(() => setLoading(false));
      } else {
        loadData();
      }
    }, [loadData])
  );

  // Refetch when app comes to foreground (sync across devices)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && hasLoadedOnce.current) loadData();
    });
    return () => {
      sub.remove();
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [loadData]);

  // ─── Launch tutorial after first onboarding ─────────────────────────────────
  useEffect(() => {
    if (loading) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userIdRef.current = user.id;
      const tutorialKey = `@threely_tutorial_done_${user.id}`;
      const done = await AsyncStorage.getItem(tutorialKey);
      if (!done) {
        setWalkthroughActive(true);
        setTimeout(() => setShowTutorial(true), 600);
      }
    })();
  }, [loading, setWalkthroughActive]);

  useMemo(() => {
    if (goals.length >= 1 && !selectedGoal) setSelectedGoal(goals[0].id);
  }, [goals.length]);

  // Auto-open focus picker on first visit of the day if no focus was set
  useEffect(() => {
    if (!loading && goals.length > 1 && !goalPickerShownToday) {
      setGoalPickerVisible(true);
    }
  }, [loading, goals.length, goalPickerShownToday]);

  // Open focus picker when navigating from Profile → "Change today's focus"
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("@threely_open_focus_picker").then((val) => {
        if (val === "1") {
          AsyncStorage.removeItem("@threely_open_focus_picker");
          if (goals.length > 1) {
            setGoalPickerVisible(true);
          }
        }
      });
    }, [goals.length])
  );

  // Restart tutorial when triggered from Profile settings
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("@threely_restart_tutorial").then((val) => {
        if (val === "true") {
          AsyncStorage.removeItem("@threely_restart_tutorial");
          setWalkthroughActive(true);
          setTimeout(() => setShowTutorial(true), 350);
        }
      });
    }, [setWalkthroughActive])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // During tutorial walkthrough, always use mock data for consistent spotlight targets
  const effectiveGoals = walkthroughActive ? [MOCK_TUTORIAL_GOAL] : goals;
  const effectiveDailyTasks = walkthroughActive ? [MOCK_TUTORIAL_DAILY_TASK] : dailyTasks;
  const effectiveSelectedGoal = walkthroughActive ? MOCK_TUTORIAL_GOAL.id : selectedGoal;

  // ─── Derived state ─────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _sort = sortTrigger; // subscribe to sort trigger for delayed reorder

  const visibleTasks: DailyTask[] =
    effectiveDailyTasks.filter((dt) => dt.goalId === effectiveSelectedGoal);

  const allTaskItems =
    visibleTasks.flatMap((dt) => (Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : []));

  const displayVisibleTasks: DailyTask[] = visibleTasks.map((dt) => {
    const tasks = (Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : []).slice(-3);
    // Sort: incomplete first, completed last (recently toggled stay in place)
    const incomplete = tasks.filter(t => !t.isCompleted || recentlyToggledRef.current.has(t.id));
    const completed = tasks.filter(t => t.isCompleted && !recentlyToggledRef.current.has(t.id));
    return { ...dt, tasks: [...incomplete, ...completed] };
  });

  const newTaskItems =
    displayVisibleTasks.flatMap((dt) => (Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : []));

  const selectedLabel =
    effectiveGoals.find((g) => g.id === effectiveSelectedGoal)?.title ?? "Select goal";

  const hasAnyTasks = effectiveGoals.length > 0;

  const hasVisibleTasks = visibleTasks.length > 0;

  const allDisplayedItems = newTaskItems;
  const allDone = allDisplayedItems.length > 0 && allDisplayedItems.every((t) => t.isCompleted || t.isSkipped);
  const completedCount = allDisplayedItems.filter((t) => t.isCompleted || t.isSkipped).length;
  const totalCount = allDisplayedItems.length;

  const totalEstimatedMinutes = (() => {
    const displayed = displayVisibleTasks.flatMap(dt => Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : []);
    return displayed
      .filter(t => !t.isCompleted && !t.isSkipped)
      .reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
  })();

  // Build notification context from current state
  const buildNotifContext = useCallback((): NotifContext => {
    const focusGoalName = goals.find(g => g.id === selectedGoal)?.title ?? null;
    const incomplete = newTaskItems.filter(t => !t.isCompleted && !t.isSkipped);

    // Count goals that are active today (not off-day)
    const activeGoalsToday = goals.filter(g => {
      const stat = goalStats.find(s => s.goalId === g.id);
      return isGoalWorkDay(stat?.workDays);
    });

    // Total time across ALL active goals today (not just focused)
    const allIncompleteTasks = dailyTasks
      .filter(dt => activeGoalsToday.some(g => g.id === dt.goalId))
      .flatMap(dt => (dt.tasks as TaskItem[]).filter(t => !t.isCompleted && !t.isSkipped));
    const totalTimeAllGoals = allIncompleteTasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0);

    return {
      focusGoalName,
      totalTimeMinutes: incomplete.reduce((s, t) => s + (t.estimated_minutes || 0), 0),
      incompleteCount: incomplete.length,
      allDone,
      staleGoals: [],
      isRestDay: restDay,
      activeGoalCountToday: activeGoalsToday.length,
      totalTimeAllGoals,
    };
  }, [selectedGoal, goals, newTaskItems, allDone, restDay, goalStats, dailyTasks]);

  // Schedule notifications after data loads (debounced to avoid rapid re-scheduling)
  useEffect(() => {
    if (!loading && goals.length > 0) {
      const timer = setTimeout(() => {
        scheduleNotifications(buildNotifContext()).catch(() => {});
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [loading, buildNotifContext, goals.length]);

  // Track when all tasks become done
  const prevAllDone = useRef(false);
  const goalKey = selectedGoal ?? "none";
  useEffect(() => {
    prevAllDone.current = allDone;
  }, [allDone, newTaskItems.length]);

  // Review is now triggered by "Give me more" button — no auto-open

  // ─── Goal picker ───────────────────────────────────────────────────────────

  async function persistFocus(val: string) {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelectedGoal(val);
    setGoalPickerVisible(false);
    setGoalPickerShownToday(true);
    // Persist locally + server
    const todayKey = `@threely_focus_${new Date().toISOString().slice(0, 10)}`;
    await AsyncStorage.setItem(todayKey, val);
    focusApi.save(val).catch(() => {});
  }

  function selectGoal(val: string) {
    // Check if this is an off-day goal
    const stat = goalStats.find(s => s.goalId === val);
    if (stat && !isGoalWorkDay(stat.workDays)) {
      const dayNames = formatWorkDaysList(stat.workDays);
      Alert.alert(
        "Off-Day Goal",
        `This goal is scheduled for ${dayNames}. Would you like to work on it today?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Work on it", onPress: () => persistFocus(val) },
        ]
      );
      return;
    }
    persistFocus(val);
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handleFirstGenerate() {
    if (goals.length === 0) {
      router.navigate("/(tabs)/goals");
      return;
    }
    setGenerating(true);
    const genTodayStr = new Date().toISOString().slice(0, 10);
    AsyncStorage.setItem(`@threely_generating_${genTodayStr}`, String(Date.now()));
    try {
      const res = await tasksApi.generate(selectedGoal || undefined);
      AsyncStorage.removeItem(`@threely_generating_${genTodayStr}`);
      setDailyTasks((prev) => {
        const newIds = new Set(res.dailyTasks.map((dt) => dt.id));
        return [
          ...prev.filter(
            (dt) => !newIds.has(dt.id) && res.dailyTasks.every((r) => r.goalId !== dt.goalId)
          ),
          ...res.dailyTasks,
        ];
      });
      sendInstantNotification(
        "Your tasks are ready!",
        "Your personalized daily tasks have been generated. Open Threely to get started."
      );
    } catch (e: unknown) {
      AsyncStorage.removeItem(`@threely_generating_${genTodayStr}`);
      if (e instanceof Error && e.message?.includes("pro_required")) {
        setShowPaywall(true);
      } else {
        showToast(e instanceof Error ? e.message : "Failed to generate tasks", "error");
      }
    } finally {
      setGenerating(false);
    }
  }

  function handleGiveMoreTasks() {
    if (!allDone) return;
    // Pre-check: if tasks already have > 3 items, this goal already got extra tasks today
    const dt = visibleTasks[0];
    if (dt) {
      const taskCount = Array.isArray(dt.tasks) ? (dt.tasks as unknown[]).length : 0;
      if (taskCount > 3) {
        setShowGenLimit(true);
        return;
      }
    }
    Alert.alert(
      "Work Ahead?",
      "We automatically create new tasks for you each day. Are you sure you want to generate more now?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Generate More",
          onPress: () => {
            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const targetDt = visibleTasks[0];
            if (targetDt) {
              setReviewDailyTaskId(targetDt.id);
              setReviewOpen(true);
            }
          },
        },
      ]
    );
  }

  async function handleToggleTask(dailyTaskId: string, taskItemId: string, isCompleted: boolean) {
    // Delay sort when completing (so user sees checkmark first); sort immediately when unchecking
    if (isCompleted) {
      recentlyToggledRef.current.add(taskItemId);
      setTimeout(() => {
        recentlyToggledRef.current.delete(taskItemId);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSortTrigger(prev => prev + 1);
      }, 400);
    }

    try {
      const res = await tasksApi.completeItem(dailyTaskId, taskItemId, isCompleted);
      const newDailyTasks = dailyTasks.map((dt) => (dt.id === dailyTaskId ? res.dailyTask : dt));
      setDailyTasks(newDailyTasks);
      // Update notifications after task completion
      if (isCompleted) {
        onTaskCompleted(buildNotifContext());
      }
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

  async function handleAskAboutTask(dailyTaskId: string, taskItemId: string, messages: { role: "user" | "assistant"; content: string }[]) {
    const res = await tasksApi.askAboutTask(dailyTaskId, taskItemId, messages);
    return { answer: res.answer, options: res.options ?? [] };
  }

  async function handleCompleteAll() {
    const incompleteTasks = newTaskItems.filter((t) => !t.isCompleted);
    if (incompleteTasks.length === 0) return;

    try {
      for (const task of incompleteTasks) {
        // Find the dailyTaskId for this task
        let dtId: string | undefined;
        for (const dt of visibleTasks) {
          const items = Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : [];
          if (items.find((t) => t.id === task.id)) {
            dtId = dt.id;
            break;
          }
        }
        if (dtId) {
          const res = await tasksApi.completeItem(dtId, task.id, true);
          setDailyTasks((prev) =>
            prev.map((dt) => (dt.id === dtId ? res.dailyTask : dt))
          );
        }
      }
      // Clear any stale generation state so completed tasks show properly
      setGenerating(false);
      const genTodayStr = new Date().toISOString().slice(0, 10);
      AsyncStorage.removeItem(`@threely_generating_${genTodayStr}`);
    } catch {
      showToast("Couldn't complete all tasks. Try again.", "error");
    }
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
      const genTodayStr = new Date().toISOString().slice(0, 10);
      AsyncStorage.setItem(`@threely_generating_${genTodayStr}`, String(Date.now()));
      try {
        const res = await tasksApi.generate(selectedGoal || undefined, { requestingAdditional: true });
        setDailyTasks((prev) => {
          const updatedGoalIds = new Set(res.dailyTasks.map((dt) => dt.goalId));
          return [
            ...prev.filter((dt) => !updatedGoalIds.has(dt.goalId)),
            ...res.dailyTasks,
          ];
        });
        AsyncStorage.removeItem(`@threely_generating_${genTodayStr}`);
        sendInstantNotification(
          "Your next tasks are ready!",
          "New tasks have been generated based on your review. Keep the momentum going!"
        );
      } catch (err: unknown) {
        AsyncStorage.removeItem(`@threely_generating_${genTodayStr}`);
        if (err instanceof Error && err.message?.includes("pro_required")) {
          setShowPaywall(true);
        } else if (err instanceof Error && err.message?.includes("generation_limit_reached")) {
          setShowGenLimit(true);
        }
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
  const rawName = nickname || (userEmail ? userEmail.split("@")[0] : "");
  const firstNameRaw = rawName.split(/\s+/)[0] || "there";
  const firstName = firstNameRaw.charAt(0).toUpperCase() + firstNameRaw.slice(1);

  // Staggered entrance animations for task cards
  const staggerAnims = useStaggeredEntrance(loading ? 0 : newTaskItems.length);

  const wideContentStyle = isWide ? { maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" as const, width: "100%" as const } : undefined;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={[styles.headerRow, wideContentStyle]}>
            <View>
              <Text style={styles.date}>{formatDate(today)}</Text>
              <Text style={styles.greeting}>
                {getGreeting()}, {firstName}
              </Text>
            </View>
          </View>
        </View>
        <View style={[{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }, wideContentStyle]}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </View>
    );
  }

  return (
    <SwipeNavigator currentIndex={0}>
    <View style={styles.container}>
      {/* Fixed header — outside ScrollView so it never hides under Dynamic Island */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={[styles.headerRow, wideContentStyle]}>
          <View>
            <Text style={styles.date}>{formatDate(today)}</Text>
            <Text style={styles.greeting}>
              {getGreeting()}, {firstName}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={r => registerScroll("today-scroll", r)}
        contentContainerStyle={[styles.scroll, wideContentStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >

        {/* Limited mode banner */}
        {isLimitedMode && (
          <Pressable style={styles.expiredBanner} onPress={() => setShowPaywall(true)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.expiredTitle}>Unlock Threely Pro</Text>
              <Text style={styles.expiredSubtitle}>Get Pro free for 7 days — Achieve your goals</Text>
            </View>
            <Text style={{ color: colors.primary, fontSize: typography.sm, fontWeight: typography.semibold }}>Try Free</Text>
          </Pressable>
        )}

        {/* Goal selector */}
        {effectiveGoals.length > 0 && (
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
            {effectiveGoals.length > 1 && (
              <TouchableOpacity
                style={styles.changePill}
                onPress={() => setGoalPickerVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.changeText}>Change</Text>
              </TouchableOpacity>
            )}
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

        {/* Complete All button removed — users check tasks off individually */}

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
                  <View style={{ marginTop: spacing.xs }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <ActivityIndicator color={colors.primary} size="small" />
                      <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>Generating next tasks…</Text>
                    </View>
                    <Text style={{ fontSize: typography.xs, color: colors.textTertiary, marginTop: 4 }}>
                      <Text style={{ fontWeight: typography.bold }}>This can take a couple of minutes. </Text>
                      We'll notify you when they're ready.
                    </Text>
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
        {effectiveGoals.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{"✦"}</Text>
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
        ) : restDay && !generating ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{"✦"}</Text>
            <Text style={styles.emptyTitle}>No goals scheduled for today</Text>
            <Text style={styles.emptySubtitle}>
              Enjoy your rest day — or keep the momentum going!
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: spacing.md, paddingHorizontal: spacing.xl }]}
              onPress={() => {
                const todayStr = new Date().toISOString().slice(0, 10);
                if (goals.length === 1) {
                  setGenerating(true);
                  AsyncStorage.setItem(`@threely_restday_gen_${todayStr}`, String(Date.now()));
                  tasksApi.generate(goals[0].id).then((res) => {
                    setDailyTasks((prev) => {
                      const newIds = new Set(res.dailyTasks.map((dt) => dt.id));
                      return [...prev.filter((dt) => !newIds.has(dt.id) && res.dailyTasks.every((r) => r.goalId !== dt.goalId)), ...res.dailyTasks];
                    });
                    setRestDay(false);
                    if (res.dailyTasks.length === 1) setSelectedGoal(res.dailyTasks[0].goalId);
                    AsyncStorage.removeItem(`@threely_restday_gen_${todayStr}`);
                  }).catch((e) => {
                    AsyncStorage.removeItem(`@threely_restday_gen_${todayStr}`);
                    if (e instanceof Error && e.message?.includes("pro_required")) {
                      setShowPaywall(true);
                    } else {
                      showToast(e instanceof Error ? e.message : "Failed to generate tasks", "error");
                    }
                  }).finally(() => setGenerating(false));
                } else {
                  setRestDayPickerOpen(true);
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Generate tasks anyway</Text>
            </TouchableOpacity>
          </View>
        ) : generating && !hasVisibleTasks ? (
          <View style={{ alignItems: "center", paddingVertical: spacing.xl * 2, paddingHorizontal: spacing.lg }}>
            <Text style={{ fontSize: 36, marginBottom: spacing.md }}>{"\u2726"}</Text>
            <Text style={{ fontSize: typography.lg, fontWeight: "700", color: colors.text, textAlign: "center", marginBottom: spacing.sm }}>
              Your tasks are being generated...
            </Text>
            <View style={{ width: "70%", maxWidth: 300, height: 5, backgroundColor: colors.border, borderRadius: 3, marginBottom: spacing.md, overflow: "hidden" }}>
              <View style={{ height: "100%", width: "60%", backgroundColor: colors.primary, borderRadius: 3 }} />
            </View>
            <Text style={{ textAlign: "center", fontSize: typography.sm, color: colors.textSecondary, lineHeight: 20 }}>
              This can take up to 30 seconds.{"\n"}We'll notify you when ready.
            </Text>
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
            {generating && (
              <Text style={{ textAlign: "center", marginTop: spacing.sm, fontSize: typography.xs, color: colors.textTertiary, lineHeight: 18 }}>
                <Text style={{ fontWeight: typography.bold }}>This can take a couple of minutes. </Text>
                We'll notify you when your tasks are ready.
              </Text>
            )}
          </View>
        ) : (
          <>
            {/* Get more tasks — above task cards */}
            <View ref={r => register("get-more-button", r)} collapsable={false}>
              {allDone ? (
                <TouchableOpacity
                  style={styles.getMoreBar}
                  onPress={handleGiveMoreTasks}
                  disabled={generating}
                  activeOpacity={0.85}
                >
                  {generating ? (
                    <ActivityIndicator color={colors.primaryText} size="small" />
                  ) : (
                    <Text style={styles.getMoreTitle}>Get more tasks</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.getMoreBarLocked}>
                  <Text style={styles.getMoreTitleLocked}>Complete all tasks to unlock more</Text>
                  <Text style={styles.getMoreSubtitleLocked}>
                    {completedCount}/{totalCount} done — {totalCount - completedCount} remaining
                  </Text>
                </View>
              )}
            </View>

            {(() => {
              let globalTaskIdx = 0;
              return displayVisibleTasks.map((dt) => {
                let taskIdx = 0;
                return (
                  <View key={dt.id} style={styles.section}>
                    {(Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : []).map((task) => {
                      const animIdx = taskIdx++;
                      const isFirst = globalTaskIdx === 0;
                      globalTaskIdx++;
                      const card = (
                        <TaskCard
                          task={task}
                          onToggle={(isCompleted) =>
                            handleToggleTask(dt.id, task.id, isCompleted)
                          }
                          onRefine={(userRequest) => handleRefineTask(dt.id, task.id, userRequest)}
                          onAsk={(messages) => handleAskAboutTask(dt.id, task.id, messages)}
                          paywalled={isLimitedMode}
                        />
                      );
                      return (
                        <Animated.View
                          key={task.id}
                          style={staggerAnims[animIdx] ? {
                            opacity: staggerAnims[animIdx],
                            transform: [{ translateY: staggerAnims[animIdx].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
                          } : undefined}
                        >
                          {isFirst ? (
                            <View ref={r => register("first-task-card", r)} collapsable={false}>
                              {card}
                            </View>
                          ) : card}
                        </Animated.View>
                      );
                    })}
                  </View>
                );
              });
            })()}
          </>
        )}
      </ScrollView>

      {/* ── Rest day goal picker ────────────────────────────────────────────── */}
      <Modal visible={restDayPickerOpen} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" }}
          onPress={() => setRestDayPickerOpen(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.card,
              borderRadius: radius.lg,
              padding: spacing.lg,
              width: "85%",
              maxWidth: 420,
            }}
            onPress={() => {}}
          >
            <Text style={{ fontSize: typography.lg, fontWeight: typography.bold as "700", color: colors.text, marginBottom: 4 }}>
              Which goal?
            </Text>
            <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 }}>
              Pick a goal to generate tasks for today.
            </Text>
            {goals.map(g => (
              <TouchableOpacity
                key={g.id}
                style={{
                  paddingVertical: spacing.sm + 2,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                  marginBottom: spacing.xs,
                }}
                activeOpacity={0.7}
                onPress={() => {
                  setRestDayPickerOpen(false);
                  setGenerating(true);
                  const todayStr = new Date().toISOString().slice(0, 10);
                  AsyncStorage.setItem(`@threely_restday_gen_${todayStr}`, String(Date.now()));
                  tasksApi.generate(g.id).then((res) => {
                    setDailyTasks((prev) => {
                      const newIds = new Set(res.dailyTasks.map((dt) => dt.id));
                      return [...prev.filter((dt) => !newIds.has(dt.id) && res.dailyTasks.every((r) => r.goalId !== dt.goalId)), ...res.dailyTasks];
                    });
                    setRestDay(false);
                    if (res.dailyTasks.length === 1) setSelectedGoal(res.dailyTasks[0].goalId);
                    AsyncStorage.removeItem(`@threely_restday_gen_${todayStr}`);
                  }).catch((e) => {
                    AsyncStorage.removeItem(`@threely_restday_gen_${todayStr}`);
                    if (e instanceof Error && e.message?.includes("pro_required")) {
                      setShowPaywall(true);
                    } else {
                      showToast(e instanceof Error ? e.message : "Failed to generate tasks", "error");
                    }
                  }).finally(() => setGenerating(false));
                }}
              >
                <Text style={{ fontSize: typography.md, fontWeight: "600", color: colors.text }}>{g.title}</Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Review bottom sheet ─────────────────────────────────────────────── */}
      {reviewOpen && (
        <KeyboardAvoidingView
          style={styles.historyOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={{ flex: 1 }} onPress={closeReview} />
          <View style={styles.reviewSheet}>

            <Pressable onPress={closeReview} style={{ alignItems: "center", paddingVertical: 8 }}>
              <View style={styles.historyHandle} />
            </Pressable>

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
                <Text style={styles.reviewQuestion}>Anything we should know for tomorrow?</Text>
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
            {goals.map((goal) => {
              const isSelected = selectedGoal === goal.id;
              const stat = goalStats.find(s => s.goalId === goal.id);
              const days = daysSince(stat?.lastWorkedAt ?? null);
              const staleColor = days === null ? colors.textTertiary
                : days < 7 ? colors.success
                : days < 14 ? colors.warning
                : colors.danger;
              const offDay = stat ? !isGoalWorkDay(stat.workDays) : false;
              // Calculate remaining time from incomplete tasks for this goal
              const goalDt = dailyTasks.find(dt => dt.goalId === goal.id);
              const goalItems = goalDt && Array.isArray(goalDt.tasks) ? (goalDt.tasks as unknown as TaskItem[]) : [];
              const remainingMin = goalItems.filter(t => !t.isCompleted).reduce((s, t) => s + (t.estimated_minutes || 0), 0);
              // Show remaining time if tasks exist, otherwise fall back to daily budget
              const displayTime = goalItems.length > 0 ? remainingMin : (goal.dailyTimeMinutes ?? 0);
              const timeLabel = goalItems.length > 0 ? formatMinutes(remainingMin) : (goal.dailyTimeMinutes ? `~${formatMinutes(goal.dailyTimeMinutes)}/day` : null);
              return (
                <TouchableOpacity
                  key={goal.id}
                  style={[styles.menuItem, isSelected && styles.menuItemSelected, { flexDirection: "column", alignItems: "stretch", opacity: offDay && !isSelected ? 0.5 : 1 }]}
                  onPress={() => selectGoal(goal.id)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Text
                      style={[styles.menuItemText, isSelected && styles.menuItemTextSelected, offDay && !isSelected && { color: colors.textTertiary }, { flex: 1 }]}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {goal.title}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      {offDay && stat?.nextWorkDay ? (
                        <View style={[styles.menuTimeBadge, { backgroundColor: colors.primaryLight }]}>
                          <Text style={[styles.menuTimeBadgeText, { color: colors.primary }]}>Next: {stat.nextWorkDay}</Text>
                        </View>
                      ) : stat && stat.overdueCount > 0 ? (
                        <View style={[styles.menuTimeBadge, { backgroundColor: colors.warningLight }]}>
                          <Text style={[styles.menuTimeBadgeText, { color: colors.warning }]}>{stat.overdueCount} overdue</Text>
                        </View>
                      ) : timeLabel ? (
                        <View style={styles.menuTimeBadge}>
                          <Text style={styles.menuTimeBadgeText}>{timeLabel}</Text>
                        </View>
                      ) : null}
                      {isSelected && <Text style={styles.menuCheck}>✓</Text>}
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <Text style={[styles.menuStaleness, { color: staleColor, marginTop: 0 }]}>
                      {stalenessLabel(days)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
      {/* ── Generation limit modal ────────────────────────────────────────── */}
      <Modal visible={showGenLimit} transparent animationType="fade">
        <Pressable style={styles.welcomeOverlay} onPress={() => setShowGenLimit(false)}>
          <Pressable style={[styles.welcomeBox, { alignItems: "flex-start" }]} onPress={() => {}}>
            <Text style={{ fontSize: 32, textAlign: "center", alignSelf: "center", marginBottom: spacing.md }}>{"✦"}</Text>
            <Text style={[styles.welcomeTitle, { textAlign: "center", alignSelf: "center", color: colors.text }]}>You're on a roll!</Text>
            <Text style={[styles.welcomeSubtitle, { textAlign: "center", alignSelf: "center" }]}>
              You've already gotten extra tasks for this goal today. Instead of generating more, try these:
            </Text>

            <Text style={{ fontSize: typography.base, fontWeight: typography.bold, color: colors.text, marginBottom: 6 }}>
              ✦ Refine a task
            </Text>
            <Text style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md }}>
              Tap on any task to open it, then hit the{" "}
              <Text style={{ fontWeight: typography.bold, color: colors.primary }}>✦ Refine</Text>
              {" "}button and tell the AI what to change. Need it harder? Shorter? More specific? Just ask.
            </Text>

            <Text style={{ fontSize: typography.base, fontWeight: typography.bold, color: colors.text, marginBottom: 6 }}>
              ⚙ Adjust your plan
            </Text>
            <Text style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.lg }}>
              Increase your daily time or intensity in goal settings for automatically tougher, more in-depth tasks tomorrow.
            </Text>

            <View style={{ flexDirection: "row", gap: spacing.sm, width: "100%" }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: radius.lg,
                  borderWidth: 1.5,
                  borderColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onPress={() => {
                  setShowGenLimit(false);
                  router.push("/(tabs)/goals" as never);
                }}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: typography.sm, fontWeight: typography.bold, color: colors.primary }}>Adjust my plan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 48,
                  backgroundColor: colors.primary,
                  borderRadius: radius.lg,
                  alignItems: "center",
                  justifyContent: "center",
                  ...shadow.sm,
                }}
                onPress={() => setShowGenLimit(false)}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: typography.sm, fontWeight: typography.bold, color: colors.primaryText }}>Got it</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {/* ── App tutorial walkthrough ──────────────────────────────────────── */}
      <AppTutorial
        visible={showTutorial}
        onComplete={async () => {
          setShowTutorial(false);
          setWalkthroughActive(false);
          if (userIdRef.current) {
            await AsyncStorage.setItem(`@threely_tutorial_done_${userIdRef.current}`, "true");
          }
        }}
      />
      <Paywall visible={showPaywall} onDismiss={() => { setShowPaywall(false); refreshSubscription(); }} />
    </View>
    </SwipeNavigator>
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
    changePill: {
      backgroundColor: c.primaryLight,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: c.primary + "33",
    },
    changeText: {
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
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: radius.lg,
      paddingVertical: 14,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    primaryBtnText: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: c.primaryText,
    },
    section: { marginBottom: 0 },
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
    // Get more tasks — unlocked (all tasks done)
    getMoreBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      height: 52,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.full,
      backgroundColor: c.primary,
      marginBottom: spacing.lg,
      ...shadow.md,
    },
    getMoreTitle: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: c.primaryText,
      letterSpacing: -0.3,
    },
    // Get more tasks — locked
    getMoreBarLocked: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    getMoreTitleLocked: {
      fontSize: typography.sm,
      fontWeight: typography.medium,
      color: c.textTertiary,
      textAlign: "center",
    },
    getMoreSubtitleLocked: {
      fontSize: typography.xs,
      color: c.textTertiary,
      marginTop: 2,
      textAlign: "center",
    },
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
      maxWidth: 500,
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
      paddingVertical: 16,
      borderRadius: radius.md,
      marginBottom: 4,
    },
    menuItemSelected: { backgroundColor: c.primaryLight },
    menuItemText: {
      flex: 1,
      fontSize: typography.base,
      fontWeight: typography.medium,
      color: c.text,
    },
    menuItemTextSelected: { color: c.primary, fontWeight: typography.semibold },
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
    menuCheck: { fontSize: typography.base, color: c.primary, fontWeight: typography.bold },
    menuStaleness: {
      fontSize: typography.xs,
      fontWeight: typography.medium,
      marginTop: 2,
    },
    menuDivider: { height: 1, backgroundColor: c.border, marginHorizontal: spacing.md },
    // ── Catch up on more button ─────────────────────────────────────────────
    catchUpBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      width: "100%",
      height: 44,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.warning,
      backgroundColor: c.warningLight,
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
    },
    catchUpIcon: { fontSize: 14 },
    catchUpText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.warning,
      letterSpacing: -0.2,
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
      maxWidth: 600,
      alignSelf: "center" as const,
      width: "100%",
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
      maxWidth: 600,
      alignSelf: "center" as const,
      width: "100%",
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
    // ── Welcome to Pro modal ──────────────────────────────────────────────────
    welcomeOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
    },
    welcomeBox: {
      width: "100%",
      maxWidth: 500,
      backgroundColor: c.card,
      borderRadius: radius.xl,
      padding: spacing.xl,
      alignItems: "center",
      ...shadow.lg,
    },
    welcomeTitle: {
      fontSize: typography.xxl,
      fontWeight: typography.bold,
      color: c.text,
      letterSpacing: -0.5,
      marginBottom: spacing.sm,
      textAlign: "center",
    },
    welcomeSubtitle: {
      fontSize: typography.base,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: spacing.lg,
    },
    welcomeFeature: {
      fontSize: typography.sm,
      fontWeight: typography.medium,
      color: c.text,
      lineHeight: 22,
    },
    welcomeNote: {
      fontSize: typography.xs,
      color: c.textTertiary,
      textAlign: "center",
      marginBottom: spacing.lg,
    },
    welcomeBtn: {
      width: "100%",
      height: 50,
      backgroundColor: c.primary,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.sm,
    },
    welcomeBtnText: {
      fontSize: typography.md,
      fontWeight: typography.bold,
      color: c.primaryText,
      letterSpacing: -0.2,
    },
    // ── Pro expired banner ────────────────────────────────────────────────────
    expiredBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.primaryLight,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: c.primary,
      padding: spacing.md,
      marginBottom: spacing.lg,
      gap: spacing.md,
    },
    expiredTitle: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: c.text,
      marginBottom: 2,
    },
    expiredSubtitle: {
      fontSize: typography.xs,
      color: c.textSecondary,
    },
    expiredCta: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: c.primary,
      flexShrink: 0,
    },
  });
}
