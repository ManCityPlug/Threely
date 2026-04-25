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
  AppState,
  TouchableOpacity,
  Animated,
  Platform,
  Modal,
  Pressable,
  LayoutAnimation,
  UIManager,
  useWindowDimensions,
  InteractionManager,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SwipeNavigator } from "@/components/SwipeNavigator";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import {
  tasksApi,
  goalsApi,
  profileApi,
  statsApi,
  focusApi,
  type DailyTask,
  type Goal,
  type TaskItem,
  type GoalStat,
} from "@/lib/api";
import { MOCK_TUTORIAL_GOAL, MOCK_TUTORIAL_DAILY_TASK } from "@/lib/mock-tutorial-data";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/lib/toast";
import { scheduleNotifications, onTaskCompleted, sendInstantNotification, type NotifContext } from "@/lib/notifications";
import { useTheme } from "@/lib/theme";
import { useSubscription } from "@/lib/subscription-context";
import { useWalkthroughRegistry } from "@/lib/walkthrough-registry";
import Paywall from "@/components/Paywall";
import OfferPopup from "@/components/OfferPopup";
import DfyModal, { detectDfyType } from "@/components/DfyModal";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius } from "@/constants/theme";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// iPad-friendly max content width
const MAX_CONTENT_WIDTH = 760;

// ─── Gamification Helpers ─────────────────────────────────────────────────────

const GOLD = "#D4A843";
const GOLD_DARK = "#9A7A2A";
const GOLD_GRADIENT_TOP = "#E8C547";

const MILESTONE_DAYS = [7, 14, 30, 60, 100];
const MILESTONE_LABELS: Record<number, string> = {
  7: "1 Week!",
  14: "2 Weeks!",
  30: "1 Month!",
  60: "2 Months!",
  100: "100 Days!",
};

// S-curve horizontal offsets (% of path width) matching web
const S_CURVE_OFFSETS = [50, 35, 25, 35, 50, 65, 75, 65];

function getCelebrationEmoji(day: number): string {
  if ([7, 14, 30, 60, 100].includes(day)) return "👑";
  if (day === 3) return "🚀";
  if (day % 20 === 0) return "🏆";
  return "🔥";
}

function getCompletionMessage(day: number): string {
  const messages: Record<number, string> = {
    1: "Day 1 done. You're already ahead of most people.",
    2: "You're already ahead of most people.",
    3: "This is becoming a habit.",
    5: "You're not the same person you were Monday.",
    7: "One full week. Most people quit by now. You didn't.",
    10: "You're building something real.",
    14: "Two weeks in. The old you wouldn't recognize this.",
    21: "21 days. Science says this is a habit now.",
    30: "One month. You're not dreaming anymore — you're doing.",
    60: "Two months. This is who you are now.",
    100: "100 days. Legend.",
  };
  if (messages[day]) return messages[day];
  const generic = [
    "These are building you for tomorrow.",
    "Every day you show up, you level up.",
    "Small steps. Big results. See you tomorrow.",
    "You showed up. That's what matters.",
  ];
  return generic[day % generic.length];
}

function getGoalDayNumber(goal: Goal): number {
  const created = new Date(goal.createdAt);
  const createdLocal = new Date(created.getFullYear(), created.getMonth(), created.getDate());
  const now = new Date();
  const nowLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = nowLocal.getTime() - createdLocal.getTime();
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
}

function getStreakFromGoals(goals: Goal[]): number {
  if (goals.length === 0) return 0;
  const earliest = goals.reduce((min, g) => {
    const d = new Date(g.createdAt).getTime();
    return d < min ? d : min;
  }, Infinity);
  const createdLocal = new Date(earliest);
  const createdMidnight = new Date(createdLocal.getFullYear(), createdLocal.getMonth(), createdLocal.getDate());
  const nowLocal = new Date();
  const nowMidnight = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate());
  const diffDays = Math.floor((nowMidnight.getTime() - createdMidnight.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
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

function isMilestone(day: number): boolean {
  return MILESTONE_DAYS.includes(day);
}

// ─── Progress Ring (View-based, mirrors web's SVG ring visually) ─────────────
// Web draws an SVG stroke ring at radius = size/2 + 6. When allDoneToday
// (progress=1) the full gold ring is visible; otherwise only the faint track.
// We match that visual with pure Views (no SVG dep): a track ring plus a
// gold ring that only renders at 100%. Partial-progress split-circle hack
// removed — it never rendered cleanly on RN and the app only ever surfaces
// 0% or 100% in practice (tasks view tracks per-task progress separately).
function NodeProgressRing({
  size,
  progress,
  color,
  trackColor,
}: {
  size: number;
  progress: number; // 0-1
  color: string;
  trackColor: string;
}) {
  const borderW = 3;
  const ringSize = size + 20; // matches web's visual offset
  const isFull = progress >= 0.999;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: ringSize,
        height: ringSize,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Track (always shown, like web) */}
      <View style={{
        position: "absolute",
        width: ringSize,
        height: ringSize,
        borderRadius: ringSize / 2,
        borderWidth: borderW,
        borderColor: trackColor,
      }} />
      {/* Gold progress ring — only when 100% complete (matches web's progress=1) */}
      {isFull && (
        <View style={{
          position: "absolute",
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
          borderWidth: borderW,
          borderColor: color,
        }} />
      )}
    </View>
  );
}

// ─── Path Node Component ──────────────────────────────────────────────────────

function PathNode({
  day,
  type,
  isToday,
  isCrown,
  isMilestoneNode,
  isNextLocked,
  onPress,
  colors,
  allDoneToday,
  workAheadReady,
  taskProgress,
}: {
  day: number;
  type: "completed" | "today" | "locked" | "work-ahead";
  isToday: boolean;
  isCrown: boolean;
  isMilestoneNode: boolean;
  isNextLocked: boolean;
  onPress?: () => void;
  colors: Colors;
  allDoneToday: boolean;
  workAheadReady: boolean;
  taskProgress: number; // 0-1
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const shouldAnimate = (isToday && !allDoneToday) || workAheadReady;
    if (shouldAnimate) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ])
      );
      pulse.start();
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 0.6, duration: 1500, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.35, duration: 1500, useNativeDriver: true }),
        ])
      );
      glow.start();
      return () => { pulse.stop(); glow.stop(); };
    }
  }, [isToday, allDoneToday, workAheadReady, pulseAnim, glowAnim]);

  // Node sizes matching spec
  const nodeSize = isToday ? 68 : isCrown ? 64 : isMilestoneNode ? 60 : type === "completed" ? 56 : 50;
  const isCompleted = type === "completed";
  const isLocked = type === "locked";
  const isWorkAhead = type === "work-ahead";

  // Determine node style
  let bgColor: string;
  let borderColor: string;
  let borderWidth: number;
  let borderStyle: "solid" | "dashed" = "solid";
  let nodeOpacity = 1;
  let shadowConfig: object = {};

  if (isCompleted) {
    bgColor = GOLD_GRADIENT_TOP; // Gold fill
    borderColor = GOLD_DARK;
    borderWidth = 4;
    shadowConfig = {
      shadowColor: GOLD,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    };
  } else if (isToday) {
    // Match web: keep today's background dark even when allDone so the gold
    // check inside stays visible. Web never fills the today node gold.
    bgColor = "rgba(20,20,20,0.95)";
    borderColor = GOLD;
    borderWidth = 3;
    shadowConfig = {
      shadowColor: GOLD,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 8,
    };
  } else if (isWorkAhead) {
    bgColor = "rgba(20,20,20,0.95)";
    borderColor = GOLD;
    borderWidth = 3;
    shadowConfig = {
      shadowColor: GOLD,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.55,
      shadowRadius: 22,
      elevation: 10,
    };
  } else if (isCrown) {
    bgColor = GOLD_GRADIENT_TOP;
    borderColor = GOLD_DARK;
    borderWidth = 4;
    shadowConfig = {
      shadowColor: GOLD,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 8,
    };
  } else if (isMilestoneNode) {
    // Locked milestone — gold tint + glow
    bgColor = "rgba(212,168,67,0.08)";
    borderColor = GOLD_DARK;
    borderWidth = 3;
    nodeOpacity = 0.7;
    shadowConfig = {
      shadowColor: GOLD,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 4,
    };
  } else {
    // Locked
    bgColor = "#1e1e1e";
    borderColor = "#1e1e1e";
    borderWidth = 4;
    nodeOpacity = 0.45;
    shadowConfig = {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 3,
    };
  }

  // Icon content
  let icon: React.ReactNode;
  if (isCrown) {
    icon = <Text style={{ fontSize: nodeSize * 0.42 }}>{"👑"}</Text>;
  } else if (isMilestoneNode && (isCompleted || isToday)) {
    icon = <Text style={{ fontSize: nodeSize * 0.4 }}>{"🏆"}</Text>;
  } else if (isMilestoneNode && (isLocked || isWorkAhead)) {
    icon = <Text style={{ fontSize: nodeSize * 0.36, opacity: 0.5 }}>{"🏆"}</Text>;
  } else if (isCompleted) {
    icon = <Text style={{ fontSize: nodeSize * 0.35, color: "#fff", fontWeight: "800" }}>{"✓"}</Text>;
  } else if (isToday) {
    if (allDoneToday) {
      icon = <Text style={{ fontSize: nodeSize * 0.35, color: GOLD, fontWeight: "800" }}>{"✓"}</Text>;
    } else {
      icon = <Text style={{ fontSize: nodeSize * 0.4 }}>{"⭐"}</Text>;
    }
  } else if (isWorkAhead) {
    icon = <Text style={{ fontSize: nodeSize * 0.32 }}>{"⭐"}</Text>;
  } else {
    icon = <Text style={{ fontSize: nodeSize * 0.28, opacity: 0.4 }}>{"🔒"}</Text>;
  }

  // Label below node
  let label: React.ReactNode = null;
  if (isCrown && !isToday) {
    label = (
      <View style={{ alignItems: "center", marginTop: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: GOLD }}>Huge Progress</Text>
        <Text style={{ fontSize: 11, fontWeight: "600", color: GOLD, opacity: 0.8, marginTop: 1 }}>
          Enter next stage {"→"}
        </Text>
      </View>
    );
  } else if (isMilestoneNode && !isToday && !isCrown) {
    label = (
      <View style={{ alignItems: "center", marginTop: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: GOLD }}>
          {MILESTONE_LABELS[day] ?? `Day ${day}`}
        </Text>
        <Text style={{ fontSize: 10, fontWeight: "600", color: "rgba(212,168,67,0.7)", marginTop: 1 }}>
          Milestone
        </Text>
      </View>
    );
  } else if (isToday) {
    label = (
      <View style={{ alignItems: "center", marginTop: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: GOLD, letterSpacing: -0.3 }}>
          Day {day}
        </Text>
        <Text style={{
          fontSize: 11,
          fontWeight: "700",
          color: allDoneToday ? GOLD : "rgba(255,255,255,0.9)",
          marginTop: 1,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}>
          {allDoneToday ? "Complete!" : "Start"}
        </Text>
      </View>
    );
  } else if (isWorkAhead && !isMilestoneNode && !isCrown) {
    label = (
      <View style={{ alignItems: "center", marginTop: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: GOLD, letterSpacing: -0.3 }}>
          Day {day}
        </Text>
        <Text style={{
          fontSize: 11,
          fontWeight: "700",
          color: GOLD,
          marginTop: 1,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}>
          Start
        </Text>
      </View>
    );
  } else if (isCompleted) {
    label = (
      <Text style={{ fontSize: 11, fontWeight: "600", color: GOLD, marginTop: 4, textAlign: "center" }}>
        {day}
      </Text>
    );
  } else {
    // Locked - minimal label, no countdown.
    label = (
      <View style={{ alignItems: "center", marginTop: 4 }}>
        <Text style={{ fontSize: 10, fontWeight: "500", color: "rgba(255,255,255,0.25)", textAlign: "center" }}>
          {day}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ alignItems: "center" }}>
      <TouchableOpacity
        onPress={onPress}
        // Only the NEXT locked day (day+1) is tappable among locked/future
        // nodes. Today's node, completed days, and the work-ahead node are
        // tappable via their own branches. The crown is intentionally NOT
        // tappable — the whitelist used to include it, which is why tapping
        // the far-future day surfaced the generic "complete current day
        // first" alert the user reported.
        disabled={isLocked && !isWorkAhead && !isNextLocked}
        activeOpacity={0.7}
        style={{ alignItems: "center" }}
      >
        {/* Progress ring - today only */}
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          {isToday && (
            <NodeProgressRing
              size={nodeSize}
              progress={taskProgress}
              color={GOLD}
              trackColor="rgba(212,168,67,0.15)"
            />
          )}
          <Animated.View style={{
            width: nodeSize,
            height: nodeSize,
            borderRadius: nodeSize / 2,
            backgroundColor: bgColor,
            borderWidth: borderWidth,
            borderColor: borderColor,
            borderStyle: borderStyle,
            alignItems: "center",
            justifyContent: "center",
            opacity: nodeOpacity,
            transform: [{ scale: isToday && !allDoneToday ? pulseAnim : 1 }],
            ...shadowConfig,
          }}>
            {icon}
          </Animated.View>
        </View>

        {label}
      </TouchableOpacity>
    </View>
  );
}

