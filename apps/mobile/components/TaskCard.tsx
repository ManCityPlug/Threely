import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  ScrollView,
  Platform,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import * as Haptics from "expo-haptics";
import type { TaskItem } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";
import { scalePress } from "@/lib/animations";

interface TaskCardProps {
  task: TaskItem;
  onToggle: (isCompleted: boolean) => void;
  onEdit?: (editData: { task?: string; description?: string }) => void;
  onRefine?: (userRequest: string) => Promise<void>;
  readonly?: boolean;
}

export function TaskCard({ task, onToggle, onEdit, onRefine, readonly = false }: TaskCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [modalVisible, setModalVisible] = useState(false);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editTask, setEditTask] = useState(task.task);
  const [editDesc, setEditDesc] = useState(task.description ?? "");

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
    // Enhanced checkbox animation — larger scale pop (1 -> 1.15 -> 1)
    Animated.sequence([
      Animated.spring(checkScaleAnim, { toValue: 1.15, useNativeDriver: true, tension: 300, friction: 6 }),
      Animated.spring(checkScaleAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    onToggle(!task.isCompleted);
  }

  function handleTextPress() {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(true);
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
    <>
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

          {/* Text area — tap to open detail modal */}
          <TouchableOpacity
            style={styles.textWrap}
            onPress={handleTextPress}
            onPressIn={cardPress.onPressIn}
            onPressOut={cardPress.onPressOut}
            activeOpacity={0.75}
          >
            <View style={styles.titleRow}>
              <Text
                style={[styles.title, task.isCompleted && styles.titleDone]}
                numberOfLines={2}
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
              {task.isCarriedOver && (
                <View style={styles.overduePill}>
                  <Text style={styles.overduePillText}>Overdue</Text>
                </View>
              )}
            </View>

            {task.description ? (
              <Text
                style={[styles.description, task.isCompleted && styles.descDone]}
                numberOfLines={2}
              >
                {task.description}
              </Text>
            ) : null}

            {task.why ? (
              <Text
                style={[styles.why, task.isCompleted && styles.whyDone]}
                numberOfLines={1}
              >
                {task.why}
              </Text>
            ) : null}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Detail modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, (refineMode || editing) && styles.modalSheetExpanded]} onPress={() => {}}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Time badge */}
              {task.estimated_minutes ? (
                <View style={styles.modalTimeBadge}>
                  <Text style={styles.modalTimeBadgeText}>~{task.estimated_minutes} min</Text>
                </View>
              ) : null}

              {editing ? (
                <>
                  {/* Edit mode */}
                  <Text style={styles.modalSectionLabel}>Task name</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editTask}
                    onChangeText={setEditTask}
                    placeholder="Task name"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                  />
                  <Text style={styles.modalSectionLabel}>Description</Text>
                  <TextInput
                    style={[styles.editInput, { minHeight: 80 }]}
                    value={editDesc}
                    onChangeText={setEditDesc}
                    placeholder="Description"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    textAlignVertical="top"
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={styles.editCancelBtn}
                      onPress={() => {
                        setEditing(false);
                        setEditTask(task.task);
                        setEditDesc(task.description ?? "");
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.editCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.editSaveBtn}
                      onPress={() => {
                        if (onEdit) {
                          const data: { task?: string; description?: string } = {};
                          if (editTask.trim() !== task.task) data.task = editTask.trim();
                          if (editDesc.trim() !== (task.description ?? "")) data.description = editDesc.trim();
                          if (data.task !== undefined || data.description !== undefined) {
                            onEdit(data);
                          }
                        }
                        setEditing(false);
                        setModalVisible(false);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.editSaveText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  {/* Title */}
                  <Text style={[styles.modalTitle, task.isCompleted && styles.modalTitleDone]}>
                    {taskTitle}
                  </Text>

                  {/* Description */}
                  {task.description ? (
                    <>
                      <Text style={styles.modalSectionLabel}>What to do</Text>
                      <Text style={styles.modalBody}>{task.description}</Text>
                    </>
                  ) : null}

                  {/* Why */}
                  {task.why ? (
                    <>
                      <Text style={styles.modalSectionLabel}>Why it matters</Text>
                      <Text style={styles.modalWhy}>{task.why}</Text>
                    </>
                  ) : null}

                  {/* AI Refine inline */}
                  {refineMode && onRefine && (
                    <View style={styles.refineSection}>
                      <Text style={styles.modalSectionLabel}>Ask AI to adjust this task</Text>
                      <TextInput
                        style={styles.refineInput}
                        value={refineInput}
                        onChangeText={setRefineInput}
                        placeholder='e.g. "Make it easier" or "Add more detail"'
                        placeholderTextColor={colors.textTertiary}
                        multiline
                        editable={!refineLoading}
                      />
                      <View style={styles.editActions}>
                        <TouchableOpacity
                          style={styles.editCancelBtn}
                          onPress={() => { setRefineMode(false); setRefineInput(""); }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.editCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.editSaveBtn, (!refineInput.trim() || refineLoading) && { opacity: 0.5 }]}
                          onPress={async () => {
                            if (!refineInput.trim() || refineLoading) return;
                            setRefineLoading(true);
                            try {
                              await onRefine(refineInput.trim());
                              setRefineMode(false);
                              setRefineInput("");
                              setModalVisible(false);
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
                            <Text style={styles.editSaveText}>Send</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {/* Action buttons: Edit + Ask AI */}
            {!readonly && !editing && !refineMode && (
              <View style={styles.modalActionRow}>
                {onEdit && (
                  <TouchableOpacity
                    style={styles.modalActionBtn}
                    onPress={() => {
                      setEditTask(task.task);
                      setEditDesc(task.description ?? "");
                      setEditing(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalActionText}>Edit</Text>
                  </TouchableOpacity>
                )}
                {onRefine && (
                  <TouchableOpacity
                    style={styles.modalActionBtn}
                    onPress={() => setRefineMode(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalActionText}>Ask AI</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Check off button / completed badge */}
            {readonly ? (
              task.isCompleted ? (
                <View style={styles.modalCompletedBadge}>
                  <Text style={styles.modalCompletedBadgeText}>✓  Completed</Text>
                </View>
              ) : null
            ) : !editing && !refineMode ? (
              <TouchableOpacity
                style={[styles.modalCheckBtn, task.isCompleted && styles.modalCheckBtnDone]}
                onPress={() => {
                  handleCheckPress();
                  setModalVisible(false);
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.modalCheckBtnText, task.isCompleted && styles.modalCheckBtnTextDone]}>
                  {task.isCompleted ? "Mark as incomplete" : "Mark as complete"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </>
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
    overduePill: {
      backgroundColor: c.warningLight,
      borderRadius: radius.full,
      paddingHorizontal: 7,
      paddingVertical: 2,
      flexShrink: 0,
      marginTop: 2,
    },
    overduePillText: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.warning,
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
    // ── Detail Modal ────────────────────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
      maxHeight: "75%",
      ...shadow.lg,
    },
    modalSheetExpanded: {
      maxHeight: "90%",
    },
    modalHeader: {
      alignItems: "center",
      marginBottom: spacing.md,
    },
    modalHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
    },
    modalTimeBadge: {
      alignSelf: "flex-start",
      backgroundColor: c.primaryLight,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: spacing.sm,
    },
    modalTimeBadgeText: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.primary,
    },
    modalTitle: {
      fontSize: typography.xl,
      fontWeight: typography.bold,
      color: c.text,
      lineHeight: 28,
      marginBottom: spacing.lg,
      letterSpacing: -0.3,
    },
    modalTitleDone: {
      color: c.textSecondary,
      textDecorationLine: "line-through",
    },
    modalSectionLabel: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: spacing.xs,
    },
    modalBody: {
      fontSize: typography.base,
      color: c.text,
      lineHeight: 23,
      marginBottom: spacing.lg,
    },
    modalWhy: {
      fontSize: typography.base,
      color: c.textSecondary,
      lineHeight: 23,
      fontStyle: "italic",
      marginBottom: spacing.lg,
    },
    modalCheckBtn: {
      height: 50,
      backgroundColor: c.primary,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing.md,
      ...shadow.sm,
    },
    modalCheckBtnDone: {
      backgroundColor: c.bg,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    modalCheckBtnText: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: c.primaryText,
    },
    modalCheckBtnTextDone: {
      color: c.textSecondary,
    },
    modalCompletedBadge: {
      height: 50,
      backgroundColor: c.successLight,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: c.success,
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing.md,
    },
    modalCompletedBadgeText: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: c.success,
    },
    // ── Edit / Refine ──────────────────────────────────────────────────────────
    editInput: {
      backgroundColor: c.bg,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md,
      fontSize: typography.base,
      color: c.text,
      lineHeight: 22,
      marginBottom: spacing.md,
    },
    editActions: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    editCancelBtn: {
      flex: 1,
      height: 44,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    editCancelText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.textSecondary,
    },
    editSaveBtn: {
      flex: 1,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.sm,
    },
    editSaveText: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: c.primaryText,
    },
    refineSection: {
      marginTop: spacing.sm,
    },
    refineInput: {
      backgroundColor: c.bg,
      borderWidth: 1.5,
      borderColor: c.primary + "55",
      borderRadius: radius.md,
      padding: spacing.md,
      fontSize: typography.base,
      color: c.text,
      lineHeight: 22,
      minHeight: 60,
      marginBottom: spacing.md,
    },
    modalActionRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    modalActionBtn: {
      flex: 1,
      height: 40,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    modalActionText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.textSecondary,
    },
  });
}
