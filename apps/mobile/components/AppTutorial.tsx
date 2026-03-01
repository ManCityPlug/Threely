import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";
import { useWalkthroughRegistry, type WalkthroughTarget, type TargetLayout } from "@/lib/walkthrough-registry";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const SPOTLIGHT_PAD = 10;

interface TutorialStep {
  title: string;
  description: string;
  target: WalkthroughTarget | null;
  tabRoute: "/(tabs)" | "/(tabs)/goals" | "/(tabs)/profile" | null;
  tooltipPosition: "above" | "below" | "center";
  icon: keyof typeof Ionicons.glyphMap;
  buttonLabel?: string;
}

const STEPS: TutorialStep[] = [
  {
    title: "Your Daily Tasks",
    description:
      "Every day, Threely generates 3 personalized tasks for each of your goals. Tap any task to see details, refine it, or ask AI about it.",
    target: "first-task-card",
    tabRoute: "/(tabs)",
    tooltipPosition: "below",
    icon: "flash",
  },
  {
    title: "Want More?",
    description:
      "Finished all your tasks? Tap here to generate more. You get one extra set per goal each day.",
    target: "get-more-button",
    tabRoute: "/(tabs)",
    tooltipPosition: "above",
    icon: "add-circle",
  },
  {
    title: "Your Goals",
    description:
      "View and manage all your goals here. Tap any goal to open its options.",
    target: "first-goal-card",
    tabRoute: "/(tabs)/goals",
    tooltipPosition: "below",
    icon: "disc",
  },
  {
    title: "Goal Options",
    description:
      "Edit, pause, complete, or delete goals. Adjust your schedule, intensity, and deadline through an AI chat.",
    target: "goal-menu-button",
    tabRoute: "/(tabs)/goals",
    tooltipPosition: "below",
    icon: "ellipsis-horizontal",
  },
  {
    title: "Your Profile",
    description:
      "Track streaks, view weekly summaries, manage notifications, and adjust your settings.",
    target: "profile-stats",
    tabRoute: "/(tabs)/profile",
    tooltipPosition: "below",
    icon: "person",
  },
  {
    title: "You're all set!",
    description:
      "Threely adapts to your progress and evolves your tasks over time. The more you use it, the better it gets. Let's crush those goals!",
    target: null,
    tabRoute: null,
    tooltipPosition: "center",
    icon: "rocket",
    buttonLabel: "Let's go!",
  },
];

const TOTAL_STEPS = STEPS.length;

interface AppTutorialProps {
  visible: boolean;
  onComplete: () => void;
}