// ─── START / COMPLETE Badge ─────────────────────────────────────────────────

function StartBadge({
  started,
  onPress,
}: {
  started: boolean;
  onPress: () => void;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{ alignItems: "center", marginBottom: 6 }}>
      <Animated.View style={{
        paddingHorizontal: 18,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: GOLD,
        transform: [{ scale: pulseAnim }],
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 6,
      }}>
        <Text style={{
          fontSize: 12,
          fontWeight: "800",
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "#000",
        }}>
          {started ? "CONTINUE" : "START"}
        </Text>
      </Animated.View>
      {/* Small connector line */}
      <View style={{
        width: 2,
        height: 8,
        backgroundColor: "rgba(212,168,67,0.4)",
      }} />
    </TouchableOpacity>
  );
}

// ─── S-Curve Path View ───────────────────────────────────────────────────────

function SCurvePathView({
  goalDayNumber,
  allDone,
  onTapToday,
  onTapWorkAhead,
  onTapLocked,
  onTapCompleted,
  colors,
  screenWidth,
  screenHeight,
  taskProgress,
  startedDays,
  scrollTrigger,
}: {
  goalDayNumber: number;
  allDone: boolean;
  onTapToday: () => void;
  onTapWorkAhead: () => void;
  onTapLocked: (day: number) => void;
  onTapCompleted: (day: number) => void;
  colors: Colors;
  screenWidth: number;
  screenHeight: number;
  taskProgress: number;
  startedDays: Set<number>;
  scrollTrigger: number;
}) {
  const { scrollToOffset } = useWalkthroughRegistry();

  // Stage system: 20 nodes per stage (1-20, 21-40, 41-60, ...) — match web PathView
  const VISIBLE_NODES = 20;
  const stage = Math.ceil(goalDayNumber / VISIBLE_NODES) || 1;
  const windowStart = (stage - 1) * VISIBLE_NODES + 1;
  const days: number[] = [];
  for (let i = 0; i < VISIBLE_NODES; i++) {
    days.push(windowStart + i);
  }
  const lastVisibleDay = days[days.length - 1];

  // Path container width (leave margin on each side)
  const pathWidth = Math.min(screenWidth - 40, screenWidth >= 768 ? 600 : 500);
  // Spacing between nodes — matches web PathView (130px) so mobile looks as
  // dense as web. Previously 170px which left huge gaps (visible as extra
  // black space between consecutive locked nodes).
  const nodeSpacing = 130;

  // Scroll-to-today via the OUTER "today-scroll" ScrollView registered in the
  // walkthrough registry. The old implementation used a nested inner ScrollView
  // whose scrollTo calls never moved the screen (RN: nested ScrollViews of the
  // same axis break — only the outer one actually scrolls). Now we compute
  // the focus node's absolute Y inside the outer scroll content by summing:
  //   (a) this component's own y offset (onLayout)
  //   (b) the node's y within the path layout (40 + focusIndex*nodeSpacing)
  // Viewport height is approximated from screenHeight minus header+tabbar chrome.
  //
  // Focus day jumps forward to goalDayNumber+1 once today is complete so the
  // scroll pulls the user to the next unlocked day, not the finished one.
  const containerYRef = useRef<number>(0);
  const focusDay = goalDayNumber + (allDone ? 1 : 0);
  const todayIndex = focusDay - windowStart;
  const todayY = 40 + todayIndex * nodeSpacing;
  const TODAY_NODE_SIZE = 68;
  // Approximate outer-scroll viewport: screen minus top safe area + header
  // (~60px) + goal tabs (~50px) + tab bar (~80px). Being ~20px off just moves
  // today a hair off center — still visible. Web uses +36 offset; we use +34.
  const approxViewportH = Math.max(300, screenHeight - 190);

  const scrollToToday = useCallback((animated: boolean = true) => {
    const absoluteY = containerYRef.current + todayY;
    const target = absoluteY - approxViewportH / 2 + TODAY_NODE_SIZE / 2;
    scrollToOffset("today-scroll", Math.max(0, target));
  }, [todayY, approxViewportH, scrollToOffset]);

  useEffect(() => {
    // Fire at multiple windows to cover every mount/focus scenario. The outer
    // ScrollView may not have its ref registered at first rAF on cold launch,
    // so we retry.
    let raf = 0;
    const fires: Array<ReturnType<typeof setTimeout>> = [];
    raf = requestAnimationFrame(() => scrollToToday(false));
    fires.push(setTimeout(() => scrollToToday(true), 150));
    fires.push(setTimeout(() => scrollToToday(true), 400));
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      scrollToToday(true);
    });
    return () => {
      cancelAnimationFrame(raf);
      fires.forEach((t) => clearTimeout(t));
      interactionHandle.cancel?.();
    };
  }, [goalDayNumber, allDone, scrollTrigger, scrollToToday]);

  return (
    <View
      style={{ width: "100%", position: "relative", paddingTop: 20, paddingBottom: 20 }}
      onLayout={(e) => {
        const y = e.nativeEvent.layout.y;
        const wasUnset = containerYRef.current === 0;
        containerYRef.current = y;
        // First valid layout — fire scroll so the first visible frame is centered.
        if (wasUnset || y > 0) scrollToToday(false);
      }}
    >
      {/* Path field — rendered in outer scroll coordinate space. No nested
          ScrollView (that blocked scroll on iOS). */}
      <View style={{
        width: pathWidth,
        alignSelf: "center",
        position: "relative",
        // +35 accounts for the future-day yPos bump below
        height: days.length * nodeSpacing + 60 + 35,
      }}>
        {days.map((day, i) => {
            // Once the active day's tasks are all done it visually becomes
            // "completed" (gold fill) — matches web. The next day takes over
            // as the glowing "work-ahead"/START node.
            const isCompleted = day < goalDayNumber || (day === goalDayNumber && allDone);
            const isToday = day === goalDayNumber && !allDone;
            const isWorkAhead = day === goalDayNumber + 1 && allDone;
            const isLocked = !isCompleted && !isToday && !isWorkAhead;
            const isCrown = day === lastVisibleDay && day > goalDayNumber;
            const isMilestoneNode = isMilestone(day);

            let type: "completed" | "today" | "locked" | "work-ahead" = "locked";
            if (isCompleted) type = "completed";
            else if (isToday) type = "today";
            else if (isWorkAhead) type = "work-ahead";

            // S-curve positioning. Future days get a +35 offset so today's
            // expanded label ("Day N / TODAY" or "Day N / Complete!" with
            // the CONTINUE badge above) can't collide with day+1 when they
            // land on the same side of the S-curve. Past days keep their
            // standard spacing. Scroll-to-today math is unaffected (today
            // is not "future").
            const xOffsetPct = S_CURVE_OFFSETS[i % S_CURVE_OFFSETS.length];
            const xPos = (xOffsetPct / 100) * pathWidth;
            const futureBump = day > goalDayNumber ? 35 : 0;
            const yPos = 40 + i * nodeSpacing + futureBump;

            // Week dividers
            const isWeekBoundary = i > 0 && i % 7 === 0;
            const weekNumber = Math.floor(i / 7) + 1;

            return (
              <View key={day}>
                {/* Week divider */}
                {isWeekBoundary && (
                  <View style={{
                    position: "absolute",
                    top: yPos - 20,
                    left: "10%",
                    right: "10%",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    zIndex: 2,
                  }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
                    <Text style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: "rgba(255,255,255,0.3)",
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                    }}>
                      Week {weekNumber}
                    </Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
                  </View>
                )}

                {/* Node positioned absolutely.
                    yPos (40 + i*nodeSpacing) matches todayY used by scroll. */}
                <View style={{
                  position: "absolute",
                  top: yPos,
                  left: xPos,
                  transform: [{ translateX: isToday ? -34 : type === "completed" ? -28 : isCrown ? -32 : isMilestoneNode ? -30 : -25 }],
                  zIndex: isToday ? 10 : isCrown ? 5 : 1,
                  alignItems: "center",
                }}>
                  {/* START/COMPLETE badge above today's node — only before user has tapped */}
                  {isToday && !allDone && (
                    <StartBadge
                      started={startedDays.has(day)}
                      onPress={() => {
                        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onTapToday();
                      }}
                    />
                  )}

                  <PathNode
                    day={day}
                    type={type}
                    isToday={isToday}
                    isCrown={isCrown && !isToday}
                    isMilestoneNode={isMilestoneNode}
                    isNextLocked={day === goalDayNumber + 1 && isLocked}
                    colors={colors}
                    allDoneToday={allDone}
                    workAheadReady={isWorkAhead}
                    taskProgress={taskProgress}
                    onPress={
                      // Today is always tappable — matches web. When all done,
                      // the tasks view opens in read-only visual state (toggles
                      // show completed). Previously a hard gate swallowed the
                      // tap silently when allDone was true.
                      isToday ? () => {
                        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onTapToday();
                      }
                      : isCompleted ? () => {
                        if (Platform.OS !== "web") Haptics.selectionAsync();
                        onTapCompleted(day);
                      }
                      : isWorkAhead ? onTapWorkAhead
                      : isLocked ? () => onTapLocked(day)
                      : undefined
                    }
                  />
                </View>
              </View>
            );
          })}
        </View>
    </View>
  );
}

