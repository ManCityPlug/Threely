import { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases from "react-native-purchases";
import { subscriptionApi } from "@/lib/api";

export type PaywallType = "fullscreen" | "bottomsheet" | null;

interface SubscriptionContextValue {
  hasPro: boolean;
  isLimitedMode: boolean;
  walkthroughActive: boolean;
  loaded: boolean;
  paywallType: PaywallType;
  showFullScreenPaywall: () => void;
  showBottomSheetPaywall: () => void;
  dismissPaywall: () => void;
  setWalkthroughActive: (v: boolean) => void;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  hasPro: true,
  isLimitedMode: false,
  walkthroughActive: false,
  loaded: false,
  paywallType: null,
  showFullScreenPaywall: () => {},
  showBottomSheetPaywall: () => {},
  dismissPaywall: () => {},
  setWalkthroughActive: () => {},
  refreshSubscription: async () => {},
});

export function useSubscription() {
  return useContext(SubscriptionContext);
}

interface SubscriptionProviderProps {
  userId: string | null;
  children: React.ReactNode;
}

export function SubscriptionProvider({ userId, children }: SubscriptionProviderProps) {
  const [hasPro, setHasPro] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [walkthroughActive, setWalkthroughActiveState] = useState(false);
  const [paywallType, setPaywallType] = useState<PaywallType>(null);

  const checkSubscription = useCallback(async () => {
    if (!userId) return;

    try {
      // 1. Check cached status
      const cached = await AsyncStorage.getItem("@threely_subscription_status");
      if (cached === "trialing" || cached === "active") {
        setHasPro(true);
        setLoaded(true);
        return;
      }

      // 2. Check RevenueCat entitlements
      try {
        const customerInfo = await Purchases.getCustomerInfo();
        const isPro = typeof customerInfo.entitlements.active["pro"] !== "undefined";
        if (isPro) {
          await AsyncStorage.setItem("@threely_subscription_status", "active");
          setHasPro(true);
          setLoaded(true);
          return;
        }
      } catch {
        // RevenueCat unavailable — fall through
      }

      // 3. Fallback: backend check
      try {
        const { status } = await subscriptionApi.status();
        if (status === "trialing" || status === "active") {
          await AsyncStorage.setItem("@threely_subscription_status", status);
          setHasPro(true);
          setLoaded(true);
          return;
        }
      } catch {
        // Backend unreachable — be lenient
        setLoaded(true);
        return;
      }

      // No valid subscription
      setHasPro(false);
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      checkSubscription();
    }
  }, [userId, checkSubscription]);

  const showFullScreenPaywall = useCallback(() => setPaywallType("fullscreen"), []);
  const showBottomSheetPaywall = useCallback(() => setPaywallType("bottomsheet"), []);
  const dismissPaywall = useCallback(() => setPaywallType(null), []);
  const refreshSubscription = useCallback(async () => { await checkSubscription(); }, [checkSubscription]);
  const setWalkthroughActive = useCallback((v: boolean) => setWalkthroughActiveState(v), []);

  const isLimitedMode = !hasPro && !walkthroughActive;

  return (
    <SubscriptionContext.Provider
      value={{
        hasPro,
        isLimitedMode,
        walkthroughActive,
        loaded,
        paywallType,
        showFullScreenPaywall,
        showBottomSheetPaywall,
        dismissPaywall,
        setWalkthroughActive,
        refreshSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}
