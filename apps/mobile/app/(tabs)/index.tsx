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
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import { AppTutorial } from "@/components/AppTutorial";
import { MOCK_TUTORIAL_GOAL, MOCK_TUTORIAL_DAILY_TASK } from "@/lib/mock-tutorial-data";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/lib/toast";
import { scheduleNotifications, onTaskCompleted, sendInstantNotification, type NotifContext } from "@/lib/notifications";
import { useTheme } from "@/lib/theme";
import { useSubscription } from "@/lib/subscription-context";
import { useWalkthroughRegistry } from "@/lib/walkthrough-registry";
import Paywall from "@/components/Paywall";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius } from "@/constants/theme";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// iPad-friendly max content width
const MAX_CONTENT_WIDTH = 600;

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
  const now = new Date();
  const diff = now.getTime() - created.getTime();
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
}

function getStreakFromGoals(goals: Goal[]): number {
  if (goals.length === 0) return 0;
  const earliest = goals.reduce((min, g) => {
    const d = new Date(g.createdAt).getTime();
    return d < min ? d : min;
  }, Infinity);
  const diff = Date.now() - earliest;
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
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

function getMidnightCountdown(): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function isMilestone(day: number): boolean {
  return MILESTONE_DAYS.includes(day);
}

// ─── Progress Ring (simple View-based) ────────────────────────────────────────

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
  const ringSize = size + 14;
  // Simple ring using border approach. For RN without SVG, use two half-circles.
  const pct = Math.min(100, Math.max(0, progress * 100));
  const rightRotation = pct <= 50 ? (pct / 50) * 180 : 180;
  const leftRotation = pct > 50 ? ((pct - 50) / 50) * 180 : 0;

  return (
    <View style={{
      position: "absolute",
      width: ringSize,
      height: ringSize,
    }}>
      {/* Track */}
      <View style={{
        position: "absolute",
        width: ringSize,
        height: ringSize,
        borderRadius: ringSize / 2,
        borderWidth: borderW,
        borderColor: trackColor,
      }} />
      {/* Right half 0-180 */}
      <View style={{
        position: "absolute",
        top: 0,
        left: ringSize / 2,
        width: ringSize / 2,
        height: ringSize,
        overflow: "hidden",
      }}>
        <View style={{
          position: "absolute",
          top: 0,
          left: -(ringSize / 2),
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
          borderWidth: borderW,
          borderColor: color,
          borderLeftColor: "transparent",
          borderBottomColor: "transparent",
          transform: [{ rotate: `${rightRotation}deg` }],
        }} />
      </View>
      {/* Left half 180-360 */}
      {pct > 50 && (
        <View style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: ringSize / 2,
          height: ringSize,
          overflow: "hidden",
        }}>
          <View style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderWidth: borderW,
            borderColor: color,
            borderLeftColor: "transparent",
            borderBottomColor: "transparent",
            transform: [{ rotate: `${leftRotation}deg` }],
          }} />
        </View>
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
  onPress?: () => void;
  colors: Colors;
  allDoneToday: boolean;
  workAheadReady: boolean;
  taskProgress: number; // 0-1
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (isToday && !allDoneToday) {
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
  }, [isToday, allDoneToday, pulseAnim, glowAnim]);

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
    bgColor = allDoneToday ? GOLD : "rgba(20,20,20,0.95)";
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
    bgColor = "#1e1e1e";
    borderColor = GOLD;
    borderWidth = 2.5;
    borderStyle = "dashed";
    nodeOpacity = 0.6;
    shadowConfig = {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
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
          {allDoneToday ? "Complete!" : "TODAY"}
        </Text>
      </View>
    );
  } else if (isWorkAhead && !isMilestoneNode && !isCrown) {
    label = (
      <View style={{ alignItems: "center", marginTop: 6 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.7)" }}>
          Day {day}
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
    // Locked - minimal label
    label = (
      <Text style={{ fontSize: 10, fontWeight: "500", color: "rgba(255,255,255,0.25)", marginTop: 4, textAlign: "center" }}>
        {day}
      </Text>
    );
  }

  return (
    <View style={{ alignItems: "center" }}>
      <TouchableOpacity
        onPress={onPress}
        disabled={isLocked && !isWorkAhead && !isCrown}
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
  allDone,
  onPress,
}: {
  allDone: boolean;
  onPress: () => void;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!allDone) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [allDone, pulseAnim]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{ alignItems: "center", marginBottom: 6 }}>
      <Animated.View style={{
        paddingHorizontal: 18,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: allDone ? "#3ecf8e" : GOLD,
        transform: [{ scale: allDone ? 1 : pulseAnim }],
        shadowColor: allDone ? "#3ecf8e" : GOLD,
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
          color: allDone ? "#fff" : "#000",
        }}>
          {allDone ? "COMPLETE \u2713" : "START"}
        </Text>
      </Animated.View>
      {/* Small connector line */}
      <View style={{
        width: 2,
        height: 8,
        backgroundColor: allDone ? "rgba(62,207,142,0.4)" : "rgba(212,168,67,0.4)",
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
  colors,
  screenWidth,
  taskProgress,
}: {
  goalDayNumber: number;
  allDone: boolean;
  onTapToday: () => void;
  onTapWorkAhead: () => void;
  onTapLocked: (day: number) => void;
  colors: Colors;
  screenWidth: number;
  taskProgress: number;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [showScrollHint, setShowScrollHint] = useState(true);

  // Show 20 nodes starting from a window around today
  const VISIBLE_NODES = 20;
  const windowStart = Math.max(1, goalDayNumber - Math.min(goalDayNumber - 1, 5));
  const days: number[] = [];
  for (let i = 0; i < VISIBLE_NODES; i++) {
    days.push(windowStart + i);
  }
  const lastVisibleDay = days[days.length - 1];

  // Scroll to today's node on mount
  useEffect(() => {
    const todayIndex = days.indexOf(goalDayNumber);
    if (todayIndex >= 0 && scrollRef.current) {
      const nodeSpacing = 100;
      const scrollTarget = Math.max(0, todayIndex * nodeSpacing - 200);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: scrollTarget, animated: true });
      }, 300);
    }
  }, [goalDayNumber]);

  // Path container width (leave margin on each side)
  const pathWidth = Math.min(screenWidth - 40, 500);
  const nodeSpacing = 100;

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 50) {
      setShowScrollHint(false);
    }
  };

  return (
    <View style={{ flex: 1, position: "relative" }}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        contentContainerStyle={{
          paddingTop: 30,
          paddingBottom: 80,
          minHeight: days.length * nodeSpacing + 100,
        }}
      >
        <View style={{
          width: pathWidth,
          alignSelf: "center",
          position: "relative",
          height: days.length * nodeSpacing + 60,
        }}>
          {days.map((day, i) => {
            const isCompleted = day < goalDayNumber;
            const isToday = day === goalDayNumber;
            const isWorkAhead = day === goalDayNumber + 1 && allDone;
            const isLocked = day > goalDayNumber && !isWorkAhead;
            const isCrown = day === lastVisibleDay && day > goalDayNumber;
            const isMilestoneNode = isMilestone(day);

            let type: "completed" | "today" | "locked" | "work-ahead" = "locked";
            if (isCompleted) type = "completed";
            else if (isToday) type = "today";
            else if (isWorkAhead) type = "work-ahead";

            // S-curve positioning
            const xOffsetPct = S_CURVE_OFFSETS[i % S_CURVE_OFFSETS.length];
            const xPos = (xOffsetPct / 100) * pathWidth;
            const yPos = 40 + i * nodeSpacing;

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

                {/* Node positioned absolutely */}
                <View style={{
                  position: "absolute",
                  top: yPos,
                  left: xPos,
                  transform: [{ translateX: isToday ? -34 : type === "completed" ? -28 : isCrown ? -32 : isMilestoneNode ? -30 : -25 }],
                  zIndex: isToday ? 10 : isCrown ? 5 : 1,
                  alignItems: "center",
                }}>
                  {/* START/COMPLETE badge above today's node */}
                  {isToday && (
                    <StartBadge
                      allDone={allDone}
                      onPress={() => {
                        if (allDone) return;
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
                    colors={colors}
                    allDoneToday={allDone}
                    workAheadReady={isWorkAhead}
                    taskProgress={taskProgress}
                    onPress={
                      isToday ? () => {
                        if (allDone) return;
                        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onTapToday();
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
      </ScrollView>

      {/* Scroll hint arrow */}
      {showScrollHint && (
        <View style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 50,
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: 8,
          pointerEvents: "none",
        }}>
          <ScrollArrow />
        </View>
      )}
    </View>
  );
}

function ScrollArrow() {
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: 4, duration: 750, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [bounceAnim]);

  return (
    <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
      <Text style={{ fontSize: 20, color: "rgba(255,255,255,0.35)" }}>{"▼"}</Text>
    </Animated.View>
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

  const pathWidth = Math.min(screenWidth - 40, 500);
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
}: {
  task: TaskItem;
  onToggle: (isCompleted: boolean) => void;
  colors: Colors;
  isAnimating: boolean;
  readOnly?: boolean;
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

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => {
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
        </View>
      </Animated.View>
    </TouchableOpacity>
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
          {"🔥"}
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

        <Animated.Text style={{
          fontSize: typography.md,
          color: "rgba(255,255,255,0.85)",
          textAlign: "center",
          lineHeight: 26,
          marginBottom: 16,
          maxWidth: 340,
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim,
        }}>
          {getCompletionMessage(dayNumber)}
        </Animated.Text>

        <Animated.Text style={{
          fontSize: typography.base,
          color: GOLD,
          marginBottom: 40,
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim,
        }}>
          {"→"} {goalTitle}
        </Animated.Text>

        <Animated.View style={{ transform: [{ translateY: slideAnim }], opacity: fadeAnim }}>
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
              See you tomorrow
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

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

  // Gamification state
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const [animatingTaskId, setAnimatingTaskId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"path" | "tasks">("path");
  const [showTodayPopup, setShowTodayPopup] = useState(false);
  const [midnightCountdown, setMidnightCountdown] = useState(getMidnightCountdown());

  // ─── Pro / trial state ────────────────────────────────────────────────────────
  const [showTutorial, setShowTutorial] = useState(false);
  const { isLimitedMode, walkthroughActive, setWalkthroughActive, refreshSubscription } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);

  const hasLoadedOnce = useRef(false);
  const hasAutoGenerated = useRef(false);
  const pendingSwitchGoal = useRef<string | null>(null);
  const recentlyToggledRef = useRef<Set<string>>(new Set());
  const userIdRef = useRef<string>("");
  const [sortTrigger, setSortTrigger] = useState(0);

  // Midnight countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setMidnightCountdown(getMidnightCountdown());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

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

      // Check if any generate is in progress
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

      // Apply pending goal switch
      if (pendingSwitchGoal.current) {
        setSelectedGoal(pendingSwitchGoal.current);
        pendingSwitchGoal.current = null;
      }
    } catch (e) {
      console.warn("loadData error", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("@threely_switch_goal").then((switchGoalId) => {
        if (switchGoalId) {
          AsyncStorage.removeItem("@threely_switch_goal");
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
  const allDone = newTaskItems.length > 0 && newTaskItems.every((t) => t.isCompleted || t.isSkipped);

  const streak = getStreakFromGoals(effectiveGoals);
  const goalDayNumber = currentGoalObj ? getGoalDayNumber(currentGoalObj) : 1;

  // Task progress for progress ring (0-1)
  const taskProgress = newTaskItems.length > 0
    ? newTaskItems.filter(t => t.isCompleted || t.isSkipped).length / newTaskItems.length
    : 0;

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

  // Schedule notifications after data loads
  useEffect(() => {
    if (!loading && goals.length > 0) {
      const timer = setTimeout(() => {
        scheduleNotifications(buildNotifContext()).catch(() => {});
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [loading, buildNotifContext, goals.length]);

  // Show celebration when user manually completes all tasks (not on page load)
  const userToggledRef = useRef(false);
  const hasTriggeredCelebration = useRef(false);
  useEffect(() => {
    if (allDone && newTaskItems.length > 0 && userToggledRef.current && !hasTriggeredCelebration.current) {
      setShowCelebration(true);
      hasTriggeredCelebration.current = true;
    }
  }, [allDone, newTaskItems.length]);

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
    // Persist locally + server
    const todayKey = `@threely_focus_${new Date().toISOString().slice(0, 10)}`;
    AsyncStorage.setItem(todayKey, goalId);
    focusApi.save(goalId).catch(() => {});
  }

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
      const newDailyTasks = dailyTasks.map((dt) => (dt.id === dailyTaskId ? res.dailyTask : dt));
      setDailyTasks(newDailyTasks);
      if (isCompleted) {
        onTaskCompleted(buildNotifContext());
      }
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
          <Text style={styles.streakText}>{"🔥"} {streak}</Text>

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
        ) : viewMode === "path" ? (
          /* ═══ PATH VIEW ═══ */
          <>
            {/* All done state above path — only when completed in this session */}
            {allDone && celebrationDismissed && hasTriggeredCelebration.current && (
              <View style={styles.allDoneContainer}>
                <Text style={styles.allDoneCheck}>{"✓"}</Text>
                <Text style={styles.allDoneTitle}>All done for today</Text>
                <Text style={styles.allDoneMessage}>{getCompletionMessage(goalDayNumber)}</Text>
                <View style={styles.countdownContainer}>
                  <Text style={styles.countdownText}>Next day unlocks in {midnightCountdown}</Text>
                </View>
              </View>
            )}

            {/* S-curve path */}
            <SCurvePathView
              goalDayNumber={allDone ? goalDayNumber + 1 : goalDayNumber}
              allDone={allDone && celebrationDismissed}
              onTapToday={() => {
                if (allDone && celebrationDismissed) return;
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowTodayPopup(true);
              }}
              onTapWorkAhead={() => {
                Alert.alert(
                  "Work Ahead",
                  "We recommend doing one day's work per day. Want to work ahead?",
                  [
                    { text: "I'll wait", style: "cancel" },
                    {
                      text: "Work ahead",
                      onPress: () => {
                        setViewMode("tasks");
                      },
                    },
                  ]
                );
              }}
              onTapLocked={(day) => {
                Alert.alert("Locked", "Complete the previous day first.");
              }}
              colors={colors}
              screenWidth={screenWidth}
              taskProgress={taskProgress}
            />
          </>
        ) : (
          /* ═══ TASK VIEW ═══ */
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

            {/* Day heading */}
            <View style={styles.dayLabelContainer}>
              <Text style={styles.dayLabel}>Day {goalDayNumber}</Text>
            </View>

            {/* Task cards — always shown, read-only when all done */}
            {(
              <>
                {displayVisibleTasks.map((dt) => (
                  <View key={dt.id} style={{ marginBottom: 0 }}>
                    {(Array.isArray(dt.tasks) ? (dt.tasks as TaskItem[]) : []).map((task) => (
                      <View
                        key={task.id}
                        ref={newTaskItems.indexOf(task) === 0 ? r => register("first-task-card", r) : undefined}
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
                          readOnly={allDone}
                        />
                      </View>
                    ))}
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Today popup ─────────────────────────────────────────────────────── */}
      <TodayPopup
        visible={showTodayPopup}
        dayNumber={goalDayNumber}
        taskCount={newTaskItems.length}
        onStart={() => {
          setShowTodayPopup(false);
          setViewMode("tasks");
        }}
        onDismiss={() => setShowTodayPopup(false)}
        colors={colors}
      />

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

      <Paywall visible={showPaywall} onDismiss={() => { setShowPaywall(false); refreshSubscription(); }} />
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
