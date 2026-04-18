import { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Goal } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius } from "@/constants/theme";

interface GoalCardProps {
  goal: Goal;
  onPress?: () => void;
  onDelete?: () => void;
}

// Minimal goal card — title + trash icon (matches web's minimal row).
export function GoalCard({ goal, onPress, onDelete }: GoalCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={styles.title} numberOfLines={1}>
        {goal.title}
      </Text>

      {onDelete && (
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); onDelete(); }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.deleteBtn}
          activeOpacity={0.6}
        >
          <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      minHeight: 56,
    },
    title: {
      flex: 1,
      minWidth: 0,
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: c.text,
    },
    deleteBtn: {
      padding: 6,
      marginLeft: spacing.sm,
      minWidth: 36,
      minHeight: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.sm,
      flexShrink: 0,
    },
  });
}