export function AppTutorial({ visible, onComplete }: AppTutorialProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { measure } = useWalkthroughRegistry();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [currentStep, setCurrentStep] = useState(0);
  const [targetLayout, setTargetLayout] = useState<TargetLayout | null>(null);

  // Animations
  const overlayFade = useRef(new Animated.Value(0)).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(30)).current;
  const spotlightTop = useRef(new Animated.Value(0)).current;
  const spotlightLeft = useRef(new Animated.Value(0)).current;
  const spotlightWidth = useRef(new Animated.Value(0)).current;
  const spotlightHeight = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const step = STEPS[currentStep];

  // Reset when visible
  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      setTargetLayout(null);
      overlayFade.setValue(0);
      cardFade.setValue(0);
      cardTranslateY.setValue(30);
      Animated.timing(overlayFade, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        measureAndAnimate(0);
      });
    }
  }, [visible]);

  // Pulse animation
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  const measureAndAnimate = useCallback(async (stepIdx: number) => {
    const s = STEPS[stepIdx];
    if (s.target) {
      // Navigate first, wait for render
      if (s.tabRoute) {
        router.navigate(s.tabRoute as never);
      }
      await new Promise((r) => setTimeout(r, 400));

      const layout = await measure(s.target);
      setTargetLayout(layout);

      if (layout) {
        Animated.parallel([
          Animated.timing(spotlightTop, { toValue: layout.y - SPOTLIGHT_PAD, duration: 350, useNativeDriver: false }),
          Animated.timing(spotlightLeft, { toValue: layout.x - SPOTLIGHT_PAD, duration: 350, useNativeDriver: false }),
          Animated.timing(spotlightWidth, { toValue: layout.width + SPOTLIGHT_PAD * 2, duration: 350, useNativeDriver: false }),
          Animated.timing(spotlightHeight, { toValue: layout.height + SPOTLIGHT_PAD * 2, duration: 350, useNativeDriver: false }),
        ]).start();
      }
    } else {
      setTargetLayout(null);
    }

    // Animate card in
    cardFade.setValue(0);
    cardTranslateY.setValue(20);
    Animated.parallel([
      Animated.timing(cardFade, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(cardTranslateY, { toValue: 0, friction: 8, tension: 65, useNativeDriver: true }),
    ]).start();
  }, [measure, router, spotlightTop, spotlightLeft, spotlightWidth, spotlightHeight, cardFade, cardTranslateY]);

  const animateCardOut = useCallback((onDone: () => void) => {
    Animated.parallel([
      Animated.timing(cardFade, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(cardTranslateY, { toValue: -20, duration: 180, useNativeDriver: true }),
    ]).start(onDone);
  }, [cardFade, cardTranslateY]);

  const goNext = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep >= TOTAL_STEPS - 1) {
      Animated.timing(overlayFade, { toValue: 0, duration: 250, useNativeDriver: false }).start(() => {
        router.navigate("/(tabs)" as never);
        onComplete();
      });
      return;
    }
    animateCardOut(() => {
      const next = currentStep + 1;
      setCurrentStep(next);
      measureAndAnimate(next);
    });
  }, [currentStep, animateCardOut, measureAndAnimate, onComplete, overlayFade, router]);

  const skip = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(overlayFade, { toValue: 0, duration: 250, useNativeDriver: false }).start(() => {
      router.navigate("/(tabs)" as never);
      onComplete();
    });
  }, [onComplete, overlayFade, router]);

  if (!visible) return null;

  const isLastStep = currentStep === TOTAL_STEPS - 1;
  const hasTarget = step.target !== null && targetLayout !== null;

  // Calculate tooltip position
  let tooltipTop = SCREEN_H / 2 - 100;
  if (hasTarget && targetLayout) {
    if (step.tooltipPosition === "below") {
      tooltipTop = targetLayout.y + targetLayout.height + SPOTLIGHT_PAD + 16;
    } else if (step.tooltipPosition === "above") {
      tooltipTop = targetLayout.y - SPOTLIGHT_PAD - 220;
    }
  }
  // Clamp to screen bounds
  tooltipTop = Math.max(insets.top + 16, Math.min(tooltipTop, SCREEN_H - insets.bottom - 260));

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: overlayFade }]}>
        {hasTarget ? (
          <>
            {/* 4 dark rects around the spotlight cutout */}
            {/* Top rect */}
            <Animated.View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: spotlightTop,
                backgroundColor: "rgba(0,0,0,0.75)",
              }}
            />
            {/* Bottom rect */}
            <Animated.View
              style={{
                position: "absolute",
                top: Animated.add(spotlightTop, spotlightHeight),
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0,0,0,0.75)",
              }}
            />
            {/* Left rect */}
            <Animated.View
              style={{
                position: "absolute",
                top: spotlightTop,
                left: 0,
                width: spotlightLeft,
                height: spotlightHeight,
                backgroundColor: "rgba(0,0,0,0.75)",
              }}
            />
            {/* Right rect */}
            <Animated.View
              style={{
                position: "absolute",
                top: spotlightTop,
                left: Animated.add(spotlightLeft, spotlightWidth),
                right: 0,
                height: spotlightHeight,
                backgroundColor: "rgba(0,0,0,0.75)",
              }}
            />

            {/* Pulsing border around spotlight */}
            <Animated.View
              style={{
                position: "absolute",
                top: spotlightTop,
                left: spotlightLeft,
                width: spotlightWidth,
                height: spotlightHeight,
                borderRadius: radius.lg,
                borderWidth: 2,
                borderColor: colors.primary,
                transform: [{ scale: pulseAnim }],
              }}
            />
          </>
        ) : (
          /* Full overlay for centered steps */
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.75)" }]} />
        )}

        {/* Tooltip card */}
        <Animated.View
          style={[
            styles.tooltipCard,
            {
              top: tooltipTop,
              opacity: cardFade,
              transform: [{ translateY: cardTranslateY }],
            },
          ]}
        >
          {/* Icon badge for center steps */}
          {!hasTarget && (
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

          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>

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
      </Animated.View>
    </Modal>
  );
}

function createStyles(c: Colors) {
  const isTablet = SCREEN_W >= 768;
  const cardMaxWidth = isTablet ? 420 : SCREEN_W - spacing.lg * 2;

  return StyleSheet.create({
    tooltipCard: {
      position: "absolute",
      left: spacing.lg,
      right: spacing.lg,
      maxWidth: cardMaxWidth,
      alignSelf: "center",
      backgroundColor: c.card,
      borderRadius: radius.xl,
      padding: spacing.xl,
      alignItems: "center",
      ...shadow.lg,
      zIndex: 10,
    },
    iconBadge: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
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
