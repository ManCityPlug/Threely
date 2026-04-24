import { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";

const GOLD = "#D4A843";
const MAX_CONTENT_WIDTH = 600;

type GrowthLesson = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
};

const LESSONS: GrowthLesson[] = [
  {
    icon: "rocket-outline",
    title: "How to get your first sale",
    desc: "The three levers that matter on day one — traffic, product page, and price anchor.",
  },
  {
    icon: "trending-up-outline",
    title: "Improve conversion rate",
    desc: "Small tweaks to your headline, hero image, and trust badges that move the needle.",
  },
  {
    icon: "bag-check-outline",
    title: "Winning product pages",
    desc: "What every high-converting product page includes — scan it for gaps in yours.",
  },
  {
    icon: "megaphone-outline",
    title: "Ad basics",
    desc: "The three ad angles that work for beginners, and which creative to launch first.",
  },
  {
    icon: "pulse-outline",
    title: "Scaling basics",
    desc: "When to raise budget, when to pause, and when to launch a new creative.",
  },
];

export default function GrowthTab() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 820;
  const wideStyle = isWide ? { maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" as const, width: "100%" as const } : undefined;
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={[styles.header, wideStyle]}>
        <Text style={styles.title}>Growth</Text>
        <Text style={styles.subtitle}>Short lessons. Real moves.</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, wideStyle]}
        showsVerticalScrollIndicator={false}
      >
        {LESSONS.map((lesson) => (
          <TouchableOpacity
            key={lesson.title}
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              // Lesson content is coming in a later session. For now the tap
              // just gives a soft haptic — the cards exist so the tab has
              // real visual weight while the content pipeline is built.
            }}
          >
            <View style={styles.cardIconWrap}>
              <Ionicons name={lesson.icon} size={22} color={GOLD} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{lesson.title}</Text>
              <Text style={styles.cardDesc}>{lesson.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        ))}

        <Text style={styles.footnote}>
          New lessons added every month. Tap a card to start.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.bg,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    title: {
      fontSize: typography.xxxl,
      fontWeight: typography.bold,
      color: c.text,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: typography.sm,
      color: c.textSecondary,
      marginTop: 2,
    },
    scroll: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl,
      gap: spacing.sm + 2,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      ...shadow.sm,
    },
    cardIconWrap: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: "rgba(212,168,67,0.08)",
      alignItems: "center",
      justifyContent: "center",
    },
    cardTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: c.text,
      marginBottom: 2,
    },
    cardDesc: {
      fontSize: typography.xs,
      color: c.textSecondary,
      lineHeight: 18,
    },
    footnote: {
      marginTop: spacing.lg,
      fontSize: typography.xs,
      color: c.textTertiary,
      textAlign: "center",
    },
  });
}
