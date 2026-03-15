"use client";

import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { subscriptionApi } from "@/lib/api-client";

interface SubscriptionContextValue {
  hasPro: boolean;
  isLimitedMode: boolean;
  walkthroughActive: boolean;
  loaded: boolean;
  trialEligible: boolean;
  setWalkthroughActive: (v: boolean) => void;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  hasPro: true,
  isLimitedMode: false,
  walkthroughActive: false,
  loaded: false,
  trialEligible: true,
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
        setWalkthroughActive,
        refreshSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}
