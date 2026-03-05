"use client";

import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { subscriptionApi } from "@/lib/api-client";

export type PaywallVariant = "fullscreen" | "sheet";

interface SubscriptionContextValue {
  hasPro: boolean;
  isLimitedMode: boolean;
  walkthroughActive: boolean;
  loaded: boolean;
  trialEligible: boolean;
  paywallOpen: boolean;
  paywallVariant: PaywallVariant;
  showPaywall: (variant?: PaywallVariant) => void;
  showTrialPaywall: () => void;
  closePaywall: () => void;
  setWalkthroughActive: (v: boolean) => void;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  hasPro: true,
  isLimitedMode: false,
  walkthroughActive: false,
  loaded: false,
  trialEligible: true,
  paywallOpen: false,
  paywallVariant: "sheet",
  showPaywall: () => {},
  showTrialPaywall: () => {},
  closePaywall: () => {},
  setWalkthroughActive: () => {},
  refreshSubscription: async () => {},
});

export function useSubscription() {
  return useContext(SubscriptionContext);
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [hasPro, setHasPro] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [trialEligible, setTrialEligible] = useState(true);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallVariant, setPaywallVariant] = useState<PaywallVariant>("sheet");
  const [walkthroughActive, setWalkthroughActiveState] = useState(false);

  const checkSubscription = useCallback(async () => {
    try {
      const res = await subscriptionApi.status();
      const status = res.status;
      setHasPro(status === "trialing" || status === "active");
      setTrialEligible(res.trialEligible !== false);
      if (!status || (status !== "trialing" && status !== "active")) {
        localStorage.setItem("threely_limited_mode", "true");
      } else {
        localStorage.removeItem("threely_limited_mode");
      }
    } catch {
      // On error, assume pro to avoid blocking
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  const showPaywall = useCallback((variant: PaywallVariant = "sheet") => {
    setPaywallVariant(variant);
    setPaywallOpen(true);
  }, []);

  const showTrialPaywall = useCallback(() => {
    setPaywallVariant("fullscreen");
    setPaywallOpen(true);
  }, []);

  const closePaywall = useCallback(() => {
    setPaywallOpen(false);
    if (!hasPro) {
      localStorage.setItem("threely_limited_mode", "true");
    }
  }, [hasPro]);

  const setWalkthroughActive = useCallback((v: boolean) => {
    setWalkthroughActiveState(v);
  }, []);

  const refreshSubscription = useCallback(async () => {
    await checkSubscription();
  }, [checkSubscription]);

  const isLimitedMode = !hasPro && !walkthroughActive;

  return (
    <SubscriptionContext.Provider
      value={{
        hasPro,
        isLimitedMode,
        walkthroughActive,
        loaded,
        trialEligible,
        paywallOpen,
        paywallVariant,
        showPaywall,
        showTrialPaywall,
        closePaywall,
        setWalkthroughActive,
        refreshSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}
