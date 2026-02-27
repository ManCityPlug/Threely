import { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Goal } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";
import { ProgressRing } from "@/components/ProgressRing";

function formatWorkDays(days: number[] | undefined | null): string {
  if (!days || days.length === 0 || days.length === 7) return "Every day";
  const sorted = [...days].sort();
  const key = sorted.join(",");
  if (key === "1,2,3,4,5") return "Weekdays";
  if (key === "6,7") return "Weekends";
  if (key === "1,3,5") return "Mon, Wed, Fri";
  if (key === "2,4") return "Tue, Thu";
  const names = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return sorted.map(d => names[d]).join(", ");
}

interface GoalCardProps {
  goal: Goal;
  completedToday?: number;
  totalToday?: number;
  onPress?: () => void;
  onViewTasks?: () => void;
  lifetimeCompletionPct?: number;
  isPaused?: boolean;
}

function getStatusText(completedToday: number, totalToday: number): { text: string; color: "success" | "warning" | "textTertiary" } | null {
  if (totalToday === 0) return null;
  if (completedToday === 0) return { text: "Not started", color: "textTertiary" };
  if (completedToday >= totalToday) return { text: "Done for today", color: "success" };
  return { text: "In progress", color: "warning" };
}

export function GoalCard({ goal, completedToday = 0, totalToday = 3, onPress, onViewTasks, lifetimeCompletionPct, isPaused }: GoalCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const progressPct = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;
  const ringPct = lifetimeCompletionPct !== undefined ? Math.min(100, lifetimeCompletionPct) : undefined;
  const status = getStatusText(completedToday, totalToday);

  return (
    <TouchableOpacity
      style={[styles.card, isPaused && styles.cardPaused]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.top}>
        <View style={[styles.iconWrap, isPaused && { backgroundColor: colors.border }]}>
          <Ionicons
            name={isPaused ? "pause" : "flag"}
            size={16}
            color={isPaused ? colors.textTertiary : colors.primary}
          />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.title, isPaused && styles.titlePaused]} numberOfLines={1}>
            {goal.title}
          </Text>
          {goal.description ? (
            <Text style={styles.description} numberOfLines={1}>
              {goal.description}
            </Text>
          ) : null}
        </View>
        {ringPct !== undefined && !isPaused && (
          <ProgressRing percentage={ringPct} size={36} />
        )}
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPct}%` }, isPaused && styles.progressFillPaused]} />
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.progressLabel}>
          {completedToday}/{totalToday} tasks today
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          {!isPaused && (
            <Text style={styles.scheduleBadge}>
              {formatWorkDays(goal.workDays)}
            </Text>
          )}
          {status && !isPaused && (
            <Text style={[styles.statusText, { color: colors[status.color] }]}>
              {status.text}
            </Text>
          )}
          {isPaused && (
            <Text style={[styles.statusText, { color: colors.textTertiary }]}>
              Paused
            </Text>
          )}
        </View>
      </View>

      {onViewTasks && !isPaused && (
        <TouchableOpacity
          style={styles.viewTasksBtn}
          onPress={(e) => { e.stopPropagation(); onViewTasks(); }}
          activeOpacity={0.7}
        >
          <Text style={styles.viewTasksText}>View today's tasks →</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      ...shadow.sm,
    },
    top: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: c.primaryLight,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    textWrap: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: c.text,
    },
    description: {
      fontSize: typography.sm,
      color: c.textSecondary,
    },
    progressTrack: {
      height: 6,
      backgroundColor: c.border,
      borderRadius: radius.full,
      overflow: "hidden",
      marginBottom: spacing.xs,
    },
    progressFill: {
      height: "100%",
      backgroundColor: c.primary,
      borderRadius: radius.full,
      minWidth: 0,
    },
    bottomRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    progressLabel: {
      fontSize: typography.xs,
      color: c.textTertiary,
      fontWeight: typography.medium,
    },
    scheduleBadge: {
      fontSize: typography.xs,
      color: c.textTertiary,
      fontWeight: typography.medium,
    },
    statusText: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
    },
    viewTasksBtn: {
      marginTop: spacing.sm,
      paddingVertical: spacing.xs + 2,
      borderTopWidth: 1,
      borderTopColor: c.border,
      alignItems: "center",
    },
    viewTasksText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.primary,
    },
    cardPaused: {
      opacity: 0.6,
      borderColor: c.border,
    },
    titlePaused: {
      color: c.textTertiary,
    },
    progressFillPaused: {
      backgroundColor: c.textTertiary,
    },
  });
}
