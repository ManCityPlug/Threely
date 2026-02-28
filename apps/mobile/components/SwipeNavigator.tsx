import React from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useRouter } from "expo-router";

const TAB_ROUTES = ["/(tabs)", "/(tabs)/goals", "/(tabs)/profile"] as const;

interface SwipeNavigatorProps {
  children: React.ReactNode;
  currentIndex: number;
}

/**
 * Wraps a tab screen's content and detects horizontal swipe gestures
 * to navigate between tabs. Uses velocity threshold to avoid conflicts
 * with vertical scrolling.
 */
export function SwipeNavigator({ children, currentIndex }: SwipeNavigatorProps) {
  const router = useRouter();

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-30, 30])
    .failOffsetY([-15, 15])
    .onEnd((event) => {
      const { velocityX, translationX } = event;
      const MIN_VELOCITY = 400;
      const MIN_DISTANCE = 50;

      if (velocityX < -MIN_VELOCITY && translationX < -MIN_DISTANCE && currentIndex < TAB_ROUTES.length - 1) {
        router.navigate(TAB_ROUTES[currentIndex + 1] as never);
      } else if (velocityX > MIN_VELOCITY && translationX > MIN_DISTANCE && currentIndex > 0) {
        router.navigate(TAB_ROUTES[currentIndex - 1] as never);
      }
    });

  return (
    <GestureDetector gesture={swipe}>
      <View style={{ flex: 1 }}>
        {children}
      </View>
    </GestureDetector>
  );
}
