/**
 * Payment deep-link handler.
 * Redirects to the main app and shows the bottom-sheet paywall.
 */

import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { useSubscription } from "@/lib/subscription-context";

export default function PaymentScreen() {
  const router = useRouter();
  const { showBottomSheetPaywall } = useSubscription();

  useEffect(() => {
    // Navigate first, then show paywall after navigation settles
    router.replace("/(tabs)");
    const timer = setTimeout(() => {
      showBottomSheetPaywall();
    }, 300);
    return () => clearTimeout(timer);
  }, [router, showBottomSheetPaywall]);

  return (
    <View style={{ flex: 1, backgroundColor: "#1A1040", alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color="#FFFFFF" size="large" />
    </View>
  );
}
