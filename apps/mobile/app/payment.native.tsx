/**
 * Payment deep-link handler.
 * Redirects to the main app and shows the bottom-sheet paywall.
 */

import { useEffect } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useSubscription } from "@/lib/subscription-context";

export default function PaymentScreen() {
  const router = useRouter();
  const { showBottomSheetPaywall } = useSubscription();

  useEffect(() => {
    router.replace("/(tabs)");
    showBottomSheetPaywall();
  }, [router, showBottomSheetPaywall]);

  return <View />;
}
