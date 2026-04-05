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
  PanResponder,
  Dimensions,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { SwipeNavigator } from "@/components/SwipeNavigator";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { goalsApi, tasksApi, type Goal, type TaskItem, type ParsedGoal, type GoalChatMessage, type GoalChatResult } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { GoalCard } from "@/components/GoalCard";
import { GoalTemplates } from "@/components/GoalTemplates";
import { MOCK_TUTORIAL_GOAL } from "@/lib/mock-tutorial-data";
import { SkeletonCard } from "@/components/Skeleton";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/lib/toast";
import { cancelAllNotifications } from "@/lib/notifications";
import { useTheme } from "@/lib/theme";
import { useSubscription } from "@/lib/subscription-context";
import { useWalkthroughRegistry } from "@/lib/walkthrough-registry";
import Paywall from "@/components/Paywall";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";
import type { GoalCategory } from "@/constants/goal-templates";

// ─── Date picker constants ────────────────────────────────────────────────────
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const PICKER_ITEM_HEIGHT = 52;
const PICKER_HEIGHT = PICKER_ITEM_HEIGHT * 3;

const TOTAL_ADD_STEPS = 6; // goal, confirm, deadline, time, workdays, building

const WORK_DAY_PRESETS = [
  { label: "Every day", value: [1, 2, 3, 4, 5, 6, 7] },
  { label: "Weekdays (Mon\u2013Fri)", value: [1, 2, 3, 4, 5] },
  { label: "Weekends (Sat\u2013Sun)", value: [6, 7] },
  { label: "Mon, Wed, Fri", value: [1, 3, 5] },
] as const;

const DAY_LABELS = [
  { iso: 1, short: "M" },
  { iso: 2, short: "T" },
  { iso: 3, short: "W" },
  { iso: 4, short: "T" },
  { iso: 5, short: "F" },
  { iso: 6, short: "S" },
  { iso: 7, short: "S" },
];

const TIME_OPTIONS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
];

const SCROLL_HOURS = Array.from({ length: 15 }, (_, i) => i); // 0-14
const SCROLL_MINUTES = [0, 15, 30, 45];


function getDeadlineISO(month: number, day: number, year: number) {
  return new Date(year, month, day).toISOString();
}

