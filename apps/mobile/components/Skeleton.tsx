import React, { useEffect, useRef, useMemo } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, radius } from "@/constants/theme";

// ─── Shimmer hook ────────────────────────────────────────────────────────────

function useShimmer() {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return anim;
}

// ─── SkeletonLine ────────────────────────────────────────────────────────────

interface SkeletonLineProps {
  width?: number | `${number}%`;
  height?: number;
  style?: object;
}

export function SkeletonLine({ width = "100%", height = 14, style }: SkeletonLineProps) {
  const { colors } = useTheme();
  const opacity = useShimmer();

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: height / 2,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

// ─── SkeletonCard ────────────────────────────────────────────────────────────

interface SkeletonCardProps {
  style?: object;
}

export function SkeletonCard({ style }: SkeletonCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createCardStyles(colors), [colors]);
  const opacity = useShimmer();

  return (
    <Animated.View style={[styles.card, { opacity }, style]}>
      {/* Checkbox placeholder */}
      <View style={styles.row}>
        <View style={styles.checkboxPlaceholder} />
        <View style={styles.textArea}>
          <View style={styles.titleLine} />
          <View style={styles.descLine} />
        </View>
        <View style={styles.badge} />
      </View>
    </Animated.View>
  );
}

// ─── SkeletonStatCard ────────────────────────────────────────────────────────

interface SkeletonStatCardProps {
  style?: object;
}

export function SkeletonStatCard({ style }: SkeletonStatCardProps) {
  const { colors } = useTheme();
  const opacity = useShimmer();

  return (
    <Animated.View
      style={[
        {
          flex: 1,
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: spacing.md,
          alignItems: "center",
          gap: spacing.xs,
          borderWidth: 1,
          borderColor: colors.border,
          opacity,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.md,
          backgroundColor: colors.border,
          marginBottom: 2,
        }}
      />
      <View
        style={{
          width: 40,
          height: 22,
          borderRadius: 4,
          backgroundColor: colors.border,
        }}
      />
      <View
        style={{
          width: 60,
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.border,
        }}
      />
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createCardStyles(c: Colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    checkboxPlaceholder: {
      width: 24,
      height: 24,
      borderRadius: 7,
      backgroundColor: c.border,
      flexShrink: 0,
    },
    textArea: {
      flex: 1,
      gap: spacing.xs,
    },
    titleLine: {
      width: "80%",
      height: 14,
      borderRadius: 4,
      backgroundColor: c.border,
    },
    descLine: {
      width: "60%",
      height: 11,
      borderRadius: 4,
      backgroundColor: c.border,
    },
    badge: {
      width: 40,
      height: 18,
      borderRadius: radius.full,
      backgroundColor: c.border,
      flexShrink: 0,
    },
  });
}
