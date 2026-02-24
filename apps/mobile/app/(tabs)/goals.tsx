import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Animated,
  Switch,
  Platform,
  Modal,
  KeyboardAvoidingView,
  FlatList,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { goalsApi, tasksApi, type Goal, type TaskItem, type ParsedGoal, type GoalChatMessage } from "@/lib/api";
import { GoalCard } from "@/components/GoalCard";
import { GoalTemplates } from "@/components/GoalTemplates";
import { SkeletonCard } from "@/components/Skeleton";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/lib/toast";
import { cancelAllNotifications } from "@/lib/notifications";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";
import type { GoalCategory } from "@/constants/goal-templates";

// ─── Date picker constants ────────────────────────────────────────────────────
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const PICKER_ITEM_HEIGHT = 52;
const PICKER_HEIGHT = PICKER_ITEM_HEIGHT * 3;

const TOTAL_ADD_STEPS = 6; // goal, confirm, deadline, time, intensity, building

const TIME_OPTIONS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
];

const SCROLL_HOURS = Array.from({ length: 15 }, (_, i) => i); // 0-14
const SCROLL_MINUTES = [0, 15, 30, 45];

const INTENSITY_OPTIONS = [
  {
    level: 1 as const,
    emoji: "🌱",
    label: "Building the habit",
    description: "Steady, sustainable progress. Short daily wins.",
  },
  {
    level: 2 as const,
    emoji: "🎯",
    label: "Making real progress",
    description: "Committed and consistent. This is getting done.",
  },
  {
    level: 3 as const,
    emoji: "🚀",
    label: "All in",
    description: "Maximum effort. Push limits every day.",
  },
];

