import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL, PurchasesPackage, CustomerInfo } from "react-native-purchases";
import { subscriptionApi } from "@/lib/api";

const RC_IOS_KEY = "appl_ASqjSLtAtKmDGSFhhFHZbbahFSF";

interface SubscriptionContextValue {
  hasPro: boolean;
  isLimitedMode: boolean;
  walkthroughActive: boolean;
  loaded: boolean;
  billingDate: string | null;
  currentPackage: PurchasesPackage | null;
  setWalkthroughActive: (v: boolean) => void;
  refreshSubscription: () => Promise<void>;
  purchasePro: () => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  hasPro: true,
  isLimitedMode: false,
  walkthroughActive: false,
  loaded: false,
  billingDate: null,
  currentPackage: null,
  setWalkthroughActive: () => {},
  refreshSubscription: async () => {},
  purchasePro: async () => false,
  restorePurchases: async () => false,
});

export function useSubscription() {
  return useContext(SubscriptionContext);
}

interface SubscriptionProviderProps {
  userId: string | null;
  children: React.ReactNode;
}

let rcConfigured = false;

export function SubscriptionProvider({ userId, children }: SubscriptionProviderProps) {
  const [hasPro, setHasPro] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [walkthroughActive, setWalkthroughActiveState] = useState(false);
  const [billingDate, setBillingDate] = useState<string | null>(null);
  const [currentPackage, setCurrentPackage] = useState<PurchasesPackage | null>(null);

  // Initialize RevenueCat
  useEffect(() => {
    if (rcConfigured || Platform.OS === "web") return;
    try {
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      Purchases.configure({ apiKey: RC_IOS_KEY });
      rcConfigured = true;
    } catch {
      // RevenueCat init failed — continue without it
    }
  }, []);

  // Login/logout RevenueCat user
  useEffect(() => {
    if (Platform.OS === "web" || !rcConfigured) return;
    if (userId) {
      Purchases.logIn(userId).catch(() => {});
    } else {
      Purchases.logOut().catch(() => {});
    }
  }, [userId]);

  // Load available packages
  useEffect(() => {
    if (Platform.OS === "web" || !rcConfigured) return;
    (async () => {
      try {
        const offerings = await Purchases.getOfferings();
        const monthly = offerings.current?.monthly ?? offerings.current?.availablePackages?.[0] ?? null;
        setCurrentPackage(monthly);
      } catch {
        // Offerings load failed
      }
    })();
  }, []);

  const checkSubscription = useCallback(async () => {
    if (!userId) return;

    // Check RevenueCat first (for IAP purchases)
    if (Platform.OS !== "web" && rcConfigured) {
      try {
        const customerInfo = await Purchases.getCustomerInfo();
        if (customerInfo.entitlements.active["threely Pro"] || customerInfo.entitlements.active["pro"]) {
          setHasPro(true);
          setLoaded(true);
          return;
        }
      } catch {
        // RC check failed — fall through to backend
      }
    }

    // Check backend (for Stripe / web subscriptions)
    try {
      const subRes = await subscriptionApi.status();
      if (subRes.status === "trialing" || subRes.status === "active") {
        const bDate = subRes.status === "trialing" ? subRes.trialEndsAt : subRes.currentPeriodEnd;
        if (bDate) setBillingDate(bDate);
        setHasPro(true);
        setLoaded(true);
        return;
      }

      setHasPro(false);
      setLoaded(true);
    } catch {
      // Backend unreachable — be lenient
      setHasPro(true);
      setLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      checkSubscription();
    } else {
      setHasPro(true);
      setLoaded(true);
      setBillingDate(null);
    }
  }, [userId, checkSubscription]);

  // Listen for RevenueCat purchase updates
  useEffect(() => {
    if (Platform.OS === "web" || !rcConfigured) return;
    const listener = (info: CustomerInfo) => {
      if (info.entitlements.active["threely Pro"] || info.entitlements.active["pro"]) {
        setHasPro(true);
      }
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => Purchases.removeCustomerInfoUpdateListener(listener);
  }, []);

  const purchasePro = useCallback(async (): Promise<boolean> => {
    if (!currentPackage) return false;
    try {
      const { customerInfo } = await Purchases.purchasePackage(currentPackage);
      if (customerInfo.entitlements.active["threely Pro"] || customerInfo.entitlements.active["pro"]) {
        setHasPro(true);
        return true;
      }
      return false;
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean; code?: number };
      if (err.userCancelled) return false;
      // If already subscribed (error code 6778003), check entitlements
      if (err.code === 6778003 || (e instanceof Error && e.message?.includes("already"))) {
        try {
          const info = await Purchases.getCustomerInfo();
          if (info.entitlements.active["threely Pro"] || info.entitlements.active["pro"]) {
            setHasPro(true);
            return true;
          }
        } catch { /* ignore */ }
      }
      throw e;
    }
  }, [currentPackage]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (customerInfo.entitlements.active["threely Pro"] || customerInfo.entitlements.active["pro"]) {
        setHasPro(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

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
        billingDate,
        currentPackage,
        setWalkthroughActive,
        refreshSubscription,
        purchasePro,
        restorePurchases,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}
