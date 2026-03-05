import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform } from "react-native";

// ─── Staggered entrance ──────────────────────────────────────────────────────

/**
 * Returns an array of Animated.Values that stagger fadeIn + translateY.
 * Each value animates from 0 to 1; use it for opacity and translateY interpolation.
 */
export function useStaggeredEntrance(itemCount: number, delay = 80) {
  const anims = useRef<Animated.Value[]>([]);

  // Grow array if needed (but never shrink — avoids ref mutation issues)
  while (anims.current.length < itemCount) {
    anims.current.push(new Animated.Value(0));
  }

  useEffect(() => {
    // Reset all to 0
    anims.current.forEach((a) => a.setValue(0));

    const animations = anims.current.slice(0, itemCount).map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 350,
        delay: i * delay,
        useNativeDriver: true,
      })
    );

    const composite = Animated.stagger(delay, animations);
    composite.start();

    return () => {
      composite.stop();
    };
  }, [itemCount, delay]);

  return anims.current.slice(0, itemCount);
}

// ─── Count up animation ──────────────────────────────────────────────────────

/**
 * Animates a displayed number from 0 to `target` over `duration` ms.
 * Returns the current display value as a number.
 */
export function useCountUp(target: number, duration = 800): number {
  const [displayValue, setDisplayValue] = useState(0);
  const animRef = useRef(new Animated.Value(0));

  useEffect(() => {
    const anim = animRef.current;
    anim.setValue(0);

    const listener = anim.addListener(({ value }) => {
      setDisplayValue(Math.round(value));
    });

    const timing = Animated.timing(anim, {
      toValue: target,
      duration,
      useNativeDriver: false, // value listener requires JS-driven
    });
    timing.start();

    return () => {
      timing.stop();
      anim.removeListener(listener);
    };
  }, [target, duration]);

  return displayValue;
}

// ─── Scale press ─────────────────────────────────────────────────────────────

/**
 * Hook that returns onPressIn / onPressOut handlers and an Animated.Value for scale.
 * Apply the scale via transform: [{ scale: scaleValue }].
 *
 * Must be called as a hook (stable across renders). Replaces the old
 * `scalePress()` factory which required wrapping in useRef.
 */
export function useScalePress() {
  const scaleValue = useRef(new Animated.Value(1)).current;

  const handlers = useMemo(
    () => ({
      onPressIn: () => {
        Animated.spring(scaleValue, {
          toValue: 0.97,
          useNativeDriver: true,
          tension: 200,
          friction: 10,
        }).start();
      },
      onPressOut: () => {
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
          tension: 200,
          friction: 10,
        }).start();
      },
    }),
    [scaleValue]
  );

  return { scaleValue, ...handlers };
}

/**
 * @deprecated Use `useScalePress()` hook instead. This factory function
 * creates a new Animated.Value on every call and must be wrapped in useRef
 * to avoid re-creating it each render.
 */
export function scalePress() {
  const scaleValue = new Animated.Value(1);

  const onPressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  return { scaleValue, onPressIn, onPressOut };
}

// ─── Celebration haptic ──────────────────────────────────────────────────────

/**
 * Triggers a celebration haptic pattern.
 * Falls back to no-op on web or if expo-haptics is unavailable.
 */
export async function celebrationHaptic() {
  if (Platform.OS === "web") return;
  try {
    const Haptics = require("expo-haptics");
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Add a double-tap pattern for celebration
    setTimeout(async () => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // noop
      }
    }, 150);
  } catch {
    // expo-haptics not available — noop
  }
}
