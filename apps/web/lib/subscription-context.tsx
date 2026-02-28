"use client";

import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { subscriptionApi } from "@/lib/api-client";

interface SubscriptionContextValue {
  hasPro: boolean;
  loaded: boolean;
  paywallOpen: boolean;
  showPaywall: () => void;
  closePaywall: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  hasPro: true,
  loaded: false,
  paywallOpen: false,
  showPaywall: () => {},
  closePaywall: () => {},
});

export function useSubscription() {
  return useContext(SubscriptionContext);
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [hasPro, setHasPro] = useState(true); // default true to avoid flash
  const [loaded, setLoaded] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    subscriptionApi.status()
      .then((res) => {
        const status = res.status;
        setHasPro(status === "trialing" || status === "active");
      })
      .catch(() => {
        // On error, assume pro to avoid blocking
      })
      .finally(() => setLoaded(true));
  }, []);

  const showPaywall = useCallback(() => setPaywallOpen(true), []);
  const closePaywall = useCallback(() => setPaywallOpen(false), []);

  return (
    <SubscriptionContext.Provider value={{ hasPro, loaded, paywallOpen, showPaywall, closePaywall }}>
      {children}
    </SubscriptionContext.Provider>
  );
}
