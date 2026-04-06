"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase-client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    let resolved = false;

    // Listen for auth state changes (recovery token from URL hash)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        resolved = true;
        setHasSession(true);
        setChecking(false);
      }
    });

    // Handle PKCE code in URL params
    const code = searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: codeError }) => {
        if (codeError) {
          console.error("[reset-password] code exchange failed:", codeError.message);
          resolved = true;
          setExpired(true);
          setChecking(false);
        } else {
          resolved = true;
          setHasSession(true);
          setChecking(false);
        }
      });
    }

    // Fallback: check existing session after delay
    const timeout = setTimeout(async () => {
      if (resolved) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setHasSession(true);
      } else {
        setExpired(true);
      }
      setChecking(false);
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || !confirm) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    const supabase = getSupabase();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.replace("/dashboard"), 2000);
  }

  if (checking) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="spinner spinner-dark" /></div>;
  }

  if (expired) {
    return (
      <div className="card fade-in" style={{ padding: "2.5rem 2rem", textAlign: "center" }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: "rgba(239,68,68,0.1)", color: "#ef4444",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, fontWeight: 700, margin: "0 auto 1rem",
        }}>!</div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 8 }}>
          Link expired
        </h1>
        <p style={{ color: "var(--subtext)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
          This password reset link has expired or was already used. Please request a new one.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => router.replace("/login")}
          style={{ height: 46, fontSize: "0.95rem" }}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="card fade-in" style={{ padding: "2.5rem 2rem", textAlign: "center" }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: "var(--success-light)", color: "var(--success)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, fontWeight: 700, margin: "0 auto 1rem",
        }}>✓</div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 8 }}>
          Password updated
        </h1>
        <p style={{ color: "var(--subtext)", fontSize: "0.9rem" }}>
          Redirecting to your dashboard...
        </p>
      </div>
    );
  }

  return (
    <div className="card fade-in" style={{ padding: "2.5rem 2rem" }}>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>
          Set new password
        </h1>
        <p style={{ color: "var(--subtext)", fontSize: "0.9rem" }}>
          Choose a new password for your account
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label className="field-label">New password</label>
          <input
            className="field-input"
            type="password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <div>
          <label className="field-label">Confirm password</label>
          <input
            className="field-input"
            type="password"
            placeholder="Re-enter your password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
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
          {loading ? <span className="spinner" /> : "Update password"}
        </button>
      </form>
    </div>
  );
}
