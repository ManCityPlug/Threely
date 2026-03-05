import { useMemo } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
} from "react-native";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { typography, radius, spacing } from "@/constants/theme";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "filled" | "outline" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  onPress,
  variant = "filled",
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variant === "filled" && styles.filled,
        variant === "outline" && styles.outline,
        variant === "ghost" && styles.ghost,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      accessibilityLabel={title}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "filled" ? colors.primaryText : colors.primary}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.label,
            variant === "filled" && styles.labelFilled,
            variant === "outline" && styles.labelOutline,
            variant === "ghost" && styles.labelGhost,
            isDisabled && styles.labelDisabled,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    base: {
      height: 48,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
    },
    filled: {
      backgroundColor: c.primary,
    },
    outline: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: c.border,
    },
    ghost: {
      backgroundColor: "transparent",
    },
    disabled: {
      opacity: 0.5,
    },
    label: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      letterSpacing: -0.2,
    },
    labelFilled: {
      color: c.primaryText,
    },
    labelOutline: {
      color: c.text,
    },
    labelGhost: {
      color: c.primary,
    },
    labelDisabled: {
      opacity: 0.6,
    },
  });
}
