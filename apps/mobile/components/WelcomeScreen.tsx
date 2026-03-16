import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FloatingParticles } from "./FloatingParticles";
import { celebrationHaptic } from "@/lib/animations";
import { typography, spacing, radius } from "@/constants/theme";
import {
  useGoogleSignIn,
  useAppleSignIn,
  isAppleSignInAvailable,
} from "@/lib/auth-providers";

const WELCOME_KEY = "@threely_welcome_seen";
const PRIMARY = "#635BFF";
const TOTAL_PAGES = 4;

const GRADIENTS: [string, string, string][] = [
  ["#1A1040", "#2D1B69", "#635BFF"],
  ["#0D1117", "#1A1040", "#3D2B8C"],
  ["#0F2027", "#203A43", "#2C5364"],
  ["#1A1040", "#2D1B69", "#635BFF"],
];

interface WelcomeScreenProps {
  onComplete: (destination?: "login") => void;
  initialPage?: number;
}

// ── Dot Indicators ────────────────────────────────────────────────────────────

function DotIndicators({ scrollX, screenWidth }: { scrollX: Animated.Value; screenWidth: number }) {
  return (
    <View style={styles.dotsRow}>
      {GRADIENTS.map((_, i) => {
        const inputRange = [
          (i - 1) * screenWidth,
          i * screenWidth,
          (i + 1) * screenWidth,
        ];

        const width = scrollX.interpolate({
          inputRange,
          outputRange: [8, 24, 8],
          extrapolate: "clamp",
        });

        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.3, 1, 0.3],
          extrapolate: "clamp",
        });

        return (
          <Animated.View
            key={i}
            style={[styles.dot, { width, opacity }]}
          />
        );
      })}
    </View>
  );
}

// ── Page 1: The Hook ──────────────────────────────────────────────────────────

function PageHook({ anim, screenWidth }: { anim: Animated.Value; screenWidth: number }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const sparkleAnims = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const loops: Animated.CompositeAnimation[] = [];

    // Floating up/down
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -8, duration: 2000, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    loops.push(floatLoop);
    floatLoop.start();

    // Pulsing glow — matches web: pulse 3s ease-in-out infinite
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    loops.push(pulseLoop);
    pulseLoop.start();

    // Sparkles — each loops infinitely with staggered delay (matches web: sparkle 2s infinite)
    const timers: ReturnType<typeof setTimeout>[] = [];
    sparkleAnims.forEach((a, idx) => {
      const timer = setTimeout(() => {
        const sparkleLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(a, { toValue: 1, duration: 1000, useNativeDriver: true }),
            Animated.timing(a, { toValue: 0, duration: 1000, useNativeDriver: true }),
          ])
        );
        loops.push(sparkleLoop);
        sparkleLoop.start();
      }, 600 + idx * 80);
      timers.push(timer);
    });

    return () => {
      timers.forEach(clearTimeout);
      loops.forEach((l) => l.stop());
    };
  }, []);

  const translateY = (idx: number, base: number) =>
    anim.interpolate({
      inputRange: [0, 1],
      outputRange: [base, 0],
    });

  const sparklePositions = [
    { angle: 0 },
    { angle: 60 },
    { angle: 120 },
    { angle: 180 },
    { angle: 240 },
    { angle: 300 },
  ];

  return (
    <View style={[styles.page, { width: screenWidth }]}>
      {/* Logo with glow + sparkles + float */}
      <Animated.View
        style={[
          styles.hookLogoWrap,
          {
            opacity: anim,
            transform: [{ scale: pulseAnim }, { translateY: floatAnim }],
          },
        ]}
      >
        <View style={styles.hookLogoGlow} />
        <Image
          source={require("@/assets/icon.png")}
          style={styles.hookLogo}
        />
        {sparklePositions.map((pos, idx) => {
          const rad = (pos.angle * Math.PI) / 180;
          const dist = 55;
          return (
            <Animated.View
              key={idx}
              style={[
                styles.sparkle,
                {
                  left: 52 + Math.cos(rad) * dist - 3,
                  top: 52 + Math.sin(rad) * dist - 3,
                  opacity: sparkleAnims[idx],
                  transform: [
                    {
                      scale: sparkleAnims[idx].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 1],
                      }),
                    },
                  ],
                },
              ]}
            />
          );
        })}
      </Animated.View>

      {/* Title */}
      <Animated.Text
        style={[
          styles.titleXXXL,
          { opacity: anim, transform: [{ translateY: translateY(0, 30) }] },
        ]}
      >
        Do less.
      </Animated.Text>
      <Animated.Text
        style={[
          styles.titleXXXL,
          {
            opacity: anim,
            transform: [{ translateY: translateY(1, 40) }],
            marginTop: -4,
          },
        ]}
      >
        <Text style={{ color: PRIMARY }}>Achieve</Text> more.
      </Animated.Text>

      {/* Subtitle */}
      <Animated.Text
        style={[
          styles.subtitle,
          {
            opacity: anim,
            transform: [{ translateY: translateY(2, 50) }],
            marginTop: spacing.lg,
          },
        ]}
      >
        Tell us your goal.{"\n"}We'll get you there.
      </Animated.Text>
    </View>
  );
}