// ─── Skeleton Path Loading ───────────────────────────────────────────────────

function SkeletonPath({ screenWidth }: { screenWidth: number }) {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const pathWidth = Math.min(screenWidth - 40, screenWidth >= 768 ? 600 : 500);
  const skeletonNodes = [0, 1, 2, 3, 4, 5, 6];

  return (
    <View style={{ alignItems: "center", paddingVertical: spacing.xl }}>
      {skeletonNodes.map((i) => {
        const xOffsetPct = S_CURVE_OFFSETS[i % S_CURVE_OFFSETS.length];
        const xPos = (xOffsetPct / 100) * pathWidth - pathWidth / 2;
        const size = i === 2 ? 60 : i === 0 || i === 6 ? 42 : 48;
        return (
          <Animated.View key={i} style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: "rgba(255,255,255,0.1)",
            opacity: pulseAnim,
            marginBottom: 48,
            marginLeft: xPos,
          }} />
        );
      })}
    </View>
  );
}

// ─── Gamified Task Card ──────────────────────────────────────────────────────

function GamifiedTaskCard({
  task,
  onToggle,
  colors,
  isAnimating,
  readOnly,
  paywalled,
  onPaywall,
}: {
  task: TaskItem;
  onToggle: (isCompleted: boolean) => void;
  colors: Colors;
  isAnimating: boolean;
  readOnly?: boolean;
  paywalled?: boolean;
  onPaywall?: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const checkScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isAnimating) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.02, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.spring(checkScaleAnim, { toValue: 1.3, friction: 3, tension: 200, useNativeDriver: true }),
        Animated.spring(checkScaleAnim, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [isAnimating, scaleAnim, checkScaleAnim]);

  const taskTitle = (task as unknown as { title?: string }).title ?? task.task;
  const dfyType = !task.isCompleted && !task.isSkipped && !readOnly ? detectDfyType(taskTitle) : null;
  const [dfyOpen, setDfyOpen] = useState(false);

  return (
    <View style={{ position: "relative" }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          if (paywalled) { onPaywall?.(); return; }
          if (!readOnly && !task.isSkipped) {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            onToggle(!task.isCompleted);
          }
        }}
      >
        <Animated.View style={{
          transform: [{ scale: scaleAnim }],
          backgroundColor: colors.card,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: task.isCompleted ? GOLD : colors.border,
          padding: spacing.md,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: spacing.md,
          opacity: task.isSkipped ? 0.5 : 1,
        }}>
          {/* Checkbox */}
          <View style={{ marginTop: 2 }}>
            <Animated.View style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: task.isCompleted ? GOLD : colors.border,
              backgroundColor: task.isCompleted ? GOLD : "transparent",
              alignItems: "center",
              justifyContent: "center",
              transform: [{ scale: checkScaleAnim }],
            }}>
              {task.isCompleted && (
                <Text style={{ color: "#000", fontSize: 14, fontWeight: "800" }}>{"✓"}</Text>
              )}
            </Animated.View>
          </View>

          {/* Content */}
          <View style={{ flex: 1 }}>
            <Text style={{
              fontWeight: "600",
              fontSize: typography.base,
              color: task.isCompleted ? colors.textTertiary : colors.text,
              textDecorationLine: "none",
              lineHeight: 22,
            }}>
              {taskTitle}
            </Text>
            {task.description ? (
              <Text style={{
                fontSize: typography.sm,
                color: task.isCompleted ? colors.textTertiary : colors.textSecondary,
                marginTop: 4,
                lineHeight: 20,
              }}>
                {task.description}
              </Text>
            ) : null}
            {dfyType && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation?.();
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setDfyOpen(true);
                }}
                style={{
                  alignSelf: "flex-start",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  marginTop: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: "rgba(212,168,67,0.4)",
                  backgroundColor: "rgba(212,168,67,0.12)",
                }}
              >
                <Text style={{ fontSize: 12, color: GOLD }}>{"✨"}</Text>
                <Text style={{ fontSize: 12, fontWeight: "800", color: GOLD }}>
                  Do it for me
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </TouchableOpacity>

      {dfyType && (
        <DfyModal
          visible={dfyOpen}
          type={dfyType}
          taskText={taskTitle}
          onClose={() => setDfyOpen(false)}
          onDelivered={() => {
            if (!task.isCompleted) onToggle(true);
          }}
        />
      )}
    </View>
  );
}

// ─── Today Popup Card ────────────────────────────────────────────────────────

