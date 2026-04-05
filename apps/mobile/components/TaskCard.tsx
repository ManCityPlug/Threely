import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TaskItem } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";
import { useScalePress } from "@/lib/animations";

const RESOURCE_ICONS: Record<string, string> = {
  youtube_channel: "\u25B6",
  tool: "\u2699",
  website: "\u2197",
  book: "\u2261",
  app: "\u25A0",
};

interface AskMessage {
  role: "user" | "assistant";
  content: string;
}

interface AskResult {
  answer: string;
  options: string[];
}

interface TaskCardProps {
  task: TaskItem;
  onToggle: (isCompleted: boolean) => void;
  onRefine?: (userRequest: string) => Promise<void>;
  onAsk?: (messages: AskMessage[]) => Promise<AskResult>;
  readonly?: boolean;
  paywalled?: boolean;
  onShowPaywall?: () => void;
}

export function TaskCard({ task, onToggle, onRefine, onAsk, readonly = false, paywalled = false, onShowPaywall }: TaskCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [modalVisible, setModalVisible] = useState(false);
  const pendingPaywallRef = useRef(false);

  const strikeAnim = useRef(new Animated.Value(task.isCompleted ? 1 : 0)).current;
  const checkScaleAnim = useRef(new Animated.Value(1)).current;

  // Card-level scale press micro-interaction
  const cardPress = useScalePress();

  useEffect(() => {
    const anim = Animated.spring(strikeAnim, {
      toValue: task.isCompleted ? 1 : 0,
      useNativeDriver: false,
      tension: 120,
      friction: 8,
    });
    anim.start();
    return () => anim.stop();
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
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
        onDismiss={() => {
          if (pendingPaywallRef.current) {
            pendingPaywallRef.current = false;
            onShowPaywall?.();
          }
        }}
      >
        {modalVisible && (
          <TaskDetailContent
            task={task}
            taskTitle={taskTitle}
            colors={colors}
            styles={styles}
            readonly={readonly}
            onClose={() => setModalVisible(false)}
            onCheckPress={() => { handleCheckPress(); setModalVisible(false); }}
            onRefine={onRefine}
            onAsk={onAsk}
            paywalled={paywalled}
            onPaywall={() => {
              pendingPaywallRef.current = true;
              setModalVisible(false);
              if (Platform.OS !== "ios") {
                setTimeout(() => {
                  if (pendingPaywallRef.current) {
                    pendingPaywallRef.current = false;
                    onShowPaywall?.();
                  }
                }, 350);
              }
            }}
          />
        )}
      </Modal>
    </>
  );
}

// ─── Swipe-to-dismiss detail modal ──────────────────────────────────────────

const DISMISS_THRESHOLD = 120;

function TaskDetailContent({
  task, taskTitle, colors, styles, readonly,
  onClose, onCheckPress, onRefine, onAsk, paywalled, onPaywall,
}: {
  task: TaskItem;
  taskTitle: string;
  colors: Colors;
  styles: ReturnType<typeof createStyles>;
  readonly: boolean;
  onClose: () => void;
  onCheckPress: () => void;
  onRefine?: (userRequest: string) => Promise<void>;
  onAsk?: (messages: AskMessage[]) => Promise<AskResult>;
  paywalled?: boolean;
  onPaywall?: () => void;
}) {
  // Full-screen chat modals
  const [askModalOpen, setAskModalOpen] = useState(false);
  const [refineModalOpen, setRefineModalOpen] = useState(false);

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

  return (
    <>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}>
        <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.modalSheet,
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
            {!readonly && (onRefine || onAsk) && (
              <View style={styles.modalActionRow}>
                {onAsk && (
                  <TouchableOpacity
                    style={styles.modalActionBtn}
                    onPress={() => {
                      if (paywalled && onPaywall) { onPaywall(); return; }
                      setAskModalOpen(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.intelligenceActionIcon}>✦</Text>
                    <Text style={styles.modalActionText}>Ask AI</Text>
                  </TouchableOpacity>
                )}
                {onRefine && (
                  <TouchableOpacity
                    style={styles.modalActionBtn}
                    onPress={() => {
                      if (paywalled && onPaywall) { onPaywall(); return; }
                      setRefineModalOpen(true);
                    }}
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

          {/* Check off button / completed badge */}
          {readonly ? (
            task.isCompleted ? (
              <View style={styles.modalCompletedBadge}>
                <Text style={styles.modalCompletedBadgeText}>✓  Completed</Text>
              </View>
            ) : null
          ) : (
            <TouchableOpacity
              style={[styles.modalCheckBtn, task.isCompleted && styles.modalCheckBtnDone]}
              onPress={onCheckPress}
              activeOpacity={0.85}
            >
              <Text style={[styles.modalCheckBtnText, task.isCompleted && styles.modalCheckBtnTextDone]}>
                {task.isCompleted ? "Mark as incomplete" : "Mark as complete"}
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Full-screen Ask AI modal */}
      {askModalOpen && onAsk && (
        <AskChatModal
          visible={askModalOpen}
          taskTitle={taskTitle}
          colors={colors}
          onAsk={onAsk}
          onClose={() => setAskModalOpen(false)}
        />
      )}

      {/* Full-screen Refine modal */}
      {refineModalOpen && onRefine && (
        <RefineChatModal
          visible={refineModalOpen}
          taskTitle={taskTitle}
          colors={colors}
          onRefine={onRefine}
          onClose={() => { setRefineModalOpen(false); onClose(); }}
        />
      )}
    </>
  );
}

// ─── Full-screen Ask AI chat modal ────────────────────────────────────────────

function AskChatModal({
  visible, taskTitle, colors, onAsk, onClose,
}: {
  visible: boolean;
  taskTitle: string;
  colors: Colors;
  onAsk: (messages: AskMessage[]) => Promise<AskResult>;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const chatStyles = useMemo(() => createChatStyles(colors), [colors]);

  const sendMessage = useCallback(async (messageText?: string) => {
    const text = messageText ?? input.trim();
    if (!text || loading) return;
    const userMsg: AskMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setOptions([]);
    setLoading(true);
    try {
      const result = await onAsk(newMessages);
      setMessages(prev => [...prev, { role: "assistant", content: result.answer }]);
      setOptions(result.options ?? []);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
      setOptions([]);
    } finally {
      setLoading(false);
      // Delayed scroll to ensure suggestion chips are rendered
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [input, loading, messages, onAsk]);

  const handleSubmit = useCallback(() => sendMessage(), [sendMessage]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={chatStyles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header with safe area */}
        <View style={[chatStyles.headerBlock, { paddingTop: insets.top }]}>
          <View style={chatStyles.header}>
            <View style={{ width: 32 }} />
            <View style={chatStyles.headerCenter}>
              <Text style={chatStyles.headerIcon}>✦</Text>
              <Text style={chatStyles.headerTitle}>Ask Threely</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.7} style={chatStyles.closeBtn}>
              <Text style={chatStyles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={chatStyles.messageList}
          contentContainerStyle={chatStyles.messageListContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {messages.length === 0 && (
            <View style={chatStyles.emptyState}>
              <Text style={chatStyles.emptyIcon}>✦</Text>
              <Text style={chatStyles.emptyTitle}>Ask anything about this task</Text>
              <Text style={chatStyles.emptySubtitle}>
                Get tips, clarification, alternative approaches, or help getting started.
              </Text>
            </View>
          )}

          {/* Initial suggestion chips */}
          {messages.length === 0 && (
            <View style={chatStyles.suggestionRow}>
              {["How do I start?", "Break it down", "Tips & resources", "Why this task?"].map(s => (
                <TouchableOpacity
                  key={s}
                  style={chatStyles.suggestionChip}
                  onPress={() => sendMessage(s)}
                  activeOpacity={0.7}
                >
                  <Text style={chatStyles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {messages.map((msg, i) => (
            <View
              key={i}
              style={[
                chatStyles.bubble,
                msg.role === "user" ? chatStyles.bubbleUser : chatStyles.bubbleAI,
              ]}
            >
              {msg.role === "assistant" && <Text style={chatStyles.bubbleAIIcon}>✦</Text>}
              <Text style={[
                chatStyles.bubbleText,
                msg.role === "user" ? chatStyles.bubbleTextUser : chatStyles.bubbleTextAI,
              ]}>{msg.content}</Text>
            </View>
          ))}

          {/* Option buttons after AI response */}
          {!loading && options.length > 0 && (
            <View style={chatStyles.suggestionRow}>
              {options.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={chatStyles.suggestionChip}
                  onPress={() => sendMessage(opt)}
                  activeOpacity={0.7}
                >
                  <Text style={chatStyles.suggestionText}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {loading && (
            <View style={[chatStyles.bubble, chatStyles.bubbleAI]}>
              <Text style={chatStyles.bubbleAIIcon}>✦</Text>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
        </ScrollView>

        {/* Input bar */}
        <View style={[chatStyles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TextInput
            style={chatStyles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask a question..."
            placeholderTextColor={colors.textTertiary}
            editable={!loading}
            onSubmitEditing={handleSubmit}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[chatStyles.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]}
            onPress={handleSubmit}
            disabled={!input.trim() || loading}
            activeOpacity={0.85}
          >
            <Text style={chatStyles.sendBtnText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Full-screen Refine modal ─────────────────────────────────────────────────

function RefineChatModal({
  visible, taskTitle, colors, onRefine, onClose,
}: {
  visible: boolean;
  taskTitle: string;
  colors: Colors;
  onRefine: (userRequest: string) => Promise<void>;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatStyles = useMemo(() => createChatStyles(colors), [colors]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    try {
      await onRefine(input.trim());
      onClose();
    } catch {
      // handled by parent
    } finally {
      setLoading(false);
    }
  }, [input, loading, onRefine, onClose]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={chatStyles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header with safe area */}
        <View style={[chatStyles.headerBlock, { paddingTop: insets.top }]}>
          <View style={chatStyles.header}>
            <View style={{ width: 32 }} />
            <View style={chatStyles.headerCenter}>
              <Text style={chatStyles.headerTitle}>Threely Intelligence</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.7} style={chatStyles.closeBtn}>
              <Text style={chatStyles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Explanation */}
        <ScrollView
          style={chatStyles.messageList}
          contentContainerStyle={chatStyles.messageListContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={chatStyles.emptyState}>
            <Text style={chatStyles.emptyIcon}>✦</Text>
            <Text style={chatStyles.emptyTitle}>How should we adjust this task?</Text>
            <Text style={chatStyles.emptySubtitle}>
              Tell us what to change — make it easier, harder, more specific, shorter, etc. AI will regenerate the task for you.
            </Text>
          </View>

          <View style={chatStyles.suggestionRow}>
            {["Make it easier", "Make it harder", "More detail", "Shorter"].map((s) => (
              <TouchableOpacity
                key={s}
                style={chatStyles.suggestionChip}
                onPress={() => setInput(s)}
                activeOpacity={0.7}
              >
                <Text style={chatStyles.suggestionText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Input bar */}
        <View style={[chatStyles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TextInput
            style={chatStyles.input}
            value={input}
            onChangeText={setInput}
            placeholder='e.g. "Make it easier" or "Add more detail"'
            placeholderTextColor={colors.textTertiary}
            editable={!loading}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            autoFocus
          />
          <TouchableOpacity
            style={[chatStyles.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={chatStyles.sendBtnText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
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
      marginBottom: spacing.md,
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
      padding: spacing.md + 2,
      gap: spacing.md,
    },
    checkboxHitArea: {
      paddingTop: 1,
      flexShrink: 0,
      minWidth: 44,
      minHeight: 44,
      alignItems: "center" as const,
      justifyContent: "center" as const,
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
      fontSize: typography.md,
      fontWeight: typography.semibold,
      color: c.text,
      lineHeight: 23,
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
      lineHeight: 20,
      marginTop: 2,
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
      paddingVertical: spacing.sm + 2,
      minHeight: 44,
      borderTopWidth: 1,
      borderTopColor: c.border,
      alignItems: "center",
      justifyContent: "center",
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
      right: -6,
      top: -10,
      width: 44,
      height: 44,
      borderRadius: 22,
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
  });
}

// ─── Full-screen chat styles ──────────────────────────────────────────────────

function createChatStyles(c: Colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    headerBlock: {
      backgroundColor: c.card,
      borderBottomLeftRadius: radius.lg,
      borderBottomRightRadius: radius.lg,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    closeBtn: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    closeBtnText: {
      fontSize: 16,
      fontWeight: typography.semibold,
      color: c.textSecondary,
      lineHeight: 18,
    },
    headerCenter: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    headerIcon: {
      fontSize: 16,
      color: c.primary,
    },
    headerTitle: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: c.text,
      letterSpacing: -0.3,
    },
    messageList: {
      flex: 1,
    },
    messageListContent: {
      padding: spacing.md,
      paddingBottom: 100,
    },
    emptyState: {
      alignItems: "center",
      paddingTop: 60,
      paddingHorizontal: spacing.lg,
    },
    emptyIcon: {
      fontSize: 32,
      color: c.primary,
      marginBottom: spacing.md,
    },
    emptyTitle: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: c.text,
      textAlign: "center",
      marginBottom: spacing.xs,
      letterSpacing: -0.3,
    },
    emptySubtitle: {
      fontSize: typography.sm,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
    bubble: {
      maxWidth: "85%",
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    bubbleUser: {
      alignSelf: "flex-end",
      backgroundColor: c.primary,
      borderBottomRightRadius: 4,
    },
    bubbleAI: {
      alignSelf: "flex-start",
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderBottomLeftRadius: 4,
      flexDirection: "row",
      gap: spacing.xs,
    },
    bubbleAIIcon: {
      fontSize: 14,
      color: c.primary,
      marginTop: 1,
    },
    bubbleText: {
      fontSize: typography.base,
      lineHeight: 22,
      flexShrink: 1,
    },
    bubbleTextUser: {
      color: c.primaryText,
    },
    bubbleTextAI: {
      color: c.text,
      flex: 1,
    },
    inputBar: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.bg,
    },
    input: {
      flex: 1,
      backgroundColor: c.bg,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.base,
      color: c.text,
      maxHeight: 100,
    },
    sendBtn: {
      height: 44,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.sm,
    },
    sendBtnText: {
      fontSize: typography.sm,
      fontWeight: typography.bold,
      color: c.primaryText,
    },
    suggestionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginTop: spacing.xl,
      justifyContent: "center",
    },
    suggestionChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: c.primary + "44",
      backgroundColor: c.primaryLight,
    },
    suggestionText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.primary,
    },
  });
}
