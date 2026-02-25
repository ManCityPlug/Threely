import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
  TextInput,
  ActivityIndicator,
  UIManager,
} from "react-native";
import * as Haptics from "expo-haptics";
import type { TaskItem } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";
import { scalePress } from "@/lib/animations";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface TaskCardProps {
  task: TaskItem;
  onToggle: (isCompleted: boolean) => void;
  onRefine?: (userRequest: string) => Promise<void>;
  readonly?: boolean;
}

export function TaskCard({ task, onToggle, onRefine, readonly = false }: TaskCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  // Refine (AI) mode state
  const [refineMode, setRefineMode] = useState(false);
  const [refineInput, setRefineInput] = useState("");
  const [refineLoading, setRefineLoading] = useState(false);

  const strikeAnim = useRef(new Animated.Value(task.isCompleted ? 1 : 0)).current;
  const checkScaleAnim = useRef(new Animated.Value(1)).current;

  // Card-level scale press micro-interaction
  const cardPress = useRef(scalePress()).current;

  useEffect(() => {
    Animated.spring(strikeAnim, {
      toValue: task.isCompleted ? 1 : 0,
      useNativeDriver: false,
      tension: 120,
      friction: 8,
    }).start();
  }, [task.isCompleted]);

  function handleCheckPress() {
    if (readonly) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(checkScaleAnim, { toValue: 1.15, useNativeDriver: true, tension: 300, friction: 6 }),
      Animated.spring(checkScaleAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    onToggle(!task.isCompleted);
  }

  function toggleExpand() {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (expanded) {
      setRefineMode(false);
      setRefineInput("");
    }
    setExpanded(!expanded);
  }

  const checkBg = strikeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.card, colors.success],
  });

  const checkBorder = strikeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.success],
  });

  // Support both old (title) and new (task) field names for backward compat
  const taskTitle = (task as unknown as { title?: string }).title ?? task.task;

  return (
    <Animated.View
      style={[
        styles.card,
        { transform: [{ scale: cardPress.scaleValue }] },
        task.isCompleted && styles.cardDone,
      ]}
    >
      <View style={styles.inner}>
        {/* Checkbox — tap to toggle completion */}
        <TouchableOpacity
          style={styles.checkboxHitArea}
          onPress={handleCheckPress}
          activeOpacity={0.7}
          hitSlop={8}
        >
          <Animated.View style={{ transform: [{ scale: checkScaleAnim }] }}>
            <Animated.View
              style={[styles.checkbox, { backgroundColor: checkBg, borderColor: checkBorder }]}
            >
              {task.isCompleted && <Text style={styles.checkmark}>✓</Text>}
            </Animated.View>
          </Animated.View>
        </TouchableOpacity>

        {/* Text area — tap to expand/collapse */}
        <TouchableOpacity
          style={styles.textWrap}
          onPress={toggleExpand}
          onPressIn={cardPress.onPressIn}
          onPressOut={cardPress.onPressOut}
          activeOpacity={0.75}
        >
          <View style={styles.titleRow}>
            <Text
              style={[styles.title, task.isCompleted && styles.titleDone]}
              numberOfLines={expanded ? undefined : 2}
            >
              {taskTitle}
            </Text>
            {task.estimated_minutes ? (
              <View style={[styles.timeBadge, task.isCompleted && styles.timeBadgeDone]}>
                <Text style={[styles.timeBadgeText, task.isCompleted && styles.timeBadgeTextDone]}>
                  ~{task.estimated_minutes}m
                </Text>
              </View>
            ) : null}
          </View>

          {!expanded && task.description ? (
            <Text
              style={[styles.description, task.isCompleted && styles.descDone]}
              numberOfLines={2}
            >
              {task.description}
            </Text>
          ) : null}

          {!expanded && task.why ? (
            <Text
              style={[styles.why, task.isCompleted && styles.whyDone]}
              numberOfLines={1}
            >
              {task.why}
            </Text>
          ) : null}
        </TouchableOpacity>
      </View>

      {/* Expanded section */}
      {expanded && (
        <View style={styles.expandedSection}>
          {/* Full description */}
          {task.description ? (
            <>
              <Text style={styles.expandedSectionLabel}>What to do</Text>
              <Text style={styles.expandedBody}>{task.description}</Text>
            </>
          ) : null}

          {/* Why it matters */}
          {task.why ? (
            <>
              <Text style={styles.expandedSectionLabel}>Why it matters</Text>
              <Text style={styles.expandedWhy}>{task.why}</Text>
            </>
          ) : null}

          {/* AI Refine inline */}
          {refineMode && onRefine && (
            <View style={styles.refineSection}>
              <Text style={styles.expandedSectionLabel}>Ask AI to adjust this task</Text>
              <TextInput
                style={styles.refineInput}
                value={refineInput}
                onChangeText={setRefineInput}
                placeholder='e.g. "Make it easier" or "Add more detail"'
                placeholderTextColor={colors.textTertiary}
                multiline
                editable={!refineLoading}
              />
              <View style={styles.refineActions}>
                <TouchableOpacity
                  style={styles.refineCancelBtn}
                  onPress={() => { setRefineMode(false); setRefineInput(""); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.refineCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.refineSendBtn, (!refineInput.trim() || refineLoading) && { opacity: 0.5 }]}
                  onPress={async () => {
                    if (!refineInput.trim() || refineLoading) return;
                    setRefineLoading(true);
                    try {
                      await onRefine(refineInput.trim());
                      setRefineMode(false);
                      setRefineInput("");
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setExpanded(false);
                    } catch {
                      // handled by parent
                    } finally {
                      setRefineLoading(false);
                    }
                  }}
                  activeOpacity={0.85}
                  disabled={!refineInput.trim() || refineLoading}
                >
                  {refineLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.refineSendText}>Send</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Action buttons */}
          {!refineMode && (
            <View style={styles.expandedActions}>
              {onRefine && !readonly && (
                <TouchableOpacity
                  style={styles.askAiBtn}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setRefineMode(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.askAiText}>Ask AI</Text>
                </TouchableOpacity>
              )}

              {!readonly && (
                <TouchableOpacity
                  style={[styles.toggleCompleteBtn, task.isCompleted && styles.toggleCompleteBtnDone]}
                  onPress={() => {
                    handleCheckPress();
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setExpanded(false);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.toggleCompleteText, task.isCompleted && styles.toggleCompleteTextDone]}>
                    {task.isCompleted ? "Mark incomplete" : "Mark complete"}
                  </Text>
                </TouchableOpacity>
              )}

              {readonly && task.isCompleted && (
                <View style={styles.completedBadge}>
                  <Text style={styles.completedBadgeText}>✓  Completed</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: spacing.sm,
      overflow: "hidden",
      ...shadow.sm,
    },
    cardDone: {
      borderColor: c.success,
      backgroundColor: c.successLight,
    },
    inner: {
      flexDirection: "row",
      alignItems: "flex-start",
      padding: spacing.md,
      gap: spacing.md,
    },
    checkboxHitArea: {
      paddingTop: 1,
      flexShrink: 0,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    checkmark: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 14,
    },
    textWrap: {
      flex: 1,
      gap: 4,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    title: {
      flex: 1,
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: c.text,
      lineHeight: 21,
    },
    titleDone: {
      color: c.textSecondary,
      textDecorationLine: "line-through",
    },
    timeBadge: {
      backgroundColor: c.primaryLight,
      borderRadius: radius.full,
      paddingHorizontal: 7,
      paddingVertical: 2,
      flexShrink: 0,
      marginTop: 2,
    },
    timeBadgeDone: {
      backgroundColor: c.successLight,
    },
    timeBadgeText: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.primary,
    },
    timeBadgeTextDone: {
      color: c.success,
    },
    description: {
      fontSize: typography.sm,
      color: c.textSecondary,
      lineHeight: 19,
    },
    descDone: {
      color: c.textTertiary,
    },
    why: {
      fontSize: typography.sm,
      color: c.textTertiary,
      lineHeight: 18,
      fontStyle: "italic",
    },
    whyDone: {
      color: c.textTertiary,
    },
    // ── Expanded Section ────────────────────────────────────────────────────
    expandedSection: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    expandedSectionLabel: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    expandedBody: {
      fontSize: typography.base,
      color: c.text,
      lineHeight: 23,
    },
    expandedWhy: {
      fontSize: typography.base,
      color: c.textSecondary,
      lineHeight: 23,
      fontStyle: "italic",
    },
    expandedActions: {
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    askAiBtn: {
      height: 40,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    askAiText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.textSecondary,
    },
    toggleCompleteBtn: {
      height: 44,
      backgroundColor: c.primary,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.sm,
    },
    toggleCompleteBtnDone: {
      backgroundColor: c.bg,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    toggleCompleteText: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: c.primaryText,
    },
    toggleCompleteTextDone: {
      color: c.textSecondary,
    },
    completedBadge: {
      height: 44,
      backgroundColor: c.successLight,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.success,
      alignItems: "center",
      justifyContent: "center",
    },
    completedBadgeText: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: c.success,
    },
    // ── Refine ──────────────────────────────────────────────────────────────
    refineSection: {
      marginTop: spacing.sm,
    },
    refineInput: {
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.primary,
      borderRadius: radius.md,
      padding: spacing.md,
      fontSize: typography.base,
      color: c.text,
      lineHeight: 22,
      minHeight: 80,
      marginBottom: spacing.md,
    },
    refineActions: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    refineCancelBtn: {
      flex: 1,
      height: 44,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    refineCancelText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.textSecondary,
    },
    refineSendBtn: {
      flex: 1,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.sm,
    },
    refineSendText: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: c.primaryText,
    },
  });
}
