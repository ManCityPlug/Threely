import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
} from "react-native";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { typography, radius, spacing } from "@/constants/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
          props.multiline && styles.inputMultiline,
          style,
        ]}
        placeholderTextColor={colors.textTertiary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    wrapper: {
      gap: spacing.xs,
    },
    label: {
      fontSize: typography.sm,
      fontWeight: typography.medium,
      color: c.text,
    },
    input: {
      backgroundColor: c.card,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: radius.md,
      height: 48,
      paddingHorizontal: spacing.md,
      fontSize: typography.base,
      color: c.text,
    },
    inputFocused: {
      borderColor: c.borderFocus,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 2,
    },
    inputError: {
      borderColor: c.danger,
    },
    inputMultiline: {
      height: undefined,
      minHeight: 80,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      textAlignVertical: "top",
    },
    error: {
      fontSize: typography.xs,
      color: c.danger,
    },
  });
}
