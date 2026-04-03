import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import {
  goalCategories,
  type GoalCategory,
} from "@/constants/goal-templates";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";

interface GoalTemplatesProps {
  onSelect: (category: GoalCategory) => void;
  onClose: () => void;
  onOther?: () => void;
  closeLabel?: string;
}

export function GoalTemplates({ onSelect, onClose, onOther, closeLabel = "Back" }: GoalTemplatesProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>What is your goal?</Text>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.closeBtnWrap}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.closeBtn}>{closeLabel}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>
        Pick a category and Threely Intelligence will ask personalized questions
        to build your perfect plan.
      </Text>

      {/* Two category cards side by side */}
      <View style={styles.row}>
        {goalCategories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={styles.categoryCard}
            onPress={() => onSelect(cat)}
            activeOpacity={0.75}
          >
            <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
            <Text style={styles.categoryLabel}>{cat.label}</Text>
            <Text style={styles.categoryDesc} numberOfLines={2}>
              {cat.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* "Something else" full-width */}
      {onOther && (
        <TouchableOpacity
          style={[styles.categoryCard, styles.otherCard]}
          onPress={onOther}
          activeOpacity={0.75}
        >
          <Text style={styles.categoryEmoji}>✏️</Text>
          <Text style={styles.categoryLabel}>Something else</Text>
          <Text style={styles.categoryDesc} numberOfLines={2}>
            Let me describe my own goal
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    title: {
      fontSize: typography.xl,
      fontWeight: typography.bold as "700",
      color: c.text,
      letterSpacing: -0.3,
    },
    closeBtnWrap: {
      minHeight: 44,
      justifyContent: "center" as const,
      paddingHorizontal: spacing.xs,
    },
    closeBtn: {
      fontSize: typography.base,
      fontWeight: typography.semibold as "600",
      color: c.primary,
    },
    subtitle: {
      fontSize: typography.sm,
      color: c.textSecondary,
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    row: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    categoryCard: {
      flex: 1,
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 140,
      ...shadow.sm,
    },
    categoryEmoji: {
      fontSize: 36,
      marginBottom: spacing.sm,
    },
    categoryLabel: {
      fontSize: typography.base,
      fontWeight: typography.semibold as "600",
      color: c.text,
      marginBottom: 4,
    },
    categoryDesc: {
      fontSize: typography.xs,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 16,
    },
    otherCard: {
      borderStyle: "dashed",
    },
  });
}
