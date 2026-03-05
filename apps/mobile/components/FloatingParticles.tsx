import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, useWindowDimensions, View } from "react-native";

const PARTICLE_COUNT = 20;

interface ParticleData {
  /** 0-1 fraction of screen width */
  xFrac: number;
  /** 0-1 fraction of screen height (capped at 80%) */
  yFrac: number;
  size: number;
  opacity: number;
  floatRange: number;
  duration: number;
  delay: number;
}

function generateParticles(): ParticleData[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    xFrac: Math.random(),
    yFrac: Math.random() * 0.8,
    size: 3 + Math.random() * 5,
    opacity: 0.1 + Math.random() * 0.3,
    floatRange: 15 + Math.random() * 25,
    duration: 2500 + Math.random() * 2000,
    delay: Math.random() * 2000,
  }));
}

export function FloatingParticles() {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const particles = useRef(generateParticles()).current;
  const anims = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const loops: Animated.CompositeAnimation[] = [];

    anims.forEach((anim, i) => {
      const { duration, delay } = particles[i];

      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration,
            useNativeDriver: true,
          }),
        ])
      );

      loops.push(loop);
      loop.start();
    });

    return () => {
      loops.forEach((l) => l.stop());
    };
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((p, i) => {
        const translateY = anims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [0, -p.floatRange],
        });

        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: p.xFrac * SCREEN_WIDTH,
              top: p.yFrac * SCREEN_HEIGHT,
              transform: [{ translateY }],
            }}
          >
            <View
              style={{
                width: p.size,
                height: p.size,
                borderRadius: p.size / 2,
                backgroundColor: "#FFFFFF",
                opacity: p.opacity,
              }}
            />
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
});