function TodayPopup({
  visible,
  dayNumber,
  taskCount,
  onStart,
  onDismiss,
  colors,
}: {
  visible: boolean;
  dayNumber: number;
  taskCount: number;
  onStart: () => void;
  onDismiss: () => void;
  colors: Colors;
}) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.8);
      fadeAnim.setValue(0);
    }
  }, [visible, scaleAnim, fadeAnim]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none">
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}
        onPress={onDismiss}
      >
        <Animated.View style={{
          transform: [{ scale: scaleAnim }],
          opacity: fadeAnim,
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          borderWidth: 2,
          borderColor: GOLD,
          padding: spacing.xl,
          width: "80%",
          maxWidth: 320,
          alignItems: "center",
          shadowColor: GOLD,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
          elevation: 10,
        }}>
          <Text style={{ fontSize: 48, marginBottom: spacing.md }}>{"⭐"}</Text>
          <Text style={{
            fontSize: typography.xxl,
            fontWeight: "800",
            color: colors.text,
            marginBottom: spacing.xs,
            letterSpacing: -0.5,
          }}>
            Day {dayNumber}
          </Text>
          <Text style={{
            fontSize: typography.base,
            color: colors.textSecondary,
            marginBottom: spacing.lg,
            textAlign: "center",
          }}>
            {taskCount} tasks ready
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onStart();
            }}
            activeOpacity={0.85}
            style={{
              backgroundColor: GOLD,
              paddingHorizontal: 48,
              paddingVertical: 14,
              borderRadius: 14,
              width: "100%",
              alignItems: "center",
            }}
          >
            <Text style={{
              fontSize: typography.md,
              fontWeight: "700",
              color: "#000",
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}>
              START
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ─── Celebration Overlay ─────────────────────────────────────────────────────

function CelebrationOverlay({
  visible,
  dayNumber,
  goalTitle,
  onDismiss,
  colors,
}: {
  visible: boolean;
  dayNumber: number;
  goalTitle: string;
  onDismiss: () => void;
  colors: Colors;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true, delay: 200 }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true, delay: 400 }),
      ]).start();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.5);
      slideAnim.setValue(30);
    }
  }, [visible, fadeAnim, scaleAnim, slideAnim]);

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={{
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.85)",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeAnim,
        padding: spacing.xl,
      }}>
        {/* Gold glow */}
        <View style={{
          position: "absolute",
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: "rgba(212,168,67,0.12)",
        }} />

        <Animated.Text style={{
          fontSize: 80,
          marginBottom: 24,
          transform: [{ scale: scaleAnim }],
        }}>
          {getCelebrationEmoji(dayNumber)}
        </Animated.Text>

        <Animated.Text style={{
          fontSize: typography.xxxl + 4,
          fontWeight: "800",
          color: "#fff",
          letterSpacing: -1,
          marginBottom: 12,
          textAlign: "center",
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim,
        }}>
          Day {dayNumber} Complete
        </Animated.Text>

        <Animated.View style={{ transform: [{ translateY: slideAnim }], opacity: fadeAnim, marginTop: 24 }}>
          <TouchableOpacity
            onPress={onDismiss}
            activeOpacity={0.85}
            style={{
              paddingHorizontal: 48,
              paddingVertical: 16,
              borderRadius: 14,
              backgroundColor: GOLD,
            }}
          >
            <Text style={{
              fontSize: typography.md,
              fontWeight: "700",
              color: "#000",
            }}>
              Return to path
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Stage-complete Celebration Overlay (Fix 2) ──────────────────────────────
// Bigger, more cinematic than the day-complete overlay: emoji spring-bounce,
// sliding title/subtitle, pulsing CTA, confetti burst, double-tap haptic.

const CONFETTI_COUNT = 20;

