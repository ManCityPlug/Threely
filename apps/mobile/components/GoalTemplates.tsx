import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Text style={styles.closeBtn}>{closeLabel}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>
        Pick a category and Threely Intelligence will ask personalized questions
        to build your perfect plan.
      </Text>

      {/* Category grid */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.gridContent}
      >
        <View style={styles.grid}>
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

          {/* "Something else" as a grid card */}
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
      </ScrollView>
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
    gridContent: {
      paddingBottom: spacing.xl,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    categoryCard: {
      width: "47.5%" as any,
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      alignItems: "center",
      ...shadow.sm,
    },
    categoryEmoji: {
      fontSize: 32,
      marginBottom: spacing.xs,
    },
    categoryLabel: {
      fontSize: typography.base,
      fontWeight: typography.semibold as "600",
      color: c.text,
      marginBottom: 2,
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
