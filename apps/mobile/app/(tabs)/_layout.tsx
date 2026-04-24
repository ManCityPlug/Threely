import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, Platform } from "react-native";
import { typography } from "@/constants/theme";
import { useTheme } from "@/lib/theme";
import { NotificationProvider, useNotifications } from "@/lib/notification-context";

const IS_TABLET = Platform.OS === "ios" && Platform.isPad;
const GOLD_ACTIVE = "#D4A843";
const ICON_BG_SIZE = IS_TABLET ? 36 : 32;

function TabIcon({
  focused,
  name,
  focusedName,
  size,
  inactiveColor,
}: {
  focused: boolean;
  name: string;
  focusedName: string;
  size: number;
  inactiveColor: string;
}) {
  return (
    <View style={{
      width: ICON_BG_SIZE,
      height: ICON_BG_SIZE,
      borderRadius: ICON_BG_SIZE / 2,
      backgroundColor: focused ? "rgba(212,168,67,0.15)" : "transparent",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <Ionicons
        name={(focused ? focusedName : name) as any}
        size={size - 2}
        color={focused ? GOLD_ACTIVE : inactiveColor}
      />
    </View>
  );
}

function TabsContent() {
  const { unreadCount } = useNotifications();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: GOLD_ACTIVE,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: IS_TABLET ? 8 : 4,
          height: IS_TABLET ? 72 : 60,
        },
        tabBarLabelStyle: {
          fontSize: IS_TABLET ? typography.sm : typography.xs,
          fontWeight: typography.medium,
        },
      }}
    >
      {/* Home — primary dashboard. The file is still `index.tsx` so it's the
          initial route; the label is "Home" because it combines the dashboard
          cards AND the moves list. A future session should factor the moves
          list into a separate Moves tab per spec. */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused, size }) => (
            <TabIcon focused={focused} name="flash-outline" focusedName="flash" size={size} inactiveColor={colors.textTertiary} />
          ),
        }}
      />
      {/* Goals — kept functional for active users managing their launches.
          Hidden from marketing copy but still accessible via this tab. */}
      <Tabs.Screen
        name="goals"
        options={{
          title: "Launches",
          tabBarIcon: ({ focused, size }) => (
            <TabIcon focused={focused} name="aperture-outline" focusedName="aperture" size={size} inactiveColor={colors.textTertiary} />
          ),
        }}
      />
      {/* Creatives — weekly ad drop inbox. Shows sample/locked tiles until
          the Pro weekly drop backend ships. */}
      <Tabs.Screen
        name="creatives"
        options={{
          title: "Creatives",
          tabBarIcon: ({ focused, size }) => (
            <TabIcon focused={focused} name="color-palette-outline" focusedName="color-palette" size={size} inactiveColor={colors.textTertiary} />
          ),
        }}
      />
      {/* Growth — learning center with short ecom lessons. */}
      <Tabs.Screen
        name="growth"
        options={{
          title: "Growth",
          tabBarIcon: ({ focused, size }) => (
            <TabIcon focused={focused} name="trending-up-outline" focusedName="trending-up" size={size} inactiveColor={colors.textTertiary} />
          ),
        }}
      />
      {/* Account — formerly Profile. Single place for plan + support + logout. */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Account",
          tabBarIcon: ({ focused, size }) => (
            <View style={{
              width: ICON_BG_SIZE,
              height: ICON_BG_SIZE,
              borderRadius: ICON_BG_SIZE / 2,
              backgroundColor: focused ? "rgba(212,168,67,0.15)" : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Ionicons
                name={focused ? "person" : "person-outline"}
                size={size - 2}
                color={focused ? GOLD_ACTIVE : colors.textTertiary}
              />
              {unreadCount > 0 && (
                <View style={{
                  position: "absolute",
                  top: IS_TABLET ? -2 : -1,
                  right: IS_TABLET ? -4 : -3,
                  minWidth: IS_TABLET ? 18 : 14,
                  height: IS_TABLET ? 18 : 14,
                  borderRadius: IS_TABLET ? 9 : 7,
                  backgroundColor: "#ef4444",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: IS_TABLET ? 3 : 2,
                }}>
                  <Text style={{ color: "#fff", fontSize: IS_TABLET ? 10 : 8, fontWeight: "700" }}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabsLayout() {
  return (
    <NotificationProvider>
      <TabsContent />
    </NotificationProvider>
  );
}
