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
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ focused, size }) => (
            <TabIcon focused={focused} name="flash-outline" focusedName="flash" size={size} inactiveColor={colors.textTertiary} />
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: "Goals",
          tabBarIcon: ({ focused, size }) => (
            <TabIcon focused={focused} name="aperture-outline" focusedName="aperture" size={size} inactiveColor={colors.textTertiary} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
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
