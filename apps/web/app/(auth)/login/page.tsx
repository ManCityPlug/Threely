"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase-client";
import { isOnboarded, markOnboarded } from "@/lib/auth-context";
import { profileApi } from "@/lib/api-client";

type DeviceType = "iphone" | "ipad" | "android_phone" | "android_tablet" | "desktop";

function detectDevice(): DeviceType {
  const ua = navigator.userAgent;
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ipad";
  if (/iPhone|iPod/i.test(ua)) return "iphone";
  if (/Android/i.test(ua)) {
    return /Mobile/i.test(ua) ? "android_phone" : "android_tablet";
  }
  if (/webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return "android_phone";
  return "desktop";
}

function deviceLabel(device: DeviceType): string {
  switch (device) {
    case "ipad": return "your iPad";
    case "android_tablet": return "your tablet";
    default: return "your phone";
  }
}

function AppleIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="22" viewBox="0 0 17 20" fill="currentColor">
      <path d="M.517 1.206A1.4 1.4 0 0 0 0 2.275v15.45a1.4 1.4 0 0 0 .517 1.069l.056.05 8.662-8.663v-.204L.573 1.156l-.056.05z"/>
      <path d="M12.122 13.068l-2.887-2.887v-.204l2.887-2.887.065.037 3.42 1.943c.977.555.977 1.463 0 2.018l-3.42 1.943-.065.037z"/>
      <path d="M12.187 13.031L9.235 10.08.517 18.794c.322.34.856.382 1.456.043l10.214-5.806"/>
      <path d="M12.187 7.127L1.973 1.322C1.373.982.84 1.024.517 1.365L9.235 10.08l2.952-2.952z"/>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [device, setDevice] = useState<DeviceType>("desktop");

  useEffect(() => {
    setDevice(detectDevice());
  }, []);

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

  const isMobileDevice = device !== "desktop";
  const isAppleDevice = device === "iphone" || device === "ipad";
  const isAndroidDevice = device === "android_phone" || device === "android_tablet";

  return (
    <div className="card fade-in" style={{ padding: "2.5rem 2rem" }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: isMobileDevice ? "1.25rem" : "2rem" }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: "var(--primary)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, fontWeight: 700, margin: "0 auto 1rem",
        }}>3</div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>
          Welcome back
        </h1>
        <p style={{ color: "var(--subtext)", fontSize: "0.9rem" }}>
          Sign in to your Threely account
        </p>
      </div>

      {/* Mobile/tablet: suggest app download */}
      {isMobileDevice && (
        <div style={{
          background: "var(--primary-light)", border: "1px solid rgba(99,91,255,0.2)",
          borderRadius: "var(--radius)", padding: "1rem",
          marginBottom: "1.25rem", textAlign: "center",
        }}>
          <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
            Threely is built for {deviceLabel(device)}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {!isAndroidDevice && (
              <a href="#" style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 12px", background: "#0a2540", color: "#fff",
                borderRadius: 8, fontSize: "0.75rem", fontWeight: 600, textDecoration: "none",
              }}>
                <AppleIcon />
                <span>App Store</span>
              </a>
            )}
            {!isAppleDevice && (
              <a href="#" style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 12px", background: "#0a2540", color: "#fff",
                borderRadius: 8, fontSize: "0.75rem", fontWeight: 600, textDecoration: "none",
              }}>
                <PlayIcon />
                <span>Google Play</span>
              </a>
            )}
          </div>
        </div>
      )}

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
