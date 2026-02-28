import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PARTICLE_COUNT = 20;

interface ParticleData {
  x: number;
  y: number;
  size: number;
  opacity: number;
  floatRange: number;
  duration: number;
  delay: number;
}

function generateParticles(): ParticleData[] {
  // Keep particles in the upper 80% of the screen to avoid the bottom bar
  const maxY = SCREEN_HEIGHT * 0.8;
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random() * SCREEN_WIDTH,
    y: Math.random() * maxY,
    size: 3 + Math.random() * 5,
    opacity: 0.1 + Math.random() * 0.3,
    floatRange: 15 + Math.random() * 25,
    duration: 2500 + Math.random() * 2000,
    delay: Math.random() * 2000,
  }));
}

export function FloatingParticles() {
  const particles = useRef(generateParticles()).current;
  const anims = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
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

      loop.start();
    });
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
              left: p.x,
              top: p.y,
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
  particle: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
  },
});
