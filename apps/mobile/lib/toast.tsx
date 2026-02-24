import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastVariant = "success" | "error" | "info";

interface ToastMessage {
  id: number;
  text: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (text: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

// ─── Toast Item ───────────────────────────────────────────────────────────────

function ToastItem({
  message,
  onDismiss,
}: {
  message: ToastMessage;
  onDismiss: (id: number) => void;
}) {
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 120,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    dismissTimer.current = setTimeout(() => {
      dismiss();
    }, 3000);

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  function dismiss() {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss(message.id));
  }

  const bgColor =
    message.variant === "success"
      ? colors.success
      : message.variant === "error"
        ? colors.danger
        : colors.primary;

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: bgColor,
          transform: [{ translateY }],
          opacity,
          ...shadow.md,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.toastInner}
        onPress={dismiss}
        activeOpacity={0.9}
      >
        <Text style={styles.toastText} numberOfLines={2}>
          {message.text}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const idCounter = useRef(0);

  const showToast = useCallback((text: string, variant: ToastVariant = "info") => {
    const id = ++idCounter.current;
    setMessages((prev) => [...prev, { id, text, variant }]);
  }, []);

  const handleDismiss = useCallback((id: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View
        style={[styles.container, { top: insets.top + spacing.sm }]}
        pointerEvents="box-none"
      >
        {messages.map((msg) => (
          <ToastItem key={msg.id} message={msg} onDismiss={handleDismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    alignItems: "center",
  },
  toast: {
    borderRadius: radius.lg,
    marginBottom: spacing.xs,
    width: "100%",
    overflow: "hidden",
  },
  toastInner: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  toastText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold as "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
});
