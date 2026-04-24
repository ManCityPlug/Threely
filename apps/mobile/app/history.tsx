import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { tasksApi, type DailyTask, type TaskItem } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";

interface CompletedTask {
  id: string;
  title: string;
  description: string;
  goalId: string;
  goalTitle: string;
  date: string;
}

export default function HistoryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoalId, setSelectedGoalId] = useState<string | "all">("all");

  useFocusEffect(
    useCallback(() => {
      tasksApi.history(90).then((res) => {
        setDailyTasks(res.dailyTasks);
      }).catch(() => {}).finally(() => setLoading(false));
    }, [])
  );

  // Extract all unique goals from history
  const goals = useMemo(() => {
    const map = new Map<string, string>();
    for (const dt of dailyTasks) {
      if (dt.goal) map.set(dt.goalId, dt.goal.title);
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [dailyTasks]);

  // Flatten into completed task items, filtered by selected goal
  const grouped = useMemo(() => {
    const filtered = selectedGoalId === "all"
      ? dailyTasks
      : dailyTasks.filter((dt) => dt.goalId === selectedGoalId);

    // Collect completed tasks grouped by date
    const byDate = new Map<string, CompletedTask[]>();

    for (const dt of filtered) {
      const items = Array.isArray(dt.tasks) ? (dt.tasks as unknown as TaskItem[]) : [];
      const completedItems = items.filter((t) => t.isCompleted);
      if (completedItems.length === 0) continue;

      const dateKey = new Date(dt.date).toDateString();
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);

      for (const task of completedItems) {
        byDate.get(dateKey)!.push({
          id: task.id,
          title: (task as unknown as { title?: string }).title ?? task.task,
          description: task.description,
          goalId: dt.goalId,
          goalTitle: dt.goal?.title ?? "Goal",
          date: dt.date,
        });
      }
    }

    return byDate;
  }, [dailyTasks, selectedGoalId]);

  const todayStr = new Date().toDateString();
  const dateEntries = Array.from(grouped.entries());
  const totalCompleted = dateEntries.reduce((sum, [, tasks]) => sum + tasks.length, 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Completed Tasks</Text>
          <Text style={styles.subtitle}>{totalCompleted} tasks completed</Text>
        </View>
      </View>

      {/* Goal filter chips */}
      {goals.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <TouchableOpacity
            style={[styles.filterChip, selectedGoalId === "all" && styles.filterChipSelected]}
            onPress={() => setSelectedGoalId("all")}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterLabel, selectedGoalId === "all" && styles.filterLabelSelected]}>
              All Goals
            </Text>
          </TouchableOpacity>
          {goals.map((g) => (
            <TouchableOpacity
              key={g.id}
              style={[styles.filterChip, selectedGoalId === g.id && styles.filterChipSelected]}
              onPress={() => setSelectedGoalId(g.id)}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.filterLabel, selectedGoalId === g.id && styles.filterLabelSelected]}
                numberOfLines={1}
              >
                {g.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : dateEntries.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>✓</Text>
          <Text style={styles.emptyTitle}>No completed moves yet</Text>
          <Text style={styles.emptySubtitle}>
            Complete moves on the Today tab and they'll appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {dateEntries.map(([dateStr, tasks]) => {
            const d = new Date(dateStr);
            const label =
              dateStr === todayStr
                ? "Today"
                : d.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  });
            return (
              <View key={dateStr} style={styles.daySection}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayLabel}>{label}</Text>
                  <Text style={styles.dayCount}>{tasks.length} done</Text>
                </View>
                {tasks.map((task) => (
                  <View key={task.id} style={styles.taskRow}>
                    <View style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                    <View style={styles.taskText}>
                      <Text style={styles.taskTitle}>{task.title}</Text>
                      {task.description ? (
                        <Text style={styles.taskDesc} numberOfLines={2}>
                          {task.description}
                        </Text>
                      ) : null}
                      {selectedGoalId === "all" && (
                        <Text style={styles.taskGoal}>{task.goalTitle}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      gap: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      backgroundColor: c.card,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: c.border,
    },
    headerText: { flex: 1 },
    title: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: c.text,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: typography.sm,
      color: c.textSecondary,
      marginTop: 2,
    },
    filterRow: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.sm,
      alignItems: "center",
    },
    filterChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.card,
      ...shadow.sm,
    },
    filterChipSelected: {
      borderColor: c.primary,
      backgroundColor: c.primaryLight,
    },
    filterLabel: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.text,
    },
    filterLabelSelected: { color: c.primary },
    scroll: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      gap: spacing.lg,
    },
    emptyWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
    },
    emptyIcon: {
      fontSize: 48,
      color: c.success,
      marginBottom: spacing.md,
    },
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
    },
    daySection: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      overflow: "hidden",
      ...shadow.sm,
    },
    dayHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: c.bg,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    dayLabel: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.text,
    },
    dayCount: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.success,
    },
    taskRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    checkCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.success,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      marginTop: 1,
    },
    taskText: { flex: 1, gap: 3 },
    taskTitle: {
      fontSize: typography.base,
      fontWeight: typography.medium,
      color: c.text,
      textDecorationLine: "line-through",
      lineHeight: 21,
    },
    taskDesc: {
      fontSize: typography.sm,
      color: c.textTertiary,
      lineHeight: 18,
    },
    taskGoal: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.primary,
      marginTop: 2,
    },
  });
}
