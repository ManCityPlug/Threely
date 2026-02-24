import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { typography } from "@/constants/theme";

interface ProgressRingProps {
  percentage: number;
  size?: number;
  color?: string;
}

/**
 * A simple circular progress indicator using two half-circle clips.
 * Shows the percentage text in the center.
 */
export function ProgressRing({ percentage, size = 40, color }: ProgressRingProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, size, color ?? colors.primary), [colors, size, color]);

  const pct = Math.min(100, Math.max(0, percentage));
  const borderW = Math.max(3, size * 0.1);

  // Rotation degrees for the two halves
  // First half covers 0-180deg, second half covers 180-360deg
  const rightRotation = pct <= 50 ? (pct / 50) * 180 : 180;
  const leftRotation = pct > 50 ? ((pct - 50) / 50) * 180 : 0;

  const ringColor = color ?? colors.primary;
  const trackColor = colors.border;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Track (background circle) */}
      <View
        style={[
          styles.track,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: borderW,
            borderColor: trackColor,
          },
        ]}
      />

      {/* Right half (0-180 degrees) */}
      <View style={[styles.halfClip, { width: size / 2, height: size, left: size / 2 }]}>
        <View
          style={[
            styles.halfCircle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: borderW,
              borderColor: ringColor,
              left: -(size / 2),
              transform: [{ rotate: `${rightRotation}deg` }],
            },
          ]}
        />
      </View>

      {/* Left half (180-360 degrees) */}
      {pct > 50 && (
        <View style={[styles.halfClip, { width: size / 2, height: size, left: 0 }]}>
          <View
            style={[
              styles.halfCircle,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: borderW,
                borderColor: ringColor,
                left: 0,
                transform: [{ rotate: `${leftRotation}deg` }],
              },
            ]}
          />
        </View>
      )}

      {/* Center text */}
      <View style={styles.centerText}>
        <Text style={[styles.percentText, { fontSize: size * 0.25, color: ringColor }]}>
          {Math.round(pct)}%
        </Text>
      </View>
    </View>
  );
}

function createStyles(c: Colors, size: number, ringColor: string) {
  return StyleSheet.create({
    container: {
      position: "relative",
    },
    track: {
      position: "absolute",
    },
    halfClip: {
      position: "absolute",
      top: 0,
      overflow: "hidden",
    },
    halfCircle: {
      position: "absolute",
      top: 0,
      borderLeftColor: "transparent",
      borderBottomColor: "transparent",
    },
    centerText: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    percentText: {
      fontWeight: typography.bold as "700",
    },
  });
}
