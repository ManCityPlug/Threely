import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, useWindowDimensions, View } from "react-native";

const PARTICLE_COUNT = 45;
const CONFETTI_COLORS = [
  "#635BFF", // primary
  "#3ECF8E", // success
  "#F59E0B", // warning
  "#FF4D4F", // danger
  "#7B74FF", // primary light
  "#00D4AA", // teal
  "#FF6B6B", // coral
  "#FFD93D", // yellow
];

interface ConfettiProps {
  active: boolean;
}

interface Particle {
  /** Fraction of screen width (0..1) so position adapts to dimension changes */
  xFraction: number;
  width: number;
  height: number;
  color: string;
  spinSpeed: number;
  swayAmplitude: number;
  swaySpeed: number;
}

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    xFraction: Math.random(),
    width: 6 + Math.random() * 6,
    height: 10 + Math.random() * 8,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    spinSpeed: 1 + Math.random() * 3,
    swayAmplitude: 20 + Math.random() * 40,
    swaySpeed: 0.5 + Math.random() * 1.5,
  }));
}

export function Confetti({ active }: ConfettiProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const fallAnims = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => new Animated.Value(0))
  ).current;
  const particles = useRef(generateParticles()).current;
  const hasRun = useRef(false);

  useEffect(() => {
    if (!active) {
      hasRun.current = false;
      fallAnims.forEach((a) => a.setValue(0));
      return;
    }

    if (hasRun.current) return;
    hasRun.current = true;

    // Regenerate particles for randomness each time
    const newParticles = generateParticles();
    newParticles.forEach((p, i) => {
      particles[i] = p;
    });

    // Reset all
    fallAnims.forEach((a) => a.setValue(0));

    // Stagger start for each particle
    const animations = fallAnims.map((anim) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 1800 + Math.random() * 600,
        delay: Math.random() * 400,
        useNativeDriver: true,
      })
    );

    const composite = Animated.parallel(animations);
    composite.start();

    return () => {
      composite.stop();
    };
  }, [active]);

  if (!active) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((p, i) => {
        const translateY = fallAnims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [-20, screenHeight + 50],
        });

        const translateX = fallAnims[i].interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: [
            0,
            p.swayAmplitude,
            0,
            -p.swayAmplitude,
            0,
          ],
        });

        const rotate = fallAnims[i].interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", `${360 * p.spinSpeed}deg`],
        });

        const opacity = fallAnims[i].interpolate({
          inputRange: [0, 0.1, 0.85, 1],
          outputRange: [0, 1, 1, 0],
        });

        return (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                left: p.xFraction * screenWidth,
                width: p.width,
                height: p.height,
                backgroundColor: p.color,
                borderRadius: p.width / 4,
                opacity,
                transform: [{ translateY }, { translateX }, { rotate }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
  },
  particle: {
    position: "absolute",
    top: 0,
  },
});
