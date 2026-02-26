import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import type { HeatmapDay } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius } from "@/constants/theme";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BAR_MAX = 3;
const BAR_HEIGHT = 120;

function getWeekDates(): string[] {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }
  return dates;
}

interface WeeklyBarChartProps {
  data: HeatmapDay[];
}

export function WeeklyBarChart({ data }: WeeklyBarChartProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const todayStr = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  }, []);

  const weekDates = useMemo(() => getWeekDates(), []);

  const dateMap = useMemo(() => {
    const map = new Map<string, HeatmapDay>();
    for (const d of data) {
      map.set(d.date.slice(0, 10), d);
    }
    return map;
  }, [data]);

  const weekData = useMemo(() => {
    return weekDates.map((dateStr, i) => {
      const entry = dateMap.get(dateStr);
      const isFuture = dateStr > todayStr;
      return {
        dateStr,
        label: DAY_LABELS[i],
        completed: entry?.completed ?? 0,
        total: entry?.total ?? 0,
        isToday: dateStr === todayStr,
        isFuture,
      };
    });
  }, [weekDates, dateMap, todayStr]);

  const weekCompleted = weekData.reduce((s, d) => s + d.completed, 0);
  const weekDisplayTotal = weekCompleted === 0 ? 3 : Math.ceil(weekCompleted / 3) * 3;

  // Entrance animation for bars
  const barAnims = useRef(weekData.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Reset
    barAnims.forEach((v) => v.setValue(0));

    const animations = barAnims.map((animVal, i) =>
      Animated.spring(animVal, {
        toValue: 1,
        useNativeDriver: false, // height can't use native driver
        tension: 60,
        friction: 10,
        delay: i * 60,
      })
    );

    Animated.stagger(60, animations).start();
  }, [data]);

  return (
    <View style={styles.container}>
      {/* Week summary */}
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>This week</Text>
        <Text style={styles.headerValue}>{weekCompleted}/{weekDisplayTotal} tasks</Text>
      </View>

      {/* Bars */}
      <View style={styles.barsRow}>
        {weekData.map((day, i) => {
          const fillRatio = day.isFuture ? 0 : Math.min(day.completed / BAR_MAX, 1);
          const targetHeight = Math.max(fillRatio * BAR_HEIGHT, fillRatio > 0 ? 8 : 4);

          const animatedHeight = barAnims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [4, targetHeight],
          });

          const barColor = day.isFuture || day.completed === 0
            ? colors.border
            : day.completed >= BAR_MAX
              ? colors.primary
              : `rgba(99,91,255,0.4)`;

          return (
            <View key={day.dateStr} style={styles.barCol}>
              {/* Count label */}
              {!day.isFuture && day.completed > 0 && (
                <Text style={[
                  styles.countLabel,
                  day.isToday && { color: colors.primary },
                ]}>
                  {day.completed}
                </Text>
              )}

              {/* Bar */}
              <View style={styles.barTrack}>
                <Animated.View
                  style={[
                    styles.barFill,
                    {
                      height: animatedHeight,
                      backgroundColor: barColor,
                      opacity: day.isFuture ? 0.3 : 1,
                      borderColor: day.isToday ? colors.primary : "transparent",
                      borderWidth: day.isToday ? 1.5 : 0,
                    },
                  ]}
                />
              </View>

              {/* Day label */}
              <Text style={[
                styles.dayLabel,
                day.isToday && { color: colors.primary, fontWeight: typography.bold },
              ]}>
                {day.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "rgba(99,91,255,0.4)" }]} />
          <Text style={styles.legendText}>Partial</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendText}>All 3 done</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: spacing.md,
    },
    headerLabel: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.textSecondary,
    },
    headerValue: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.primary,
    },
    barsRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 6,
      height: BAR_HEIGHT + 20, // extra space for count labels
      marginBottom: spacing.xs,
    },
    barCol: {
      flex: 1,
      alignItems: "center",
      justifyContent: "flex-end",
      height: "100%",
    },
    countLabel: {
      fontSize: typography.xs,
      fontWeight: typography.bold,
      color: c.textSecondary,
      marginBottom: 4,
    },
    barTrack: {
      width: "100%",
      maxWidth: 36,
      justifyContent: "flex-end",
      alignItems: "stretch",
    },
    barFill: {
      borderRadius: 6,
      minHeight: 4,
    },
    dayLabel: {
      fontSize: typography.xs,
      fontWeight: typography.medium,
      color: c.textTertiary,
      marginTop: spacing.xs,
    },
    legendRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 2,
    },
    legendText: {
      fontSize: typography.xs - 1,
      color: c.textTertiary,
    },
  });
}
