import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";

// ─── Tutorial step definitions ──────────────────────────────────────────────

interface TutorialStep {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  tabRoute: "/(tabs)" | "/(tabs)/goals" | "/(tabs)/profile" | null;
  /** Position hint for the pointer arrow — "top" means the relevant area is above the card */
  pointerDirection: "up" | "down" | "none";
  buttonLabel?: string;
}

const STEPS: TutorialStep[] = [
  {
    title: "Your Daily Tasks",
    description:
      "Every day, Threely generates 3 personalized tasks for each of your goals. Tap any task to see details, refine it, or ask AI about it.",
    icon: "flash",
    tabRoute: "/(tabs)",
    pointerDirection: "up",
  },
  {
    title: "Want More?",
    description:
      "Finished all your tasks? Complete them and tap the \"Get more tasks\" button to generate more. You get one extra set per goal each day.",
    icon: "add-circle",
    tabRoute: "/(tabs)",
    pointerDirection: "down",
  },
  {
    title: "Your Goals",
    description:
      "View and manage all your goals here. Tap any goal to open its options — you'll see everything you need to manage it.",
    icon: "disc",
    tabRoute: "/(tabs)/goals",
    pointerDirection: "up",
  },
  {
    title: "Goal Options",
    description:
      "Edit goal — adjust your daily time, intensity, schedule, and deadline through an AI chat.\n\nPause goal — take a break without losing progress. Resume anytime.\n\nMark as complete — finished a goal? Celebrate and archive it.\n\nDelete goal — remove it entirely if you no longer need it.",
    icon: "ellipsis-horizontal",
    tabRoute: "/(tabs)/goals",
    pointerDirection: "up",
  },
  {
    title: "Your Profile",
    description:
      "Track your streaks, view weekly summaries, manage notifications, and adjust your subscription settings.",
    icon: "person",
    tabRoute: "/(tabs)/profile",
    pointerDirection: "up",
  },
  {
    title: "You're all set!",
    description:
      "Threely learns from your progress and adapts your tasks over time. The more you use it, the better it gets. Let's crush those goals!",
    icon: "rocket",
    tabRoute: null,
    pointerDirection: "none",
    buttonLabel: "Let's go!",
  },
];

const TOTAL_STEPS = STEPS.length;

// ─── Component ──────────────────────────────────────────────────────────────

interface AppTutorialProps {
  visible: boolean;
  onComplete: () => void;
}

