import { useEffect, useRef, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { goalsApi, profileApi, tasksApi, type TaskItem, type ParsedGoal, type GoalChatMessage, type GoalChatResult } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { colors, spacing, typography, radius, shadow } from "@/constants/theme";
import { GoalTemplates } from "@/components/GoalTemplates";
import { type GoalCategory } from "@/constants/goal-templates";

const TOTAL_STEPS = 5; // name, goal, deadline, time, intensity

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

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current;

  // Step 1 — Name
  const [nameInput, setNameInput] = useState("");

  // Step 2 — Goal input
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
  const [chatGoalText, setChatGoalText] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");
  const chatListRef = useRef<FlatList>(null);

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

  // Step 4 — Intensity
  const [intensityLevel, setIntensityLevel] = useState<1 | 2 | 3 | null>(null);

  // Step 5 — Magic moment
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
            if (result.daily_time_detected && result.daily_time_detected > 0) nextStep = 5;
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

  async function startAiChat() {
    startAiChatWithMessage("Help me define my goal.");
  }

  function handleCategorySelect(category: GoalCategory) {
    startAiChatWithMessage(category.starterMessage);
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
      setChatHistory([{ role: "assistant", text: "Something went wrong. Please close and try again." }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function sendChatAnswer(answer: string) {
    const userEntry = { role: "user" as const, text: answer };
    setChatHistory((prev) => [...prev, userEntry]);
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

  function handleEditChatGoal() {
    setChatDone(false);
    setChatGoalText(null);
    sendChatAnswer("I'd like to change something about my goal.");
  }

  async function handleUseGoal() {
    if (!chatGoalText) return;
    setRawGoalInput(chatGoalText);
    setShowAiChat(false);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Auto-parse and advance to step 3
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
      // Skip steps that AI Plan already covered
      let nextStep = 3;
      if (result.deadline_detected) nextStep = 4; // skip deadline step
      if (result.daily_time_detected && result.daily_time_detected > 0) nextStep = 5; // skip time step too
      advanceStep(nextStep);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to analyze goal. Try again.");
    } finally {
      setParsing(false);
    }
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

  // ─── Build (Step 5) ─────────────────────────────────────────────────────────

  async function handleBuild() {
    setBuildError("");
    setBuilding(true);
    advanceStep(TOTAL_STEPS + 1);

    try {
      const goalTitle =
        parsedGoal?.short_title ??
        rawGoalInput.trim().slice(0, 40);

      // Save display name
      if (nameInput.trim()) {
        await AsyncStorage.setItem("@threely_nickname", nameInput.trim());
      }

      // Save profile
      await profileApi.save({
        dailyTimeMinutes: timeMinutes ?? 60,
        intensityLevel: intensityLevel ?? 2,
      });

      // Create the goal with all parsed data + per-goal settings
      const goalResult = await goalsApi.create(goalTitle, {
        rawInput: rawGoalInput.trim(),
        structuredSummary: parsedGoal?.structured_summary ?? undefined,
        category: parsedGoal?.category ?? undefined,
        deadline: parsedGoal?.deadline_detected ?? getDeadlineISO(),
        dailyTimeMinutes: timeMinutes ?? undefined,
        intensityLevel: intensityLevel ?? undefined,
      });

      // Generate tasks
      const tasksResult = await tasksApi.generate(goalResult.goal.id);

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
    }
  }

  // ─── Step renders ───────────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.stepScroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepTitle}>What should we call you?</Text>
          <Text style={styles.stepSubtitle}>
            This appears in your daily greeting.
          </Text>
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
    return (
      <View style={{ flex: 1 }}>
        <GoalTemplates
          onSelect={handleCategorySelect}
          onClose={() => advanceStep(1)}
          onOther={() => {
            startAiChatWithMessage("Help me define my goal.");
          }}
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
            onPress={() => canContinue && advanceStep(5)}
            activeOpacity={canContinue ? 0.85 : 1}
          >
            <Text
              style={[styles.continueBtnText, !canContinue && styles.continueBtnTextDisabled]}
            >
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderStep5() {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.stepScroll}>
          <Text style={styles.stepTitle}>What's your pace?</Text>
          <Text style={styles.stepSubtitle}>
            This shapes how ambitious Threely Intelligence makes your daily tasks.
          </Text>

          <View style={styles.intensityList}>
            {INTENSITY_OPTIONS.map((opt) => {
              const isSelected = intensityLevel === opt.level;
              return (
                <TouchableOpacity
                  key={opt.level}
                  style={[styles.intensityCard, isSelected && styles.intensityCardSelected]}
                  onPress={() => {
                    if (Platform.OS !== "web") Haptics.selectionAsync();
                    setIntensityLevel(opt.level);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.intensityEmoji}>{opt.emoji}</Text>
                  <View style={styles.intensityText}>
                    <Text
                      style={[styles.intensityLabel, isSelected && styles.intensityLabelSelected]}
                    >
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
            style={[styles.continueBtn, !intensityLevel && styles.continueBtnDisabled]}
            onPress={intensityLevel ? handleBuild : undefined}
            activeOpacity={intensityLevel ? 0.85 : 1}
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
      return (
        <View style={styles.buildingCenter}>
          <Text style={styles.buildIcon}>✦</Text>
          <Text style={styles.buildTitle}>Threely Intelligence is building your plan…</Text>
          <Text style={styles.buildSubtitle}>
            Analyzing your goal and crafting{"\n"}3 perfect tasks to start with.
          </Text>
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
            onPress={() => router.replace("/(tabs)")}
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

      {/* Step counter */}
      {!isMagicMoment && (
        <Text style={styles.stepCounter}>
          Step {step} of {TOTAL_STEPS}
        </Text>
      )}

      {/* Back button */}
      {step > 1 && !isMagicMoment && (
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => advanceStep(step - 1)}
          hitSlop={12}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
      )}

      {/* Content */}
      <View style={{ flex: 1 }}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
        {isMagicMoment && renderMagicMoment()}
      </View>
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
                    onPress={handleEditChatGoal}
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
                    style={styles.chatInput}
                    placeholder="Type your answer here..."
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "#FFF8EC",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#F5A623" + "55",
    padding: spacing.md,
  },
  warningTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: "#B45309",
    marginBottom: spacing.xs,
  },
  warningBody: {
    fontSize: typography.sm,
    color: "#92400E",
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
    marginTop: spacing.sm,
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
    paddingVertical: spacing.md,
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
    height: 48,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: `rgba(99,91,255,0.3)`,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    fontSize: typography.base,
    color: colors.text,
  },
  chatSendBtn: {
    height: 48,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  chatSendText: {
    fontSize: typography.base,
    fontWeight: typography.bold,
    color: colors.primaryText,
  },
});
