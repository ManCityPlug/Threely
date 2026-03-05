import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, Platform } from "react-native";
import { colors, typography } from "@/constants/theme";
import { NotificationProvider, useNotifications } from "@/lib/notification-context";

const IS_TABLET = Platform.OS === "ios" && Platform.isPad;

function TabsContent() {
  const { unreadCount } = useNotifications();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
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
            <Ionicons
              name={focused ? "flash" : "flash-outline"}
              size={size}
              color={focused ? "#F59E0B" : colors.textTertiary}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: "Goals",
          tabBarIcon: ({ focused, size }) => (
            <Ionicons
              name={focused ? "disc" : "disc-outline"}
              size={size}
              color={focused ? "#EF4444" : colors.textTertiary}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused, size }) => (
            <View>
              <Ionicons
                name={focused ? "person" : "person-outline"}
                size={size}
                color={focused ? "#635BFF" : colors.textTertiary}
              />
              {unreadCount > 0 && (
                <View style={{
                  position: "absolute",
                  top: IS_TABLET ? -6 : -4,
                  right: IS_TABLET ? -10 : -8,
                  minWidth: IS_TABLET ? 20 : 16,
                  height: IS_TABLET ? 20 : 16,
                  borderRadius: IS_TABLET ? 10 : 8,
                  backgroundColor: "#ef4444",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: IS_TABLET ? 4 : 3,
                }}>
                  <Text style={{ color: "#fff", fontSize: IS_TABLET ? 11 : 9, fontWeight: "700" }}>
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
