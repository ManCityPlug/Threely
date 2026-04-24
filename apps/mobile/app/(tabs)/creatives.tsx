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
import { useSubscription } from "@/lib/subscription-context";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius, shadow } from "@/constants/theme";

const GOLD = "#D4A843";
const MAX_CONTENT_WIDTH = 600;

export default function CreativesTab() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 820;
  const wideStyle = isWide ? { maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" as const, width: "100%" as const } : undefined;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { hasPro } = useSubscription();

  // Until the weekly creative drop backend ships, treat every user as being in
  // "preview mode" — sample tiles, locked state. When the drop infra lands,
  // flip this to `!hasPro` so full Pro members see unlocked drops and
  // trial/non-Pro users see the preview UI.
  const inPreview = !hasPro || true;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={[styles.header, wideStyle]}>
        <View>
          <Text style={styles.title}>Creatives</Text>
          <Text style={styles.subtitle}>
            {inPreview ? "Sample previews · full drops unlock after Pro activates" : "Weekly drops · ready to launch"}
          </Text>
        </View>
        {!inPreview && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, wideStyle]}
        showsVerticalScrollIndicator={false}
      >
        {inPreview && (
          <View style={styles.previewBanner}>
            <Ionicons name="sparkles-outline" size={18} color={GOLD} />
            <Text style={styles.previewBannerText}>
              Your first full ad drop unlocks when your Pro plan activates.
            </Text>
          </View>
        )}

        {/* Locked sample tiles during preview; real cards replace these when
            the weekly drop backend lands. */}
        <Text style={styles.sectionHeader}>
          {inPreview ? "SAMPLE DROP" : "THIS WEEK'S DROP"}
        </Text>

        <View style={styles.grid}>
          {[
            { icon: "videocam-outline" as const, label: "UGC Video Ad" },
            { icon: "image-outline" as const, label: "Static Ad #1" },
            { icon: "image-outline" as const, label: "Static Ad #2" },
            { icon: "text-outline" as const, label: "Hook Variants" },
            { icon: "chatbox-outline" as const, label: "Ad Copy" },
            { icon: "create-outline" as const, label: "Caption Pack" },
          ].map((item) => (
            <View key={item.label} style={[styles.tile, inPreview && styles.tileLocked]}>
              <View style={styles.tileIconWrap}>
                <Ionicons name={item.icon} size={22} color={inPreview ? colors.textTertiary : GOLD} />
              </View>
              <Text style={[styles.tileLabel, inPreview && { color: colors.textSecondary }]}>
                {item.label}
              </Text>
              <View style={styles.tileActions}>
                {inPreview ? (
                  <View style={styles.tileLockPill}>
                    <Ionicons name="lock-closed" size={11} color={colors.textTertiary} />
                    <Text style={styles.tileLockText}>Locked</Text>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.tileAction}
                      activeOpacity={0.7}
                      onPress={() => {
                        if (Platform.OS !== "web") Haptics.selectionAsync();
                      }}
                    >
                      <Ionicons name="copy-outline" size={14} color={colors.text} />
                      <Text style={styles.tileActionText}>Copy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.tileAction}
                      activeOpacity={0.7}
                      onPress={() => {
                        if (Platform.OS !== "web") Haptics.selectionAsync();
                      }}
                    >
                      <Ionicons name="download-outline" size={14} color={colors.text} />
                      <Text style={styles.tileActionText}>Save</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.footnote}>
          {inPreview
            ? "Weekly drops begin the moment your Pro plan activates. Check back Friday."
            : "Fresh drops every Friday. Tap to copy or save."}
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
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
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
    newBadge: {
      backgroundColor: GOLD,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      marginTop: 6,
    },
    newBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      color: "#000",
      letterSpacing: 1.2,
    },
    scroll: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl,
    },
    previewBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.md,
      marginBottom: spacing.lg,
      backgroundColor: "rgba(212,168,67,0.08)",
      borderWidth: 1,
      borderColor: "rgba(212,168,67,0.25)",
      borderRadius: radius.lg,
    },
    previewBannerText: {
      flex: 1,
      fontSize: typography.sm,
      color: c.text,
      lineHeight: 20,
    },
    sectionHeader: {
      fontSize: typography.xs,
      fontWeight: "700",
      color: GOLD,
      letterSpacing: 1.5,
      marginBottom: spacing.sm,
      marginTop: 2,
    },
    grid: {
      gap: spacing.sm + 2,
    },
    tile: {
      padding: spacing.md,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      gap: spacing.sm,
      ...shadow.sm,
    },
    tileLocked: {
      opacity: 0.55,
    },
    tileIconWrap: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: "rgba(212,168,67,0.08)",
      alignItems: "center",
      justifyContent: "center",
    },
    tileLabel: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: c.text,
    },
    tileActions: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "center",
    },
    tileAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: radius.md,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
    },
    tileActionText: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.text,
    },
    tileLockPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: radius.md,
      backgroundColor: c.bgElevated,
    },
    tileLockText: {
      fontSize: typography.xs,
      fontWeight: typography.semibold,
      color: c.textTertiary,
    },
    footnote: {
      marginTop: spacing.lg,
      fontSize: typography.xs,
      color: c.textTertiary,
      textAlign: "center",
      lineHeight: 18,
    },
  });
}
