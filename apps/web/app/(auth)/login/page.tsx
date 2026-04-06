"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase-client";
import { isOnboarded, markOnboarded } from "@/lib/auth-context";
import { profileApi } from "@/lib/api-client";
import { SocialAuthButtons, AuthDivider } from "@/components/SocialAuthButtons";
import { MagicLinkForm } from "@/components/MagicLinkForm";

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
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const forgotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up forgot-password cooldown timer on unmount
  useEffect(() => {
    return () => {
      if (forgotTimerRef.current) clearInterval(forgotTimerRef.current);
    };
  }, []);

  useEffect(() => {
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

    if (authError) {
      // Check if the email exists to show a more helpful message
      try {
        const res = await fetch("/api/auth/check-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });
        const { exists } = await res.json();
        if (!exists) {
          setLoading(false);
          setError("no_account");
          return;
        }
      } catch {
        // If check fails, fall through to generic error
      }
      setLoading(false);
      setError("Invalid login credentials");
      return;
    }
    if (data.session && data.user) {
      // Fast path: localStorage knows they're onboarded
      if (isOnboarded(data.user.id)) {
        // Full page load ensures cookies are synced with middleware
        window.location.href = "/dashboard";
        return;
      }
      // Slow path: check DB for existing profile
      try {
        const { profile } = await profileApi.get();
        if (profile) {
          markOnboarded(data.user.id);
        }
        // Returning user on login page — always go to dashboard
        // (layout will redirect to onboarding if truly needed)
        window.location.href = "/dashboard";
      } catch {
        // Even on error, try dashboard — layout handles the auth gate
        window.location.href = "/dashboard";
      }
    } else {
      setLoading(false);
      setError("Sign-in failed. Please try again.");
    }
  }

  return (
    <div className="card fade-in" style={{ padding: "2.5rem 2rem" }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
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
            background: error === "no_account" ? "var(--primary-light)" : "var(--danger-light)",
            color: error === "no_account" ? "var(--primary)" : "var(--danger)",
            padding: "0.65rem 0.875rem", borderRadius: "var(--radius)",
            fontSize: "0.875rem",
          }}>
            {error === "no_account" ? (
              <>
                We couldn't find an account with this email.{" "}
                <Link href="/signup" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "underline" }}>
                  Sign up
                </Link>
              </>
            ) : (
              error
            )}
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
        <Link href="/signup" style={{ color: "var(--primary)", fontWeight: 600 }}>
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
                <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginTop: 8 }}>
                  Not seeing it? Check your spam folder.
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
                    if (forgotTimerRef.current) clearInterval(forgotTimerRef.current);
                    forgotTimerRef.current = setInterval(() => {
                      setForgotCooldown((prev) => {
                        if (prev <= 1) { if (forgotTimerRef.current) { clearInterval(forgotTimerRef.current); forgotTimerRef.current = null; } return 0; }
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
                  if (forgotTimerRef.current) clearInterval(forgotTimerRef.current);
                  forgotTimerRef.current = setInterval(() => {
                    setForgotCooldown((prev) => {
                      if (prev <= 1) { if (forgotTimerRef.current) { clearInterval(forgotTimerRef.current); forgotTimerRef.current = null; } return 0; }
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
