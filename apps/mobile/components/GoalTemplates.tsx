import { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import {
  FUNNEL_CATEGORIES,
  type FunnelCategory,
} from "@/constants/goal-templates";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";

interface GoalTemplatesProps {
  onSelect: (category: FunnelCategory) => void;
  onClose: () => void;
}

// Category picker for the Add Goal funnel: 3 stacked cards (Business / Health / Other).
export function GoalTemplates({ onSelect, onClose }: GoalTemplatesProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.closeBtnWrap}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.closeBtn}>{"\u2715"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>What do you want to achieve?</Text>
      <Text style={styles.subtitle}>Pick a category to get started</Text>

      <View style={styles.list}>
        {FUNNEL_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={styles.categoryCard}
            onPress={() => onSelect(cat.id)}
            activeOpacity={0.75}
          >
            <Text style={styles.categoryLabel}>{cat.label}</Text>
            <Text style={styles.categorySubtitle}>{cat.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    closeBtnWrap: {
      minHeight: 44,
      minWidth: 44,
      justifyContent: "center",
      alignItems: "center",
    },
    closeBtn: {
      fontSize: 22,
      color: c.textSecondary,
      fontWeight: typography.medium as "500",
    },
    title: {
      fontSize: typography.xxl,
      fontWeight: typography.bold as "700",
      color: c.text,
      letterSpacing: -0.5,
      textAlign: "center",
      marginBottom: spacing.xs,
    },
    subtitle: {
      fontSize: typography.base,
      color: c.textSecondary,
      textAlign: "center",
      marginBottom: spacing.xl,
    },
    list: {
      gap: spacing.sm,
    },
    categoryCard: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      minHeight: 80,
      justifyContent: "center",
      ...shadow.sm,
    },
    categoryLabel: {
      fontSize: typography.lg,
      fontWeight: typography.bold as "700",
      color: c.text,
      marginBottom: 4,
    },
    categorySubtitle: {
      fontSize: typography.sm,
      color: c.textSecondary,
      lineHeight: 20,
    },
  });
}
