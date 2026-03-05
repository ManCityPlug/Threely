import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import type { HeatmapDay } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius } from "@/constants/theme";

interface CalendarHeatmapProps {
  data: HeatmapDay[];
}

const CELL_GAP = 3;
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Interpolate between two hex colors.
 */
function interpolateColor(color1: string, color2: string, factor: number): string {
  const hex = (c: string) => parseInt(c, 16);
  const r1 = hex(color1.slice(1, 3));
  const g1 = hex(color1.slice(3, 5));
  const b1 = hex(color1.slice(5, 7));
  const r2 = hex(color2.slice(1, 3));
  const g2 = hex(color2.slice(3, 5));
  const b2 = hex(color2.slice(5, 7));
  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function getMonthName(month: number): string {
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return names[month];
}

function isSameMonth(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
}

export function CalendarHeatmap({ data }: CalendarHeatmapProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = useMemo(() => new Date(), []);

  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const isCurrentMonth = isSameMonth(currentMonth, today);

  // Build date -> percentage map
  const dateMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of data) {
      map.set(d.date.slice(0, 10), d.percentage);
    }
    return map;
  }, [data]);

  // Build calendar grid for the displayed month
  const grid = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const rows: { day: number | null; dateStr: string; pct: number; isToday: boolean; isFuture: boolean }[][] = [];
    let row: typeof rows[0] = [];

    // Leading empty cells
    for (let i = 0; i < firstDay; i++) {
      row.push({ day: null, dateStr: "", pct: 0, isToday: false, isFuture: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayDate = new Date(year, month, d);
      const isFuture = dayDate > today;
      row.push({
        day: d,
        dateStr,
        pct: dateMap.get(dateStr) ?? 0,
        isToday: dateStr === todayStr,
        isFuture,
      });
      if (row.length === 7) {
        rows.push(row);
        row = [];
      }
    }

    // Trailing empty cells
    if (row.length > 0) {
      while (row.length < 7) {
        row.push({ day: null, dateStr: "", pct: 0, isToday: false, isFuture: false });
      }
      rows.push(row);
    }

    return rows;
  }, [currentMonth, dateMap, today]);

  const emptyColor = colors.border.startsWith("#") ? colors.border : "#E3E8EF";
  const fullColor = colors.primary.startsWith("#") ? colors.primary : "#635BFF";

  // --- Staggered cell entrance animations ---
  const totalCells = grid.length * 7;
  const cellAnimValues = useRef<Animated.Value[]>([]);

  // Ensure we have the right number of Animated.Values
  if (cellAnimValues.current.length !== totalCells) {
    cellAnimValues.current = Array.from({ length: totalCells }, () => new Animated.Value(0));
  }

  useEffect(() => {
    // Reset all values to 0
    cellAnimValues.current.forEach((v) => v.setValue(0));

    // Stagger animate each cell with 15ms delay between starts
    const animations = cellAnimValues.current.map((animVal) =>
      Animated.spring(animVal, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      })
    );

    const composite = Animated.stagger(15, animations);
    composite.start();
    return () => composite.stop();
  }, [currentMonth, totalCells]);

  function navigateMonth(delta: number) {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  return (
    <View style={styles.container}>
      {/* Month navigation header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigateMonth(-1)}
          style={styles.navButton}
          accessibilityLabel="Previous month"
          accessibilityRole="button"
        >
          <Text style={styles.navText}>{"\u2039"}</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {getMonthName(currentMonth.getMonth())} {currentMonth.getFullYear()}
        </Text>
        <TouchableOpacity
          onPress={() => navigateMonth(1)}
          style={[styles.navButton, isCurrentMonth && styles.navButtonDisabled]}
          disabled={isCurrentMonth}
          accessibilityLabel="Next month"
          accessibilityRole="button"
        >
          <Text style={[styles.navText, isCurrentMonth && styles.navTextDisabled]}>{"\u203A"}</Text>
        </TouchableOpacity>
      </View>

      {/* Day-of-week labels */}
      <View style={styles.dayLabelsRow}>
        {DAY_LABELS.map((label, i) => (
          <View key={i} style={styles.dayLabelCell}>
            <Text style={styles.dayLabelText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      {grid.map((row, ri) => (
        <View key={ri} style={styles.gridRow}>
          {row.map((cell, ci) => {
            const cellIndex = ri * 7 + ci;
            const animVal = cellAnimValues.current[cellIndex];

            if (cell.day === null) {
              return (
                <Animated.View key={ci} style={[styles.cellEmpty, { opacity: animVal }]} />
              );
            }

            const bg = cell.isFuture
              ? "transparent"
              : cell.pct === 0
                ? emptyColor
                : interpolateColor(emptyColor, fullColor, Math.min(1, cell.pct / 100));

            const hasProgress = cell.pct > 0 && !cell.isFuture;
            const scale = hasProgress
              ? animVal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.85, 1],
                })
              : 1;

            return (
              <Animated.View
                key={ci}
                style={[
                  styles.cell,
                  { backgroundColor: bg, opacity: animVal, transform: [{ scale }] },
                  cell.isToday && { borderWidth: 2, borderColor: colors.primary },
                ]}
              >
                <Text style={[
                  styles.cellText,
                  cell.isFuture && { color: colors.textTertiary },
                  cell.isToday && { fontWeight: typography.bold, color: colors.primary },
                ]}>
                  {cell.day}
                </Text>
              </Animated.View>
            );
          })}
        </View>
      ))}
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
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    navButton: {
      width: 44,
      height: 44,
      borderRadius: radius.sm,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.bg,
    },
    navButtonDisabled: {
      opacity: 0.3,
    },
    navText: {
      fontSize: 22,
      fontWeight: typography.semibold,
      color: c.text,
      lineHeight: 24,
    },
    navTextDisabled: {
      color: c.textTertiary,
    },
    monthTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: c.text,
    },
    dayLabelsRow: {
      flexDirection: "row",
      marginBottom: CELL_GAP,
    },
    dayLabelCell: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 4,
    },
    dayLabelText: {
      fontSize: typography.xs,
      color: c.textTertiary,
      fontWeight: typography.medium,
    },
    gridRow: {
      flexDirection: "row",
      gap: CELL_GAP,
      marginBottom: CELL_GAP,
    },
    cell: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: radius.sm,
      justifyContent: "center",
      alignItems: "center",
    },
    cellEmpty: {
      flex: 1,
      aspectRatio: 1,
    },
    cellText: {
      fontSize: typography.xs,
      color: c.textSecondary,
      fontWeight: typography.medium,
    },
  });
}