// iPad-friendly max content width
const MAX_CONTENT_WIDTH = 600;

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function GoalsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 768;
  const router = useRouter();
  const { showToast } = useToast();
  const { isLimitedMode, walkthroughActive, refreshSubscription } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);
  const { register, registerScroll } = useWalkthroughRegistry();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [pausedGoals, setPausedGoals] = useState<Goal[]>([]);
  const [completedByGoal, setCompletedByGoal] = useState<Record<string, { completed: number; total: number }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedOnce = useRef(false);

  // Step 1: show templates grid by default, free text when "Something else" is tapped
  const [showFreeText, setShowFreeText] = useState(false);

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
  const [showTypingInput, setShowTypingInput] = useState(false);
  const [chatError, setChatError] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const chatInputRef = useRef<TextInput>(null);
  const chatListRef = useRef<FlatList>(null);

  // Auto-scroll chat when new messages arrive or chat completes
  useEffect(() => {
    if (chatHistory.length > 0 || chatDone) {
      // Double-fire: immediate for content, delayed for options/goal card layout
      requestAnimationFrame(() => chatListRef.current?.scrollToEnd({ animated: true }));
      setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 400);
    }
  }, [chatHistory.length, chatDone]);

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

  // Step 5 — Work days
  const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [showCustomDays, setShowCustomDays] = useState(false);

  // Step 6 — Building
  const [buildError, setBuildError] = useState("");
  const [builtTasks, setBuiltTasks] = useState<TaskItem[]>([]);
  const [coachNote, setCoachNote] = useState("");
  const [offDayMessage, setOffDayMessage] = useState<string | null>(null);
  const [buildRetrying, setBuildRetrying] = useState(false);
  const buildProgressAnim = useRef(new Animated.Value(0)).current;
  const [buildStageText, setBuildStageText] = useState("Analyzing your goal...");
  const buildStageTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const createdGoalIdRef = useRef<string | null>(null);
  const buildInProgressRef = useRef(false);
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

  // ── Add flow helpers ────────────────────────────────────────────────────────
  function openAddFlow() {
    // Allow first goal free — only gate if user already has goals
    if (isLimitedMode && !walkthroughActive && goals.length > 0) { setShowPaywall(true); return; }
    // 3-goal limit
    const activeCount = goals.length;
    if (activeCount >= 3) {
      Alert.alert(
        "3 Goals. Total Focus.",
        "Threely gives you 3 tasks per goal, per day \u2014 designed for deep focus and real progress. More than 3 active goals spreads you too thin.\n\nPause or complete a goal to make room for a new one.",
        [{ text: "Got it", style: "default" }]
      );
      return;
    }
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

    setBuildError("");
    setBuiltTasks([]);
    setCoachNote("");
    setOffDayMessage(null);
    createdGoalIdRef.current = null;
    buildInProgressRef.current = false;
    taskRevealAnims.forEach((a) => a.setValue(0));
    setShowFreeText(false);
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
    createdGoalIdRef.current = null;
    buildInProgressRef.current = false;
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
    setWorkDays(goal.workDays ?? [1, 2, 3, 4, 5, 6, 7]);
    setShowCustomDays(false);

    setShowFreeText(true); // Skip templates when editing
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
    createdGoalIdRef.current = null;
    buildInProgressRef.current = false;
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
      // Pre-fill work days if detected
      if (result.work_days_detected && result.work_days_detected.length > 0) {
        setWorkDays(result.work_days_detected);
        const isCustom = !WORK_DAY_PRESETS.some(
          (p) => p.value.length === result.work_days_detected!.length && p.value.every((d) => result.work_days_detected!.includes(d))
        );
        setShowCustomDays(isCustom);
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
      if (e instanceof Error && e.message?.includes("pro_required")) {
        closeAddFlow();
        setShowPaywall(true);
      } else {
        setParseError(e instanceof Error ? e.message : "Failed to analyze goal. Try again.");
      }
    } finally {
      setParsing(false);
    }
  }

  // ── Step 1: AI Plan chat ──────────────────────────────────────────────────
  async function chatWithRetry(messages: GoalChatMessage[]): Promise<GoalChatResult> {
    try {
      return await goalsApi.chat(messages);
    } catch (e) {
      // Retry once on transient failures (timeout, network, server error)
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("pro_required") || msg.includes("cancelled")) throw e;
      try {
        return await goalsApi.chat(messages);
      } catch (retryErr) {
        // If retry also fails, throw a user-friendly message
        const retryMsg = retryErr instanceof Error ? retryErr.message : "";
        if (retryMsg.includes("pro_required")) throw retryErr;
        throw new Error("Unable to reach the server. Please check your connection and try again.");
      }
    }
  }

  async function startAiChat() {
    startAiChatWithMessage("Help me define my goal.");
  }

  async function startAiChatWithMessage(initialMessage: string) {
    setShowAiChat(true);
    setChatHistory([]);
    setChatMessages([]);
    setChatDone(false);
    setChatError("");
    setChatGoalText(null);
    setCustomInput("");
    setShowTypingInput(false);
    setChatLoading(true);
    try {
      const seedMessages: GoalChatMessage[] = [{ role: "user", content: initialMessage }];
      const result = await chatWithRetry(seedMessages);
      setChatMessages([
        { role: "user", content: initialMessage },
        { role: "assistant", content: result.raw_reply },
      ]);
      setChatHistory([
        { role: "user" as const, text: initialMessage },
        { role: "assistant" as const, text: result.message, options: result.options },
      ]);
      // Auto-show text input when AI sends no options
      if (!result.options || result.options.length === 0) {
        setShowTypingInput(true);
      }
      if (result.done) {
        setChatDone(true);
        setChatGoalText(result.goal_text);
      }
    } catch (err) {
      if (err instanceof Error && err.message?.includes("pro_required")) {
        setShowAiChat(false);
        closeAddFlow();
        setShowPaywall(true);
      } else {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.warn("[goals chat]", msg);
        setChatHistory([{ role: "assistant" as const, text: "Something went wrong. Please close and try again." }]);
      }
    } finally {
      setChatLoading(false);
    }
  }

  async function sendChatAnswer(answer: string) {
    setChatHistory((prev) => [...prev, { role: "user" as const, text: answer }]);
    setCustomInput("");
    setSelectedOptions(new Set());
    setChatLoading(true);
    setChatError("");

    const newMessages: GoalChatMessage[] = [...chatMessages, { role: "user", content: answer }];
    setChatMessages(newMessages);

    try {
      const result = await chatWithRetry(newMessages);
      const assistantMsg: GoalChatMessage = { role: "assistant", content: result.raw_reply };
      setChatMessages((prev) => [...prev, assistantMsg]);
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", text: result.message, options: result.done ? [] : result.options },
      ]);
      // Save name if returned by AI
      if (result.name) {
        const formatted = result.name.trim().replace(/\s+/g, " ").split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
        AsyncStorage.setItem("@threely_nickname", formatted).catch(() => {});
        supabase.auth.updateUser({ data: { display_name: formatted } }).catch(() => {});
      }
      // Show text input when AI sends no options, hide when options are available
      if (!result.done && (!result.options || result.options.length === 0)) {
        setShowTypingInput(true);
      } else {
        setShowTypingInput(false);
      }
      if (result.done) {
        setChatDone(true);
        setChatGoalText(result.goal_text);
        setShowTypingInput(false);
      }
    } catch (err) {
      if (err instanceof Error && err.message?.includes("pro_required")) {
        setShowAiChat(false);
        closeAddFlow();
        setShowPaywall(true);
      } else {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.warn("[goals chat]", msg);
        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", text: "Something went wrong. Tap retry below to try again." },
        ]);
        setChatError("retry_send");
      }
    } finally {
      setChatLoading(false);
    }
  }

  async function handleUseGoal() {
    if (!chatGoalText) return;
    const goalText = chatGoalText.trim();
    setRawGoalInput(goalText);
    setShowAiChat(false);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Go straight to building — AI chat already covered all details
    setBuildError("");
    advanceAddStep(TOTAL_ADD_STEPS); // show building screen immediately
    try {
      const result = await goalsApi.parse(goalText);
      setParsedGoal(result);
      if (result.work_days_detected && result.work_days_detected.length > 0) {
        setWorkDays(result.work_days_detected);
      }
      // Build immediately with parsed data
      await handleBuild({ goalText, parsed: result, dailyMinutes: result.daily_time_detected && result.daily_time_detected > 0 ? result.daily_time_detected : undefined });
    } catch (e) {
      setBuildError(e instanceof Error ? e.message : "Failed to analyze goal. Try again.");
    }
  }

  // ── Progress bar helpers ────────────────────────────────────────────────────
  function startBuildProgress(isRetry?: boolean) {
    // Clear previous timers
    buildStageTimers.current.forEach(clearTimeout);
    buildStageTimers.current = [];
    setBuildRetrying(!!isRetry);

    if (isRetry) {
      buildProgressAnim.setValue(0.30);
      setBuildStageText("Sorry, taking longer than usual — lots of traffic right now");
      buildStageTimers.current.push(setTimeout(() => {
        setBuildStageText("Still working on it...");
        Animated.timing(buildProgressAnim, { toValue: 0.55, duration: 5000, useNativeDriver: false }).start();
      }, 4000));
      buildStageTimers.current.push(setTimeout(() => {
        setBuildStageText("Almost there...");
        Animated.timing(buildProgressAnim, { toValue: 0.80, duration: 8000, useNativeDriver: false }).start();
      }, 10000));
    } else {
      buildProgressAnim.setValue(0);
      setBuildStageText("Understanding your situation...");
      Animated.timing(buildProgressAnim, { toValue: 0.25, duration: 3000, useNativeDriver: false }).start();
      buildStageTimers.current.push(setTimeout(() => {
        setBuildStageText("Mapping out your path...");
        Animated.timing(buildProgressAnim, { toValue: 0.55, duration: 5000, useNativeDriver: false }).start();
      }, 3000));
      buildStageTimers.current.push(setTimeout(() => {
        setBuildStageText("Creating today's tasks...");
        Animated.timing(buildProgressAnim, { toValue: 0.85, duration: 7000, useNativeDriver: false }).start();
      }, 8000));
      buildStageTimers.current.push(setTimeout(() => {
        setBuildStageText("Locking it in...");
        Animated.timing(buildProgressAnim, { toValue: 0.95, duration: 10000, useNativeDriver: false }).start();
      }, 15000));
    }
  }

  function finishBuildProgress() {
    buildStageTimers.current.forEach(clearTimeout);
    buildStageTimers.current = [];
    Animated.timing(buildProgressAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
  }

  // ── Step 4: Build (save goal + generate tasks) ────────────────────────────
  const buildTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleBuild(overrides?: {
    goalText?: string;
    parsed?: ParsedGoal;
    dailyMinutes?: number;
  }) {
    // Prevent double-taps while build is in progress
    if (buildInProgressRef.current) return;
    buildInProgressRef.current = true;
    setBuildError("");
    setBuildRetrying(false);
    advanceAddStep(TOTAL_ADD_STEPS);
    startBuildProgress();

    // Safety timeout: if the entire build (incl. retries) takes longer than 90s,
    // surface an error so the user is never stuck on a frozen screen.
    if (buildTimeoutRef.current) clearTimeout(buildTimeoutRef.current);
    buildTimeoutRef.current = setTimeout(() => {
      buildInProgressRef.current = false;
      setBuildError("This is taking longer than expected. Please check your connection and try again.");
    }, 90_000);

    // Use overrides if provided (when called directly from handleUseGoal before state updates)
    const effectiveGoalText = overrides?.goalText ?? rawGoalInput.trim();
    const effectiveParsed = overrides?.parsed ?? parsedGoal;
    const effectiveTime = overrides?.dailyMinutes ?? timeMinutes;

    const MAX_RETRIES = 2;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          startBuildProgress(true);
          await new Promise(r => setTimeout(r, 2000));
        }

        const goalTitle =
          effectiveParsed?.short_title ??
          effectiveGoalText.slice(0, 40);

        const deadlineISO = hasDeadline ? getDeadlineISO(deadlineMonth, deadlineDay, deadlineYear) : undefined;
        const deadline = effectiveParsed?.deadline_detected ?? deadlineISO ?? undefined;
        const effectiveWorkDays = (effectiveParsed?.work_days_detected && effectiveParsed.work_days_detected.length > 0)
          ? effectiveParsed.work_days_detected : workDays;

        let goalId: string;

        if (editingGoalId) {
          const goalResult = await goalsApi.update(editingGoalId, {
            title: goalTitle,
            rawInput: effectiveGoalText,
            structuredSummary: effectiveParsed?.structured_summary ?? undefined,
            category: effectiveParsed?.category ?? undefined,
            deadline: deadline ?? null,
            dailyTimeMinutes: effectiveTime ?? 60,
            intensityLevel: 2,
            workDays: effectiveWorkDays,
          });
          setGoals((prev) => prev.map((g) => g.id === editingGoalId ? goalResult.goal : g));
          goalId = editingGoalId;
        } else if (createdGoalIdRef.current) {
          goalId = createdGoalIdRef.current;
          const goalResult = await goalsApi.update(goalId, {
            title: goalTitle,
            rawInput: effectiveGoalText,
            structuredSummary: effectiveParsed?.structured_summary ?? undefined,
            category: effectiveParsed?.category ?? undefined,
            deadline: deadline ?? null,
            dailyTimeMinutes: effectiveTime ?? 60,
            intensityLevel: 2,
            workDays: effectiveWorkDays,
          });
          setGoals((prev) => prev.map((g) => g.id === goalId ? goalResult.goal : g));
        } else {
          const goalResult = await goalsApi.create(goalTitle, {
            rawInput: effectiveGoalText,
            structuredSummary: effectiveParsed?.structured_summary ?? undefined,
            category: effectiveParsed?.category ?? undefined,
            deadline,
            dailyTimeMinutes: effectiveTime ?? 60,
            intensityLevel: 2,
            workDays: effectiveWorkDays,
          });
          setGoals((prev) => [goalResult.goal, ...prev]);
          goalId = goalResult.goal.id;
          createdGoalIdRef.current = goalId;
        }

        // Check if today is a work day for this goal
        const todayJs = new Date().getDay();
        const todayIsoDay = todayJs === 0 ? 7 : todayJs;
        const isTodayWorkDay = effectiveWorkDays.length === 0 || effectiveWorkDays.length === 7 || effectiveWorkDays.includes(todayIsoDay);

        if (isTodayWorkDay) {
          const tasksResult = await tasksApi.generate(goalId);
          const allTasks = tasksResult.dailyTasks.flatMap((dt) => dt.tasks).slice(0, 3);
          finishBuildProgress();
          setBuiltTasks(allTasks);
          if (tasksResult.coachNote) setCoachNote(tasksResult.coachNote);

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
        } else {
          const dayNames = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
          const sorted = [...effectiveWorkDays].sort((a, b) => a - b);
          const nextDay = sorted.find(d => d > todayIsoDay) ?? sorted[0];
          finishBuildProgress();
          setOffDayMessage(`Your first tasks will appear on ${dayNames[nextDay]}!`);
        }

        // Success — break out of retry loop
        lastError = null;
        break;
      } catch (e: unknown) {
        lastError = e;
        if (e instanceof Error && e.message?.includes("pro_required")) {
          closeAddFlow();
          setShowPaywall(true);
          lastError = null;
          break;
        }
        // If not last attempt, continue to next retry
        if (attempt < MAX_RETRIES) continue;
      }
    }

    // Clear the safety timeout
    if (buildTimeoutRef.current) {
      clearTimeout(buildTimeoutRef.current);
      buildTimeoutRef.current = null;
    }

    if (lastError) {
      setBuildError(lastError instanceof Error ? lastError.message : "Something went wrong. Please try again.");
    }
    setBuildRetrying(false);
    buildInProgressRef.current = false;
  }

  // ── Edit / action handlers ──────────────────────────────────────────────────
  function handleEditPress() {
    if (!actionGoal) return;
    if (isLimitedMode && !walkthroughActive) { setActionGoal(null); setShowPaywall(true); return; }
    const goal = actionGoal;
    setActionGoal(null);
    // Set editing context so save flow updates the existing goal
    setEditingGoalId(goal.id);
    setRawGoalInput(goal.rawInput || goal.title);
    if (goal.deadline) {
      const d = new Date(goal.deadline);
      setHasDeadline(true);
      setDeadlineMonth(d.getMonth());
      setDeadlineDay(d.getDate());
      setDeadlineYear(d.getFullYear());
    }
    setTimeMinutes(goal.dailyTimeMinutes);
    setWorkDays(goal.workDays ?? [1, 2, 3, 4, 5, 6, 7]);

    // Open the add flow overlay (step 1) so the AI chat modal can render
    setAddStep(1);

    // Open AI chat with context about the existing goal
    startAiChatWithMessage(`I have an existing goal: "${goal.title}"${goal.structuredSummary ? ` — ${goal.structuredSummary}` : ""}. I'd like to make some changes to it. Ask me what I'd like to change and offer a few options like: change the deadline/timeline, adjust daily time commitment, change which days I work on it, refine the goal itself, or something else.`);
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
    if (isLimitedMode && !walkthroughActive) { setActionGoal(null); setShowPaywall(true); return; }
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
    startAiChatWithMessage(category.starterMessage);
  }


  // ── Step renders ────────────────────────────────────────────────────────────

  function renderAddStep1() {
    // When editing, don't show templates — AI chat is the only UI
    if (editingGoalId) return null;
    // Show free-text input when "Something else" is tapped
    if (showFreeText) {
      return (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        >
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
              style={styles.goalInput}
              placeholder="e.g. I want to grow my YouTube channel to 10k subscribers starting from 200"
              placeholderTextColor={colors.textTertiary}
              value={rawGoalInput}
              onChangeText={setRawGoalInput}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.continueBtn, !rawGoalInput.trim() && styles.continueBtnDisabled]}
              onPress={() => startAiChatWithMessage(rawGoalInput.trim())}
              activeOpacity={rawGoalInput.trim() ? 0.85 : 1}
              disabled={!rawGoalInput.trim()}
            >
              <Text style={[styles.continueBtnText, !rawGoalInput.trim() && styles.continueBtnTextDisabled]}>
                Continue →
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      );
    }

    // Default: show category templates grid
    return (
      <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <GoalTemplates
          onSelect={handleCategorySelect}
          onClose={closeAddFlow}
          onOther={() => setShowFreeText(true)}
          closeLabel="✕"
        />
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
                <Text style={styles.continueBtnText}>Edit goal →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.continueBtn, { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.primary + "40" }]}
                onPress={() => startAiChatWithMessage(rawGoalInput.trim())}
                activeOpacity={0.85}
              >
                <Text style={[styles.continueBtnText, { color: colors.primary }]}>Use AI instead</Text>
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
            onPress={canContinue ? () => advanceAddStep(5) : undefined}
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
    const matchesPreset = WORK_DAY_PRESETS.find(
      (p) => p.value.length === workDays.length && p.value.every((d) => workDays.includes(d))
    );

    function toggleDay(iso: number) {
      setWorkDays((prev) => {
        if (prev.includes(iso)) {
          if (prev.length <= 1) return prev;
          return prev.filter((d) => d !== iso);
        }
        return [...prev, iso].sort();
      });
    }

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Which days will you work on this?</Text>
        <Text style={styles.stepSubtitle}>Pick a schedule that fits your routine.</Text>

        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          {WORK_DAY_PRESETS.map((preset) => {
            const isActive = !showCustomDays && matchesPreset?.label === preset.label;
            return (
              <TouchableOpacity
                key={preset.label}
                style={[styles.optionChip, isActive && styles.optionChipActive]}
                onPress={() => {
                  setShowCustomDays(false);
                  setWorkDays([...preset.value]);
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.optionChip, showCustomDays && styles.optionChipActive]}
            onPress={() => {
              setShowCustomDays(true);
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.optionChipText, showCustomDays && styles.optionChipTextActive]}>
              Custom
            </Text>
          </TouchableOpacity>

          {showCustomDays && (
            <View style={styles.dayCircleRow}>
              {DAY_LABELS.map((day) => {
                const isActive = workDays.includes(day.iso);
                return (
                  <TouchableOpacity
                    key={day.iso}
                    style={[styles.dayCircle, isActive && styles.dayCircleActive]}
                    onPress={() => {
                      toggleDay(day.iso);
                      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.dayCircleText, isActive && styles.dayCircleTextActive]}>
                      {day.short}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => handleBuild()}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>Build my plan →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderBuildingStep() {
    const tasksReady = builtTasks.length > 0;
    const isOffDay = offDayMessage !== null;

    if (!tasksReady && !buildError && !isOffDay) {
      return (
        <View style={styles.buildingCenter}>
          <Text style={styles.buildTitle}>
            {buildRetrying ? "Still working on it..." : "Threely Intelligence is building your plan\u2026"}
          </Text>
          <Text style={styles.buildSubtitle}>{buildStageText}</Text>
          {/* Progress bar */}
          <View style={{
            width: "80%",
            height: 6,
            backgroundColor: colors.border,
            borderRadius: 3,
            marginTop: spacing.lg,
            overflow: "hidden",
          }}>
            <Animated.View style={{
              height: "100%",
              backgroundColor: colors.primary,
              borderRadius: 3,
              width: buildProgressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            }} />
          </View>
          <Text style={{
            fontSize: 12,
            color: colors.textSecondary,
            marginTop: spacing.sm,
            textAlign: "center",
          }}>
            {buildRetrying ? "Lots of traffic right now — hang tight" : "This can take up to 30 seconds"}
          </Text>
        </View>
      );
    }

    if (buildError) {
      return (
        <View style={styles.buildingCenter}>
          <Text style={styles.buildIcon}>{"\u26A0"}</Text>
          <Text style={styles.buildTitle}>Something went wrong</Text>
          <Text style={styles.buildError}>{buildError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => handleBuild()} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.buildReadyTitle}>{isOffDay ? "Goal created" : "Your plan is ready"}</Text>
          {coachNote ? <Text style={styles.coachNote}>{coachNote}</Text> : null}

          {isOffDay ? (
            <View style={{
              backgroundColor: colors.primaryLight,
              borderRadius: radius.lg,
              padding: spacing.xl,
              alignItems: "center",
              marginTop: spacing.md,
            }}>
              <Text style={{ fontSize: 40, marginBottom: spacing.sm }}>📅</Text>
              <Text style={{
                fontSize: typography.lg,
                fontWeight: "700" as const,
                color: colors.text,
                textAlign: "center",
                marginBottom: spacing.xs,
              }}>
                {offDayMessage}
              </Text>
              <Text style={{
                fontSize: typography.sm,
                color: colors.textSecondary,
                textAlign: "center",
                lineHeight: 20,
              }}>
                We'll generate your first 3 tasks on your next scheduled day.
              </Text>
            </View>
          ) : (
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
          )}
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
    const isBuildStep = addStep === TOTAL_ADD_STEPS;

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

        {/* Step counter + close/back — hidden when showing templates (GoalTemplates has its own header) */}
        {!(addStep === 1 && !showFreeText) && (
          <View style={styles.addFlowHeader}>
            {!isBuildStep && addStep > 1 ? (
              <Text style={styles.stepCounter}>{editingGoalId ? "Edit goal" : ""}</Text>
            ) : <View />}
            {(addStep === 1 && showFreeText) ? (
              <TouchableOpacity onPress={() => setShowFreeText(false)} activeOpacity={0.7}>
                <Text style={styles.backBtn}>‹ Back</Text>
              </TouchableOpacity>
            ) : addStep > 1 && !isBuildStep ? (
              <TouchableOpacity onPress={() => advanceAddStep(addStep - 1)} activeOpacity={0.7}>
                <Text style={styles.backBtn}>‹ Back</Text>
              </TouchableOpacity>
            ) : !isBuildStep ? (
              <TouchableOpacity onPress={closeAddFlow} activeOpacity={0.7}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {addStep === 1 && renderAddStep1()}
        {addStep === 2 && renderAddStep2()}
        {addStep === 3 && renderAddStep3()}
        {addStep === 4 && renderAddStep4()}
        {addStep === 5 && renderAddStep5()}
        {addStep === TOTAL_ADD_STEPS && renderBuildingStep()}

        {/* ── AI Plan Chat Modal ── */}
        <Modal
          visible={showAiChat}
          animationType="slide"
          onRequestClose={() => { setShowAiChat(false); if (editingGoalId && addStep === 1) closeAddFlow(); }}
        >
          <KeyboardAvoidingView
            style={styles.chatModal}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 50 : 0}
          >
            {/* Header */}
            <View style={[styles.chatHeaderBlock, { paddingTop: insets.top }]}>
              <View style={styles.chatHeader}>
                <View style={{ width: 32 }} />
                <View style={styles.chatHeaderLeft}>
                  <Text style={styles.chatHeaderTitle}>Threely Intelligence</Text>
                </View>
                <TouchableOpacity
                  style={styles.chatCloseBtn}
                  onPress={() => { setShowAiChat(false); if (editingGoalId && addStep === 1) closeAddFlow(); }}
                  hitSlop={12}
                >
                  <Text style={styles.chatCloseText}>×</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Chat progress bar */}
            {(() => {
              const userMsgCount = chatHistory.filter((m) => m.role === "user").length;
              const totalExpected = 10;
              const progress = chatDone ? 1 : Math.min(userMsgCount / totalExpected, 0.95);
              return (
                <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: spacing.xs }}>
                  <View style={{ height: 4, backgroundColor: colors.primary, borderRadius: 2, width: `${Math.round(progress * 100)}%` }} />
                </View>
              );
            })()}

            {/* Chat messages */}
              <FlatList
                ref={chatListRef}
                data={[
                  ...chatHistory,
                  ...(chatLoading ? [{ role: "loading" as const, text: "" }] : []),
                  ...(chatDone && chatGoalText ? [{ role: "goal" as const, text: chatGoalText }] : []),
                ]}
                keyExtractor={(_, i) => String(i)}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[styles.chatList, { flexGrow: 1, paddingBottom: spacing.xxl * 2 }]}
                onContentSizeChange={() => {
                  requestAnimationFrame(() => chatListRef.current?.scrollToEnd({ animated: true }));
                  setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 300);
                }}
                onLayout={() => {
                  requestAnimationFrame(() => chatListRef.current?.scrollToEnd({ animated: false }));
                }}
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
                      {isLastAssistant && options && options.length > 0 && !chatLoading && !chatDone && showTypingInput && (
                        <View style={[styles.chatOptions, { marginTop: spacing.sm }]}>
                          <TouchableOpacity
                            style={[styles.chatOptionBtn, { borderColor: colors.border, borderWidth: 1, backgroundColor: colors.bg }]}
                            onPress={() => {
                              setShowTypingInput(false);
                              setCustomInput("");
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.chatOptionText, { color: colors.textSecondary }]}>Show options</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      {isLastAssistant && options && options.length > 0 && !chatLoading && !chatDone && !showTypingInput && (
                        <View style={styles.chatOptions}>
                          {options.map((opt, j) => {
                            const isSelected = selectedOptions.has(opt);
                            return (
                              <TouchableOpacity
                                key={j}
                                style={[
                                  styles.chatOptionBtn,
                                  isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                                ]}
                                onPress={() => {
                                  if (Platform.OS !== "web") Haptics.selectionAsync();
                                  setSelectedOptions((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(opt)) next.delete(opt);
                                    else next.add(opt);
                                    return next;
                                  });
                                  setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 200);
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={[
                                  styles.chatOptionText,
                                  isSelected && { color: colors.primaryText },
                                ]}>{isSelected ? `✓ ${opt}` : opt}</Text>
                              </TouchableOpacity>
                            );
                          })}
                          <TouchableOpacity
                            style={[styles.chatOptionBtn, { borderColor: colors.border, borderWidth: 1, backgroundColor: colors.bg }]}
                            onPress={() => {
                              setShowTypingInput(true);
                              setTimeout(() => chatInputRef.current?.focus(), 150);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.chatOptionText, { color: colors.textSecondary }]}>Type my own</Text>
                          </TouchableOpacity>
                          {selectedOptions.size > 0 && (
                            <TouchableOpacity
                              style={[styles.chatOptionBtn, { backgroundColor: colors.primary, borderColor: colors.primary, width: "100%", alignItems: "center", marginTop: spacing.sm, paddingVertical: spacing.md }]}
                              onPress={() => sendChatAnswer(Array.from(selectedOptions).join(" + "))}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.chatOptionText, { color: colors.primaryText, fontWeight: "700", fontSize: typography.base }]}>
                                Continue with {selectedOptions.size} selected →
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                }}
              />

              {/* Retry button after send failure */}
              {chatError === "retry_send" && !chatLoading && (
                <View style={[styles.chatFooter, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
                  <TouchableOpacity
                    style={styles.continueBtn}
                    onPress={async () => {
                      setChatError("");
                      setChatHistory((prev) => prev.slice(0, -1));
                      setChatLoading(true);
                      try {
                        const result = await chatWithRetry(chatMessages);
                        const assistantMsg: GoalChatMessage = { role: "assistant", content: result.raw_reply };
                        setChatMessages((prev) => [...prev, assistantMsg]);
                        setChatHistory((prev) => [
                          ...prev,
                          { role: "assistant", text: result.message, options: result.done ? [] : result.options },
                        ]);
                        if (!result.done && (!result.options || result.options.length === 0)) {
                          setShowTypingInput(true);
                        } else {
                          setShowTypingInput(false);
                        }
                        if (result.done) {
                          setChatDone(true);
                          setChatGoalText(result.goal_text);
                          setShowTypingInput(false);
                        }
                      } catch (retryErr) {
                        console.warn("[goals chat retry]", retryErr);
                        setChatHistory((prev) => [
                          ...prev,
                          { role: "assistant", text: "Still having trouble. Please check your connection and try again." },
                        ]);
                        setChatError("retry_send");
                      } finally {
                        setChatLoading(false);
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.continueBtnText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Bottom: typing input */}
              {showTypingInput && !chatDone && !chatError && (
                <View style={[styles.chatFooter, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
                  <View style={styles.chatInputRow}>
                    <TextInput
                      ref={chatInputRef}
                      style={styles.chatInput}
                      placeholder="Type your answer…"
                      placeholderTextColor={colors.textTertiary}
                      value={customInput}
                      onChangeText={setCustomInput}
                      editable={!chatLoading}
                      returnKeyType="send"
                      autoFocus
                      onSubmitEditing={() => {
                        if (customInput.trim() && !chatLoading) {
                          sendChatAnswer(customInput.trim());
                        }
                      }}
                    />
                    <TouchableOpacity
                      style={[styles.chatSendBtn, (!customInput.trim() || chatLoading) && { opacity: 0.4 }]}
                      onPress={() => {
                        if (customInput.trim() && !chatLoading) {
                          sendChatAnswer(customInput.trim());
                        }
                      }}
                      activeOpacity={0.75}
                      disabled={!customInput.trim() || chatLoading}
                    >
                      <Text style={styles.chatSendText}>Send</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setShowTypingInput(false); setCustomInput(""); }}
                      style={{ paddingHorizontal: 8, paddingVertical: 10 }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 18, color: colors.textTertiary }}>×</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {chatDone && (
                <View style={[styles.chatFooter, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
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
                </View>
              )}
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  }

  // During tutorial walkthrough, always use mock data for consistent spotlight targets
  const effectiveGoals = walkthroughActive ? [MOCK_TUTORIAL_GOAL] : goals;

  // ── Main render ─────────────────────────────────────────────────────────────

  const wideContentStyle = isWide ? { maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" as const, width: "100%" as const } : undefined;

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
            {effectiveGoals.length} active{pausedGoals.length > 0 ? ` · ${pausedGoals.length} paused` : ""}
          </Text>
        </View>
        <TouchableOpacity style={styles.fab} onPress={openAddFlow} activeOpacity={0.85}>
          <Ionicons name="add" size={24} color={colors.primaryText} />
        </TouchableOpacity>
      </View>

      {/* Goal list */}
      <ScrollView
        ref={r => registerScroll("goals-scroll", r)}
        contentContainerStyle={[styles.scroll, wideContentStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {effectiveGoals.length === 0 && pausedGoals.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyTitle}>What will you achieve?</Text>
            <Text style={styles.emptySubtitle}>
              Set a goal and your AI coach will break it into 3 small daily tasks — the proven way to make real progress.
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.lg }}>
              <Text style={{ fontSize: typography.xs, color: colors.textSecondary }}>AI-powered tasks</Text>
              <Text style={{ fontSize: typography.xs, color: colors.textTertiary }}>·</Text>
              <Text style={{ fontSize: typography.xs, color: colors.textSecondary }}>Daily coaching</Text>
              <Text style={{ fontSize: typography.xs, color: colors.textTertiary }}>·</Text>
              <Text style={{ fontSize: typography.xs, color: colors.textSecondary }}>Progress tracking</Text>
            </View>
            <Button title="Create your first goal" onPress={openAddFlow} style={styles.emptyBtn} />
          </View>
        ) : (
          <>
            {effectiveGoals.map((goal, goalIdx) => {
              const isMock = goal.id === MOCK_TUTORIAL_GOAL.id;
              const cStats = completedByGoal[goal.id];
              const card = (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  completedToday={cStats?.completed ?? 0}
                  totalToday={cStats?.total ?? 3}
                  onPress={() => { if (!isMock) setActionGoal(goal); }}
                  onMenu={() => { if (!isMock) setActionGoal(goal); }}
                  onViewTasks={isMock ? undefined : () => {
                    AsyncStorage.setItem("@threely_switch_goal", goal.id);
                    router.push("/(tabs)");
                  }}
                  {...(goalIdx === 0 ? { menuRef: (r: any) => register("goal-menu-button", r) } : {})}
                />
              );
              return goalIdx === 0 ? (
                <View key={goal.id} ref={r => register("first-goal-card", r)} collapsable={false}>
                  {card}
                </View>
              ) : card;
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
                    onMenu={() => setActionGoal(goal)}
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
        <GoalActionSheet
          goal={actionGoal}
          colors={colors}
          styles={styles}
          onClose={() => setActionGoal(null)}
          onEdit={handleEditPress}
          onTogglePause={handleTogglePause}
          onMarkComplete={handleMarkCompletePress}
          onDelete={handleDeletePress}
        />
      )}

      {/* ── Add / Edit goal full-screen flow ─────────────────────────────────────────── */}
      {renderAddFlow()}
      <Paywall visible={showPaywall} onDismiss={() => { setShowPaywall(false); refreshSubscription(); }} />
    </SafeAreaView>
    </SwipeNavigator>
  );
}

// ─── Swipe-to-dismiss goal action sheet ──────────────────────────────────────

const SHEET_DISMISS_THRESHOLD = 120;

function GoalActionSheet({
  goal, colors, styles, onClose, onEdit, onTogglePause, onMarkComplete, onDelete,
}: {
  goal: Goal;
  colors: Colors;
  styles: ReturnType<typeof createStyles>;
  onClose: () => void;
  onEdit: () => void;
  onTogglePause: () => void;
  onMarkComplete: () => void;
  onDelete: () => void;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: Dimensions.get("window").height, duration: 250, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(onClose);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          translateY.setValue(g.dy);
          overlayOpacity.setValue(Math.max(0, 1 - g.dy / 400));
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > SHEET_DISMISS_THRESHOLD || g.vy > 0.5) {
          dismiss();
        } else {
          Animated.parallel([
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 200, friction: 20 }),
            Animated.timing(overlayOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.backdrop, { opacity: overlayOpacity }]}>
        <Pressable style={{ flex: 1 }} onPress={dismiss} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
        {/* Header: handle + X button */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", position: "relative", paddingVertical: 8 }}>
          <View style={styles.handle} />
          <TouchableOpacity
            style={{ position: "absolute", right: 0, top: 4, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}
            onPress={dismiss}
            hitSlop={12}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textSecondary, lineHeight: 18 }}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sheetTitle} numberOfLines={1}>{goal.title}</Text>

        {/* Goal info badges */}
        {(() => {
          const fmtDays = (days: number[] | undefined | null): string => {
            if (!days || days.length === 0 || days.length === 7) return "Every day";
            const sorted = [...days].sort();
            const key = sorted.join(",");
            if (key === "1,2,3,4,5") return "Weekdays";
            if (key === "6,7") return "Weekends";
            if (key === "1,3,5") return "Mon, Wed, Fri";
            const names = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
            return sorted.map(d => names[d]).join(", ");
          };
          const dLeft = goal.deadline ? Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000) : null;
          const infoBadges: { label: string; color: string; bg: string }[] = [];
          infoBadges.push({ label: fmtDays(goal.workDays), color: colors.warning, bg: `${colors.warning}18` });
          if (goal.dailyTimeMinutes) {
            const h = Math.floor(goal.dailyTimeMinutes / 60);
            const m = goal.dailyTimeMinutes % 60;
            const tl = h > 0 && m > 0 ? `${h}h ${m}m/day` : h > 0 ? `${h}h/day` : `${m}m/day`;
            infoBadges.push({ label: tl, color: "#0891B2", bg: "#0891B218" });
          }
          if (dLeft !== null) {
            infoBadges.push({ label: dLeft > 0 ? `${dLeft}d left` : "Overdue", color: dLeft < 14 ? colors.danger : colors.textTertiary, bg: dLeft < 14 ? `${colors.danger}14` : `${colors.textTertiary}14` });
          }
          if (!goal.isPaused) {
            infoBadges.push({ label: "Active", color: colors.success, bg: `${colors.success}18` });
          } else {
            infoBadges.push({ label: "Paused", color: colors.textTertiary, bg: `${colors.textTertiary}14` });
          }
          return (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8, marginBottom: 4 }}>
              {infoBadges.map((b, i) => (
                <View key={i} style={{ backgroundColor: b.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: b.color }}>{b.label}</Text>
                </View>
              ))}
            </View>
          );
        })()}

        <Text style={[styles.sheetSubtitle, { marginTop: 12 }]}>What would you like to do?</Text>

        <Pressable style={styles.actionRow} onPress={onEdit}>
          <View style={[styles.actionIcon, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.actionLabel}>Edit goal</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.actionRow} onPress={onTogglePause}>
          <View style={[styles.actionIcon, { backgroundColor: colors.warningLight }]}>
            <Ionicons
              name={goal.isPaused ? "play-outline" : "pause-outline"}
              size={18}
              color={colors.warning}
            />
          </View>
          <Text style={[styles.actionLabel, { color: colors.warning }]}>
            {goal.isPaused ? "Resume goal" : "Pause goal"}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.actionRow} onPress={onMarkComplete}>
          <View style={[styles.actionIcon, { backgroundColor: colors.successLight }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
          </View>
          <Text style={[styles.actionLabel, { color: colors.success }]}>Mark as complete</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.actionRow} onPress={onDelete}>
          <View style={[styles.actionIcon, { backgroundColor: colors.dangerLight }]}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </View>
          <Text style={[styles.actionLabel, { color: colors.danger }]}>Delete goal</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </Pressable>
        <Button title="Cancel" onPress={dismiss} variant="outline" style={styles.cancelBtn} />
      </Animated.View>
    </View>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    stepContainer: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
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
      justifyContent: "flex-end",
      zIndex: 100,
    },
    backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.overlay },
    sheet: {
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
      backgroundColor: c.warningLight,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.warning + "55",
      padding: spacing.md,
    },
    warningTitle: { fontSize: typography.sm, fontWeight: typography.semibold, color: c.warning, marginBottom: spacing.xs },
    warningBody: { fontSize: typography.sm, color: c.textSecondary, lineHeight: 20 },

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

    // ── Work days step ─────────────────────────────────────────────────────────
    optionChip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.card,
      alignItems: "center",
      ...shadow.sm,
    },
    optionChipActive: {
      borderColor: c.primary,
      backgroundColor: c.primaryLight,
    },
    optionChipText: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: c.text,
    },
    optionChipTextActive: {
      color: c.primary,
    },
    dayCircleRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    dayCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.card,
      alignItems: "center",
      justifyContent: "center",
    },
    dayCircleActive: {
      borderColor: c.primary,
      backgroundColor: c.primaryLight,
    },
    dayCircleText: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: c.textSecondary,
    },
    dayCircleTextActive: {
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
    chatHeaderBlock: {
      backgroundColor: c.card,
      borderBottomLeftRadius: radius.lg,
      borderBottomRightRadius: radius.lg,
      overflow: "hidden",
    },
    chatHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
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
      marginTop: spacing.md,
      marginBottom: spacing.md,
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
      backgroundColor: c.bg,
    },
    chatInputRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    chatInput: {
      flex: 1,
      height: 44,
      backgroundColor: c.card,
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
