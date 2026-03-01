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
  PanResponder,
  Dimensions,
  Pressable,
} from "react-native";
import * as Haptics from "expo-haptics";
import type { TaskItem } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";
import { scalePress } from "@/lib/animations";

const RESOURCE_ICONS: Record<string, string> = {
  youtube_channel: "\u25B6",
  tool: "\u2699",
  website: "\uD83D\uDD17",
  book: "\uD83D\uDCD6",
  app: "\uD83D\uDCF1",
};

interface AskMessage {
  role: "user" | "assistant";
  content: string;
}

interface TaskCardProps {
  task: TaskItem;
  onToggle: (isCompleted: boolean) => void;
  onRefine?: (userRequest: string) => Promise<void>;
  onAsk?: (messages: AskMessage[]) => Promise<string>;
  readonly?: boolean;
}

export function TaskCard({ task, onToggle, onRefine, onAsk, readonly = false }: TaskCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [modalVisible, setModalVisible] = useState(false);

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

        {/* View task link — centered with top divider, matching GoalCard style */}
        <TouchableOpacity
          style={styles.viewTaskBtn}
          onPress={handleTextPress}
          activeOpacity={0.7}
        >
          <Text style={styles.viewTaskBtnText}>View task →</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Detail modal */}
      {modalVisible && (
        <TaskDetailModal
          visible={modalVisible}
          task={task}
          taskTitle={taskTitle}
          colors={colors}
          styles={styles}
          readonly={readonly}
          onClose={() => { setModalVisible(false); setRefineMode(false); setRefineInput(""); }}
          onCheckPress={() => { handleCheckPress(); setModalVisible(false); }}
          onRefine={onRefine}
          onAsk={onAsk}
          refineMode={refineMode}
          setRefineMode={setRefineMode}
          refineInput={refineInput}
          setRefineInput={setRefineInput}
          refineLoading={refineLoading}
          setRefineLoading={setRefineLoading}
        />
      )}
    </>
  );
}

// ─── Swipe-to-dismiss detail modal ──────────────────────────────────────────

const DISMISS_THRESHOLD = 120;

