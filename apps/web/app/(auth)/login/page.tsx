"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase-client";
import { isOnboarded, markOnboarded } from "@/lib/auth-context";
import { profileApi } from "@/lib/api-client";
import { SocialAuthButtons, AuthDivider } from "@/components/SocialAuthButtons";
import { MagicLinkForm } from "@/components/MagicLinkForm";

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
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [device, setDevice] = useState<DeviceType>("desktop");
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useState(0);

  useEffect(() => {
    setDevice(detectDevice());
    // Show error banner if redirected from failed OAuth
    if (searchParams.get("error") === "auth") {
      setError("Sign-in failed. Please try again.");
    }
    // Redirect if already logged in
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/dashboard");
    });
  }, [searchParams, router]);

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

  // Mobile/tablet: block sign-in, show app download screen
  if (isMobileDevice) {
    return (
      <div className="card fade-in" style={{ padding: "2.5rem 2rem", textAlign: "center" }}>
        {/* Animated logo with glow + sparkles */}
        <div style={{ width: 80, height: 80, margin: "0 auto 1.25rem", position: "relative" }}>
          <div style={{
            position: "absolute", left: -12, top: -12, width: 104, height: 104, borderRadius: 52,
            backgroundColor: "rgba(99, 91, 255, 0.25)", animation: "pulse 3s ease-in-out infinite",
          }} />
          <img src="/favicon.png" alt="Threely" width={80} height={80} style={{
            position: "relative", borderRadius: 20, animation: "pulse 3s ease-in-out infinite", zIndex: 2,
          }} />
          {[0, 60, 120, 180, 240, 300].map((angle, idx) => {
            const rad = (angle * Math.PI) / 180;
            return (
              <div key={idx} style={{
                position: "absolute", left: 40 + Math.cos(rad) * 55 - 3, top: 40 + Math.sin(rad) * 55 - 3,
                width: 6, height: 6, borderRadius: 3, backgroundColor: "#635bff",
                animation: `sparkle 2s ease-in-out ${0.6 + idx * 0.08}s infinite`, zIndex: 3,
              }} />
            );
          })}
        </div>

        <h1 style={{
          fontSize: "1.5rem", fontWeight: 800,
          letterSpacing: "-0.03em", marginBottom: 8, lineHeight: 1.2,
        }}>
          Threely is built for {deviceLabel(device)}
        </h1>

        <p style={{
          color: "var(--subtext)", fontSize: "0.9rem",
          lineHeight: 1.6, marginBottom: "1.75rem",
          maxWidth: 320, margin: "0 auto 1.75rem",
        }}>
          Get the full experience — daily reminders, task tracking, and AI coaching — all in the app.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: "1.25rem" }}>
          {!isAndroidDevice && (
            <a
              href="#"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 18px", background: "#0a2540", color: "#fff",
                borderRadius: 10, fontSize: "0.8rem", fontWeight: 600,
                textDecoration: "none", position: "relative",
              }}
            >
              <AppleIcon />
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
                <span style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.8 }}>Download on the</span>
                <span>App Store</span>
              </span>
            </a>
          )}
          {!isAppleDevice && (
            <a
              href="#"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 18px", background: "#0a2540", color: "#fff",
                borderRadius: 10, fontSize: "0.8rem", fontWeight: 600,
                textDecoration: "none", position: "relative",
              }}
            >
              <PlayIcon />
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
                <span style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.8 }}>Get it on</span>
                <span>Google Play</span>
              </span>
            </a>
          )}
        </div>

        <p style={{ color: "var(--subtext)", fontSize: "0.95rem", lineHeight: 1.5, marginBottom: "1.25rem" }}>
          On a computer? Use the web version at{" "}
          <a href="https://threely.co" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>threely.co</a>
        </p>

        <p style={{ color: "var(--subtext)", fontSize: "0.875rem" }}>
          Don{"'"}t have an account?{" "}
          <Link href="/register" style={{ color: "var(--primary)", fontWeight: 600 }}>
            Sign up
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="card fade-in" style={{ padding: "2.5rem 2rem" }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <img src="/favicon.png" alt="Threely" width={52} height={52} style={{ borderRadius: 14, margin: "0 auto 1rem", display: "block" }} />
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>
          Welcome back
        </h1>
        <p style={{ color: "var(--subtext)", fontSize: "0.9rem" }}>
          Sign in to your Threely account
        </p>
      </div>

      {/* Social auth buttons */}
      <SocialAuthButtons />

      <AuthDivider />

      {/* Email/password form */}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <label className="field-label">Password</label>
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              style={{
                color: "var(--primary)", fontSize: "0.8rem", fontWeight: 500,
                background: "none", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              Forgot password?
            </button>
          </div>
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

      {/* Magic link toggle */}
      <div style={{ textAlign: "center", marginTop: "1rem" }}>
        {showMagicLink ? (
          <div style={{ marginTop: "0.5rem" }}>
            <MagicLinkForm />
            <button
              type="button"
              onClick={() => setShowMagicLink(false)}
              style={{
                marginTop: "0.75rem", color: "var(--muted)", fontSize: "0.8rem",
                background: "none", border: "none", cursor: "pointer",
              }}
            >
              Back to password sign in
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowMagicLink(true)}
            style={{
              color: "var(--primary)", fontSize: "0.85rem", fontWeight: 500,
              background: "none", border: "none", cursor: "pointer",
            }}
          >
            Sign in with a magic link instead
          </button>
        )}
      </div>

      <p style={{ textAlign: "center", marginTop: "1.5rem", color: "var(--subtext)", fontSize: "0.875rem" }}>
        Don't have an account?{" "}
        <Link href="/register" style={{ color: "var(--primary)", fontWeight: 600 }}>
          Sign up
        </Link>
      </p>

      {/* Forgot password overlay */}
      {showForgotPassword && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.4)", display: "flex",
          alignItems: "center", justifyContent: "center", padding: "1rem",
        }} onClick={() => setShowForgotPassword(false)}>
          <div className="card" style={{ padding: "2rem", maxWidth: 400, width: "100%" }} onClick={e => e.stopPropagation()}>
            {forgotSent ? (
              <div style={{ textAlign: "center" }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: "var(--success-light)", color: "var(--success)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, fontWeight: 700, margin: "0 auto 1rem",
                }}>✓</div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8 }}>Check your email</h2>
                <p style={{ color: "var(--subtext)", fontSize: "0.875rem", lineHeight: 1.6 }}>
                  We sent a password reset link to <strong>{forgotEmail}</strong>. Click the link to set a new password.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={forgotCooldown > 0 || forgotLoading}
                  onClick={async () => {
                    setForgotLoading(true);
                    const supabase = getSupabase();
                    await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
                      redirectTo: `${window.location.origin}/api/auth/callback?type=recovery`,
                    });
                    setForgotLoading(false);
                    setForgotCooldown(60);
                    const timer = setInterval(() => {
                      setForgotCooldown((prev) => {
                        if (prev <= 1) { clearInterval(timer); return 0; }
                        return prev - 1;
                      });
                    }, 1000);
                  }}
                  style={{ marginTop: "1.25rem", width: "100%" }}
                >
                  {forgotLoading ? <span className="spinner" /> : forgotCooldown > 0 ? `Resend in ${forgotCooldown}s` : "Resend reset link"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => { setShowForgotPassword(false); setForgotSent(false); setForgotEmail(""); setForgotCooldown(0); }}
                  style={{ marginTop: "0.5rem", width: "100%" }}
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 4 }}>Reset your password</h2>
                <p style={{ color: "var(--subtext)", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
                  Enter your email and we'll send you a link to reset your password.
                </p>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!forgotEmail.trim()) return;
                  setForgotLoading(true);
                  const supabase = getSupabase();
                  await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
                    redirectTo: `${window.location.origin}/api/auth/callback?type=recovery`,
                  });
                  setForgotLoading(false);
                  setForgotSent(true);
                  setForgotCooldown(60);
                  const timer = setInterval(() => {
                    setForgotCooldown((prev) => {
                      if (prev <= 1) { clearInterval(timer); return 0; }
                      return prev - 1;
                    });
                  }, 1000);
                }}>
                  <label className="field-label">Email</label>
                  <input
                    className="field-input"
                    type="email"
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    autoComplete="email"
                    required
                    autoFocus
                  />
                  <div style={{ display: "flex", gap: 10, marginTop: "1rem" }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setShowForgotPassword(false)}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={forgotLoading}
                      style={{ flex: 1 }}
                    >
                      {forgotLoading ? <span className="spinner" /> : "Send reset link"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