// ── Page 2: How It Works ──────────────────────────────────────────────────────

const STEPS = [
  {
    icon: "flag-outline" as const,
    title: "Set any goal",
  },
  {
    icon: "clipboard-outline" as const,
    title: "Get your daily plan",
  },
  {
    icon: "checkmark-done-outline" as const,
    title: "Just do the 3 tasks",
  },
  {
    icon: "rocket-outline" as const,
    title: "See real results",
  },
];

function PageHowItWorks({ anim, screenWidth }: { anim: Animated.Value; screenWidth: number }) {
  const stepAnims = useRef(
    Array.from({ length: 4 }, () => new Animated.Value(0))
  ).current;
  const lineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Stagger step entrances
    const stagger = Animated.stagger(
      180,
      stepAnims.map((a) =>
        Animated.timing(a, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        })
      )
    );
    stagger.start();

    // Line draw
    const lineTiming = Animated.timing(lineAnim, {
      toValue: 1,
      duration: 1000,
      delay: 200,
      useNativeDriver: false,
    });
    lineTiming.start();

    return () => {
      stagger.stop();
      lineTiming.stop();
    };
  }, []);

  const lineHeight = lineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 300],
  });

  return (
    <View style={[styles.page, { width: screenWidth }]}>
      <Animated.Text style={[styles.titleXXL, { opacity: anim }]}>
        How it works
      </Animated.Text>
      <Animated.Text
        style={[
          styles.subtitle,
          { opacity: anim, marginTop: spacing.sm, marginBottom: spacing.md },
        ]}
      >
        Three steps. Zero effort.
      </Animated.Text>

      <View style={[styles.stepsContainer, { alignItems: "center" }]}>
        {/* Connecting line */}
        <Animated.View
          style={[
            styles.connectingLine,
            { height: lineHeight, left: "50%", marginLeft: -1 },
          ]}
        />

        {STEPS.map((step, i) => (
          <Animated.View
            key={i}
            style={[
              {
                alignItems: "center",
                gap: spacing.sm,
              },
              {
                opacity: stepAnims[i],
                transform: [
                  {
                    translateY: stepAnims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={[styles.stepBadge, { zIndex: 2 }]}>
              <Ionicons name={step.icon} size={22} color="#FFFFFF" />
            </View>
            <Text style={[styles.stepTitle, { textAlign: "center" }]}>{step.title}</Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

// ── Page 3: The Payoff ────────────────────────────────────────────────────────

function PagePayoff({ anim, isVisible, screenWidth }: { anim: Animated.Value; isVisible: boolean; screenWidth: number }) {
  const checkScale = useRef(new Animated.Value(0)).current;
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (isVisible && !hasTriggered.current) {
      hasTriggered.current = true;

      Animated.spring(checkScale, {
        toValue: 1,
        tension: 50,
        friction: 6,
        useNativeDriver: true,
      }).start();

      celebrationHaptic();
    }
  }, [isVisible]);

  const translateY = (base: number) =>
    anim.interpolate({
      inputRange: [0, 1],
      outputRange: [base, 0],
    });

  return (
    <View style={[styles.page, { width: screenWidth }]}>
      {/* Animated rocket */}
      <Animated.View
        style={[
          {
            alignItems: "center",
            justifyContent: "center",
            transform: [{ scale: checkScale }],
          },
        ]}
      >
        <Text style={{ fontSize: 88, lineHeight: 100 }}>{"\u{1F680}"}</Text>
      </Animated.View>

      <Animated.Text
        style={[
          styles.titleXXXL,
          { opacity: anim, transform: [{ translateY: translateY(30) }], marginTop: spacing.xl },
        ]}
      >
        10x faster
      </Animated.Text>
      <Animated.Text
        style={[
          styles.titleXXXL,
          {
            opacity: anim,
            transform: [{ translateY: translateY(40) }],
            marginTop: -4,
            color: "#635BFF",
          },
        ]}
      >
        progress.
      </Animated.Text>

      <Animated.Text
        style={[
          styles.subtitle,
          {
            opacity: anim,
            transform: [{ translateY: translateY(50) }],
            marginTop: spacing.lg,
          },
        ]}
      >
        No planning. No thinking.{"\n"}Just 3 tasks a day and real results.
      </Animated.Text>

      {/* Frosted stat card */}
      <Animated.View
        style={[
          styles.statCard,
          {
            opacity: anim,
            transform: [{ translateY: translateY(60) }],
          },
        ]}
      >
        <Text style={styles.statText}>
          AI keeps you moving.
        </Text>
      </Animated.View>
    </View>
  );
}

// ── Page 4: Auth ──────────────────────────────────────────────────────────────

interface PageAuthProps {
  anim: Animated.Value;
  onComplete: WelcomeScreenProps["onComplete"];
  onGoogleSignIn: () => void;
  onAppleSignIn: () => void;
  googleLoading: boolean;
  appleLoading: boolean;
  screenWidth: number;
}

function PageAuth({ anim, onComplete, onGoogleSignIn, onAppleSignIn, googleLoading, appleLoading, screenWidth }: PageAuthProps) {
  const socialLoading = googleLoading || appleLoading;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sparkleAnims = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const loops: Animated.CompositeAnimation[] = [];

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -6, duration: 2000, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    loops.push(floatLoop);
    floatLoop.start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    loops.push(pulseLoop);
    pulseLoop.start();

    // Sparkles — loop infinitely with stagger
    const timers: ReturnType<typeof setTimeout>[] = [];
    sparkleAnims.forEach((a, idx) => {
      const timer = setTimeout(() => {
        const sparkleLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(a, { toValue: 1, duration: 1000, useNativeDriver: true }),
            Animated.timing(a, { toValue: 0, duration: 1000, useNativeDriver: true }),
          ])
        );
        loops.push(sparkleLoop);
        sparkleLoop.start();
      }, 600 + idx * 80);
      timers.push(timer);
    });

    return () => {
      timers.forEach(clearTimeout);
      loops.forEach((l) => l.stop());
    };
  }, []);

  const authSparklePositions = [
    { angle: 0 }, { angle: 60 }, { angle: 120 },
    { angle: 180 }, { angle: 240 }, { angle: 300 },
  ];

  return (
    <View style={[styles.page, { width: screenWidth }]}>
      {/* Logo with float + pulse + glow + sparkles */}
      <Animated.View style={[styles.authLogoWrap, { opacity: anim, transform: [{ scale: pulseAnim }, { translateY: floatAnim }] }]}>
        <View style={styles.authLogoGlow} />
        <Image
          source={require("@/assets/icon.png")}
          style={styles.authLogo}
        />
        {authSparklePositions.map((pos, idx) => {
          const rad = (pos.angle * Math.PI) / 180;
          const dist = 45;
          return (
            <Animated.View
              key={idx}
              style={[
                styles.sparkle,
                {
                  left: 40 + Math.cos(rad) * dist - 3,
                  top: 40 + Math.sin(rad) * dist - 3,
                  opacity: sparkleAnims[idx],
                  transform: [{
                    scale: sparkleAnims[idx].interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1],
                    }),
                  }],
                },
              ]}
            />
          );
        })}
      </Animated.View>

      <Animated.Text style={[styles.titleXXL, { opacity: anim, marginTop: spacing.lg }]}>
        Ready to begin?
      </Animated.Text>
      <Animated.Text style={[styles.subtitle, { opacity: anim, marginTop: spacing.sm }]}>
        Your goals are waiting.{"\n"}Let's make them happen.
      </Animated.Text>

      <Animated.View style={[styles.authButtons, { opacity: anim }]}>
        {/* Continue with Apple (iOS only) */}
        {isAppleSignInAvailable && (
          <Pressable
            style={[styles.appleButton, socialLoading && { opacity: 0.6 }]}
            onPress={onAppleSignIn}
            disabled={socialLoading}
          >
            <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
            <Text style={styles.appleButtonText}>Continue with Apple</Text>
          </Pressable>
        )}

        {/* Continue with Google */}
        <Pressable
          style={[styles.googleButton, socialLoading && { opacity: 0.6 }]}
          onPress={onGoogleSignIn}
          disabled={socialLoading}
        >
          <Ionicons name="logo-google" size={20} color="#1F2937" />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </Pressable>

        {/* Sign in with email */}
        <Pressable
          style={styles.emailButton}
          onPress={() => onComplete("login")}
        >
          <Ionicons name="mail-outline" size={20} color="#FFFFFF" />
          <Text style={styles.emailButtonText}>Sign in with email</Text>
        </Pressable>
      </Animated.View>

      {/* Create account link */}
      <Animated.View style={{ opacity: anim, marginTop: spacing.xl }}>
        <Text style={styles.signInText}>
          New here?{" "}
          <Text style={{ color: "rgba(255,255,255,0.9)", fontWeight: "600" }} onPress={() => onComplete("login")}>
            Create an account
          </Text>
        </Text>
      </Animated.View>

      {/* Legal — Terms & Privacy links */}
      <Animated.View style={{ opacity: anim, marginTop: spacing.lg }}>
        <Text style={styles.legalText}>
          By continuing, you agree to our{" "}
          <Text style={styles.legalLink} onPress={() => Linking.openURL("https://threely.co/terms")}>
            Terms
          </Text>{" "}
          and{" "}
          <Text style={styles.legalLink} onPress={() => Linking.openURL("https://threely.co/privacy")}>
            Privacy Policy
          </Text>
          .
        </Text>
      </Animated.View>
    </View>
  );
}

