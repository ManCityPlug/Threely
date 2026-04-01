import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
  ActivityIndicator,
  Platform,
  Switch,
  Modal,
  KeyboardAvoidingView,
  FlatList,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { goalsApi, profileApi, tasksApi, type TaskItem, type ParsedGoal, type GoalChatMessage, type GoalChatResult } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { spacing, typography, radius, shadow } from "@/constants/theme";
import type { Colors } from "@/constants/theme";
import { useTheme } from "@/lib/theme";
import { GoalTemplates } from "@/components/GoalTemplates";
import type { GoalCategory } from "@/constants/goal-templates";

const TOTAL_STEPS = 3; // name, goal, AI chat
const FIRST_STEP = 1;

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
const PICKER_ITEM_HEIGHT = 52;
const PICKER_HEIGHT = PICKER_ITEM_HEIGHT * 3;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const BUILDING_STEPS = [
  "Analyzing your goal…",
  "Crafting your personalized roadmap…",
  "Generating 3 perfect tasks to start with…",
  "Almost there — putting the finishing touches…",
];

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
      <Text style={styles.buildIcon}>✦</Text>
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

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [step, setStep] = useState(0); // 0 = loading, 1 = name, 2 = goal
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current;

  // Step 1 — Name
  const [nameInput, setNameInput] = useState("");

  // Check if we already have a name (e.g. from Apple Sign In) — skip name step if so
  useEffect(() => {
    (async () => {
      try {
        // Check AsyncStorage first
        const saved = await AsyncStorage.getItem("@threely_nickname");
        if (saved) {
          setNameInput(saved);
          setStep(2);
          Animated.timing(progressAnim, { toValue: 2 / TOTAL_STEPS, duration: 0, useNativeDriver: false }).start();
          return;
        }
        // Check Supabase user metadata
        const { data: { user } } = await supabase.auth.getUser();
        const meta = user?.user_metadata;
        const metaName = meta?.display_name || meta?.full_name || meta?.name;
        if (metaName && !metaName.includes("@") && !metaName.includes(".")) {
          setNameInput(metaName);
          await AsyncStorage.setItem("@threely_nickname", metaName);
          setStep(2);
          Animated.timing(progressAnim, { toValue: 2 / TOTAL_STEPS, duration: 0, useNativeDriver: false }).start();
          return;
        }
      } catch { /* ignore */ }
      setStep(1);
    })();
  }, []);

  // Step 2 — Goal input (templates shown first, free text via "Something else")
  const [showFreeText, setShowFreeText] = useState(false);
  const [rawGoalInput, setRawGoalInput] = useState("");
  const [parsedGoal, setParsedGoal] = useState<ParsedGoal | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [parseAttemptCount, setParseAttemptCount] = useState(0);

  // Step 2 — AI Plan chat
  const [showAiChat, setShowAiChat] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "assistant"; text: string; options?: string[] }>>([]);
  const [chatMessages, setChatMessages] = useState<GoalChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatDone, setChatDone] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatGoalText, setChatGoalText] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [showTypingInput, setShowTypingInput] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const chatInputRef = useRef<TextInput>(null);
  const chatListRef = useRef<FlatList>(null);

  // Auto-scroll chat when new messages arrive or chat completes
  useEffect(() => {
    if (chatHistory.length > 0 || chatDone) {
      requestAnimationFrame(() => chatListRef.current?.scrollToEnd({ animated: true }));
      setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 400);
    }
  }, [chatHistory.length, chatDone]);

  // Step 3 — Deadline (default: 1 month from today)
  const now = new Date();
  const defaultDeadline = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const [hasDeadline, setHasDeadline] = useState(true);
  const [deadlineMonth, setDeadlineMonth] = useState(defaultDeadline.getMonth());
  const [deadlineDay, setDeadlineDay] = useState(defaultDeadline.getDate());
  const [deadlineYear, setDeadlineYear] = useState(defaultDeadline.getFullYear());
  const monthPickerRef = useRef<ScrollView>(null);
  const dayPickerRef = useRef<ScrollView>(null);
  const yearPickerRef = useRef<ScrollView>(null);

  // Step 3 — Daily time
  const [timeMinutes, setTimeMinutes] = useState<number | null>(null);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [scrollPickerHours, setScrollPickerHours] = useState(0);
  const [scrollPickerMinutes, setScrollPickerMinutes] = useState(0);
  const scrollHoursRef = useRef<ScrollView>(null);
  const scrollMinutesRef = useRef<ScrollView>(null);

  // Step 5 — Work days
  const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [showCustomDays, setShowCustomDays] = useState(false);

  // Magic moment
  const [generatedTasks, setGeneratedTasks] = useState<TaskItem[]>([]);
  const [coachNote, setCoachNote] = useState("");
  const [taskRevealAnims] = useState([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState("");

  // ─── Navigation ─────────────────────────────────────────────────────────────

  function advanceStep(nextStep: number) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(progressAnim, {
      toValue: nextStep / TOTAL_STEPS,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setStep(nextStep);
  }

  // ─── Scroll pickers to detected deadline when step 2 opens ──────────────────

  useEffect(() => {
    if (step === 3 && hasDeadline) {
      const YEARS_LOCAL = Array.from({ length: 5 }, (_, i) => now.getFullYear() + i);
      const yearIdx = YEARS_LOCAL.indexOf(deadlineYear);
      // Delay to ensure the pickers are mounted before scrolling
      setTimeout(() => {
        monthPickerRef.current?.scrollTo({ y: deadlineMonth * PICKER_ITEM_HEIGHT, animated: false });
        dayPickerRef.current?.scrollTo({ y: (deadlineDay - 1) * PICKER_ITEM_HEIGHT, animated: false });
        yearPickerRef.current?.scrollTo({ y: Math.max(0, yearIdx) * PICKER_ITEM_HEIGHT, animated: false });
      }, 80);
    }
  }, [step]);

  // ─── Step 1: Goal parse ─────────────────────────────────────────────────────

  async function handleParseGoal() {
    if (!rawGoalInput.trim()) return;
    setParsing(true);
    setParseError("");
    try {
      const result = await goalsApi.parse(rawGoalInput.trim());
      setParsedGoal(result);
      // Auto-fill step 2 if a deadline was detected
      if (result.deadline_detected) {
        const d = new Date(result.deadline_detected + "T12:00:00");
        setHasDeadline(true);
        setDeadlineMonth(d.getMonth());
        setDeadlineDay(d.getDate());
        setDeadlineYear(d.getFullYear());
      }
      // Auto-fill work days if detected
      if (result.work_days_detected && result.work_days_detected.length > 0) {
        setWorkDays(result.work_days_detected);
        const isCustom = !WORK_DAY_PRESETS.some(
          (p) => p.value.length === result.work_days_detected!.length && p.value.every((d) => result.work_days_detected!.includes(d))
        );
        setShowCustomDays(isCustom);
      }
      // Auto-fill daily time if detected
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
          // Close enough — pick nearest preset
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
            // Auto-accept after 2 attempts — skip to next relevant step
            let nextStep = 3;
            if (result.deadline_detected) nextStep = 4;
            advanceStep(nextStep);
          } else {
            setShowConfirmation(true);
          }
          return next;
        });
      } else {
        setShowConfirmation(true);
      }
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to analyze goal. Try again.");
    } finally {
      setParsing(false);
    }
  }

  function handleEditGoal() {
    setShowConfirmation(false);
    setParsedGoal(null);
  }

  function handleAddMoreDetail() {
    // Keep parsedGoal so recommendations stay visible as a reference
    setShowConfirmation(false);
  }

  // ─── Step 2: AI Plan chat ───────────────────────────────────────────────────

  function handleCategorySelect(category: GoalCategory) {
    startAiChatWithMessage(category.starterMessage);
  }

  async function startAiChat() {
    startAiChatWithMessage("Help me define my goal.");
  }

  async function chatWithRetry(messages: GoalChatMessage[]): Promise<GoalChatResult> {
    try {
      return await goalsApi.chat(messages, { onboarding: true });
    } catch (e) {
      // Retry once on transient failures (timeout, network, server error)
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("pro_required") || msg.includes("cancelled")) throw e; // Don't retry pro gate or user cancellation
      try {
        return await goalsApi.chat(messages, { onboarding: true });
      } catch (retryErr) {
        // If retry also fails, throw a user-friendly error
        throw retryErr instanceof Error ? retryErr : new Error("Unable to reach Threely. Please check your connection.");
      }
    }
  }

  // Track the initial message so we can retry from the error state
  const lastInitialMessageRef = useRef<string>("");

  async function startAiChatWithMessage(initialMessage: string) {
    lastInitialMessageRef.current = initialMessage;
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
      // Auto-show text input when AI sends no options (e.g. "What's your name?")
      if (!result.options || result.options.length === 0) {
        setShowTypingInput(true);
      }
      if (result.done) {
        setChatDone(true);
        setChatGoalText(result.goal_text);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.warn("[onboarding chat]", msg);
      // Set chatError so the UI shows a retry button instead of a dead-end
      setChatError("Something went wrong. Please try again.");
    } finally {
      setChatLoading(false);
    }
  }

  async function sendChatAnswer(answer: string) {
    const userEntry = { role: "user" as const, text: answer };
    setChatHistory((prev) => [...prev, userEntry]);
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
      if (result.name) {
        const formatted = result.name.trim().replace(/\s+/g, " ").split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
        setNameInput(formatted);
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
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.warn("[onboarding chat]", msg);
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", text: "Something went wrong. Tap the retry button below to try again." },
      ]);
      setChatError("retry_send");
    } finally {
      setChatLoading(false);
    }
  }

  function handleEditChatGoal() {
    setChatDone(false);
    setChatGoalText(null);
    sendChatAnswer("I'd like to change something about my goal.");
  }

  async function handleUseGoal() {
    if (!chatGoalText) return;
    const goalText = chatGoalText.trim();
    setRawGoalInput(goalText);
    setShowAiChat(false);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Show generating screen immediately — no flash
    setBuildError("");
    setBuilding(true);
    advanceStep(TOTAL_STEPS + 1);

    // Retry parse up to 3 times silently before showing error
    const MAX_RETRIES = 3;
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await goalsApi.parse(goalText);
        setParsedGoal(result);

        // Build with parsed data directly (avoid stale state)
        handleBuild({
          goalText,
          parsed: result,
          dailyMinutes: result.daily_time_detected && result.daily_time_detected > 0
            ? result.daily_time_detected
            : undefined,
          skipAdvance: true, // already advanced above
        });
        return; // success — exit
      } catch (e) {
        lastError = e;
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
    }
    setBuildError(lastError instanceof Error ? lastError.message : "Failed to analyze goal. Try again.");
    setBuilding(false);
  }

  // ─── Step 3: Deadline helpers ───────────────────────────────────────────────

  const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const YEARS = Array.from({ length: 5 }, (_, i) => now.getFullYear() + i);

  function getDeadlineISO(): string | undefined {
    if (!hasDeadline) return undefined;
    const month = String(deadlineMonth + 1).padStart(2, "0");
    const day = String(Math.min(deadlineDay, DAYS_IN_MONTH[deadlineMonth])).padStart(2, "0");
    return `${deadlineYear}-${month}-${day}`;
  }

  // ─── Step 3: Custom time picker ─────────────────────────────────────────────

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

  // ─── Build ─────────────────────────────────────────────────────────────────

  const buildTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleBuild(overrides?: {
    goalText?: string;
    parsed?: ParsedGoal;
    dailyMinutes?: number;
    skipAdvance?: boolean;
  }) {
    setBuildError("");
    setBuilding(true);
    if (!overrides?.skipAdvance) advanceStep(TOTAL_STEPS + 1);

    // Safety timeout: if the build takes longer than 90s, show an error
    if (buildTimeoutRef.current) clearTimeout(buildTimeoutRef.current);
    buildTimeoutRef.current = setTimeout(() => {
      setBuilding(false);
      setBuildError("This is taking longer than expected. Please check your connection and try again.");
    }, 90_000);

    // Use overrides if provided (when called directly from handleUseGoal before state updates)
    const effectiveGoalText = overrides?.goalText ?? rawGoalInput.trim();
    const effectiveParsed = overrides?.parsed ?? parsedGoal;
    const effectiveTime = overrides?.dailyMinutes ?? timeMinutes;

    const MAX_RETRIES = 3;
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Retry a single async step up to MAX_RETRIES times, staying on the
    // building screen between attempts so the user never sees an error flash.
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
      const goalTitle =
        effectiveParsed?.short_title ??
        (effectiveGoalText.slice(0, 40) || "My Goal");

      // Save display name locally + to Supabase user metadata
      if (nameInput.trim()) {
        const formatted = nameInput.trim().replace(/\s+/g, " ").split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
        await AsyncStorage.setItem("@threely_nickname", formatted);
        supabase.auth.updateUser({ data: { display_name: formatted } }).catch(() => {});
      }

      // Each step retries independently so we never redo a step that already succeeded
      await withRetry(() => profileApi.save({
        dailyTimeMinutes: effectiveTime ?? 60,
        intensityLevel: 2,
      }));

      const detectedWorkDays = (effectiveParsed?.work_days_detected && effectiveParsed.work_days_detected.length > 0)
        ? effectiveParsed.work_days_detected : workDays;
      const goalResult = await withRetry(() => goalsApi.create(goalTitle, {
        rawInput: effectiveGoalText,
        structuredSummary: effectiveParsed?.structured_summary ?? undefined,
        category: effectiveParsed?.category ?? undefined,
        deadline: effectiveParsed?.deadline_detected ?? getDeadlineISO(),
        dailyTimeMinutes: effectiveTime ?? 60,
        intensityLevel: 2,
        workDays: detectedWorkDays,
        onboarding: true,
      }));

      const tasksResult = await withRetry(() => tasksApi.generate(goalResult.goal.id, { onboarding: true }));

      // Get the tasks from the result
      const allTasks = tasksResult.dailyTasks.flatMap((dt) => dt.tasks).slice(0, 3);
      setGeneratedTasks(allTasks);
      if (tasksResult.coachNote) setCoachNote(tasksResult.coachNote);

      // Staggered reveal animation
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

      const { data: { user } } = await supabase.auth.getUser();
      const onboardingKey = user ? `@threely_onboarding_done_${user.id}` : "@threely_onboarding_done";
      await AsyncStorage.setItem(onboardingKey, "true");
    } catch (e: unknown) {
      setBuildError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setBuilding(false);
    } finally {
      if (buildTimeoutRef.current) {
        clearTimeout(buildTimeoutRef.current);
        buildTimeoutRef.current = null;
      }
    }
  }

  // ─── Step renders ───────────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.stepScroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepTitle}>What should we call you?</Text>
          <TextInput
            style={styles.nameInput}
            placeholder="Your first name"
            placeholderTextColor={colors.textTertiary}
            value={nameInput}
            onChangeText={setNameInput}
            autoCapitalize="words"
            autoFocus
            returnKeyType="done"
            maxLength={30}
          />
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueBtn, !nameInput.trim() && styles.continueBtnDisabled]}
            onPress={() => nameInput.trim() && advanceStep(2)}
            activeOpacity={nameInput.trim() ? 0.85 : 1}
          >
            <Text style={[styles.continueBtnText, !nameInput.trim() && styles.continueBtnTextDisabled]}>
              Continue →
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderStep2() {
    // After parsing: show confirmation card
    if (showConfirmation) {
      return (
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.stepScroll}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.stepTitle}>Review your goal</Text>

            <View style={styles.confirmCard}>
              <View style={styles.confirmHeader}>
                <Text style={styles.confirmIcon}>✦</Text>
                <Text style={styles.confirmTitle}>Threely Intelligence read your goal</Text>
              </View>

              {parsedGoal?.category ? (
                <View style={styles.categoryChip}>
                  <Text style={styles.categoryText}>{parsedGoal.category}</Text>
                </View>
              ) : null}

              <Text style={styles.confirmSummary}>{parsedGoal?.structured_summary}</Text>

              {parsedGoal?.deadline_detected ? (
                <Text style={styles.confirmDeadline}>
                  📅 Deadline: {new Date(parsedGoal.deadline_detected + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </Text>
              ) : null}

              {parsedGoal?.needs_more_context && parsedGoal.recommendations ? (
                <View style={styles.warningCard}>
                  <Text style={styles.warningTitle}>⚠ Your plan could be more personalized</Text>
                  <Text style={styles.warningBody}>{parsedGoal.recommendations}</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {parsedGoal?.needs_more_context ? (
              <View style={styles.footerStack}>
                <TouchableOpacity
                  style={styles.continueBtn}
                  onPress={handleAddMoreDetail}
                  activeOpacity={0.85}
                >
                  <Text style={styles.continueBtnText}>Add more detail →</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.continueBtn, { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.primary + "40" }]}
                  onPress={() => startAiChatWithMessage(rawGoalInput.trim())}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.continueBtnText, { color: colors.primary }]}>✦ Use AI instead</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.skipWarningBtn}
                  onPress={() => advanceStep(3)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.skipWarningText}>Continue anyway</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.continueBtn}
                onPress={() => advanceStep(3)}
                activeOpacity={0.85}
              >
                <Text style={styles.continueBtnText}>Looks good →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    // Free text input (shown when "Something else" tapped)
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
          >
            <Text style={styles.stepTitle}>What are you working toward?</Text>
            <Text style={styles.stepSubtitle}>
              Describe your goal and where you're at. More context means a better plan from Threely Intelligence.
            </Text>

            <TextInput
              style={styles.goalInput}
              placeholder="e.g. I want to launch my freelance design business and land my first 3 clients"
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
              style={[
                styles.continueBtn,
                !rawGoalInput.trim() && styles.continueBtnDisabled,
              ]}
              onPress={() => startAiChatWithMessage(rawGoalInput.trim())}
              activeOpacity={rawGoalInput.trim() ? 0.85 : 1}
              disabled={!rawGoalInput.trim()}
            >
              <Text
                style={[
                  styles.continueBtnText,
                  !rawGoalInput.trim() && styles.continueBtnTextDisabled,
                ]}
              >
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
          onClose={() => advanceStep(1)}
          onOther={() => setShowFreeText(true)}
          closeLabel="‹ Back"
        />
      </View>
    );
  }

  function renderStep3() {
    const days = Array.from({ length: DAYS_IN_MONTH[deadlineMonth] }, (_, i) => i + 1);

    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.stepScroll}>
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
                      const idx = Math.round(
                        e.nativeEvent.contentOffset.y / PICKER_ITEM_HEIGHT
                      );
                      setDeadlineMonth(Math.max(0, Math.min(idx, 11)));
                    }}
                  >
                    {MONTHS.map((m, i) => (
                      <View key={m} style={styles.pickerItem}>
                        <Text
                          style={[
                            styles.pickerItemText,
                            deadlineMonth === i && styles.pickerItemTextSelected,
                          ]}
                        >
                          {m}
                        </Text>
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
                      const idx = Math.round(
                        e.nativeEvent.contentOffset.y / PICKER_ITEM_HEIGHT
                      );
                      setDeadlineDay(days[Math.max(0, Math.min(idx, days.length - 1))]);
                    }}
                  >
                    {days.map((d) => (
                      <View key={d} style={styles.pickerItem}>
                        <Text
                          style={[
                            styles.pickerItemText,
                            deadlineDay === d && styles.pickerItemTextSelected,
                          ]}
                        >
                          {d}
                        </Text>
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
                      const idx = Math.round(
                        e.nativeEvent.contentOffset.y / PICKER_ITEM_HEIGHT
                      );
                      setDeadlineYear(YEARS[Math.max(0, Math.min(idx, YEARS.length - 1))]);
                    }}
                  >
                    {YEARS.map((y) => (
                      <View key={y} style={styles.pickerItem}>
                        <Text
                          style={[
                            styles.pickerItemText,
                            deadlineYear === y && styles.pickerItemTextSelected,
                          ]}
                        >
                          {y}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => advanceStep(4)}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>
              {hasDeadline ? `Set deadline: ${MONTHS[deadlineMonth]} ${deadlineDay}, ${deadlineYear}` : "No deadline →"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderStep4() {
    const canContinue = timeMinutes !== null;
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.stepScroll}>
          <Text style={styles.stepTitle}>How much time can you dedicate daily?</Text>
          <Text style={styles.stepSubtitle}>
            Threely Intelligence will size your tasks to fit this window. You can change it anytime.
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
            onPress={canContinue ? () => advanceStep(5) : undefined}
            activeOpacity={canContinue ? 0.85 : 1}
          >
            <Text
              style={[styles.continueBtnText, !canContinue && styles.continueBtnTextDisabled]}
            >
              Continue →
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderStep5() {
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
      <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
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

  function renderMagicMoment() {
    const tasksReady = generatedTasks.length > 0;

    if (!tasksReady && !buildError) {
      return <BuildingProgressMobile styles={styles} colors={colors} />;
    }

    if (buildError) {
      return (
        <View style={styles.buildingCenter}>
          <Text style={styles.buildIcon}>⚠</Text>
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
        <ScrollView contentContainerStyle={styles.stepScroll}>
          <Text style={styles.buildTitle}>Your plan is ready ✦</Text>
          {coachNote ? <Text style={styles.coachNote}>{coachNote}</Text> : null}

          <View style={styles.taskRevealList}>
            {generatedTasks.map((task, i) => (
              <Animated.View
                key={task.id}
                style={[
                  styles.taskRevealCard,
                  {
                    opacity: taskRevealAnims[i],
                    transform: [
                      {
                        translateY: taskRevealAnims[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: [20, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.taskRevealHeader}>
                  <Text style={styles.taskRevealTitle}>
                    {(task as unknown as { title?: string }).title ?? task.task}
                  </Text>
                  {task.estimated_minutes ? (
                    <View style={styles.taskRevealBadge}>
                      <Text style={styles.taskRevealBadgeText}>~{task.estimated_minutes}m</Text>
                    </View>
                  ) : null}
                </View>
                {task.why ? (
                  <Text style={styles.taskRevealWhy}>{task.why}</Text>
                ) : null}
              </Animated.View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => {
              router.replace("/(tabs)");
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>Let's go →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Root render ─────────────────────────────────────────────────────────────

  const isMagicMoment = step > TOTAL_STEPS;

  // Still checking if name exists — show blank screen briefly
  if (step === 0) {
    return <SafeAreaView style={styles.container}><View style={{ flex: 1 }} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress bar */}
      {!isMagicMoment && (
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
      )}

      {/* Step counter — hidden when Step 2 shows templates (GoalTemplates has its own header) */}
      {!isMagicMoment && !(step === 2 && !showFreeText && !showConfirmation) && (
        <Text style={styles.stepCounter}>
          Step {step} of {TOTAL_STEPS}
        </Text>
      )}

      {/* Back button */}
      {step === 2 && showFreeText && !showConfirmation && !isMagicMoment ? (
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => setShowFreeText(false)}
          hitSlop={12}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
      ) : step > 1 && !isMagicMoment && !(step === 2 && !showFreeText && !showConfirmation) ? (
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (step === 2 && showConfirmation) {
              setShowConfirmation(false);
              setShowFreeText(true);
            } else {
              advanceStep(step - 1);
            }
          }}
          hitSlop={12}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
      ) : null}

      {/* Content */}
      <View style={{ flex: 1 }}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && !isMagicMoment && renderStep3()}
        {step === 4 && !isMagicMoment && renderStep4()}
        {step === 5 && !isMagicMoment && renderStep5()}
        {isMagicMoment && renderMagicMoment()}
      </View>

      {/* Skip for now — only on goal step (step 2) */}
      {step === 2 && !showConfirmation && !isMagicMoment && (
        <TouchableOpacity
          onPress={async () => {
            // Save name
            if (nameInput.trim()) {
              const formatted = nameInput.trim().replace(/\s+/g, " ").split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
              await AsyncStorage.setItem("@threely_nickname", formatted);
              supabase.auth.updateUser({ data: { display_name: formatted } }).catch(() => {});
            }
            // Save default profile
            await profileApi.save({ dailyTimeMinutes: 60, intensityLevel: 2 }).catch(() => {});
            // Mark onboarding done
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              await AsyncStorage.setItem(`@threely_onboarding_done_${session.user.id}`, "true");
            }
            router.replace("/(tabs)");
          }}
          style={{ alignSelf: "center", paddingVertical: spacing.sm, marginBottom: spacing.md }}
        >
          <Text style={{ color: colors.textTertiary, fontSize: typography.sm }}>Skip for now</Text>
        </TouchableOpacity>
      )}

      {/* ── AI Plan Chat Modal ── */}
      <Modal
        visible={showAiChat}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => { setChatError(""); setShowAiChat(false); }}
      >
        <View style={[styles.chatModal, { backgroundColor: colors.bg }]}>
          {/* Header */}
          <View style={[styles.chatHeader, { paddingTop: insets.top + spacing.sm }]}>
            <View style={styles.chatHeaderLeft}>
              <Text style={styles.chatHeaderIcon}>✦</Text>
              <Text style={styles.chatHeaderTitle}>Threely Intelligence</Text>
            </View>
            <TouchableOpacity
              style={styles.chatCloseBtn}
              onPress={() => { setChatError(""); setShowAiChat(false); }}
              hitSlop={12}
            >
              <Text style={styles.chatCloseText}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Chat progress bar */}
          {(() => {
            const userMsgCount = chatHistory.filter((m) => m.role === "user").length;
            const totalExpected = 10;
            const progress = chatDone ? 1 : Math.min(userMsgCount / totalExpected, 0.95);
            return (
              <View style={{ height: 4, backgroundColor: colors.border, marginHorizontal: spacing.md, borderRadius: 2, marginTop: spacing.xs }}>
                <View style={{ height: 4, backgroundColor: colors.primary, borderRadius: 2, width: `${Math.round(progress * 100)}%` }} />
              </View>
            );
          })()}

          {/* Chat messages */}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 50 : 0}
          >
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
                                // Scroll to reveal continue button
                                setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 200);
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={[
                                styles.chatOptionText,
                                isSelected && { color: "#fff" },
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
                            <Text style={[styles.chatOptionText, { color: "#fff", fontWeight: "700", fontSize: typography.base }]}>
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

            {/* Error state with retry button -- initial chat load failure */}
            {!!chatError && chatError !== "retry_send" && !chatLoading && (
              <View style={styles.chatFooter}>
                <Text style={{ fontSize: typography.sm, color: colors.danger, textAlign: "center", marginBottom: spacing.sm }}>
                  {chatError}
                </Text>
                <TouchableOpacity
                  style={styles.continueBtn}
                  onPress={() => {
                    setChatError("");
                    if (lastInitialMessageRef.current) {
                      startAiChatWithMessage(lastInitialMessageRef.current);
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.continueBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Retry button after a send failure mid-conversation */}
            {chatError === "retry_send" && !chatLoading && (
              <View style={styles.chatFooter}>
                <TouchableOpacity
                  style={styles.continueBtn}
                  onPress={async () => {
                    setChatError("");
                    // Remove the error message from chat history
                    setChatHistory((prev) => prev.slice(0, -1));
                    setChatLoading(true);
                    // Retry the API call with existing chatMessages (already includes the user message)
                    try {
                      const result = await chatWithRetry(chatMessages);
                      const assistantMsg: GoalChatMessage = { role: "assistant", content: result.raw_reply };
                      setChatMessages((prev) => [...prev, assistantMsg]);
                      setChatHistory((prev) => [
                        ...prev,
                        { role: "assistant", text: result.message, options: result.done ? [] : result.options },
                      ]);
                      if (result.name) {
                        const formatted = result.name.trim().replace(/\s+/g, " ").split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
                        setNameInput(formatted);
                        AsyncStorage.setItem("@threely_nickname", formatted).catch(() => {});
                        supabase.auth.updateUser({ data: { display_name: formatted } }).catch(() => {});
                      }
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
                      console.warn("[onboarding chat retry]", retryErr);
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
                    placeholder="Type your answer..."
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
              <View style={[styles.chatFooter, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
                <View style={{ gap: spacing.sm }}>
                  <TouchableOpacity
                    style={styles.continueBtn}
                    onPress={handleUseGoal}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.continueBtnText}>Use this goal →</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleEditChatGoal}
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
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  // ─── Progress ───────────────────────────────────────────────────────────────
  progressTrack: {
    height: 4,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  stepCounter: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  // ─── Back ───────────────────────────────────────────────────────────────────
  backBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  // ─── Step layout ────────────────────────────────────────────────────────────
  stepScroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  stepTitle: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.text,
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: spacing.sm,
  },
  stepSubtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  // ─── Step 1: Name input ─────────────────────────────────────────────────────
  nameInput: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    height: 54,
    paddingHorizontal: spacing.md,
    fontSize: typography.xl,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  // ─── Step 2: Goal input ─────────────────────────────────────────────────────
  goalInput: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.base,
    color: colors.text,
    lineHeight: 22,
    minHeight: 120,
    marginBottom: spacing.md,
  },
  goalInputDisabled: {
    opacity: 0.6,
  },
  errorText: {
    fontSize: typography.sm,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  confirmCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.primary + "44",
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.sm,
  },
  confirmHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  confirmIcon: {
    fontSize: 20,
    color: colors.primary,
  },
  confirmTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  categoryChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  categoryText: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.primary,
    textTransform: "capitalize",
  },
  confirmSummary: {
    fontSize: typography.base,
    color: colors.text,
    lineHeight: 22,
    fontWeight: typography.medium,
  },
  confirmDeadline: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  hintCard: {
    marginTop: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary + "33",
    padding: spacing.md,
  },
  hintCardTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  hintCardBody: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  warningCard: {
    marginTop: spacing.md,
    backgroundColor: colors.warningLight ?? "#FFF8EC",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: (colors.warning ?? "#F5A623") + "55",
    padding: spacing.md,
  },
  warningTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.warning ?? "#B45309",
    marginBottom: spacing.xs,
  },
  warningBody: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  footerStack: {
    gap: spacing.sm,
  },
  skipWarningBtn: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  skipWarningText: {
    fontSize: typography.sm,
    color: colors.textTertiary,
    textDecorationLine: "underline",
  },
  editBtn: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    paddingVertical: 4,
  },
  editBtnText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textDecorationLine: "underline",
  },
  // ─── Step 2: Deadline ───────────────────────────────────────────────────────
  deadlineToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  deadlineToggleLabel: {
    fontSize: typography.base,
    fontWeight: typography.medium,
    color: colors.text,
  },
  datePickerRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  dateColumn: {
    flex: 1,
    gap: spacing.sm,
  },
  dateColumnLabel: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    textAlign: "center",
  },
  // ─── Step 3: Time ───────────────────────────────────────────────────────────
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
    borderColor: colors.border,
    backgroundColor: colors.card,
    minWidth: "45%",
    alignItems: "center",
    ...shadow.sm,
  },
  timeChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  timeLabel: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  timeLabelSelected: {
    color: colors.primary,
  },
  // ─── Work days step ────────────────────────────────────────────────────────
  optionChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    ...shadow.sm,
  },
  optionChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionChipText: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  optionChipTextActive: {
    color: colors.primary,
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
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircleActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  dayCircleText: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.textSecondary,
  },
  dayCircleTextActive: {
    color: colors.primary,
  },
  // ─── Scroll picker (shared) ─────────────────────────────────────────────────
  pickerWrap: {
    position: "relative",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: spacing.lg,
  },
  pickerSelectionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: PICKER_ITEM_HEIGHT,
    height: PICKER_ITEM_HEIGHT,
    backgroundColor: colors.primaryLight,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.primary + "55",
  },
  pickerItem: {
    height: PICKER_ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerItemText: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  pickerItemTextSelected: {
    color: colors.primary,
  },
  // ─── Step 4: Intensity ──────────────────────────────────────────────────────
  intensityList: {
    gap: spacing.md,
  },
  intensityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.sm,
  },
  intensityCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
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
    color: colors.text,
  },
  intensityLabelSelected: {
    color: colors.primary,
  },
  intensityDescription: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  intensityCheck: {
    fontSize: typography.base,
    color: colors.primary,
    fontWeight: typography.bold,
  },
  // ─── Step 5: Magic moment ───────────────────────────────────────────────────
  buildingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buildIcon: {
    fontSize: 48,
    color: colors.primary,
    marginBottom: spacing.lg,
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
  coachNote: {
    fontSize: typography.base,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    fontStyle: "italic",
    textAlign: "center",
  },
  taskRevealList: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  taskRevealCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.sm,
  },
  taskRevealHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  taskRevealTitle: {
    flex: 1,
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
    lineHeight: 21,
  },
  taskRevealBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  taskRevealBadgeText: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.primary,
  },
  taskRevealWhy: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 18,
    fontStyle: "italic",
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
  // ─── Footer ─────────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  continueBtn: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
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
  // ─── AI Plan button ───────────────────────────────────────────────────────
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginVertical: 4,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  orText: {
    fontSize: typography.sm,
    color: colors.textTertiary,
    fontWeight: typography.medium,
  },
  aiPlanBtn: {
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary + "40",
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    ...shadow.sm,
  },
  aiPlanIcon: {
    fontSize: 16,
    color: colors.primary,
  },
  aiPlanText: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.primary,
  },
  // ─── AI Chat Modal ────────────────────────────────────────────────────────
  chatModal: {
    flex: 1,
    backgroundColor: colors.bg,
    maxWidth: 700,
    width: "100%",
    alignSelf: "center",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  chatHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  chatHeaderIcon: {
    fontSize: 18,
    color: colors.primary,
  },
  chatHeaderTitle: {
    fontSize: typography.base,
    fontWeight: typography.bold,
    color: colors.text,
  },
  chatCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chatCloseText: {
    fontSize: 18,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  chatList: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  chatBubbleAssistant: {
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    maxWidth: "85%",
    alignSelf: "flex-start",
  },
  chatBubbleAssistantText: {
    fontSize: typography.base,
    color: colors.text,
    lineHeight: 22,
  },
  chatBubbleUser: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    borderBottomRightRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    maxWidth: "85%",
    alignSelf: "flex-end",
  },
  chatBubbleUserText: {
    fontSize: typography.base,
    color: colors.primaryText,
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
    borderColor: colors.primary + "40",
    backgroundColor: colors.card,
  },
  chatOptionText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.primary,
  },
  chatGoalCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.primary + "44",
    padding: spacing.md,
    marginTop: spacing.sm,
    ...shadow.sm,
  },
  chatGoalLabel: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  chatGoalText: {
    fontSize: typography.base,
    color: colors.text,
    lineHeight: 22,
    fontWeight: typography.medium,
  },
  chatFooter: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  chatInputRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  chatInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.base,
    color: colors.text,
  },
  chatSendBtn: {
    height: 44,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  chatSendText: {
    fontSize: typography.base,
    fontWeight: typography.bold,
    color: colors.primaryText,
  },
});
}
