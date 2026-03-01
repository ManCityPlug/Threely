import { createContext, useCallback, useContext, useRef } from "react";
import { View } from "react-native";

export type WalkthroughTarget =
  | "first-task-card"
  | "get-more-button"
  | "first-goal-card"
  | "goal-menu-button"
  | "profile-stats";

export interface TargetLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WalkthroughRegistryValue {
  register: (key: WalkthroughTarget, ref: View | null) => void;
  measure: (key: WalkthroughTarget) => Promise<TargetLayout | null>;
}

const WalkthroughRegistryContext = createContext<WalkthroughRegistryValue>({
  register: () => {},
  measure: async () => null,
});

export function useWalkthroughRegistry() {
  return useContext(WalkthroughRegistryContext);
}

export function WalkthroughRegistryProvider({ children }: { children: React.ReactNode }) {
  const refs = useRef(new Map<WalkthroughTarget, View>());

  const register = useCallback((key: WalkthroughTarget, ref: View | null) => {
    if (ref) {
      refs.current.set(key, ref);
    } else {
      refs.current.delete(key);
    }
  }, []);

  const measure = useCallback((key: WalkthroughTarget): Promise<TargetLayout | null> => {
    return new Promise((resolve) => {
      const ref = refs.current.get(key);
      if (!ref) {
        resolve(null);
        return;
      }
      ref.measureInWindow((x, y, width, height) => {
        if (width === 0 && height === 0) {
          resolve(null);
          return;
        }
        resolve({ x, y, width, height });
      });
    });
  }, []);

  return (
    <WalkthroughRegistryContext.Provider value={{ register, measure }}>
      {children}
    </WalkthroughRegistryContext.Provider>
  );
}
