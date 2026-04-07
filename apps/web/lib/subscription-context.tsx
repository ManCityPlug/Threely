"use client";

import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { subscriptionApi } from "@/lib/api-client";

interface SubscriptionContextValue {
  hasPro: boolean;
  isLimitedMode: boolean;
  walkthroughActive: boolean;
  loaded: boolean;
  trialEligible: boolean;
  pauseEndsAt: string | null;
  isPaused: boolean;
  setWalkthroughActive: (v: boolean) => void;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  hasPro: true,
  isLimitedMode: false,
  walkthroughActive: false,
  loaded: false,
  trialEligible: true,
  pauseEndsAt: null,
  isPaused: false,
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
  const [pauseEndsAt, setPauseEndsAt] = useState<string | null>(null);

  const checkSubscription = useCallback(async () => {
    try {
      const res = await subscriptionApi.status();
      const status = res.status;
      const pause = res.pauseEndsAt ?? null;
      const stillPaused = pause ? new Date(pause) > new Date() : false;

      // Paused subscriptions should not have pro access
      const pro = !stillPaused && (status === "trialing" || status === "active");
      setHasPro(pro);
      setPauseEndsAt(stillPaused ? pause : null);
      setTrialEligible(res.trialEligible !== false);

      if (!pro) {
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
  const isPaused = !!pauseEndsAt && new Date(pauseEndsAt) > new Date();

  return (
    <SubscriptionContext.Provider
      value={{
        hasPro,
        isLimitedMode,
        walkthroughActive,
        loaded,
        trialEligible,
        pauseEndsAt,
        isPaused,
        setWalkthroughActive,
        refreshSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}
