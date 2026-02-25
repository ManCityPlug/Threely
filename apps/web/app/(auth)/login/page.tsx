"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase-client";
import { isOnboarded, markOnboarded } from "@/lib/auth-context";
import { profileApi } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");

    const supabase = getSupabase();
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    if (data.user) {
      // Fast path: localStorage knows they're onboarded
      if (isOnboarded(data.user.id)) {
        router.replace("/dashboard");
        return;
      }
      // Slow path: check DB for existing profile
      try {
        const { profile } = await profileApi.get();
        if (profile) {
          markOnboarded(data.user.id);
          router.replace("/dashboard");
        } else {
          router.replace("/onboarding");
        }
      } catch {
        router.replace("/onboarding");
      }
    }
  }

  return (
    <div className="card fade-in" style={{ padding: "2.5rem 2rem" }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: "linear-gradient(145deg, #7c74ff 0%, #635bff 50%, #5144e8 100%)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, fontWeight: 700, margin: "0 auto 1rem",
          boxShadow: "0 6px 18px rgba(99,91,255,0.3), inset 0 1px 2px rgba(255,255,255,0.25)",
          textShadow: "0 2px 4px rgba(0,0,0,0.15)",
        }}>3</div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>
          Welcome back
        </h1>
        <p style={{ color: "var(--subtext)", fontSize: "0.9rem" }}>
          Sign in to your Threely account
        </p>
      </div>

      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label className="field-label">Email</label>
          <input
            className="field-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label className="field-label">Password</label>
          <input
            className="field-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && (
          <div style={{
            background: "var(--danger-light)", color: "var(--danger)",
            padding: "0.65rem 0.875rem", borderRadius: "var(--radius)",
            fontSize: "0.875rem",
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ marginTop: 4, height: 46, fontSize: "0.95rem" }}
        >
          {loading ? <span className="spinner" /> : "Sign in"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: "1.5rem", color: "var(--subtext)", fontSize: "0.875rem" }}>
        Don't have an account?{" "}
        <Link href="/register" style={{ color: "var(--primary)", fontWeight: 600 }}>
          Sign up
        </Link>
      </p>
    </div>
  );
}