function getDeadlineISO(month: number, day: number, year: number) {
  return new Date(year, month, day).toISOString();
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function GoalsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [pausedGoals, setPausedGoals] = useState<Goal[]>([]);
  const [completedByGoal, setCompletedByGoal] = useState<Record<string, { completed: number; total: number }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedOnce = useRef(false);

  // Template picker state
  const [showTemplates, setShowTemplates] = useState(false);

  // ── Add / Edit goal multi-step flow ────────────────────────────────────────
  // 0=hidden, 1=goal, 2=confirm, 3=deadline, 4=building/done
  const [addStep, setAddStep] = useState(0);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Step 1 — Goal input
  const [rawGoalInput, setRawGoalInput] = useState("");
  const [parsedGoal, setParsedGoal] = useState<ParsedGoal | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [parseAttemptCount, setParseAttemptCount] = useState(0);

  // Step 1 — AI Plan chat
  const [showAiChat, setShowAiChat] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "assistant"; text: string; options?: string[] }>>([]);
  const [chatMessages, setChatMessages] = useState<GoalChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatDone, setChatDone] = useState(false);
  const [chatGoalText, setChatGoalText] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");
  const chatListRef = useRef<FlatList>(null);

  // Step 3 — Deadline (default: 1 month from today)
  const now = new Date();
  const defaultDeadline = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineMonth, setDeadlineMonth] = useState(defaultDeadline.getMonth());
  const [deadlineDay, setDeadlineDay] = useState(defaultDeadline.getDate());
  const [deadlineYear, setDeadlineYear] = useState(defaultDeadline.getFullYear());
  const YEARS = Array.from({ length: 5 }, (_, i) => now.getFullYear() + i);
  const monthPickerRef = useRef<ScrollView>(null);
  const dayPickerRef = useRef<ScrollView>(null);
  const yearPickerRef = useRef<ScrollView>(null);

  // Step 4 — Daily time
  const [timeMinutes, setTimeMinutes] = useState<number | null>(null);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [scrollPickerHours, setScrollPickerHours] = useState(0);
  const [scrollPickerMinutes, setScrollPickerMinutes] = useState(0);
  const scrollHoursRef = useRef<ScrollView>(null);
  const scrollMinutesRef = useRef<ScrollView>(null);

  // Step 5 — Intensity
  const [goalIntensityLevel, setGoalIntensityLevel] = useState<1 | 2 | 3 | null>(null);

  // Step 6 — Building
  const [buildError, setBuildError] = useState("");
  const [builtTasks, setBuiltTasks] = useState<TaskItem[]>([]);
  const [coachNote, setCoachNote] = useState("");
  const taskRevealAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  // Action sheet
  const [actionGoal, setActionGoal] = useState<Goal | null>(null);

  // ── Scroll pickers to pre-filled deadline when step 3 opens ────────────────
  useEffect(() => {
    if (addStep === 3 && hasDeadline) {
      const yearIdx = YEARS.indexOf(deadlineYear);
      setTimeout(() => {
        monthPickerRef.current?.scrollTo({ y: deadlineMonth * PICKER_ITEM_HEIGHT, animated: false });
        dayPickerRef.current?.scrollTo({ y: (deadlineDay - 1) * PICKER_ITEM_HEIGHT, animated: false });
        yearPickerRef.current?.scrollTo({ y: Math.max(0, yearIdx) * PICKER_ITEM_HEIGHT, animated: false });
      }, 80);
    }
  }, [addStep]);

  // ── Load goals ──────────────────────────────────────────────────────────────
  const loadGoals = useCallback(async () => {
    try {
      const [goalsRes, pausedRes, tasksRes] = await Promise.all([
        goalsApi.list(),
        goalsApi.list(true),
        tasksApi.today(),
      ]);
      // Active goals (not paused)
      setGoals(goalsRes.goals.filter(g => !g.isPaused));
      // Paused goals (from the includePaused response)
      setPausedGoals(pausedRes.goals.filter(g => g.isPaused));
      const map: Record<string, { completed: number; total: number }> = {};
      for (const dt of tasksRes.dailyTasks) {
        const items = Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : [];
        // Only count the 3 most recent (visible) tasks, not all accumulated from "Give me more"
        const visible = items.slice(-3);
        map[dt.goalId] = {
          completed: visible.filter((t) => t.isCompleted).length,
          total: visible.length,
        };
      }
      setCompletedByGoal(map);
    } catch (e) {
      console.error(e);
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

  // ── Add flow helpers ────────────────────────────────────────────────────────
  function openAddFlow() {
    setEditingGoalId(null);
    setRawGoalInput("");
    setParsedGoal(null);
    setParseError("");
    setParseAttemptCount(0);
    setHasDeadline(true);
    setDeadlineMonth(defaultDeadline.getMonth());
    setDeadlineDay(defaultDeadline.getDate());
    setDeadlineYear(defaultDeadline.getFullYear());
    setTimeMinutes(null);
    setShowCustomTime(false);
    setGoalIntensityLevel(null);
    setBuildError("");
    setBuiltTasks([]);
    setCoachNote("");
    taskRevealAnims.forEach((a) => a.setValue(0));
    advanceAddStep(1);
  }

  function openEditFlow(goal: Goal) {
    setEditingGoalId(goal.id);
    setRawGoalInput(goal.rawInput || goal.title);
    setParsedGoal(null);
    setParseError("");
    setBuildError("");
    setBuiltTasks([]);
    setCoachNote("");
    taskRevealAnims.forEach((a) => a.setValue(0));
    if (goal.deadline) {
      const d = new Date(goal.deadline);
      setHasDeadline(true);
      setDeadlineMonth(d.getMonth());
      setDeadlineDay(d.getDate());
      setDeadlineYear(d.getFullYear());
    } else {
      setHasDeadline(true);
      setDeadlineMonth(defaultDeadline.getMonth());
      setDeadlineDay(defaultDeadline.getDate());
      setDeadlineYear(defaultDeadline.getFullYear());
    }
    setTimeMinutes(goal.dailyTimeMinutes);
    setShowCustomTime(false);
    setGoalIntensityLevel(goal.intensityLevel as 1 | 2 | 3 | null);
    advanceAddStep(1);
  }

  function advanceAddStep(next: number) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(progressAnim, {
      toValue: next / TOTAL_ADD_STEPS,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setAddStep(next);
  }

  function closeAddFlow() {
    setAddStep(0);
    setEditingGoalId(null);
    progressAnim.setValue(0);
  }

  // ── Step 1: Parse goal ────────────────────────────────────────────────────
  async function handleParseGoal() {
    if (!rawGoalInput.trim()) return;
    setParsing(true);
    setParseError("");
    try {
      const result = await goalsApi.parse(rawGoalInput.trim());
      setParsedGoal(result);
      if (result.deadline_detected) {
        const d = new Date(result.deadline_detected + "T12:00:00");
        setHasDeadline(true);
        setDeadlineMonth(d.getMonth());
        setDeadlineDay(d.getDate());
        setDeadlineYear(d.getFullYear());
      }
      // Pre-fill daily time if detected
      if (result.daily_time_detected && result.daily_time_detected > 0) {
        const mins = result.daily_time_detected;
        const preset = TIME_OPTIONS.find((o) => o.value === mins);
        if (preset) {
          setTimeMinutes(mins);
          setShowCustomTime(false);
        } else if (mins >= 180) {
          const hrs = Math.min(14, Math.floor(mins / 60));
          const remainder = SCROLL_MINUTES.reduce((prev, curr) =>
            Math.abs(curr - (mins % 60)) < Math.abs(prev - (mins % 60)) ? curr : prev
          );
          setScrollPickerHours(hrs);
          setScrollPickerMinutes(remainder);
          setTimeMinutes(hrs * 60 + remainder);
          setShowCustomTime(true);
        } else {
          const closest = TIME_OPTIONS.reduce((prev, curr) =>
            Math.abs(curr.value - mins) < Math.abs(prev.value - mins) ? curr : prev
          );
          setTimeMinutes(closest.value);
          setShowCustomTime(false);
        }
      }
      if (result.needs_more_context) {
        setParseAttemptCount((prev) => {
          const next = prev + 1;
          if (next >= 2) {
            // Auto-accept after 2 attempts
            let nextStep = 3;
            if (result.deadline_detected) nextStep = 4;
            if (result.daily_time_detected && result.daily_time_detected > 0) nextStep = 5;
            advanceAddStep(nextStep);
          } else {
            advanceAddStep(2);
          }
          return next;
        });
      } else {
        let nextStep = 3;
        if (result.deadline_detected) nextStep = 4;
        if (result.daily_time_detected && result.daily_time_detected > 0) nextStep = 5;
        advanceAddStep(nextStep);
      }
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to analyze goal. Try again.");
    } finally {
      setParsing(false);
    }
  }

  // ── Step 1: AI Plan chat ──────────────────────────────────────────────────
  async function startAiChat() {
    startAiChatWithMessage("Help me define my goal.");
  }

  async function startAiChatWithMessage(initialMessage: string) {
    setShowAiChat(true);
    setChatHistory([]);
    setChatMessages([]);
    setChatDone(false);
    setChatGoalText(null);
    setCustomInput("");
    setChatLoading(true);
    try {
      const seedMessages: GoalChatMessage[] = [{ role: "user", content: initialMessage }];
      const result = await goalsApi.chat(seedMessages);
      setChatMessages([
        { role: "user", content: initialMessage },
        { role: "assistant", content: result.raw_reply },
      ]);
      setChatHistory([
        { role: "user" as const, text: initialMessage },
        { role: "assistant" as const, text: result.message, options: result.options },
      ]);
      if (result.done) {
        setChatDone(true);
        setChatGoalText(result.goal_text);
      }
    } catch {
      setChatHistory([{ role: "assistant" as const, text: "Something went wrong. Please close and try again." }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function sendChatAnswer(answer: string) {
    setChatHistory((prev) => [...prev, { role: "user" as const, text: answer }]);
    setCustomInput("");
    setChatLoading(true);

    const newMessages: GoalChatMessage[] = [...chatMessages, { role: "user", content: answer }];
    setChatMessages(newMessages);

    try {
      const result = await goalsApi.chat(newMessages);
      const assistantMsg: GoalChatMessage = { role: "assistant", content: result.raw_reply };
      setChatMessages((prev) => [...prev, assistantMsg]);
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", text: result.message, options: result.done ? [] : result.options },
      ]);
      if (result.done) {
        setChatDone(true);
        setChatGoalText(result.goal_text);
      }
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", text: "Something went wrong. Please try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleUseGoal() {
    if (!chatGoalText) return;
    setRawGoalInput(chatGoalText);
    setShowAiChat(false);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Auto-parse and advance
    setParsing(true);
    setParseError("");
    try {
      const result = await goalsApi.parse(chatGoalText.trim());
      setParsedGoal(result);
      if (result.deadline_detected) {
        const d = new Date(result.deadline_detected + "T12:00:00");
        setHasDeadline(true);
        setDeadlineMonth(d.getMonth());
        setDeadlineDay(d.getDate());
        setDeadlineYear(d.getFullYear());
      }
      // Skip to deadline if no issues, or confirm if needs more context
      if (result.needs_more_context) {
        advanceAddStep(2);
      } else {
        let nextStep = 3;
        if (result.deadline_detected) nextStep = 4;
        if (result.daily_time_detected && result.daily_time_detected > 0) nextStep = 5;
        advanceAddStep(nextStep);
      }
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to analyze goal. Try again.");
    } finally {
      setParsing(false);
    }
  }

  // ── Step 4: Build (save goal + generate tasks) ────────────────────────────
  async function handleBuild() {
    setBuildError("");
    advanceAddStep(6);
    try {
      const goalTitle =
        parsedGoal?.short_title ??
        rawGoalInput.trim().slice(0, 40);

      const deadlineISO = hasDeadline ? getDeadlineISO(deadlineMonth, deadlineDay, deadlineYear) : undefined;
      const deadline = parsedGoal?.deadline_detected ?? deadlineISO;

      let goalId: string;

      if (editingGoalId) {
        const goalResult = await goalsApi.update(editingGoalId, {
          title: goalTitle,
          rawInput: rawGoalInput.trim(),
          structuredSummary: parsedGoal?.structured_summary ?? undefined,
          category: parsedGoal?.category ?? undefined,
          deadline: deadline ?? null,
          dailyTimeMinutes: timeMinutes ?? undefined,
          intensityLevel: goalIntensityLevel ?? undefined,
        });
        setGoals((prev) => prev.map((g) => g.id === editingGoalId ? goalResult.goal : g));
        goalId = editingGoalId;
      } else {
        const goalResult = await goalsApi.create(goalTitle, {
          rawInput: rawGoalInput.trim(),
          structuredSummary: parsedGoal?.structured_summary ?? undefined,
          category: parsedGoal?.category ?? undefined,
          deadline,
          dailyTimeMinutes: timeMinutes ?? undefined,
          intensityLevel: goalIntensityLevel ?? undefined,
        });
        setGoals((prev) => [goalResult.goal, ...prev]);
        goalId = goalResult.goal.id;
      }

      const tasksResult = await tasksApi.generate(goalId);
      const allTasks = tasksResult.dailyTasks.flatMap((dt) => dt.tasks).slice(0, 3);
      setBuiltTasks(allTasks);
      if (tasksResult.coachNote) setCoachNote(tasksResult.coachNote);

      // Staggered reveal
      allTasks.forEach((_, i) => {
        setTimeout(() => {
          Animated.spring(taskRevealAnims[i], {
            toValue: 1,
            useNativeDriver: true,
            tension: 120,
            friction: 8,
          }).start();
        }, i * 300);
      });
    } catch (e: unknown) {
      setBuildError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  }

  // ── Edit / action handlers ──────────────────────────────────────────────────
  function handleEditPress() {
    if (!actionGoal) return;
    const goal = actionGoal;
    setActionGoal(null);
    openEditFlow(goal);
  }

  async function handleMarkCompletePress() {
    if (!actionGoal) return;
    const goal = actionGoal;
    setActionGoal(null);
    Alert.alert(
      "Mark as complete?",
      `"${goal.title}" will be marked as achieved and removed from your active goals.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark complete",
          onPress: async () => {
            try {
              await goalsApi.markComplete(goal.id);
              setGoals((prev) => prev.filter((g) => g.id !== goal.id));
            } catch (e: unknown) {
              Alert.alert("Error", e instanceof Error ? e.message : "Failed to update goal");
            }
          },
        },
      ]
    );
  }

  function handleDeletePress() {
    if (!actionGoal) return;
    const goal = actionGoal;
    setActionGoal(null);
    Alert.alert(
      "Delete goal?",
      `"${goal.title}" and all its task history will be permanently deleted. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await goalsApi.delete(goal.id);
              setGoals((prev) => prev.filter((g) => g.id !== goal.id));
              setPausedGoals((prev) => prev.filter((g) => g.id !== goal.id));
              // Clear stale notifications referencing the deleted goal
              cancelAllNotifications().catch(() => {});
            } catch (e: unknown) {
              Alert.alert("Error", e instanceof Error ? e.message : "Failed to delete goal");
            }
          },
        },
      ]
    );
  }

  async function handleTogglePause() {
    if (!actionGoal) return;
    const goal = actionGoal;
    const newPaused = !goal.isPaused;
    setActionGoal(null);
    try {
      const res = await goalsApi.update(goal.id, { isActive: !newPaused } as never);
      // Optimistically update local state
      if (newPaused) {
        setGoals((prev) => prev.filter((g) => g.id !== goal.id));
        setPausedGoals((prev) => [...prev, { ...goal, isPaused: true }]);
      } else {
        setPausedGoals((prev) => prev.filter((g) => g.id !== goal.id));
        setGoals((prev) => [{ ...goal, isPaused: false }, ...prev]);
      }
      showToast(newPaused ? "Goal paused" : "Goal resumed", "success");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to update goal", "error");
      // Refetch to get correct state
      loadGoals();
    }
  }

  function handleCategorySelect(category: GoalCategory) {
    setShowTemplates(false);
    startAiChatWithMessage(category.starterMessage);
  }


  // ── Step renders ────────────────────────────────────────────────────────────

  function renderAddStep1() {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.stepScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.stepTitle}>What are you working toward?</Text>
          <Text style={styles.stepSubtitle}>
            Describe your goal and where you're at. More context means a better plan from Threely Intelligence.
          </Text>

          <TextInput
            style={[styles.goalInput, parsing && styles.goalInputDisabled]}
            placeholder="e.g. I want to grow my YouTube channel to 10k subscribers starting from 200"
            placeholderTextColor={colors.textTertiary}
            value={rawGoalInput}
            onChangeText={setRawGoalInput}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!parsing}
            autoFocus
          />

          {/* Or divider + template / AI Plan — below text input so keyboard doesn't block */}
          <View style={styles.orDivider}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orLine} />
          </View>

          <TouchableOpacity
            style={styles.aiPlanBtn}
            onPress={() => setShowTemplates(true)}
            activeOpacity={0.75}
            disabled={parsing}
          >
            <Text style={styles.aiPlanIcon}>✦</Text>
            <Text style={styles.aiPlanText}>AI Plan — let Threely guide you</Text>
          </TouchableOpacity>

          {parseError ? <Text style={styles.errorText}>{parseError}</Text> : null}
          {parsedGoal?.needs_more_context && parsedGoal.recommendations && addStep === 1 ? (
            <View style={styles.hintCard}>
              <Text style={styles.hintCardTitle}>Things that would strengthen your plan</Text>
              <Text style={styles.hintCardBody}>{parsedGoal.recommendations}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueBtn, (!rawGoalInput.trim() || parsing) && styles.continueBtnDisabled]}
            onPress={handleParseGoal}
            activeOpacity={rawGoalInput.trim() && !parsing ? 0.85 : 1}
            disabled={parsing}
          >
            {parsing ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.continueBtnText}>Analyzing your goal…</Text>
              </>
            ) : (
              <Text style={[styles.continueBtnText, !rawGoalInput.trim() && styles.continueBtnTextDisabled]}>
                Analyze my goal →
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderAddStep2() {
    if (!parsedGoal) return null;
    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.stepScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.stepTitle}>Review your goal</Text>

          <View style={styles.confirmCard}>
            <View style={styles.confirmHeader}>
              <Text style={styles.confirmIcon}>✦</Text>
              <Text style={styles.confirmTitle}>Threely Intelligence read your goal</Text>
            </View>
            {parsedGoal.category ? (
              <View style={styles.categoryChip}>
                <Text style={styles.categoryText}>{parsedGoal.category}</Text>
              </View>
            ) : null}
            <Text style={styles.confirmSummary}>{parsedGoal.structured_summary}</Text>
            {parsedGoal.deadline_detected ? (
              <Text style={styles.confirmDeadline}>
                📅 Deadline: {new Date(parsedGoal.deadline_detected + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </Text>
            ) : null}
            {parsedGoal.needs_more_context && parsedGoal.recommendations ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>⚠ Your plan could be more personalized</Text>
                <Text style={styles.warningBody}>{parsedGoal.recommendations}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {parsedGoal.needs_more_context ? (
            <View style={styles.footerStack}>
              <TouchableOpacity style={styles.continueBtn} onPress={() => { advanceAddStep(1); setParsedGoal(null); }} activeOpacity={0.85}>
                <Text style={styles.continueBtnText}>Add more detail →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.continueBtn, { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.primary + "40" }]}
                onPress={() => startAiChatWithMessage(rawGoalInput.trim())}
                activeOpacity={0.85}
              >
                <Text style={[styles.continueBtnText, { color: colors.primary }]}>✦ Use AI instead</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipWarningBtn} onPress={() => advanceAddStep(3)} activeOpacity={0.7}>
                <Text style={styles.skipWarningText}>Continue anyway</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.continueBtn} onPress={() => advanceAddStep(3)} activeOpacity={0.85}>
              <Text style={styles.continueBtnText}>Looks good →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  function renderAddStep3() {
    const days = Array.from({ length: DAYS_IN_MONTH[deadlineMonth] }, (_, i) => i + 1);
    const deadlineLabel = hasDeadline
      ? new Date(deadlineYear, deadlineMonth, deadlineDay).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : null;

    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>Do you have a deadline?</Text>
          <Text style={styles.stepSubtitle}>
            A deadline helps Threely Intelligence pace your tasks. If you skip this, we'll use a 90-day rolling horizon.
          </Text>

          <View style={styles.deadlineToggleRow}>
            <Text style={styles.deadlineToggleLabel}>I have a target date</Text>
            <Switch
              value={hasDeadline}
              onValueChange={(v) => {
                if (Platform.OS !== "web") Haptics.selectionAsync();
                setHasDeadline(v);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.card}
            />
          </View>

          {hasDeadline && (
            <View style={styles.datePickerRow}>
              {/* Month */}
              <View style={styles.dateColumn}>
                <Text style={styles.dateColumnLabel}>Month</Text>
                <View style={styles.pickerWrap}>
                  <View style={styles.pickerSelectionBar} pointerEvents="none" />
                  <ScrollView
                    ref={monthPickerRef}
                    style={{ height: PICKER_HEIGHT }}
                    contentContainerStyle={{ paddingVertical: PICKER_ITEM_HEIGHT }}
                    snapToInterval={PICKER_ITEM_HEIGHT}
                    decelerationRate="fast"
                    showsVerticalScrollIndicator={false}
                    onMomentumScrollEnd={(e) => {
                      const idx = Math.round(e.nativeEvent.contentOffset.y / PICKER_ITEM_HEIGHT);
                      setDeadlineMonth(Math.max(0, Math.min(idx, 11)));
                    }}
                  >
                    {MONTHS.map((m, i) => (
                      <View key={m} style={styles.pickerItem}>
                        <Text style={[styles.pickerItemText, deadlineMonth === i && styles.pickerItemTextSelected]}>{m}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Day */}
              <View style={styles.dateColumn}>
                <Text style={styles.dateColumnLabel}>Day</Text>
                <View style={styles.pickerWrap}>
                  <View style={styles.pickerSelectionBar} pointerEvents="none" />
                  <ScrollView
                    ref={dayPickerRef}
                    style={{ height: PICKER_HEIGHT }}
                    contentContainerStyle={{ paddingVertical: PICKER_ITEM_HEIGHT }}
                    snapToInterval={PICKER_ITEM_HEIGHT}
                    decelerationRate="fast"
                    showsVerticalScrollIndicator={false}
                    onMomentumScrollEnd={(e) => {
                      const idx = Math.round(e.nativeEvent.contentOffset.y / PICKER_ITEM_HEIGHT);
                      setDeadlineDay(days[Math.max(0, Math.min(idx, days.length - 1))]);
                    }}
                  >
                    {days.map((d) => (
                      <View key={d} style={styles.pickerItem}>
                        <Text style={[styles.pickerItemText, deadlineDay === d && styles.pickerItemTextSelected]}>{d}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Year */}
              <View style={styles.dateColumn}>
                <Text style={styles.dateColumnLabel}>Year</Text>
                <View style={styles.pickerWrap}>
                  <View style={styles.pickerSelectionBar} pointerEvents="none" />
                  <ScrollView
                    ref={yearPickerRef}
                    style={{ height: PICKER_HEIGHT }}
                    contentContainerStyle={{ paddingVertical: PICKER_ITEM_HEIGHT }}
                    snapToInterval={PICKER_ITEM_HEIGHT}
                    decelerationRate="fast"
                    showsVerticalScrollIndicator={false}
                    onMomentumScrollEnd={(e) => {
                      const idx = Math.round(e.nativeEvent.contentOffset.y / PICKER_ITEM_HEIGHT);
                      setDeadlineYear(YEARS[Math.max(0, Math.min(idx, YEARS.length - 1))]);
                    }}
                  >
                    {YEARS.map((y) => (
                      <View key={y} style={styles.pickerItem}>
                        <Text style={[styles.pickerItemText, deadlineYear === y && styles.pickerItemTextSelected]}>{y}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.continueBtn} onPress={() => advanceAddStep(4)} activeOpacity={0.85}>
            <Text style={styles.continueBtnText}>
              {deadlineLabel ? `Set deadline: ${deadlineLabel}` : "No deadline →"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function openCustomPicker() {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    const current = timeMinutes ?? 30;
    const h = Math.min(14, Math.floor(current / 60));
    const m = SCROLL_MINUTES.reduce((prev, curr) =>
      Math.abs(curr - (current % 60)) < Math.abs(prev - (current % 60)) ? curr : prev
    );
    setScrollPickerHours(h);
    setScrollPickerMinutes(m);
    setTimeMinutes(h * 60 + m);
    setShowCustomTime(true);
    setTimeout(() => {
      scrollHoursRef.current?.scrollTo({ y: h * PICKER_ITEM_HEIGHT, animated: false });
      scrollMinutesRef.current?.scrollTo({ y: SCROLL_MINUTES.indexOf(m) * PICKER_ITEM_HEIGHT, animated: false });
    }, 80);
  }

  function renderAddStep4() {
    const canContinue = timeMinutes !== null;
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.stepScroll}>
          <Text style={styles.stepTitle}>How much time daily for this goal?</Text>
          <Text style={styles.stepSubtitle}>
            Threely Intelligence will size your tasks to fit this window.
          </Text>

          <View style={styles.timeGrid}>
            {TIME_OPTIONS.map((opt) => {
              const isSelected = !showCustomTime && timeMinutes === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.timeChip, isSelected && styles.timeChipSelected]}
                  onPress={() => {
                    if (Platform.OS !== "web") Haptics.selectionAsync();
                    setTimeMinutes(opt.value);
                    setShowCustomTime(false);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.timeLabel, isSelected && styles.timeLabelSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.timeChip, showCustomTime && styles.timeChipSelected]}
              onPress={openCustomPicker}
              activeOpacity={0.75}
            >
              <Text style={[styles.timeLabel, showCustomTime && styles.timeLabelSelected]}>
                {showCustomTime ? `${scrollPickerHours > 0 ? scrollPickerHours + "h " : ""}${scrollPickerMinutes}m` : "+ Custom"}
              </Text>
            </TouchableOpacity>
          </View>

          {showCustomTime && (
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateColumnLabel}>Hours</Text>
                <View style={styles.pickerWrap}>
                  <View style={styles.pickerSelectionBar} pointerEvents="none" />
                  <ScrollView
                    ref={scrollHoursRef}
                    style={{ height: PICKER_HEIGHT }}
                    contentContainerStyle={{ paddingVertical: PICKER_ITEM_HEIGHT }}
                    snapToInterval={PICKER_ITEM_HEIGHT}
                    decelerationRate="fast"
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                    onMomentumScrollEnd={(e) => {
                      const idx = Math.round(e.nativeEvent.contentOffset.y / PICKER_ITEM_HEIGHT);
                      const h = SCROLL_HOURS[Math.max(0, Math.min(idx, SCROLL_HOURS.length - 1))];
                      setScrollPickerHours(h);
                      setTimeMinutes(h * 60 + scrollPickerMinutes);
                    }}
                  >
                    {SCROLL_HOURS.map((h) => (
                      <View key={h} style={styles.pickerItem}>
                        <Text style={styles.pickerItemText}>{h}h</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateColumnLabel}>Minutes</Text>
                <View style={styles.pickerWrap}>
                  <View style={styles.pickerSelectionBar} pointerEvents="none" />
                  <ScrollView
                    ref={scrollMinutesRef}
                    style={{ height: PICKER_HEIGHT }}
                    contentContainerStyle={{ paddingVertical: PICKER_ITEM_HEIGHT }}
                    snapToInterval={PICKER_ITEM_HEIGHT}
                    decelerationRate="fast"
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                    onMomentumScrollEnd={(e) => {
                      const idx = Math.round(e.nativeEvent.contentOffset.y / PICKER_ITEM_HEIGHT);
                      const m = SCROLL_MINUTES[Math.max(0, Math.min(idx, SCROLL_MINUTES.length - 1))];
                      setScrollPickerMinutes(m);
                      setTimeMinutes(scrollPickerHours * 60 + m);
                    }}
                  >
                    {SCROLL_MINUTES.map((m) => (
                      <View key={m} style={styles.pickerItem}>
                        <Text style={styles.pickerItemText}>{m}m</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
            onPress={() => canContinue && advanceAddStep(5)}
            activeOpacity={canContinue ? 0.85 : 1}
          >
            <Text style={[styles.continueBtnText, !canContinue && styles.continueBtnTextDisabled]}>
              Continue →
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderAddStep5() {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>What's your pace for this goal?</Text>
          <Text style={styles.stepSubtitle}>
            This shapes how ambitious Threely Intelligence makes your tasks.
          </Text>

          <View style={styles.intensityList}>
            {INTENSITY_OPTIONS.map((opt) => {
              const isSelected = goalIntensityLevel === opt.level;
              return (
                <TouchableOpacity
                  key={opt.level}
                  style={[styles.intensityCard, isSelected && styles.intensityCardSelected]}
                  onPress={() => {
                    if (Platform.OS !== "web") Haptics.selectionAsync();
                    setGoalIntensityLevel(opt.level);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.intensityEmoji}>{opt.emoji}</Text>
                  <View style={styles.intensityText}>
                    <Text style={[styles.intensityLabel, isSelected && styles.intensityLabelSelected]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.intensityDescription}>{opt.description}</Text>
                  </View>
                  {isSelected && <Text style={styles.intensityCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueBtn, !goalIntensityLevel && styles.continueBtnDisabled]}
            onPress={goalIntensityLevel ? handleBuild : undefined}
            activeOpacity={goalIntensityLevel ? 0.85 : 1}
          >
            <Text style={styles.continueBtnText}>Build my plan →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderAddStep6() {
    const tasksReady = builtTasks.length > 0;

    if (!tasksReady && !buildError) {
      return (
        <View style={styles.buildingCenter}>
          <Text style={styles.buildIcon}>✦</Text>
          <Text style={styles.buildTitle}>Threely Intelligence is building your plan…</Text>
          <Text style={styles.buildSubtitle}>Crafting 3 personalized tasks to get you started.</Text>
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        </View>
      );
    }

    if (buildError) {
      return (
        <View style={styles.buildingCenter}>
          <Text style={styles.buildIcon}>⚠</Text>
          <Text style={styles.buildTitle}>Something went wrong</Text>
          <Text style={styles.buildError}>{buildError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleBuild} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.buildReadyTitle}>Your plan is ready ✦</Text>
          {coachNote ? <Text style={styles.coachNote}>{coachNote}</Text> : null}
          <View style={{ gap: spacing.md, marginTop: spacing.md }}>
            {builtTasks.map((task, i) => (
              <Animated.View
                key={task.id}
                style={[
                  styles.taskRevealCard,
                  {
                    opacity: taskRevealAnims[i],
                    transform: [{ translateY: taskRevealAnims[i].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
                  },
                ]}
              >
                <View style={styles.taskRevealRow}>
                  <Text style={styles.taskRevealName}>{task.task}</Text>
                  {task.estimated_minutes ? (
                    <View style={styles.timeBadge}>
                      <Text style={styles.timeBadgeText}>~{task.estimated_minutes}m</Text>
                    </View>
                  ) : null}
                </View>
                {task.why ? <Text style={styles.taskRevealWhy}>{task.why}</Text> : null}
              </Animated.View>
            ))}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity style={styles.continueBtn} onPress={closeAddFlow} activeOpacity={0.85}>
            <Text style={styles.continueBtnText}>{editingGoalId ? "Save changes →" : "Done →"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Full-screen add flow overlay ────────────────────────────────────────────

  function renderAddFlow() {
    if (addStep === 0) return null;
    const isBuildStep = addStep === 6;

    return (
      <View style={[styles.addFlowOverlay, { paddingTop: insets.top }]}>
        {/* Progress bar */}
        {!isBuildStep && (
          <View style={styles.progressTrack}>
            <Animated.View
              style={[styles.progressFill, { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]}
            />
          </View>
        )}

        {/* Step counter + close/back */}
        <View style={styles.addFlowHeader}>
          {!isBuildStep ? (
            <Text style={styles.stepCounter}>{editingGoalId ? "Edit goal" : `Step ${addStep} of ${TOTAL_ADD_STEPS - 1}`}</Text>
          ) : <View />}
          {addStep > 1 && !isBuildStep ? (
            <TouchableOpacity onPress={() => advanceAddStep(addStep - 1)} activeOpacity={0.7}>
              <Text style={styles.backBtn}>‹ Back</Text>
            </TouchableOpacity>
          ) : !isBuildStep ? (
            <TouchableOpacity onPress={closeAddFlow} activeOpacity={0.7}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {addStep === 1 && renderAddStep1()}
        {addStep === 2 && renderAddStep2()}
        {addStep === 3 && renderAddStep3()}
        {addStep === 4 && renderAddStep4()}
        {addStep === 5 && renderAddStep5()}
        {addStep === 6 && renderAddStep6()}

        {/* ── Goal Templates Modal ── */}
        <Modal
          visible={showTemplates}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowTemplates(false)}
        >
          <SafeAreaView style={[styles.chatModal, { padding: spacing.lg }]}>
            <GoalTemplates
              onSelect={handleCategorySelect}
              onClose={() => setShowTemplates(false)}
              onOther={() => {
                setShowTemplates(false);
                startAiChatWithMessage("Help me define my goal.");
              }}
            />
          </SafeAreaView>
        </Modal>

        {/* ── AI Plan Chat Modal ── */}
        <Modal
          visible={showAiChat}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowAiChat(false)}
        >
          <SafeAreaView style={styles.chatModal}>
            {/* Header */}
            <View style={styles.chatHeader}>
              <View style={styles.chatHeaderLeft}>
                <Text style={styles.chatHeaderIcon}>✦</Text>
                <Text style={styles.chatHeaderTitle}>Threely Intelligence</Text>
              </View>
              <TouchableOpacity
                style={styles.chatCloseBtn}
                onPress={() => setShowAiChat(false)}
                hitSlop={12}
              >
                <Text style={styles.chatCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            {/* Chat messages */}
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={0}
            >
              <FlatList
                ref={chatListRef}
                data={[
                  ...chatHistory,
                  ...(chatLoading ? [{ role: "loading" as const, text: "" }] : []),
                  ...(chatDone && chatGoalText ? [{ role: "goal" as const, text: chatGoalText }] : []),
                ]}
                keyExtractor={(_, i) => String(i)}
                contentContainerStyle={styles.chatList}
                onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
                renderItem={({ item, index }) => {
                  if (item.role === "loading") {
                    return (
                      <View style={styles.chatBubbleAssistant}>
                        <ActivityIndicator color={colors.primary} size="small" />
                      </View>
                    );
                  }

                  if (item.role === "goal") {
                    return (
                      <View style={styles.chatGoalCard}>
                        <Text style={styles.chatGoalLabel}>Your goal</Text>
                        <Text style={styles.chatGoalText}>{item.text}</Text>
                      </View>
                    );
                  }

                  const isAssistant = item.role === "assistant";
                  const isLastAssistant = isAssistant && index === chatHistory.length - 1;
                  const options = (item as { options?: string[] }).options;

                  return (
                    <View>
                      <View style={isAssistant ? styles.chatBubbleAssistant : styles.chatBubbleUser}>
                        <Text style={isAssistant ? styles.chatBubbleAssistantText : styles.chatBubbleUserText}>
                          {item.text}
                        </Text>
                      </View>
                      {isLastAssistant && options && options.length > 0 && !chatLoading && !chatDone && (
                        <>
                          <View style={styles.chatOptions}>
                            {options.map((opt, j) => (
                              <TouchableOpacity
                                key={j}
                                style={styles.chatOptionBtn}
                                onPress={() => sendChatAnswer(opt)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.chatOptionText}>{opt}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <Text style={{ fontSize: typography.sm, color: colors.textTertiary, textAlign: "center", marginTop: spacing.sm }}>or type your own below</Text>
                        </>
                      )}
                    </View>
                  );
                }}
              />

              {/* Bottom input / Use this goal */}
              <View style={styles.chatFooter}>
                {chatDone ? (
                  <View style={{ gap: spacing.sm }}>
                    <TouchableOpacity
                      style={styles.continueBtn}
                      onPress={handleUseGoal}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.continueBtnText}>Use this goal →</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setChatDone(false);
                        setChatGoalText(null);
                        sendChatAnswer("I'd like to change something about my goal.");
                      }}
                      style={{ alignItems: "center", paddingVertical: 6 }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: typography.sm, color: colors.textSecondary, textDecorationLine: "underline" }}>
                        Edit goal
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.chatInputRow}>
                    <TextInput
                      style={[styles.chatInput, !chatDone && chatHistory.length > 0 && (chatHistory[chatHistory.length - 1] as { options?: string[] }).options?.length ? { borderColor: colors.primary + "55" } : undefined]}
                      placeholder="Type your own answer…"
                      placeholderTextColor={colors.textTertiary}
                      value={customInput}
                      onChangeText={setCustomInput}
                      editable={!chatLoading}
                      returnKeyType="send"
                      onSubmitEditing={() => {
                        if (customInput.trim() && !chatLoading) sendChatAnswer(customInput.trim());
                      }}
                    />
                    <TouchableOpacity
                      style={[styles.chatSendBtn, (!customInput.trim() || chatLoading) && { opacity: 0.4 }]}
                      onPress={() => customInput.trim() && !chatLoading && sendChatAnswer(customInput.trim())}
                      activeOpacity={0.75}
                      disabled={!customInput.trim() || chatLoading}
                    >
                      <Text style={styles.chatSendText}>Send</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      </View>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Goals</Text>
            <Text style={styles.subtitle}>Loading...</Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Goals</Text>
          <Text style={styles.subtitle}>
            {goals.length} active{pausedGoals.length > 0 ? ` · ${pausedGoals.length} paused` : ""}
          </Text>
        </View>
        <TouchableOpacity style={styles.fab} onPress={openAddFlow} activeOpacity={0.85}>
          <Ionicons name="add" size={24} color={colors.primaryText} />
        </TouchableOpacity>
      </View>

      {/* Goal list */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {goals.length === 0 && pausedGoals.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyTitle}>No goals yet</Text>
            <Text style={styles.emptySubtitle}>
              Add your first goal and Threely will generate 3 daily tasks to keep you moving.
            </Text>
            <Button title="Add your first goal" onPress={openAddFlow} style={styles.emptyBtn} />
          </View>
        ) : (
          <>
            {goals.map((goal) => {
              const cStats = completedByGoal[goal.id];
              return (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  completedToday={cStats?.completed ?? 0}
                  totalToday={cStats?.total ?? 3}
                  onPress={() => setActionGoal(goal)}
                />
              );
            })}

            {/* Paused goals section */}
            {pausedGoals.length > 0 && (
              <>
                <Text style={styles.pausedSectionLabel}>PAUSED</Text>
                {pausedGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    completedToday={0}
                    totalToday={0}
                    onPress={() => setActionGoal(goal)}
                    isPaused
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Action Sheet ──────────────────────────────────────────────────────── */}
      {!!actionGoal && (
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={() => setActionGoal(null)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle} numberOfLines={1}>{actionGoal.title}</Text>
            <Text style={styles.sheetSubtitle}>What would you like to do?</Text>

            <Pressable style={styles.actionRow} onPress={handleEditPress}>
              <View style={[styles.actionIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="pencil-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Add more detail</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.actionRow} onPress={handleTogglePause}>
              <View style={[styles.actionIcon, { backgroundColor: colors.warningLight }]}>
                <Ionicons
                  name={actionGoal.isPaused ? "play-outline" : "pause-outline"}
                  size={18}
                  color={colors.warning}
                />
              </View>
              <Text style={[styles.actionLabel, { color: colors.warning }]}>
                {actionGoal.isPaused ? "Resume goal" : "Pause goal"}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.actionRow} onPress={handleMarkCompletePress}>
              <View style={[styles.actionIcon, { backgroundColor: colors.successLight }]}>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.success }]}>Mark as complete</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.actionRow} onPress={handleDeletePress}>
              <View style={[styles.actionIcon, { backgroundColor: colors.dangerLight }]}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.danger }]}>Delete goal</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </Pressable>
            <Button title="Cancel" onPress={() => setActionGoal(null)} variant="outline" style={styles.cancelBtn} />
          </View>
        </View>
      )}

      {/* ── Add / Edit goal full-screen flow ─────────────────────────────────────────── */}
      {renderAddFlow()}
    </SafeAreaView>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { alignItems: "center", justifyContent: "center" },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    title: { fontSize: typography.xxl, fontWeight: typography.bold, color: c.text, letterSpacing: -0.5 },
    subtitle: { fontSize: typography.sm, color: c.textSecondary, marginTop: 2 },
    fab: {
      width: 44,
      height: 44,
      borderRadius: radius.full,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.md,
    },
    scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
    empty: { alignItems: "center", paddingVertical: spacing.xxl, paddingTop: spacing.xxl },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md },
    emptyTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: c.text, marginBottom: spacing.sm },
    emptySubtitle: {
      fontSize: typography.base,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.xl,
    },
    emptyBtn: { width: "100%" },

    // ── Sheets ─────────────────────────────────────────────────────────────────
    overlay: {
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: c.overlay,
      justifyContent: "flex-end",
      zIndex: 100,
    },
    backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
      ...shadow.lg,
    },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: "center", marginBottom: spacing.lg },
    sheetTitle: { fontSize: typography.xl, fontWeight: typography.bold, color: c.text, letterSpacing: -0.3, marginBottom: 4 },
    sheetSubtitle: { fontSize: typography.sm, color: c.textSecondary, marginBottom: spacing.lg },
    actionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
    actionIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
    actionLabel: { flex: 1, fontSize: typography.base, fontWeight: typography.medium, color: c.text },
    divider: { height: 1, backgroundColor: c.border, marginVertical: 2 },
    cancelBtn: { marginTop: spacing.md },

    // ── Add flow overlay ────────────────────────────────────────────────────────
    addFlowOverlay: {
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: c.bg,
      zIndex: 200,
      flex: 1,
    },
    progressTrack: { height: 3, backgroundColor: c.border, marginBottom: spacing.xs },
    progressFill: { height: 3, backgroundColor: c.primary, borderRadius: 2 },
    addFlowHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    stepCounter: { fontSize: typography.xs, fontWeight: typography.semibold, color: c.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 },
    backBtn: { fontSize: typography.base, color: c.textSecondary },
    closeBtn: { fontSize: typography.base, color: c.textSecondary, paddingHorizontal: spacing.sm },

    stepScroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    stepTitle: { fontSize: typography.xxxl, fontWeight: typography.bold, color: c.text, letterSpacing: -0.8, lineHeight: 42, marginBottom: spacing.sm, marginTop: spacing.md },
    stepSubtitle: { fontSize: typography.base, color: c.textSecondary, lineHeight: 22, marginBottom: spacing.xl },

    goalInput: {
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.md,
      fontSize: typography.base,
      color: c.text,
      backgroundColor: c.card,
      minHeight: 120,
      lineHeight: 22,
    },
    goalInputDisabled: { opacity: 0.5 },
    errorText: { fontSize: typography.sm, color: c.danger, marginTop: spacing.sm },

    hintCard: {
      marginTop: spacing.md,
      backgroundColor: c.primaryLight,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.primary + "33",
      padding: spacing.md,
    },
    hintCardTitle: { fontSize: typography.sm, fontWeight: typography.semibold, color: c.primary, marginBottom: spacing.xs },
    hintCardBody: { fontSize: typography.sm, color: c.textSecondary, lineHeight: 20 },

    confirmCard: {
      backgroundColor: c.card,
      borderRadius: radius.xl,
      borderWidth: 1.5,
      borderColor: c.primary + "33",
      padding: spacing.lg,
      marginTop: spacing.xs,
    },
    confirmHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm },
    confirmIcon: { fontSize: 16, color: c.primary },
    confirmTitle: { fontSize: typography.xs, fontWeight: typography.bold, color: c.primary, textTransform: "uppercase", letterSpacing: 0.8 },
    categoryChip: { alignSelf: "flex-start", backgroundColor: c.primaryLight, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4, marginBottom: spacing.sm },
    categoryText: { fontSize: typography.sm, fontWeight: typography.semibold, color: c.primary },
    confirmSummary: { fontSize: typography.base, fontWeight: typography.semibold, color: c.text, lineHeight: 22, marginBottom: spacing.sm },
    confirmDeadline: { fontSize: typography.sm, color: c.textSecondary, marginBottom: spacing.sm },
    warningCard: {
      marginTop: spacing.md,
      backgroundColor: "#FFF8EC",
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: "#F5A623" + "55",
      padding: spacing.md,
    },
    warningTitle: { fontSize: typography.sm, fontWeight: typography.semibold, color: "#B45309", marginBottom: spacing.xs },
    warningBody: { fontSize: typography.sm, color: "#92400E", lineHeight: 20 },

    footerStack: { gap: spacing.sm },
    footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.sm },
    continueBtn: {
      backgroundColor: c.primary,
      borderRadius: radius.full,
      paddingVertical: 16,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: spacing.sm,
    },
    continueBtnDisabled: { backgroundColor: c.border },
    continueBtnText: { fontSize: typography.base, fontWeight: typography.bold, color: c.primaryText },
    continueBtnTextDisabled: { color: c.textTertiary },
    skipWarningBtn: { alignItems: "center", paddingVertical: spacing.sm },
    skipWarningText: { fontSize: typography.sm, color: c.textTertiary, textDecorationLine: "underline" },

    // ── Paused section label ──────────────────────────────────────────────────
    pausedSectionLabel: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: c.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    // ── Or divider + AI Plan ─────────────────────────────────────────────────
    orDivider: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    orLine: {
      flex: 1,
      height: 1,
      backgroundColor: c.border,
    },
    orText: {
      fontSize: typography.sm,
      color: c.textTertiary,
      fontWeight: typography.medium,
    },
    aiPlanBtn: {
      height: 52,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: c.primary + "40",
      backgroundColor: c.card,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: spacing.sm,
      ...shadow.sm,
    },
    aiPlanIcon: {
      fontSize: 16,
      color: c.primary,
    },
    aiPlanText: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: c.primary,
    },

    // ── Deadline picker ─────────────────────────────────────────────────────────
    deadlineToggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    deadlineToggleLabel: { fontSize: typography.base, fontWeight: typography.medium, color: c.text },
    datePickerRow: { flexDirection: "row", gap: spacing.sm },
    dateColumn: { flex: 1 },
    dateColumnLabel: { fontSize: typography.xs, fontWeight: typography.semibold, color: c.textTertiary, textTransform: "uppercase", letterSpacing: 0.8, textAlign: "center", marginBottom: spacing.sm },
    pickerWrap: {
      position: "relative",
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      overflow: "hidden",
      marginBottom: spacing.lg,
    },
    pickerSelectionBar: {
      position: "absolute",
      left: 0, right: 0,
      top: PICKER_ITEM_HEIGHT,
      height: PICKER_ITEM_HEIGHT,
      backgroundColor: c.primaryLight,
      borderTopWidth: 1.5,
      borderBottomWidth: 1.5,
      borderColor: c.primary + "55",
    },
    pickerItem: { height: PICKER_ITEM_HEIGHT, alignItems: "center", justifyContent: "center" },
    pickerItemText: { fontSize: typography.lg, fontWeight: typography.semibold, color: c.text },
    pickerItemTextSelected: { color: c.primary },

    // ── Time step ────────────────────────────────────────────────────────────────
    timeGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    timeChip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.card,
      minWidth: "45%",
      alignItems: "center",
      ...shadow.sm,
    },
    timeChipSelected: {
      borderColor: c.primary,
      backgroundColor: c.primaryLight,
    },
    timeLabel: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: c.text,
    },
    timeLabelSelected: {
      color: c.primary,
    },

    // ── Intensity step ──────────────────────────────────────────────────────────
    intensityList: {
      gap: spacing.md,
    },
    intensityCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: c.card,
      borderRadius: radius.xl,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: spacing.md,
      ...shadow.sm,
    },
    intensityCardSelected: {
      borderColor: c.primary,
      backgroundColor: c.primaryLight,
    },
    intensityEmoji: {
      fontSize: 28,
      flexShrink: 0,
    },
    intensityText: {
      flex: 1,
      gap: 2,
    },
    intensityLabel: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: c.text,
    },
    intensityLabelSelected: {
      color: c.primary,
    },
    intensityDescription: {
      fontSize: typography.sm,
      color: c.textSecondary,
      lineHeight: 18,
    },
    intensityCheck: {
      fontSize: typography.base,
      color: c.primary,
      fontWeight: typography.bold,
    },

    // ── Build step ──────────────────────────────────────────────────────────────
    buildingCenter: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
    buildIcon: { fontSize: 40, color: c.primary, marginBottom: spacing.md },
    buildTitle: { fontSize: typography.xl, fontWeight: typography.bold, color: c.text, textAlign: "center", marginBottom: spacing.sm },
    buildSubtitle: { fontSize: typography.base, color: c.textSecondary, textAlign: "center", lineHeight: 22 },
    buildError: { fontSize: typography.sm, color: c.danger, textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.lg },
    retryBtn: { backgroundColor: c.primary, borderRadius: radius.full, paddingVertical: 14, paddingHorizontal: spacing.xl },
    retryBtnText: { fontSize: typography.base, fontWeight: typography.bold, color: c.primaryText },

    buildReadyTitle: { fontSize: typography.xxl, fontWeight: typography.bold, color: c.text, letterSpacing: -0.5, marginBottom: spacing.sm, marginTop: spacing.md },
    coachNote: { fontSize: typography.sm, color: c.textSecondary, lineHeight: 20, marginBottom: spacing.sm, fontStyle: "italic" },
    taskRevealCard: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      ...shadow.sm,
    },
    taskRevealRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
    taskRevealName: { flex: 1, fontSize: typography.base, fontWeight: typography.semibold, color: c.text, lineHeight: 22 },
    timeBadge: { backgroundColor: c.primaryLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
    timeBadgeText: { fontSize: typography.xs, fontWeight: typography.semibold, color: c.primary },
    taskRevealWhy: { fontSize: typography.sm, color: c.textSecondary, lineHeight: 18, marginTop: spacing.xs, fontStyle: "italic" },

    // ── AI Chat Modal ────────────────────────────────────────────────────────
    chatModal: {
      flex: 1,
      backgroundColor: c.bg,
    },
    chatHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.card,
    },
    chatHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    chatHeaderIcon: {
      fontSize: 18,
      color: c.primary,
    },
    chatHeaderTitle: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: c.text,
    },
    chatCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    chatCloseText: {
      fontSize: 18,
      color: c.textSecondary,
      lineHeight: 20,
    },
    chatList: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    chatBubbleAssistant: {
      backgroundColor: c.primaryLight,
      borderRadius: 14,
      borderBottomLeftRadius: 4,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      maxWidth: "85%",
      alignSelf: "flex-start",
    },
    chatBubbleAssistantText: {
      fontSize: typography.base,
      color: c.text,
      lineHeight: 22,
    },
    chatBubbleUser: {
      backgroundColor: c.primary,
      borderRadius: 14,
      borderBottomRightRadius: 4,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      maxWidth: "85%",
      alignSelf: "flex-end",
    },
    chatBubbleUserText: {
      fontSize: typography.base,
      color: c.primaryText,
      lineHeight: 22,
    },
    chatOptions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    chatOptionBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: c.primary + "40",
      backgroundColor: c.card,
    },
    chatOptionText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.primary,
    },
    chatGoalCard: {
      backgroundColor: c.card,
      borderRadius: radius.xl,
      borderWidth: 1.5,
      borderColor: c.primary + "44",
      padding: spacing.md,
      marginTop: spacing.sm,
      ...shadow.sm,
    },
    chatGoalLabel: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.primary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: spacing.sm,
    },
    chatGoalText: {
      fontSize: typography.base,
      color: c.text,
      lineHeight: 22,
      fontWeight: typography.medium,
    },
    chatFooter: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.card,
    },
    chatInputRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    chatInput: {
      flex: 1,
      height: 44,
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      fontSize: typography.base,
      color: c.text,
    },
    chatSendBtn: {
      height: 44,
      paddingHorizontal: spacing.md,
      backgroundColor: c.primary,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    chatSendText: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: c.primaryText,
    },
  });
}