export function AppTutorial({ visible, onComplete }: AppTutorialProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [currentStep, setCurrentStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const overlayFade = useRef(new Animated.Value(0)).current;

  const step = STEPS[currentStep];

  // Reset state when tutorial becomes visible
  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      fadeAnim.setValue(0);
      cardTranslateY.setValue(30);
      overlayFade.setValue(0);

      // Fade in overlay
      Animated.timing(overlayFade, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        animateStepIn();
      });
    }
  }, [visible]);

  // Navigate to the correct tab when step changes
  useEffect(() => {
    if (!visible) return;
    const route = STEPS[currentStep]?.tabRoute;
    if (route) {
      router.navigate(route as never);
    }
  }, [currentStep, visible]);

  // Pulsing animation for the pointer
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  const animateStepIn = useCallback(() => {
    fadeAnim.setValue(0);
    cardTranslateY.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.spring(cardTranslateY, {
        toValue: 0,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, cardTranslateY]);

  const animateStepOut = useCallback(
    (onDone: () => void) => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateY, {
          toValue: -20,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(onDone);
    },
    [fadeAnim, cardTranslateY]
  );

  const goNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep >= TOTAL_STEPS - 1) {
      // Last step — close tutorial
      Animated.timing(overlayFade, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        // Navigate back to home tab
        router.navigate("/(tabs)" as never);
        onComplete();
      });
      return;
    }
    animateStepOut(() => {
      setCurrentStep((s) => s + 1);
      animateStepIn();
    });
  }, [currentStep, animateStepOut, animateStepIn, onComplete, overlayFade, router]);

  const skip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(overlayFade, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      router.navigate("/(tabs)" as never);
      onComplete();
    });
  }, [onComplete, overlayFade, router]);

  if (!visible) return null;

  const isLastStep = currentStep === TOTAL_STEPS - 1;
  const showPointer = step.pointerDirection !== "none";

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: overlayFade }]}>
        {/* Top safe area spacer */}
        <View style={{ height: insets.top }} />

        {/* Pointer arrow pointing UP (area of interest is above the card) */}
        {showPointer && step.pointerDirection === "up" && (
          <View style={styles.pointerAreaTop}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View style={styles.pointerBubble}>
                <Ionicons name={step.icon} size={28} color={colors.primary} />
              </View>
              <View style={styles.pointerArrowDown} />
            </Animated.View>
          </View>
        )}

        {/* Tooltip card — centered */}
        <View style={styles.cardWrapper}>
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: cardTranslateY }],
              },
            ]}
          >
            {/* Step icon badge (for the final step or when no pointer) */}
            {!showPointer && (
              <View style={[styles.iconBadge, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name={step.icon} size={32} color={colors.primary} />
              </View>
            )}

            {/* Step counter */}
            <Text style={styles.stepCounter}>
              Step {currentStep + 1} of {TOTAL_STEPS}
            </Text>

            {/* Dot indicators */}
            <View style={styles.dots}>
              {STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === currentStep && styles.dotActive,
                    i < currentStep && styles.dotDone,
                  ]}
                />
              ))}
            </View>

            {/* Title */}
            <Text style={styles.title}>{step.title}</Text>

            {/* Description */}
            <Text style={styles.description}>{step.description}</Text>

            {/* Buttons */}
            <View style={styles.buttonRow}>
              {!isLastStep && (
                <TouchableOpacity
                  onPress={skip}
                  style={styles.skipBtn}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={goNext}
                style={[styles.nextBtn, isLastStep && styles.nextBtnFull]}
                activeOpacity={0.85}
              >
                <Text style={styles.nextBtnText}>
                  {step.buttonLabel ?? "Next"}
                </Text>
                {!isLastStep && (
                  <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>

        {/* Pointer arrow pointing DOWN (area of interest is below the card) */}
        {showPointer && step.pointerDirection === "down" && (
          <View style={styles.pointerAreaBottom}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View style={styles.pointerArrowUp} />
              <View style={styles.pointerBubble}>
                <Ionicons name={step.icon} size={28} color={colors.primary} />
              </View>
            </Animated.View>
          </View>
        )}

        {/* Bottom safe area spacer */}
        <View style={{ height: insets.bottom + 60 }} />
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(c: Colors) {
  const { width: screenWidth } = Dimensions.get("window");
  const isTablet = screenWidth >= 768;
  const cardMaxWidth = isTablet ? 480 : screenWidth - spacing.lg * 2;

  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      alignItems: "center",
    },

    // ── Pointer areas ───────────────────────────────────────────────────────
    pointerAreaTop: {
      alignItems: "center",
      paddingBottom: spacing.md,
      flex: 1,
      justifyContent: "flex-end",
    },
    pointerAreaBottom: {
      alignItems: "center",
      paddingTop: spacing.md,
      flex: 1,
      justifyContent: "flex-start",
    },
    pointerBubble: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.card,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.md,
      alignSelf: "center",
    },
    pointerArrowDown: {
      width: 0,
      height: 0,
      borderLeftWidth: 10,
      borderRightWidth: 10,
      borderTopWidth: 12,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderTopColor: c.card,
      alignSelf: "center",
      marginTop: -1,
    },
    pointerArrowUp: {
      width: 0,
      height: 0,
      borderLeftWidth: 10,
      borderRightWidth: 10,
      borderBottomWidth: 12,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderBottomColor: c.card,
      alignSelf: "center",
      marginBottom: -1,
    },

    // ── Card ────────────────────────────────────────────────────────────────
    cardWrapper: {
      width: "100%",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
    },
    card: {
      width: cardMaxWidth,
      maxWidth: 480,
      backgroundColor: c.card,
      borderRadius: radius.xl,
      padding: spacing.xl,
      alignItems: "center",
      ...shadow.lg,
    },
    iconBadge: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },

    // ── Step counter + dots ─────────────────────────────────────────────────
    stepCounter: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },
    dots: {
      flexDirection: "row",
      gap: 6,
      marginBottom: spacing.lg,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.border,
    },
    dotActive: {
      backgroundColor: c.primary,
      width: 20,
      borderRadius: 4,
    },
    dotDone: {
      backgroundColor: c.success,
    },

    // ── Text ────────────────────────────────────────────────────────────────
    title: {
      fontSize: isTablet ? typography.xl : typography.lg,
      fontWeight: typography.bold,
      color: c.text,
      textAlign: "center",
      letterSpacing: -0.5,
      marginBottom: spacing.sm,
    },
    description: {
      fontSize: isTablet ? typography.base : typography.sm,
      fontWeight: typography.regular,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: isTablet ? 24 : 20,
      marginBottom: spacing.xl,
      paddingHorizontal: spacing.xs,
    },

    // ── Buttons ─────────────────────────────────────────────────────────────
    buttonRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      gap: spacing.md,
    },
    skipBtn: {
      paddingVertical: spacing.sm + 4,
      paddingHorizontal: spacing.md,
    },
    skipText: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: c.textTertiary,
    },
    nextBtn: {
      flex: 1,
      flexDirection: "row",
      height: 48,
      backgroundColor: c.primary,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.sm,
    },
    nextBtnFull: {
      flex: 1,
    },
    nextBtnText: {
      fontSize: typography.base,
      fontWeight: typography.bold,
      color: "#fff",
      letterSpacing: -0.2,
    },
  });
}