// ── Main WelcomeScreen ────────────────────────────────────────────────────────

export function WelcomeScreen({ onComplete, initialPage = 0 }: WelcomeScreenProps) {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const screenWidthRef = useRef(SCREEN_WIDTH);
  screenWidthRef.current = SCREEN_WIDTH;

  const scrollX = useRef(new Animated.Value(initialPage * SCREEN_WIDTH)).current;
  const flatListRef = useRef<Animated.FlatList>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);

  // Social sign-in hooks (lifted to top level for stable hook lifecycle)
  const { promptAsync: googlePromptAsync, loading: googleLoading } = useGoogleSignIn();
  const { signIn: appleSignIn, loading: appleLoading } = useAppleSignIn();

  const pageAnims = useRef(
    Array.from({ length: TOTAL_PAGES }, (_, i) =>
      new Animated.Value(i < initialPage ? 1 : 0)
    )
  ).current;
  const welcomePersisted = useRef(initialPage >= 3);

  // Animate the starting page on mount
  useEffect(() => {
    Animated.timing(pageAnims[initialPage], {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // Trigger page entrance animation when page changes
  useEffect(() => {
    Animated.timing(pageAnims[currentPage], {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Persist flag when user reaches page 4
    if (currentPage === 3 && !welcomePersisted.current) {
      welcomePersisted.current = true;
      AsyncStorage.setItem(WELCOME_KEY, "true");
    }
  }, [currentPage]);

  // Android back button
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (currentPage > 0) {
        scrollToPage(currentPage - 1);
        return true;
      }
      return false; // Let system handle (exit app)
    });

    return () => handler.remove();
  }, [currentPage]);

  const scrollToPage = useCallback(
    (page: number) => {
      flatListRef.current?.scrollToOffset({
        offset: page * screenWidthRef.current,
        animated: true,
      });
    },
    []
  );

  const handleNext = useCallback(() => {
    if (currentPage < TOTAL_PAGES - 1) {
      scrollToPage(currentPage + 1);
    }
  }, [currentPage, scrollToPage]);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const onMomentumScrollEnd = useCallback(
    (e: any) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / screenWidthRef.current);
      setCurrentPage(page);
    },
    []
  );

  const renderPage = useCallback(
    ({ index }: { item: number; index: number }) => {
      return (
        <View style={{ width: SCREEN_WIDTH, backgroundColor: "transparent" }}>
          {index === 0 && <PageHook anim={pageAnims[0]} screenWidth={SCREEN_WIDTH} />}
          {index === 1 && <PageHowItWorks anim={pageAnims[1]} screenWidth={SCREEN_WIDTH} />}
          {index === 2 && (
            <PagePayoff anim={pageAnims[2]} isVisible={currentPage === 2} screenWidth={SCREEN_WIDTH} />
          )}
          {index === 3 && (
            <PageAuth
              anim={pageAnims[3]}
              onComplete={onComplete}
              onGoogleSignIn={() => googlePromptAsync()}
              onAppleSignIn={appleSignIn}
              googleLoading={googleLoading}
              appleLoading={appleLoading}
              screenWidth={SCREEN_WIDTH}
            />
          )}
        </View>
      );
    },
    [currentPage, onComplete, pageAnims, SCREEN_WIDTH]
  );

  // Per-page opacity for cross-fading background gradients
  const pageOpacities = GRADIENTS.map((_, i) =>
    scrollX.interpolate({
      inputRange: [(i - 1) * SCREEN_WIDTH, i * SCREEN_WIDTH, (i + 1) * SCREEN_WIDTH],
      outputRange: [0, 1, 0],
      extrapolate: "clamp",
    })
  );

  // Dynamic getItemLayout — uses current screen width for proper iPad paging
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    [SCREEN_WIDTH]
  );

  return (
    <View style={styles.root}>
      {/* Background gradients — one per page, cross-faded via scrollX */}
      {GRADIENTS.map((colors, i) => (
        <Animated.View
          key={i}
          style={[StyleSheet.absoluteFillObject, { opacity: pageOpacities[i] }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={colors}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        </Animated.View>
      ))}
      <FloatingParticles />

      <SafeAreaView style={styles.safeArea}>
        {/* Paging FlatList */}
        <Animated.FlatList
          ref={flatListRef}
          data={[0, 1, 2, 3]}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          initialScrollIndex={initialPage}
          keyExtractor={(item: number) => String(item)}
          renderItem={renderPage}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onMomentumScrollEnd}
          getItemLayout={getItemLayout}
          style={{ backgroundColor: "transparent" }}
        />

        {/* Bottom area: dots + next button */}
        <Animated.View style={styles.bottomBar}>
          <DotIndicators scrollX={scrollX} screenWidth={SCREEN_WIDTH} />

          <Animated.View
            style={{
              width: "100%",
              opacity: scrollX.interpolate({
                inputRange: [2 * SCREEN_WIDTH, 2.5 * SCREEN_WIDTH, 3 * SCREEN_WIDTH],
                outputRange: [1, 0, 0],
                extrapolate: "clamp",
              }),
            }}
            pointerEvents={currentPage >= 3 ? "none" : "auto"}
          >
            <Pressable style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextText}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          </Animated.View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0D1117",
  },
  safeArea: {
    flex: 1,
    zIndex: 2,
  },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: "center",
    gap: spacing.lg,
    backgroundColor: "transparent",
  },
  // Dots
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },

  // Next button
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.xl,
    gap: spacing.sm,
    width: "100%",
  },
  nextText: {
    color: "#FFFFFF",
    fontSize: typography.md,
    fontWeight: typography.semibold,
  },

  // Page shared — width is overridden at runtime via inline style with
  // useWindowDimensions for proper iPad / multitasking support
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },

  // ── Page 1: Hook ──
  hookLogoWrap: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  hookLogo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    zIndex: 2,
  },
  hookLogoGlow: {
    position: "absolute",
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "rgba(99, 91, 255, 0.25)",
  },
  sparkle: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },

  titleXXXL: {
    fontSize: typography.xxxl,
    fontWeight: typography.bold,
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  titleXXL: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: spacing.xl,
  },
  subtitle: {
    fontSize: typography.md,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 300,
  },

  // ── Page 2: How It Works ──
  stepsContainer: {
    width: "100%",
    maxWidth: 340,
    gap: spacing.xl,
  },
  connectingLine: {
    position: "absolute",
    left: 23,
    top: 48,
    width: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 1,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  stepBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    color: "#FFFFFF",
    fontSize: typography.md,
    fontWeight: typography.semibold,
  },
  stepDesc: {
    color: "rgba(255,255,255,0.6)",
    fontSize: typography.sm,
    marginTop: 2,
  },

  // ── Page 3: Payoff ──
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#3ECF8E",
    alignItems: "center",
    justifyContent: "center",
  },
  statCard: {
    marginTop: spacing.xl,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  statText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: typography.base,
    fontWeight: typography.medium,
    textAlign: "center",
  },

  // ── Page 4: Auth ──
  authLogoWrap: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  authLogoGlow: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(99, 91, 255, 0.25)",
  },
  authLogo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    zIndex: 2,
  },
  authButtons: {
    width: "100%",
    maxWidth: 340,
    gap: 12,
    marginTop: spacing.xl,
  },
  appleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    height: 52,
    borderRadius: radius.xl,
    gap: spacing.sm,
  },
  appleButtonText: {
    color: "#FFFFFF",
    fontSize: typography.md,
    fontWeight: typography.semibold,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    height: 52,
    borderRadius: radius.xl,
    gap: spacing.sm,
  },
  googleButtonText: {
    color: "#1F2937",
    fontSize: typography.md,
    fontWeight: typography.semibold,
  },
  emailButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    height: 52,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    gap: spacing.sm,
  },
  emailButtonText: {
    color: "#FFFFFF",
    fontSize: typography.md,
    fontWeight: typography.medium,
  },
  signInText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: typography.sm,
    textAlign: "center",
  },
  legalText: {
    fontSize: typography.xs,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: spacing.md,
  },
  legalLink: {
    textDecorationLine: "underline",
    color: "rgba(255,255,255,0.6)",
  },
});