function StageCelebrationOverlay({
  visible,
  stageNumber,
  onDismiss,
}: {
  visible: boolean;
  stageNumber: number;
  onDismiss: () => void;
}) {
  const emojiScale = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(50)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleSlide = useRef(new Animated.Value(50)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const buttonPulse = useRef(new Animated.Value(1)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Pre-compute confetti particle config once per visibility cycle.
  const confetti = useRef(
    Array.from({ length: CONFETTI_COUNT }).map(() => ({
      translate: new Animated.Value(0),
      opacity: new Animated.Value(1),
      angle: Math.random() * Math.PI * 2,
      distance: 140 + Math.random() * 120,
      size: 6 + Math.random() * 6,
      delay: Math.random() * 120,
    })),
  ).current;

  useEffect(() => {
    if (!visible) {
      emojiScale.setValue(0);
      titleSlide.setValue(50);
      titleOpacity.setValue(0);
      subtitleSlide.setValue(50);
      subtitleOpacity.setValue(0);
      buttonPulse.setValue(1);
      backdropOpacity.setValue(0);
      confetti.forEach((p) => {
        p.translate.setValue(0);
        p.opacity.setValue(1);
      });
      return;
    }

    Animated.timing(backdropOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    // Emoji: 0 → 1.4 → 1 with spring bounce (~700ms total).
    Animated.sequence([
      Animated.spring(emojiScale, { toValue: 1.4, friction: 6, tension: 40, useNativeDriver: true }),
      Animated.spring(emojiScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
    ]).start();

    // Title slides up + fades in (500ms, 200ms delay).
    Animated.parallel([
      Animated.timing(titleSlide, { toValue: 0, duration: 500, delay: 200, useNativeDriver: true }),
      Animated.timing(titleOpacity, { toValue: 1, duration: 500, delay: 200, useNativeDriver: true }),
    ]).start();

    // Subtitle slides up + fades in (500ms, 400ms delay).
    Animated.parallel([
      Animated.timing(subtitleSlide, { toValue: 0, duration: 500, delay: 400, useNativeDriver: true }),
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 500, delay: 400, useNativeDriver: true }),
    ]).start();

    // Button pulse loop.
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(buttonPulse, { toValue: 1.05, duration: 700, useNativeDriver: true }),
        Animated.timing(buttonPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();

    // Confetti burst — animate translation outward + fade.
    confetti.forEach((p) => {
      Animated.parallel([
        Animated.timing(p.translate, { toValue: 1, duration: 1500, delay: p.delay, useNativeDriver: true }),
        Animated.timing(p.opacity, { toValue: 0, duration: 1500, delay: p.delay, useNativeDriver: true }),
      ]).start();
    });

    // Haptics: success feedback twice for emphasis.
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const t = setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 400);
      return () => {
        clearTimeout(t);
        pulse.stop();
      };
    }

    return () => {
      pulse.stop();
    };
  }, [visible, emojiScale, titleSlide, titleOpacity, subtitleSlide, subtitleOpacity, buttonPulse, backdropOpacity, confetti]);

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={{ flex: 1, opacity: backdropOpacity }}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center", padding: spacing.xl }}
          onPress={onDismiss}
        >
          {/* Gold radial glow behind emoji */}
          <View style={{
            position: "absolute",
            width: 360,
            height: 360,
            borderRadius: 9999,
            backgroundColor: "rgba(212,168,67,0.18)",
            shadowColor: GOLD,
            shadowOpacity: 0.7,
            shadowRadius: 60,
            shadowOffset: { width: 0, height: 0 },
          }} />

          {/* Confetti — absolute-positioned gold dots animating outward */}
          {confetti.map((p, i) => {
            const dx = Math.cos(p.angle) * p.distance;
            const dy = Math.sin(p.angle) * p.distance;
            return (
              <Animated.View
                key={i}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  width: p.size,
                  height: p.size,
                  borderRadius: p.size / 2,
                  backgroundColor: GOLD,
                  opacity: p.opacity,
                  transform: [
                    { translateX: p.translate.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
                    { translateY: p.translate.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
                  ],
                }}
              />
            );
          })}

          <Animated.Text style={{
            fontSize: 96,
            marginBottom: 24,
            transform: [{ scale: emojiScale }],
          }}>
            {"🏆"}
          </Animated.Text>

          <Animated.Text style={{
            fontSize: typography.xxxl + 6,
            fontWeight: "800",
            color: "#fff",
            letterSpacing: -1,
            marginBottom: 12,
            textAlign: "center",
            transform: [{ translateY: titleSlide }],
            opacity: titleOpacity,
          }}>
            Stage {stageNumber} Complete!
          </Animated.Text>

          <Animated.Text style={{
            fontSize: typography.base,
            color: "rgba(255,255,255,0.85)",
            textAlign: "center",
            marginBottom: spacing.lg,
            paddingHorizontal: spacing.lg,
            lineHeight: 22,
            transform: [{ translateY: subtitleSlide }],
            opacity: subtitleOpacity,
          }}>
            You've unlocked Stage {stageNumber + 1}. A brand new path starts tomorrow.
          </Animated.Text>

          <Animated.View style={{ transform: [{ scale: buttonPulse }], marginTop: spacing.md }}>
            <TouchableOpacity
              onPress={onDismiss}
              activeOpacity={0.85}
              style={{
                paddingHorizontal: 48,
                paddingVertical: 16,
                borderRadius: 14,
                backgroundColor: GOLD,
              }}
            >
              <Text style={{ fontSize: typography.md, fontWeight: "700", color: "#000" }}>
                Keep going
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
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

  // Gamification state
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const [animatingTaskId, setAnimatingTaskId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"path" | "tasks">("path");
  // Increment to force a re-center on the path view (on focus / viewMode->path).
  const [pathScrollTrigger, setPathScrollTrigger] = useState(0);
  useEffect(() => {
    if (viewMode === "path") setPathScrollTrigger((n) => n + 1);
  }, [viewMode]);
  // Persisted "started" days (Gap 2): remove START badge once user taps today
  const [startedDays, setStartedDays] = useState<Set<number>>(new Set());
  // Completed-day modal (Gap 3): show that day's tasks read-only
  const [viewingDay, setViewingDay] = useState<{ day: number; tasks: TaskItem[] } | null>(null);
  const [viewingDayLoading, setViewingDayLoading] = useState(false);
  // Stage-complete celebration (Gap 4)
  const [showStageCelebration, setShowStageCelebration] = useState(false);
  const [stageCelebrationNumber, setStageCelebrationNumber] = useState(1);
  // Auto-generation failure (Fix 1): show retry UI when background gen fails
  const [autoGenFailed, setAutoGenFailed] = useState(false);

  // Next-day task buffer: holds tomorrow's DailyTask records when the user taps
  // the next-day node after completing today. No cap or modal — just a fetch
  // and immediate display.
  const [nextDayTasks, setNextDayTasks] = useState<DailyTask[] | null>(null);

  // ─── Pro / trial state ────────────────────────────────────────────────────────
  const { hasPro, isLimitedMode, walkthroughActive, refreshSubscription } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);

  const hasLoadedOnce = useRef(false);
  const hasAutoGenerated = useRef(false);
  const lastAutoGenFailRef = useRef<number>(0);
  const pendingSwitchGoal = useRef<string | null>(null);
  const recentlyToggledRef = useRef<Set<string>>(new Set());
  const userIdRef = useRef<string>("");
  const [sortTrigger, setSortTrigger] = useState(0);

  // Streak increment animation (Fix 3): scales the streak text when it increments.
  const streakScaleAnim = useRef(new Animated.Value(1)).current;
  const prevStreakRef = useRef<number | null>(null);

  // Day-complete celebration refs — declared early so the midnight-rollover
  // effect below can safely reference them without TDZ concerns.
  const userToggledRef = useRef(false);
  const hasTriggeredCelebration = useRef(false);

  const lastCalendarDayRef = useRef<string>((() => {
    const n = new Date();
    return `${n.getFullYear()}-${n.getMonth() + 1}-${n.getDate()}`;
  })());

  // Load nickname + email eagerly
  useEffect(() => {
    (async () => {
      const [saved, { data: sessionData }] = await Promise.all([
        AsyncStorage.getItem("@threely_nickname"),
        supabase.auth.getSession(),
      ]);
      if (saved) {
        setNickname(saved);
      } else {
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
      const todayKey = `@threely_focus_${new Date().toLocaleDateString("en-CA")}`;
      const [tasksRes, goalsRes, profileRes, statsRes, focusRes, savedFocus] = await Promise.all([
        tasksApi.today(false),
        goalsApi.list(),
        profileApi.get().catch(() => ({ profile: null })),
        statsApi.get().catch(() => ({ totalCompleted: 0, activeGoals: 0, streak: 0, goalStats: [] })),
        focusApi.get().catch(() => ({ focus: null })),
        AsyncStorage.getItem(`@threely_focus_${new Date().toLocaleDateString("en-CA")}`),
      ]);
      setDailyTasks(tasksRes.dailyTasks);
      setGoals(goalsRes.goals);
      setGoalStats(statsRes.goalStats ?? []);
      if (profileRes.profile) setDailyTimeMinutes(profileRes.profile.dailyTimeMinutes);

      // Check if any generate is in progress
      const todayStr = new Date().toLocaleDateString("en-CA");
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

      // Restore saved focus
      const serverFocus = focusRes.focus?.focusGoalId;
      const restoredFocus = serverFocus ?? savedFocus;
      const activeGoalIds = new Set(goalsRes.goals.map(g => g.id));
      const isValidFocus = restoredFocus && activeGoalIds.has(restoredFocus);
      if (isValidFocus) {
        setSelectedGoal(restoredFocus);
        if (serverFocus && !savedFocus) {
          await AsyncStorage.setItem(todayKey, serverFocus);
        }
      } else if (goalsRes.goals.length === 1) {
        setSelectedGoal(goalsRes.goals[0].id);
      } else if (goalsRes.goals.length > 1) {
        setSelectedGoal(goalsRes.goals[0].id);
      }

      // Auto-generate tasks if none exist and user has goals
      if (
        tasksRes.dailyTasks.length === 0 &&
        goalsRes.goals.length > 0 &&
        !tasksRes.restDay &&
        !hasAutoGenerated.current &&
        !activeGenFlag &&
        Date.now() - lastAutoGenFailRef.current >= 30_000
      ) {
        setGenerating(true);
        setAutoGenFailed(false);
        const autoGenKey = `@threely_generating_${todayStr}`;
        AsyncStorage.setItem(autoGenKey, String(Date.now()));
        try {
          const res = await tasksApi.generate();
          AsyncStorage.removeItem(autoGenKey);
          if (res.restDay) {
            setRestDay(true);
          } else {
            setDailyTasks(res.dailyTasks);
            // Notifications disabled
          }
          // Only mark as generated AFTER success, so a failure allows retry.
          hasAutoGenerated.current = true;
        } catch (err: unknown) {
          AsyncStorage.removeItem(autoGenKey);
          if (err instanceof Error && err.message?.includes("pro_required")) {
            // Paywall error: allow retry immediately on next load once upgraded.
            hasAutoGenerated.current = false;
            setShowPaywall(true);
          } else {
            // Non-paywall failure: keep hasAutoGenerated true and arm a cooldown
            // so focus/AppState/midnight triggers don't cause a retry storm.
            hasAutoGenerated.current = true;
            lastAutoGenFailRef.current = Date.now();
            setAutoGenFailed(true);
          }
        } finally {
          setGenerating(false);
        }
      }

      // Apply pending goal switch
      if (pendingSwitchGoal.current) {
        setSelectedGoal(pendingSwitchGoal.current);
        pendingSwitchGoal.current = null;
      }
    } catch (e) {
      console.warn("loadData error", e);
    }
  }, []);

  // Refetch when calendar day rolls over (midnight), so stale data clears.
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const n = new Date();
        const nowDayStr = `${n.getFullYear()}-${n.getMonth() + 1}-${n.getDate()}`;
        if (nowDayStr !== lastCalendarDayRef.current) {
          lastCalendarDayRef.current = nowDayStr;
          hasAutoGenerated.current = false;
          lastAutoGenFailRef.current = 0;
          // Reset per-day celebration + toggle flags so the new day can celebrate.
          hasTriggeredCelebration.current = false;
          userToggledRef.current = false;
          setCelebrationDismissed(false);
          loadData();
        }
      } catch (e) {
        // Never let this interval take down the app
        console.warn("midnight rollover error", e);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("@threely_switch_goal").then((switchGoalId) => {
        if (switchGoalId) {
          AsyncStorage.removeItem("@threely_switch_goal");
          pendingSwitchGoal.current = switchGoalId;
        }
      });
      // Re-center the path on today's node every time Today tab is focused.
      setPathScrollTrigger((n) => n + 1);
      if (!hasLoadedOnce.current) {
        hasLoadedOnce.current = true;
        loadData().finally(() => setLoading(false));
      } else {
        loadData();
      }
    }, [loadData])
  );

  // Refetch when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && hasLoadedOnce.current) loadData();
    });
    return () => {
      sub.remove();
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [loadData]);

  useEffect(() => {
    if (loading) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) userIdRef.current = user.id;
    })();
  }, [loading]);

  useMemo(() => {
    if (goals.length >= 1 && !selectedGoal) setSelectedGoal(goals[0].id);
  }, [goals.length]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // During tutorial walkthrough, always use mock data
  const effectiveGoals = walkthroughActive ? [MOCK_TUTORIAL_GOAL] : goals;
  const effectiveDailyTasks = walkthroughActive ? [MOCK_TUTORIAL_DAILY_TASK] : dailyTasks;
  const effectiveSelectedGoal = walkthroughActive ? MOCK_TUTORIAL_GOAL.id : selectedGoal;

  // ─── Derived state ─────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _sort = sortTrigger;

  const visibleTasks: DailyTask[] =
    effectiveDailyTasks.filter((dt) => dt.goalId === effectiveSelectedGoal);

  const displayVisibleTasks: DailyTask[] = visibleTasks.map((dt) => {
    const tasks = (Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : []).slice(-3);
    const incomplete = tasks.filter(t => !t.isCompleted || recentlyToggledRef.current.has(t.id));
    const completed = tasks.filter(t => t.isCompleted && !recentlyToggledRef.current.has(t.id));
    return { ...dt, tasks: [...incomplete, ...completed] };
  });

  const newTaskItems =
    displayVisibleTasks.flatMap((dt) => (Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : []));

  const currentGoalObj = effectiveGoals.find((g) => g.id === effectiveSelectedGoal);
  const hasVisibleTasks = visibleTasks.length > 0;

  // Only treat "all done" as true if the loaded tasks are actually for today's
  // calendar date. Otherwise a new day that just unlocked at midnight will
  // inherit yesterday's completed state until the refetch lands.
  const todayLocalDateStr = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  })();
  const tasksAreForToday = visibleTasks.some((dt) => {
    if (!dt?.date) return false;
    try {
      // Server stores DailyTask.date as UTC midnight of the user's local date
      // (e.g. "2026-04-17T00:00:00Z" represents the user's April 17 locally).
      const d = new Date(dt.date);
      if (isNaN(d.getTime())) return false;
      const s = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      return s === todayLocalDateStr;
    } catch {
      return false;
    }
  });
  const allDone = tasksAreForToday && newTaskItems.length > 0 && newTaskItems.every((t) => t.isCompleted || t.isSkipped);

  const streak = getStreakFromGoals(effectiveGoals);
  const goalDayNumber = currentGoalObj ? getGoalDayNumber(currentGoalObj) : 1;

  // Effective path day number — mirrors web's `pathDayNumber`:
  // first DailyTask whose 3 tasks aren't all done determines the day;
  // if every existing day is done, it's the day AFTER the last one.
  // No cap to calendar day — completing a day immediately unlocks the next
  // (so web + mobile stay in sync when the calendar rolls past the last
  // existing DailyTask but before tomorrow's DailyTask has been generated).
  const effectiveDayNumber = (() => {
    if (!currentGoalObj) return goalDayNumber;
    const createdLocalMs = new Date(
      new Date(currentGoalObj.createdAt).getFullYear(),
      new Date(currentGoalObj.createdAt).getMonth(),
      new Date(currentGoalObj.createdAt).getDate()
    ).getTime();
    const candidates = effectiveDailyTasks
      .filter((d) => d.goalId === effectiveSelectedGoal && d.date)
      .map((d) => {
        const x = new Date(d.date);
        const localMs = new Date(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()).getTime();
        return { dt: d, localMs };
      })
      .sort((a, b) => a.localMs - b.localMs);
    const firstIncomplete = candidates.find(({ dt }) => {
      const items = Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]).slice(-3) : [];
      // Empty-tasks DailyTask: row exists but generation hasn't populated it
      // (e.g. milestone day that pre-gen hit before content was ready). Treat
      // as incomplete so the path doesn't skip over it.
      if (items.length === 0) return true;
      return !items.every((t) => t.isCompleted || t.isSkipped);
    });
    if (firstIncomplete) {
      const diffDays = Math.floor((firstIncomplete.localMs - createdLocalMs) / 86400000) + 1;
      return Math.max(1, diffDays);
    }
    if (candidates.length > 0) {
      const last = candidates[candidates.length - 1];
      const lastDay = Math.floor((last.localMs - createdLocalMs) / 86400000) + 1;
      return Math.max(1, lastDay + 1);
    }
    return goalDayNumber;
  })();

  // pathDayAllDone reflects completion of effectiveDayNumber's DailyTask —
  // NOT of the calendar-today DailyTask. Without this scope: after user
  // finishes day N, effectiveDayNumber advances to N+1 but `allDone` is still
  // true (from day N), so SCurvePathView's `day === goalDayNumber && allDone`
  // rule incorrectly marks day N+1 as completed (and N+2 as "work-ahead"),
  // skipping the real unlocked day. Scoped to effectiveDayNumber, the
  // DailyTask for N+1 doesn't exist (or has empty/incomplete tasks) → false
  // → SCurvePathView renders N+1 as "today".
  const pathDayAllDone = (() => {
    if (!currentGoalObj) return false;
    const createdLocalMs = new Date(
      new Date(currentGoalObj.createdAt).getFullYear(),
      new Date(currentGoalObj.createdAt).getMonth(),
      new Date(currentGoalObj.createdAt).getDate()
    ).getTime();
    const pathDt = effectiveDailyTasks.find((d) => {
      if (d.goalId !== effectiveSelectedGoal || !d.date) return false;
      const x = new Date(d.date);
      const localMs = new Date(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()).getTime();
      const diffDays = Math.floor((localMs - createdLocalMs) / 86400000) + 1;
      return diffDays === effectiveDayNumber;
    });
    if (!pathDt) return false;
    const items = Array.isArray(pathDt.tasks) ? (pathDt.tasks as TaskItem[]).slice(-3) : [];
    return items.length > 0 && items.every((t) => t.isCompleted || t.isSkipped);
  })();

  // Task progress for progress ring (0-1)
  const taskProgress = newTaskItems.length > 0
    ? newTaskItems.filter(t => t.isCompleted || t.isSkipped).length / newTaskItems.length
    : 0;

  // Clear buffered next-day tasks when goal or effective day changes.
  const nextDayClearKeyRef = useRef<string>("");
  useEffect(() => {
    const key = `${effectiveSelectedGoal}:${effectiveDayNumber}`;
    if (nextDayClearKeyRef.current && nextDayClearKeyRef.current !== key) {
      setNextDayTasks(null);
    }
    nextDayClearKeyRef.current = key;
  }, [effectiveSelectedGoal, effectiveDayNumber]);

  // Gap 2 — load persisted "started" days when goal changes
  useEffect(() => {
    if (!effectiveSelectedGoal) { setStartedDays(new Set()); return; }
    let cancelled = false;
    (async () => {
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const prefix = `@threely_started_${effectiveSelectedGoal}_d`;
        const mine = allKeys.filter((k) => k.startsWith(prefix));
        const nums = mine
          .map((k) => parseInt(k.slice(prefix.length), 10))
          .filter((n) => !Number.isNaN(n));
        if (!cancelled) setStartedDays(new Set(nums));
      } catch {
        if (!cancelled) setStartedDays(new Set());
      }
    })();
    return () => { cancelled = true; };
  }, [effectiveSelectedGoal]);

  const markDayStarted = useCallback((day: number) => {
    if (!effectiveSelectedGoal) return;
    const key = `@threely_started_${effectiveSelectedGoal}_d${day}`;
    AsyncStorage.setItem(key, "1").catch(() => {});
    setStartedDays((prev) => {
      if (prev.has(day)) return prev;
      const next = new Set(prev);
      next.add(day);
      return next;
    });
  }, [effectiveSelectedGoal]);

  // Gap 4 — stage-complete celebration: fires after regular day-complete.
  const prevStageCompleteRef = useRef<{ goalId: string | null; day: number | null }>({ goalId: null, day: null });

  // Build notification context
  const buildNotifContext = useCallback((): NotifContext => {
    const focusGoalName = goals.find(g => g.id === selectedGoal)?.title ?? null;
    const incomplete = newTaskItems.filter(t => !t.isCompleted && !t.isSkipped);

    const activeGoalsToday = goals.filter(g => {
      const stat = goalStats.find(s => s.goalId === g.id);
      return isGoalWorkDay(stat?.workDays);
    });

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

  // Notifications disabled — primary channel is web, mobile is secondary
  // Permission code stays in place; just don't schedule.

  // Show celebration when user manually completes all tasks (not on page load)
  useEffect(() => {
    if (allDone && newTaskItems.length > 0 && userToggledRef.current && !hasTriggeredCelebration.current) {
      setShowCelebration(true);
      hasTriggeredCelebration.current = true;
    }
  }, [allDone, newTaskItems.length]);

  // Pre-generate tomorrow's tasks in the background as soon as today's tasks
  // are loaded — regardless of whether the user has started or finished them.
  // So tomorrow is ALWAYS ready while they work today: instant work-ahead,
  // instant midnight unlock, no LLM-call delay.
  const preGenFiredForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!effectiveSelectedGoal || !tasksAreForToday) return;
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const tomorrowLocal = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    const dedupeKey = `${effectiveSelectedGoal}:${tomorrowLocal}`;
    if (preGenFiredForRef.current === dedupeKey) return;
    preGenFiredForRef.current = dedupeKey;
    // Fire and forget — silent failure is fine, on-demand generate still works.
    // Server has a unique (goalId, date) constraint so repeated calls are no-ops.
    tasksApi.generate(effectiveSelectedGoal, { localDate: tomorrowLocal }).catch(() => {
      // Allow retry if it failed (e.g. network blip)
      preGenFiredForRef.current = null;
    });
  }, [effectiveSelectedGoal, tasksAreForToday]);

  // Fix 3 — animate streak text on increment (not on initial mount).
  useEffect(() => {
    const prev = prevStreakRef.current;
    if (prev === null) {
      prevStreakRef.current = streak;
      return;
    }
    if (streak > prev) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      Animated.sequence([
        Animated.spring(streakScaleAnim, { toValue: 1.3, friction: 6, tension: 300, useNativeDriver: true }),
        Animated.spring(streakScaleAnim, { toValue: 1, friction: 6, tension: 300, useNativeDriver: true }),
      ]).start();
    }
    prevStreakRef.current = streak;
  }, [streak, streakScaleAnim]);

  // Gap 4 — stage-complete celebration: when user completes day 20 / 40 / 60 / ...
  useEffect(() => {
    if (!allDone || !effectiveSelectedGoal || !userToggledRef.current) return;
    if (goalDayNumber % 20 !== 0) return;
    if (
      prevStageCompleteRef.current.goalId === effectiveSelectedGoal &&
      prevStageCompleteRef.current.day === goalDayNumber
    ) return;
    prevStageCompleteRef.current = { goalId: effectiveSelectedGoal, day: goalDayNumber };
    setStageCelebrationNumber(Math.ceil(goalDayNumber / 20));
    // Let the regular day-complete celebration fire first, then stage one
    const t = setTimeout(() => setShowStageCelebration(true), 600);
    return () => clearTimeout(t);
  }, [allDone, goalDayNumber, effectiveSelectedGoal]);

  // When all done and celebration dismissed, switch back to path
  useEffect(() => {
    if (allDone && celebrationDismissed && viewMode === "tasks") {
      setViewMode("path");
    }
  }, [allDone, celebrationDismissed, viewMode]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function selectGoalTab(goalId: string) {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelectedGoal(goalId);
    setCelebrationDismissed(false);
    setShowCelebration(false);
    setViewMode("path");
    // Reset per-goal celebration + toggle flags so switching goals can re-fire.
    hasTriggeredCelebration.current = false;
    userToggledRef.current = false;
    // Persist locally + server
    const todayKey = `@threely_focus_${new Date().toLocaleDateString("en-CA")}`;
    AsyncStorage.setItem(todayKey, goalId);
    focusApi.save(goalId).catch(() => {});
  }

  async function handleFirstGenerate() {
    if (goals.length === 0) {
      router.navigate("/(tabs)/goals");
      return;
    }
    // Manual retry clears both cooldown flags so the next auto-gen can run too.
    hasAutoGenerated.current = false;
    lastAutoGenFailRef.current = 0;
    setGenerating(true);
    setAutoGenFailed(false);
    const genTodayStr = new Date().toLocaleDateString("en-CA");
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
      hasAutoGenerated.current = true;
      // Notifications disabled
    } catch (e: unknown) {
      AsyncStorage.removeItem(`@threely_generating_${genTodayStr}`);
      if (e instanceof Error && e.message?.includes("pro_required")) {
        hasAutoGenerated.current = false;
        setShowPaywall(true);
      } else {
        hasAutoGenerated.current = true;
        lastAutoGenFailRef.current = Date.now();
        setAutoGenFailed(true);
        showToast(e instanceof Error ? e.message : "Failed to generate tasks", "error");
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggleTask(dailyTaskId: string, taskItemId: string, isCompleted: boolean) {
    userToggledRef.current = true;
    if (isCompleted) {
      setAnimatingTaskId(taskItemId);
      setTimeout(() => setAnimatingTaskId(null), 500);
      recentlyToggledRef.current.add(taskItemId);
      setTimeout(() => {
        recentlyToggledRef.current.delete(taskItemId);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSortTrigger(prev => prev + 1);
      }, 400);
    }

    try {
      const res = await tasksApi.completeItem(dailyTaskId, taskItemId, isCompleted);
      setDailyTasks((prev) => {
        if (prev.some((dt) => dt.id === dailyTaskId)) {
          return prev.map((dt) => (dt.id === dailyTaskId ? res.dailyTask : dt));
        }
        // Insert so path state (effectiveDayNumber) advances when a next-day
        // task is completed mid-session.
        return [...prev, res.dailyTask];
      });
      setNextDayTasks((prev) =>
        prev && prev.some((dt) => dt.id === dailyTaskId)
          ? prev.map((dt) => (dt.id === dailyTaskId ? res.dailyTask : dt))
          : prev
      );
      // Notifications disabled
    } catch {
      showToast("Couldn't update task. Try again.", "error");
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const wideContentStyle = isWide ? { maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" as const, width: "100%" as const } : undefined;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={[styles.headerRow, wideContentStyle]}>
            <View>
              <Text style={styles.streakText}>{"🔥"} --</Text>
            </View>
          </View>
        </View>
        <View style={[{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }, wideContentStyle]}>
          <SkeletonPath screenWidth={screenWidth} />
        </View>
      </View>
    );
  }

  return (
    <SwipeNavigator currentIndex={0}>
    <View style={styles.container}>
      {/* Fixed header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={[styles.headerRow, wideContentStyle]}>
          {/* Streak counter */}
          <Animated.Text style={[styles.streakText, { transform: [{ scale: streakScaleAnim }] }]}>
            {"🔥"} {streak}
          </Animated.Text>

          {/* Goal name (single goal) */}
          {currentGoalObj && effectiveGoals.length === 1 && (
            <Text style={styles.goalNameSingle} numberOfLines={1} ellipsizeMode="tail">
              {currentGoalObj.title}
            </Text>
          )}
        </View>

        {/* Goal tab pills (multiple goals) */}
        {effectiveGoals.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.goalTabsContainer, wideContentStyle]}
            style={{ marginTop: spacing.sm }}
          >
            {effectiveGoals.map(g => {
              const isActive = g.id === effectiveSelectedGoal;
              return (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => selectGoalTab(g.id)}
                  activeOpacity={0.7}
                  style={[
                    styles.goalTab,
                    isActive && styles.goalTabActive,
                  ]}
                >
                  <Text style={[
                    styles.goalTabText,
                    isActive && styles.goalTabTextActive,
                  ]} numberOfLines={1}>
                    {g.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {/* Add goal button */}
            <TouchableOpacity
              onPress={() => {
                if (effectiveGoals.length >= 3) {
                  Alert.alert(
                    "Focus beats hustle",
                    "3 goals is the sweet spot. Finish or remove one to add another."
                  );
                } else {
                  router.navigate("/(tabs)/goals");
                }
              }}
              activeOpacity={0.7}
              style={styles.goalTabAdd}
            >
              <Text style={styles.goalTabAddText}>+</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      <ScrollView
        ref={r => registerScroll("today-scroll", r)}
        contentContainerStyle={[styles.scroll, wideContentStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />
        }
      >

        {/* Special offer banner + auto-popup */}
        <OfferPopup />

        {/* Limited mode banner */}
        {isLimitedMode && (
          <Pressable style={styles.expiredBanner} onPress={() => setShowPaywall(true)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.expiredTitle}>Unlock Threely Pro</Text>
              <Text style={styles.expiredSubtitle}>Get Pro free for 3 days — Achieve your goals</Text>
            </View>
            <Text style={{ color: colors.primary, fontSize: typography.sm, fontWeight: typography.semibold }}>Try Free</Text>
          </Pressable>
        )}

        {/* ─── No goals: empty state ─── */}
        {effectiveGoals.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 48, marginBottom: spacing.md }}>{"🚀"}</Text>
            <Text style={styles.emptyTitle}>Get started</Text>
            <Text style={styles.emptySubtitle}>
              Create your first goal and we'll generate daily tasks to help you achieve it.
            </Text>
            <TouchableOpacity
              onPress={() => router.navigate("/(tabs)/goals")}
              activeOpacity={0.85}
              style={{
                backgroundColor: GOLD,
                paddingHorizontal: 32,
                paddingVertical: 14,
                borderRadius: 14,
                width: "100%",
                alignItems: "center",
              }}
            >
              <Text style={{
                fontSize: typography.md,
                fontWeight: "700",
                color: "#000",
              }}>
                Create your first goal {"→"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : restDay && !generating ? (
          /* Rest day */
          <View style={styles.empty}>
            <Text style={{ fontSize: 48, marginBottom: spacing.md }}>{"😴"}</Text>
            <Text style={styles.emptyTitle}>No goals scheduled for today</Text>
            <Text style={styles.emptySubtitle}>
              Enjoy your rest day — or keep the momentum going!
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: spacing.md, paddingHorizontal: spacing.xl }]}
              onPress={() => {
                const todayStr = new Date().toLocaleDateString("en-CA");
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
          /* Generating skeleton */
          <View style={{ alignItems: "center", paddingVertical: spacing.xl * 2, paddingHorizontal: spacing.lg }}>
            <Text style={{ fontSize: 36, marginBottom: spacing.md }}>{"\u2726"}</Text>
            <Text style={{ fontSize: typography.lg, fontWeight: "700", color: colors.text, textAlign: "center", marginBottom: spacing.sm }}>
              Your tasks are being generated...
            </Text>
            <View style={{ width: "70%", maxWidth: 300, height: 5, backgroundColor: colors.border, borderRadius: 3, marginBottom: spacing.md, overflow: "hidden" }}>
              <View style={{ height: "100%", width: "60%", backgroundColor: GOLD, borderRadius: 3 }} />
            </View>
            <Text style={{ textAlign: "center", fontSize: typography.sm, color: colors.textSecondary, lineHeight: 20 }}>
              This can take up to 30 seconds.{"\n"}We'll notify you when ready.
            </Text>
          </View>
        ) : !hasVisibleTasks ? (
          /* No tasks for today */
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {autoGenFailed ? "We couldn't generate your tasks" : "No tasks for today"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {autoGenFailed
                ? "Something went wrong reaching our servers. Tap below to try again."
                : "Tap below to generate 3 tasks for each of your goals."}
            </Text>
            <Button
              title={generating ? "Generating…" : autoGenFailed ? "Try again" : "Generate today's tasks"}
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
        ) : viewMode === "path" ? (
          /* ═══ PATH VIEW ═══ */
          <>
            {/* All done state above path — only when completed in this session */}
            {allDone && celebrationDismissed && hasTriggeredCelebration.current && (
              <View style={styles.allDoneContainer}>
                <Text style={styles.allDoneCheck}>{"✓"}</Text>
                <Text style={styles.allDoneTitle}>All done for today</Text>
              </View>
            )}

            {/* S-curve path */}
            <SCurvePathView
              goalDayNumber={effectiveDayNumber}
              allDone={pathDayAllDone}
              startedDays={startedDays}
              scrollTrigger={pathScrollTrigger}
              onTapToday={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                markDayStarted(effectiveDayNumber);
                // Go straight to tasks view (matches web — no intermediate popup).
                setViewMode("tasks");
              }}
              onTapWorkAhead={async () => {
                // No cap, no modal — fetch next day's tasks and open them immediately.
                if (!effectiveSelectedGoal) return;
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                markDayStarted(effectiveDayNumber + 1);
                if (nextDayTasks && nextDayTasks.length > 0) {
                  setViewMode("tasks");
                  return;
                }
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
                try {
                  let goalTasks: DailyTask[] = [];
                  try {
                    const existing = await tasksApi.today(false, tomorrowStr);
                    goalTasks = existing.dailyTasks.filter((dt) => dt.goalId === effectiveSelectedGoal);
                  } catch {
                    goalTasks = [];
                  }
                  if (goalTasks.length === 0) {
                    const gen = await tasksApi.generate(effectiveSelectedGoal, { localDate: tomorrowStr });
                    goalTasks = (gen.dailyTasks || []).filter((dt) => dt.goalId === effectiveSelectedGoal);
                  }
                  if (goalTasks.length === 0) {
                    Alert.alert("Couldn't load next day's tasks", "Please try again in a moment.");
                    return;
                  }
                  setNextDayTasks(goalTasks);
                  setViewMode("tasks");
                } catch (e) {
                  if (e instanceof Error && e.message?.includes("pro_required")) {
                    setShowPaywall(true);
                  } else {
                    Alert.alert("Couldn't load next day's tasks", "Please try again.");
                  }
                }
              }}
              onTapLocked={() => {
                Alert.alert("This day is locked", "Complete the current day first.");
              }}
              onTapCompleted={async (day) => {
                if (!currentGoalObj) return;
                // Stage guard (Gap 4): only allow viewing completed days in the current stage
                const currentStage = Math.ceil(effectiveDayNumber / 20) || 1;
                const tapStage = Math.ceil(day / 20) || 1;
                if (tapStage !== currentStage) return;
                // Compute the date for this day based on goal.createdAt
                const created = new Date(currentGoalObj.createdAt);
                const base = new Date(created.getFullYear(), created.getMonth(), created.getDate());
                const target = new Date(base);
                target.setDate(target.getDate() + day - 1);
                const dateStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
                setViewingDayLoading(true);
                setViewingDay({ day, tasks: [] });
                try {
                  const res = await tasksApi.today(false, dateStr);
                  const goalTasks = res.dailyTasks.filter((dt) => dt.goalId === effectiveSelectedGoal);
                  const items = goalTasks.flatMap((dt) => (Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : [])).slice(-3);
                  setViewingDay({ day, tasks: items });
                } catch {
                  setViewingDay({ day, tasks: [] });
                } finally {
                  setViewingDayLoading(false);
                }
              }}
              colors={colors}
              screenWidth={screenWidth}
              screenHeight={screenHeight}
              taskProgress={taskProgress}
            />
          </>
        ) : (
          /* ═══ TASK VIEW ═══ */
          (() => {
            const inNextDay = !!(nextDayTasks && nextDayTasks.length > 0);
            const activeTasks = inNextDay
              ? nextDayTasks!.map((dt) => ({
                  ...dt,
                  tasks: (Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : []).slice(-3),
                }))
              : displayVisibleTasks;
            const activeDayNumber = inNextDay ? goalDayNumber + 1 : goalDayNumber;
            const activeAllDone = inNextDay
              ? activeTasks.every((dt) =>
                  (Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : []).every((t) => t.isCompleted)
                )
              : allDone;
            return (
              <>
                {/* Back to path */}
                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS !== "web") Haptics.selectionAsync();
                    setViewMode("path");
                  }}
                  activeOpacity={0.7}
                  style={styles.backButton}
                >
                  <Text style={styles.backButtonText}>{"←"} Back to path</Text>
                </TouchableOpacity>

                {/* Day heading + day-total time (not per-task). */}
                <View style={styles.dayLabelContainer}>
                  <Text style={styles.dayLabel}>Day {activeDayNumber}</Text>
                  {(() => {
                    const totalMin = activeTasks.reduce((sum, dt) => {
                      const items = Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]).slice(-3) : [];
                      return sum + items.reduce((s, t) => s + (t.estimated_minutes || 0), 0);
                    }, 0);
                    if (!totalMin) return null;
                    return (
                      <Text style={{ fontSize: typography.xs, fontWeight: "600", color: colors.textSecondary, marginTop: 3 }}>
                        ~{totalMin} min total
                      </Text>
                    );
                  })()}
                </View>

                {/* Task cards — always shown, read-only when all done */}
                {activeTasks.map((dt) => (
                  <View key={dt.id} style={{ marginBottom: 0 }}>
                    {(Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : []).map((task) => (
                      <View
                        key={task.id}
                        ref={!inNextDay && newTaskItems.indexOf(task) === 0 ? r => register("first-task-card", r) : undefined}
                        collapsable={false}
                        style={{ marginBottom: spacing.sm + 4 }}
                      >
                        <GamifiedTaskCard
                          task={task}
                          onToggle={(isCompleted) =>
                            handleToggleTask(dt.id, task.id, isCompleted)
                          }
                          colors={colors}
                          isAnimating={animatingTaskId === task.id}
                          readOnly={activeAllDone}
                          paywalled={!hasPro && !walkthroughActive}
                          onPaywall={() => setShowPaywall(true)}
                        />
                      </View>
                    ))}
                  </View>
                ))}
              </>
            );
          })()
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
                  const todayStr = new Date().toLocaleDateString("en-CA");
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

      {/* ── Celebration overlay ─────────────────────────────────────────────── */}
      <CelebrationOverlay
        visible={showCelebration}
        dayNumber={goalDayNumber}
        goalTitle={currentGoalObj?.title ?? ""}
        onDismiss={() => {
          setShowCelebration(false);
          setCelebrationDismissed(true);
        }}
        colors={colors}
      />

      {/* ── Stage-complete celebration (Fix 2) ──────────────────────────────── */}
      <StageCelebrationOverlay
        visible={showStageCelebration}
        stageNumber={stageCelebrationNumber}
        onDismiss={() => {
          setShowStageCelebration(false);
          userToggledRef.current = false;
        }}
      />

      {/* ── Completed-day read-only modal (Gap 3) ───────────────────────────── */}
      <Modal visible={viewingDay !== null} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: spacing.lg }}
          onPress={() => setViewingDay(null)}
        >
          <Pressable
            style={{
              backgroundColor: colors.card,
              borderRadius: radius.xl,
              padding: spacing.xl,
              width: "100%",
              maxWidth: 420,
              borderWidth: 1,
              borderColor: "rgba(212,168,67,0.25)",
            }}
            onPress={() => {}}
          >
            <View style={{ alignItems: "center", marginBottom: spacing.md }}>
              <Text style={{ fontSize: 36, marginBottom: spacing.xs }}>{"🏆"}</Text>
              <Text style={{ fontSize: typography.xxl, fontWeight: "800", color: colors.text, letterSpacing: -0.5 }}>
                Day {viewingDay?.day ?? ""}
              </Text>
              <Text style={{ fontSize: typography.sm, fontWeight: "600", color: GOLD, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Completed
              </Text>
            </View>

            {viewingDayLoading ? (
              <Text style={{ textAlign: "center", color: colors.textSecondary, paddingVertical: spacing.lg }}>
                Loading…
              </Text>
            ) : viewingDay && viewingDay.tasks.length === 0 ? (
              <Text style={{ textAlign: "center", color: colors.textSecondary, paddingVertical: spacing.md, lineHeight: 20 }}>
                No tasks recorded for this day.
              </Text>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {(viewingDay?.tasks ?? []).map((t) => (
                  <View key={t.id} style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: spacing.md,
                    padding: spacing.md,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: t.isCompleted ? GOLD : colors.border,
                    backgroundColor: colors.bg,
                  }}>
                    <View style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: t.isCompleted ? GOLD : colors.border,
                      backgroundColor: t.isCompleted ? GOLD : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 2,
                    }}>
                      {t.isCompleted && (
                        <Text style={{ color: "#000", fontSize: 13, fontWeight: "800" }}>{"✓"}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: typography.base,
                        fontWeight: "600",
                        color: t.isCompleted ? colors.textTertiary : colors.text,
                        lineHeight: 20,
                      }}>
                        {(t as unknown as { title?: string }).title ?? t.task}
                      </Text>
                      {t.description ? (
                        <Text style={{
                          fontSize: typography.sm,
                          color: t.isCompleted ? colors.textTertiary : colors.textSecondary,
                          marginTop: 2,
                          lineHeight: 18,
                        }}>
                          {t.description}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              onPress={() => setViewingDay(null)}
              activeOpacity={0.85}
              style={{
                marginTop: spacing.lg,
                paddingVertical: 12,
                borderRadius: radius.lg,
                backgroundColor: GOLD,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: typography.base, fontWeight: "700", color: "#000" }}>
                Close
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Paywall
        visible={showPaywall}
        onDismiss={() => {
          setShowPaywall(false);
          refreshSubscription();
        }}
      />
    </View>
    </SwipeNavigator>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
    header: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: c.bg,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: spacing.sm,
    },
    streakText: {
      fontSize: typography.xxl,
      fontWeight: "800",
      color: GOLD,
      letterSpacing: -0.5,
    },
    goalNameSingle: {
      fontSize: typography.base,
      fontWeight: "600",
      color: c.textSecondary,
      maxWidth: "55%",
      textAlign: "right",
    },
    // Goal tab pills
    goalTabsContainer: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingBottom: 4,
    },
    goalTab: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 9999,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    goalTabActive: {
      borderColor: GOLD,
      borderWidth: 2,
      backgroundColor: "rgba(212,168,67,0.1)",
    },
    goalTabText: {
      fontSize: typography.sm,
      fontWeight: "500",
      color: c.textSecondary,
    },
    goalTabTextActive: {
      fontWeight: "700",
      color: GOLD,
    },
    goalTabAdd: {
      width: 36,
      height: 36,
      borderRadius: 9999,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    goalTabAddText: {
      fontSize: 18,
      color: c.textTertiary,
      fontWeight: "400",
    },
    // Back button
    backButton: {
      paddingVertical: spacing.sm,
      marginBottom: spacing.sm,
    },
    backButtonText: {
      fontSize: typography.base,
      fontWeight: "600",
      color: GOLD,
    },
    // Day label
    dayLabelContainer: {
      alignItems: "center",
      marginBottom: spacing.lg + 4,
      marginTop: spacing.sm,
    },
    dayLabel: {
      fontSize: typography.xxxl + 4,
      fontWeight: "800",
      color: c.text,
      letterSpacing: -1,
    },
    // All done state
    allDoneContainer: {
      alignItems: "center",
      paddingVertical: spacing.xxl,
    },
    allDoneCheck: {
      fontSize: typography.xxxl,
      color: GOLD,
      marginBottom: spacing.md,
    },
    allDoneTitle: {
      fontSize: typography.xl,
      fontWeight: "700",
      color: c.text,
      marginBottom: spacing.sm,
      letterSpacing: -0.3,
    },
    allDoneMessage: {
      fontSize: typography.base,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      paddingHorizontal: spacing.lg,
    },
    // Midnight countdown
    countdownContainer: {
      marginTop: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: "rgba(212,168,67,0.1)",
      borderWidth: 1,
      borderColor: "rgba(212,168,67,0.25)",
    },
    countdownText: {
      fontSize: typography.sm,
      fontWeight: "600",
      color: GOLD,
      textAlign: "center",
    },
    // Common styles
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
    empty: { alignItems: "center", paddingVertical: spacing.xxl },
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
    // Pro expired banner
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
  });
}
