import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { summaryApi, type WeeklySummary as WeeklySummaryType } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";

interface WeeklySummaryProps {
  visible: boolean;
  onClose: () => void;
  frozenData?: WeeklySummaryType | null;
}

export function WeeklySummary({ visible, onClose, frozenData }: WeeklySummaryProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [data, setData] = useState<WeeklySummaryType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    // If frozen data is provided, use it directly (no fetch)
    if (frozenData) {
      setData(frozenData);
      return;
    }
    setLoading(true);
    setError("");
    summaryApi
      .weekly(true)
      .then((res) => setData(res))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load summary"))
      .finally(() => setLoading(false));
  }, [visible, frozenData]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.title}>Weekly Summary</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator
              color={colors.primary}
              size="large"
              style={{ marginTop: spacing.xxl }}
            />
          ) : error ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => {
                  setLoading(true);
                  setError("");
                  summaryApi
                    .weekly(true)
                    .then((res) => setData(res))
                    .catch((e) =>
                      setError(e instanceof Error ? e.message : "Failed to load summary")
                    )
                    .finally(() => setLoading(false));
                }}
              >
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : data ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {data.tasksCompleted === 0 && (data.tasksGenerated ?? 0) === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: spacing.xxl }}>
                  <Text style={{ fontSize: 32, marginBottom: spacing.md }}>{"\uD83D\uDCCA"}</Text>
                  <Text style={[styles.statValue, { marginBottom: spacing.xs }]}>No activity this week</Text>
                  <Text style={[styles.statLabel, { textAlign: "center", lineHeight: 20 }]}>
                    Start working on your goals and your weekly summary will appear here.
                  </Text>
                </View>
              ) : (
              <>
              {/* Stat cards */}
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{data.tasksCompleted}</Text>
                  <Text style={styles.statLabel}>Tasks done</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{data.tasksGenerated ?? 0}</Text>
                  <Text style={styles.statLabel}>Tasks created</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>
                    {(data.hoursInvested ?? 0).toFixed(1)}h
                  </Text>
                  <Text style={styles.statLabel}>Hours invested</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{data.goalsWorkedOn}</Text>
                  <Text style={styles.statLabel}>Goals active</Text>
                </View>
              </View>

              {/* Daily breakdown */}
              {data.dailyBreakdown.length > 0 && (
                <View style={styles.breakdownSection}>
                  <Text style={styles.sectionLabel}>DAILY BREAKDOWN</Text>
                  {data.dailyBreakdown.map((day) => {
                    const pct =
                      day.total > 0
                        ? Math.round((day.completed / day.total) * 100)
                        : 0;
                    const dateObj = new Date(day.date + "T12:00:00");
                    const label = dateObj.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    });
                    return (
                      <View key={day.date} style={styles.breakdownRow}>
                        <Text style={styles.breakdownDate}>{label}</Text>
                        <View style={styles.breakdownBar}>
                          <View
                            style={[
                              styles.breakdownFill,
                              { width: `${pct}%` as `${number}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.breakdownCount}>
                          {day.completed}/{day.total}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* AI Insight */}
              {data.insight && (
                <View style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <Text style={styles.insightIcon}>✦</Text>
                    <Text style={styles.insightTitle}>Weekly insight</Text>
                  </View>
                  <Text style={styles.insightText}>{data.insight}</Text>
                </View>
              )}
              </>
              )}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
      maxHeight: "85%",
      ...shadow.lg,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: "center",
      marginBottom: spacing.lg,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: typography.xl,
      fontWeight: typography.bold as "700",
      color: c.text,
      letterSpacing: -0.3,
    },
    errorWrap: {
      alignItems: "center",
      paddingVertical: spacing.xxl,
    },
    errorText: {
      fontSize: typography.base,
      color: c.danger,
      textAlign: "center",
      marginBottom: spacing.md,
    },
    retryBtn: {
      backgroundColor: c.primary,
      borderRadius: radius.md,
      paddingVertical: 10,
      paddingHorizontal: spacing.lg,
    },
    retryText: {
      fontSize: typography.sm,
      fontWeight: typography.bold as "700",
      color: c.primaryText,
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    statCard: {
      width: "47%",
      backgroundColor: c.bg,
      borderRadius: radius.lg,
      padding: spacing.md,
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.border,
    },
    statValue: {
      fontSize: typography.xl,
      fontWeight: typography.bold as "700",
      color: c.text,
      letterSpacing: -0.3,
      marginBottom: 2,
    },
    statLabel: {
      fontSize: typography.xs,
      color: c.textSecondary,
    },
    breakdownSection: {
      marginBottom: spacing.lg,
    },
    sectionLabel: {
      fontSize: typography.xs,
      fontWeight: typography.semibold as "600",
      color: c.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: spacing.sm,
    },
    breakdownRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    breakdownDate: {
      fontSize: typography.xs,
      color: c.textSecondary,
      width: 80,
    },
    breakdownBar: {
      flex: 1,
      height: 8,
      backgroundColor: c.border,
      borderRadius: 4,
      overflow: "hidden",
    },
    breakdownFill: {
      height: "100%",
      backgroundColor: c.primary,
      borderRadius: 4,
    },
    breakdownCount: {
      fontSize: typography.xs,
      fontWeight: typography.semibold as "600",
      color: c.textSecondary,
      width: 36,
      textAlign: "right",
    },
    insightCard: {
      backgroundColor: c.primaryLight,
      borderRadius: radius.xl,
      borderWidth: 1.5,
      borderColor: c.primary + "44",
      padding: spacing.md,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    insightHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    insightIcon: {
      fontSize: 16,
      color: c.primary,
    },
    insightTitle: {
      fontSize: typography.xs,
      fontWeight: typography.semibold as "600",
      color: c.primary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    insightText: {
      fontSize: typography.base,
      color: c.text,
      lineHeight: 22,
    },
  });
}
