import { createContext, useCallback, useContext, useRef } from "react";
import { View, ScrollView } from "react-native";

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
  registerScroll: (key: string, ref: ScrollView | null) => void;
  measure: (key: WalkthroughTarget) => Promise<TargetLayout | null>;
  measureWithRetry: (key: WalkthroughTarget, retries?: number, delay?: number) => Promise<TargetLayout | null>;
  scrollTargetIntoView: (key: WalkthroughTarget, scrollKey: string) => Promise<void>;
  scrollToTop: (scrollKey: string) => Promise<void>;
  scrollToOffset: (scrollKey: string, offset: number) => Promise<void>;
}

const WalkthroughRegistryContext = createContext<WalkthroughRegistryValue>({
  register: () => {},
  registerScroll: () => {},
  measure: async () => null,
  measureWithRetry: async () => null,
  scrollTargetIntoView: async () => {},
  scrollToTop: async () => {},
  scrollToOffset: async () => {},
});

export function useWalkthroughRegistry() {
  return useContext(WalkthroughRegistryContext);
}

export function WalkthroughRegistryProvider({ children }: { children: React.ReactNode }) {
  const refs = useRef(new Map<WalkthroughTarget, View>());
  const scrollRefs = useRef(new Map<string, ScrollView>());

  const register = useCallback((key: WalkthroughTarget, ref: View | null) => {
    if (ref) {
      refs.current.set(key, ref);
    } else {
      refs.current.delete(key);
    }
  }, []);

  const registerScroll = useCallback((key: string, ref: ScrollView | null) => {
    if (ref) {
      scrollRefs.current.set(key, ref);
    } else {
      scrollRefs.current.delete(key);
    }
  }, []);

  const measure = useCallback((key: WalkthroughTarget): Promise<TargetLayout | null> => {
    return new Promise((resolve) => {
      const ref = refs.current.get(key);
      if (!ref) {
        resolve(null);
        return;
      }
      try {
        ref.measureInWindow((x, y, width, height) => {
          if (!x && !y && !width && !height) {
            resolve(null);
            return;
          }
          if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
            resolve(null);
            return;
          }
          if (width === 0 && height === 0) {
            resolve(null);
            return;
          }
          resolve({ x, y, width, height });
        });
      } catch {
        resolve(null);
      }
    });
  }, []);

  const measureWithRetry = useCallback(async (
    key: WalkthroughTarget,
    retries = 5,
    delay = 200,
  ): Promise<TargetLayout | null> => {
    for (let i = 0; i < retries; i++) {
      const layout = await measure(key);
      if (layout) return layout;
      await new Promise((r) => setTimeout(r, delay));
    }
    return null;
  }, [measure]);

  const scrollTargetIntoView = useCallback(async (
    key: WalkthroughTarget,
    scrollKey: string,
  ): Promise<void> => {
    const targetRef = refs.current.get(key);
    const scrollRef = scrollRefs.current.get(scrollKey);
    if (!targetRef || !scrollRef) return;

    // Use measureInWindow on the target to get its screen position,
    // then scroll so it's roughly centered on screen
    return new Promise((resolve) => {
      targetRef.measureInWindow((x, y, width, height) => {
        if (width === 0 && height === 0) {
          resolve();
          return;
        }
        // If the target is off-screen or near the edges, scroll to bring it into view
        // We scroll by the target's screen Y minus a comfortable offset
        const desiredOffset = Math.max(0, y - 200);
        if (desiredOffset > 50) {
          scrollRef.scrollTo({ y: desiredOffset, animated: true });
          setTimeout(resolve, 400);
        } else {
          resolve();
        }
      });
    });
  }, []);

  const scrollToTop = useCallback(async (scrollKey: string): Promise<void> => {
    const scrollRef = scrollRefs.current.get(scrollKey);
    if (!scrollRef) return;
    scrollRef.scrollTo({ y: 0, animated: true });
    await new Promise((r) => setTimeout(r, 400));
  }, []);

  const scrollToOffset = useCallback(async (scrollKey: string, offset: number): Promise<void> => {
    const scrollRef = scrollRefs.current.get(scrollKey);
    if (!scrollRef) return;
    scrollRef.scrollTo({ y: offset, animated: true });
    await new Promise((r) => setTimeout(r, 400));
  }, []);

  return (
    <WalkthroughRegistryContext.Provider value={{ register, registerScroll, measure, measureWithRetry, scrollTargetIntoView, scrollToTop, scrollToOffset }}>
      {children}
    </WalkthroughRegistryContext.Provider>
  );
}