function TaskDetailModal({
  visible, task, taskTitle, colors, styles, readonly,
  onClose, onCheckPress, onRefine, onAsk,
  refineMode, setRefineMode, refineInput, setRefineInput, refineLoading, setRefineLoading,
}: {
  visible: boolean;
  task: TaskItem;
  taskTitle: string;
  colors: Colors;
  styles: ReturnType<typeof createStyles>;
  readonly: boolean;
  onClose: () => void;
  onCheckPress: () => void;
  onRefine?: (userRequest: string) => Promise<void>;
  onAsk?: (messages: AskMessage[]) => Promise<string>;
  refineMode: boolean;
  setRefineMode: (v: boolean) => void;
  refineInput: string;
  setRefineInput: (v: string) => void;
  refineLoading: boolean;
  setRefineLoading: (v: boolean) => void;
}) {
  // Ask mode state
  const [askMode, setAskMode] = useState(false);
  const [askMessages, setAskMessages] = useState<AskMessage[]>([]);
  const [askInput, setAskInput] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const askScrollRef = useRef<ScrollView>(null);

  const translateY = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          translateY.setValue(g.dy);
          overlayOpacity.setValue(Math.max(0, 1 - g.dy / 400));
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_THRESHOLD || g.vy > 0.5) {
          Animated.parallel([
            Animated.timing(translateY, { toValue: Dimensions.get("window").height, duration: 250, useNativeDriver: true }),
            Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
          ]).start(onClose);
        } else {
          Animated.parallel([
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 200, friction: 20 }),
            Animated.timing(overlayOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  const inputRef = useRef<TextInput>(null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}>
        <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.modalSheet,
            refineMode && styles.modalSheetExpanded,
            { transform: [{ translateY }] },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Header: handle + X button */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHandle} />
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose} hitSlop={12}>
              <Text style={styles.modalCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            bounces={true}
            style={{ flexShrink: 1 }}
          >
            {/* Time badge */}
            {task.estimated_minutes ? (
              <View style={styles.modalTimeBadge}>
                <Text style={styles.modalTimeBadgeText}>~{task.estimated_minutes} min</Text>
              </View>
            ) : null}

            {/* Title */}
            <Text style={[styles.modalTitle, task.isCompleted && styles.modalTitleDone]}>
              {taskTitle}
            </Text>

            {/* AI action buttons — prominent, right after title */}
            {!readonly && !refineMode && !askMode && (onRefine || onAsk) && (
              <View style={styles.modalActionRow}>
                {onAsk && (
                  <TouchableOpacity
                    style={styles.modalActionBtn}
                    onPress={() => setAskMode(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.intelligenceActionIcon}>✦</Text>
                    <Text style={styles.modalActionText}>Ask about this</Text>
                  </TouchableOpacity>
                )}
                {onRefine && (
                  <TouchableOpacity
                    style={styles.modalActionBtn}
                    onPress={() => setRefineMode(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.intelligenceActionIcon}>✦</Text>
                    <Text style={styles.modalActionText}>Refine</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

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

            {/* Resources */}
            {task.resources && task.resources.length > 0 ? (
              <>
                <Text style={styles.modalSectionLabel}>Resources</Text>
                {task.resources.map((r, i) => (
                  <View key={i} style={styles.resourceItem}>
                    <Text style={styles.resourceIcon}>{RESOURCE_ICONS[r.type] ?? "\uD83D\uDD17"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resourceName}>{r.name}</Text>
                      <Text style={styles.resourceDetail}>{r.detail}</Text>
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </ScrollView>

          {/* Threely Intelligence — AI refine, pinned below ScrollView */}
          {refineMode && onRefine && (
            <View style={styles.refineSection}>
              <View style={styles.intelligenceHeader}>
                <Text style={styles.intelligenceIcon}>✦</Text>
                <Text style={styles.intelligenceTitle}>Threely Intelligence</Text>
              </View>
              <TextInput
                ref={inputRef}
                style={styles.refineInput}
                value={refineInput}
                onChangeText={setRefineInput}
                placeholder='e.g. "Make it easier" or "Add more detail"'
                placeholderTextColor={colors.textTertiary}
                multiline
                autoFocus
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
                      onClose();
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

          {/* Ask mode — chat UI */}
          {askMode && onAsk && (
            <View style={styles.refineSection}>
              <View style={styles.intelligenceHeader}>
                <Text style={styles.intelligenceIcon}>✦</Text>
                <Text style={styles.intelligenceTitle}>Ask Threely Intelligence</Text>
              </View>

              {askMessages.length > 0 && (
                <ScrollView
                  ref={askScrollRef}
                  style={styles.askChatScroll}
                  onContentSizeChange={() => askScrollRef.current?.scrollToEnd({ animated: true })}
                >
                  {askMessages.map((msg, i) => (
                    <View
                      key={i}
                      style={[
                        styles.askBubble,
                        msg.role === "user" ? styles.askBubbleUser : styles.askBubbleAI,
                      ]}
                    >
                      <Text style={[
                        styles.askBubbleText,
                        msg.role === "user" ? styles.askBubbleTextUser : styles.askBubbleTextAI,
                      ]}>{msg.content}</Text>
                    </View>
                  ))}
                  {askLoading && (
                    <View style={[styles.askBubble, styles.askBubbleAI]}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  )}
                </ScrollView>
              )}

              <View style={styles.askInputRow}>
                <TextInput
                  style={styles.askInput}
                  value={askInput}
                  onChangeText={setAskInput}
                  placeholder="Ask a question..."
                  placeholderTextColor={colors.textTertiary}
                  editable={!askLoading}
                  onSubmitEditing={async () => {
                    if (!askInput.trim() || askLoading) return;
                    const userMsg: AskMessage = { role: "user", content: askInput.trim() };
                    const newMessages = [...askMessages, userMsg];
                    setAskMessages(newMessages);
                    setAskInput("");
                    setAskLoading(true);
                    try {
                      const answer = await onAsk(newMessages);
                      setAskMessages(prev => [...prev, { role: "assistant", content: answer }]);
                    } catch {
                      setAskMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
                    } finally {
                      setAskLoading(false);
                    }
                  }}
                />
                <TouchableOpacity
                  style={[styles.askSendBtn, (!askInput.trim() || askLoading) && { opacity: 0.5 }]}
                  onPress={async () => {
                    if (!askInput.trim() || askLoading) return;
                    const userMsg: AskMessage = { role: "user", content: askInput.trim() };
                    const newMessages = [...askMessages, userMsg];
                    setAskMessages(newMessages);
                    setAskInput("");
                    setAskLoading(true);
                    try {
                      const answer = await onAsk(newMessages);
                      setAskMessages(prev => [...prev, { role: "assistant", content: answer }]);
                    } catch {
                      setAskMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
                    } finally {
                      setAskLoading(false);
                    }
                  }}
                  disabled={!askInput.trim() || askLoading}
                  activeOpacity={0.85}
                >
                  <Text style={styles.askSendBtnText}>Send</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.editCancelBtn}
                onPress={() => { setAskMode(false); setAskMessages([]); setAskInput(""); }}
                activeOpacity={0.7}
              >
                <Text style={styles.editCancelText}>Close chat</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Check off button / completed badge */}
          {readonly ? (
            task.isCompleted ? (
              <View style={styles.modalCompletedBadge}>
                <Text style={styles.modalCompletedBadgeText}>✓  Completed</Text>
              </View>
            ) : null
          ) : !refineMode ? (
            <TouchableOpacity
              style={[styles.modalCheckBtn, task.isCompleted && styles.modalCheckBtnDone]}
              onPress={onCheckPress}
              activeOpacity={0.85}
            >
              <Text style={[styles.modalCheckBtnText, task.isCompleted && styles.modalCheckBtnTextDone]}>
                {task.isCompleted ? "Mark as incomplete" : "Mark as complete"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
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
    viewTaskBtn: {
      marginTop: 0,
      paddingVertical: spacing.xs + 2,
      borderTopWidth: 1,
      borderTopColor: c.border,
      alignItems: "center",
    },
    viewTaskBtnText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold as "600",
      color: c.primary,
    },
    // ── Detail Modal ────────────────────────────────────────────────────────
    modalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    modalSheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
      maxHeight: "80%",
      ...shadow.lg,
    },
    modalSheetExpanded: {
      maxHeight: "90%",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
      position: "relative",
    },
    modalHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
    },
    modalCloseBtn: {
      position: "absolute",
      right: 0,
      top: -4,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    modalCloseBtnText: {
      fontSize: 16,
      fontWeight: typography.semibold,
      color: c.textSecondary,
      lineHeight: 18,
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
    // ── Refine ──────────────────────────────────────────────────────────────
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
    intelligenceHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    intelligenceIcon: {
      fontSize: 16,
      color: c.primary,
    },
    intelligenceTitle: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: c.primary,
      letterSpacing: -0.2,
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
      borderColor: c.primary + "44",
      backgroundColor: c.primaryLight,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
    },
    intelligenceActionIcon: {
      fontSize: 14,
      color: c.primary,
    },
    modalActionText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.primary,
    },
    // ── Resources ────────────────────────────────────────────────────────────
    resourceItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      marginBottom: spacing.sm,
      paddingLeft: spacing.xs,
    },
    resourceIcon: {
      fontSize: 16,
      marginTop: 2,
    },
    resourceName: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.text,
      lineHeight: 20,
    },
    resourceDetail: {
      fontSize: typography.sm,
      color: c.textSecondary,
      lineHeight: 19,
    },
    // ── Ask chat ─────────────────────────────────────────────────────────────
    askChatScroll: {
      maxHeight: 200,
      marginBottom: spacing.sm,
    },
    askBubble: {
      maxWidth: "85%",
      borderRadius: radius.md,
      padding: spacing.sm,
      marginBottom: spacing.xs,
    },
    askBubbleUser: {
      alignSelf: "flex-end",
      backgroundColor: c.primary,
    },
    askBubbleAI: {
      alignSelf: "flex-start",
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
    },
    askBubbleText: {
      fontSize: typography.sm,
      lineHeight: 20,
    },
    askBubbleTextUser: {
      color: c.primaryText,
    },
    askBubbleTextAI: {
      color: c.text,
    },
    askInputRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    askInput: {
      flex: 1,
      backgroundColor: c.bg,
      borderWidth: 1.5,
      borderColor: c.primary + "55",
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.base,
      color: c.text,
    },
    askSendBtn: {
      height: 44,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    askSendBtnText: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: c.primaryText,
    },
  });
}
