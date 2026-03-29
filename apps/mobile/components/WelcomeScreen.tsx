import React, { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FloatingParticles } from "./FloatingParticles";
import { typography, spacing, radius } from "@/constants/theme";
import {
  useGoogleSignIn,
  useAppleSignIn,
  isAppleSignInAvailable,
} from "@/lib/auth-providers";

const WELCOME_KEY = "@threely_welcome_seen";
const PRIMARY = "#635BFF";

interface WelcomeScreenProps {
  onComplete: (destination?: "login" | "register") => void;
  initialPage?: number;
}

const VALUE_PROPS = [
  "Finally become the person you keep saying you'll be.",
  "Achieve your goals.",
  "10x your productivity.",
];

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const { promptAsync: googlePromptAsync, loading: googleLoading } = useGoogleSignIn();
  const { signIn: appleSignIn, loading: appleLoading } = useAppleSignIn();
  const socialLoading = googleLoading || appleLoading;

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sparkleAnims = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    // Persist welcome seen flag
    AsyncStorage.setItem(WELCOME_KEY, "true");

    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    const loops: Animated.CompositeAnimation[] = [];

    // Float
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -8, duration: 2000, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    loops.push(floatLoop);
    floatLoop.start();

    // Pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    loops.push(pulseLoop);
    pulseLoop.start();

    // Sparkles
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

  const sparklePositions = [
    { angle: 0 }, { angle: 60 }, { angle: 120 },
    { angle: 180 }, { angle: 240 }, { angle: 300 },
  ];

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#1A1040", "#2D1B69", "#635BFF"]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <FloatingParticles />

      <SafeAreaView style={styles.content}>
        {/* Top section: logo + headline + value props */}
        <Animated.View style={[styles.topSection, { opacity: fadeAnim }]}>
          {/* Logo with glow + sparkles + float */}
          <Animated.View
            style={[
              styles.logoWrap,
              { transform: [{ scale: pulseAnim }, { translateY: floatAnim }] },
            ]}
          >
            <View style={styles.logoGlow} />
            <Image source={require("@/assets/icon.png")} style={styles.logo} />
            {sparklePositions.map((pos, idx) => {
              const rad = (pos.angle * Math.PI) / 180;
              const dist = 50;
              return (
                <Animated.View
                  key={idx}
                  style={[
                    styles.sparkle,
                    {
                      left: 44 + Math.cos(rad) * dist - 3,
                      top: 44 + Math.sin(rad) * dist - 3,
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

          {/* Headline */}
          <Text style={styles.title}>
            Do Less.{"\n"}
            <Text style={{ color: PRIMARY }}>Achieve</Text> More.
          </Text>

          <Text style={styles.subtitle}>
            Achieve your goals and actually become{"\n"}the best version of yourself.
          </Text>

          {/* Value props */}
          <View style={styles.valueProps}>
            {VALUE_PROPS.map((text, i) => (
              <View key={i} style={styles.valuePropRow}>
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                </View>
                <Text style={styles.valuePropText}>{text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Bottom section: auth buttons */}
        <Animated.View style={[styles.bottomSection, { opacity: fadeAnim }]}>
          {/* Auth buttons */}
          <View style={styles.authButtons}>
            {isAppleSignInAvailable && (
              <Pressable
                style={[styles.appleButton, socialLoading && { opacity: 0.6 }]}
                onPress={appleSignIn}
                disabled={socialLoading}
              >
                <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                <Text style={styles.appleButtonText}>Continue with Apple</Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.googleButton, socialLoading && { opacity: 0.6 }]}
              onPress={() => googlePromptAsync()}
              disabled={socialLoading}
            >
              <Ionicons name="logo-google" size={20} color="#1F2937" />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </Pressable>

            <Pressable
              style={styles.emailButton}
              onPress={() => onComplete("login")}
            >
              <Ionicons name="mail-outline" size={20} color="#FFFFFF" />
              <Text style={styles.emailButtonText}>Sign in with email</Text>
            </Pressable>
          </View>

          {/* Create account */}
          <Text style={styles.signInText}>
            New here?{" "}
            <Text
              style={{ color: "rgba(255,255,255,0.9)", fontWeight: "600" }}
              onPress={() => onComplete("register")}
            >
              Create an account
            </Text>
          </Text>

          {/* Terms */}
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
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0D1117",
  },
  content: {
    flex: 1,
    zIndex: 2,
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },

  // Top
  topSection: {
    alignItems: "center",
    paddingTop: spacing.xl,
  },
  logoWrap: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    zIndex: 2,
  },
  logoGlow: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(99, 91, 255, 0.25)",
  },
  sparkle: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontSize: typography.xxxl,
    fontWeight: typography.bold,
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.5,
    lineHeight: 44,
  },
  subtitle: {
    fontSize: typography.base,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 22,
    marginTop: spacing.md,
  },
  valueProps: {
    marginTop: spacing.xl,
    gap: spacing.md,
    width: "100%",
    maxWidth: 340,
  },
  valuePropRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  valuePropText: {
    flex: 1,
    fontSize: typography.base,
    fontWeight: typography.medium,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 20,
  },

  // Bottom
  bottomSection: {
    alignItems: "center",
    gap: spacing.lg,
  },
  authButtons: {
    width: "100%",
    maxWidth: 340,
    gap: 12,
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
