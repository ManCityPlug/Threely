"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "./supabase-client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    // Clear onboarding flag
    if (user) localStorage.removeItem(`threely_onboarding_done_${user.id}`);
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function isOnboarded(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(`threely_onboarding_done_${userId}`);
}

export function markOnboarded(userId: string) {
  localStorage.setItem(`threely_onboarding_done_${userId}`, "true");
}

export function getNickname(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("threely_nickname") ?? "";
}

export function saveNickname(name: string) {
  localStorage.setItem("threely_nickname", name);
}
