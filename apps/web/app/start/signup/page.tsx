"use client";

import { useState, useRef, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase-client";

export default function SignupPage() {
  return (
    <>
      <style>{`
        @keyframes accountErrorPop {
          0% { opacity: 0; transform: translateY(-8px) scale(0.95); }
          50% { transform: translateY(2px) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .signup-main { max-width: 440px; }
        .signup-card { max-width: 400px; padding: 28px 24px 32px; }
        .signup-card h2 { font-size: 1.35rem; }
        @media (min-width: 768px) {
          .signup-main { max-width: 540px; display: flex; flex-direction: column; justify-content: center; }
          .signup-card { max-width: 480px; padding: 40px 36px 40px; }
          .signup-card h2 { font-size: 1.6rem; }
        }
      `}</style>
      <SignupForm />
    </>
  );
}

// ─── Style constants ────────────────────────────────────────────────────────

const CARD_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  padding: "28px 24px 32px",
  margin: "0 auto",
  maxWidth: 400,
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  border: "1.5px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  padding: "14px 16px",
  background: "rgba(255,255,255,0.06)",
  fontSize: "16px",
  fontFamily: "inherit",
  color: "#fff",
  outline: "none",
  boxSizing: "border-box" as const,
  transition: "border-color 0.15s",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "rgba(255,255,255,0.5)",
  marginBottom: 6,
};

const OAUTH_BTN: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 12,
  fontSize: "0.95rem",
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  transition: "background 0.15s, border-color 0.15s",
  border: "none",
};

// ─── Main form component ────────────────────────────────────────────────────

function SignupForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountShake, setAccountShake] = useState(false);
  const passwordRef = useRef<HTMLDivElement>(null);

  const validEmail = email.includes("@") && email.includes(".");
  const validPassword = password.length >= 8;

  // Clear account error when user starts typing
  useEffect(() => {
    if (accountError && (email || password)) {
      setAccountError(null);
    }
  }, [email, password, accountError]);

  function triggerAccountError() {
    const msg = !email
      ? "Enter your email to create an account"
      : !validEmail
      ? "Please enter a valid email address"
      : !password
      ? "Create a password to continue"
      : !validPassword
      ? "Password must be at least 8 characters"
      : null;
    if (msg) {
      setAccountError(msg);
      setAccountShake(true);
      setTimeout(() => setAccountShake(false), 500);
      passwordRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    }
    return false;
  }

  // OAuth sign in (Apple / Google)
  async function handleOAuth(provider: "apple" | "google") {
    setOauthLoading(provider);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/onboarding`,
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setOauthLoading(null);
      }
      // Browser will redirect — no need to do anything else
    } catch {
      setError("Something went wrong. Please try again.");
      setOauthLoading(null);
    }
  }

  // Email/password registration
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (triggerAccountError()) return;

    setSubmitting(true);
    setError(null);

    try {
      const regRes = await fetch("/api/start/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!regRes.ok) {
        const data = await regRes.json();
        throw new Error(data.error || "Registration failed.");
      }

      // Sign into Supabase
      const supabase = getSupabase();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error("Account created but sign-in failed. Please try again.");

      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <main className="signup-main" style={{ padding: "24px 16px 60px", margin: "0 auto", flex: 1 }}>

      {/* White card */}
      <div className="signup-card" style={CARD_STYLE}>
        <h2 style={{
          fontWeight: 700,
          color: "#fff",
          letterSpacing: "-0.3px",
          textAlign: "center",
          margin: "0 0 24px",
        }}>
          Create your account
        </h2>

        {/* ── OAuth buttons ──────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => handleOAuth("apple")}
          disabled={!!oauthLoading}
          style={{
            ...OAUTH_BTN,
            background: "#000",
            color: "#fff",
            marginBottom: 10,
            opacity: oauthLoading === "google" ? 0.5 : 1,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          {oauthLoading === "apple" ? "Connecting..." : "Continue with Apple"}
        </button>

        <button
          type="button"
          onClick={() => handleOAuth("google")}
          disabled={!!oauthLoading}
          style={{
            ...OAUTH_BTN,
            background: "#fff",
            color: "#1f2937",
            border: "1.5px solid rgba(255,255,255,0.12)",
            marginBottom: 20,
            opacity: oauthLoading === "apple" ? 0.5 : 1,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {oauthLoading === "google" ? "Connecting..." : "Continue with Google"}
        </button>

        {/* ── Divider ────────────────────────────────────────────────── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
        }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
          <span style={{ fontSize: "0.75rem", color: "#8898AA", fontWeight: 500 }}>or sign up with email</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
        </div>

        {/* ── Email/Password form ────────────────────────────────────── */}
        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 12 }}>
            <label style={LABEL_STYLE}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              style={{
                ...INPUT_STYLE,
                borderColor: accountError && !validEmail ? "#FF4D4F" : undefined,
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = "#D4A843"}
              onBlur={(e) => e.currentTarget.style.borderColor = accountError && !validEmail ? "#FF4D4F" : "rgba(255,255,255,0.12)"}
            />
          </div>

          {/* Password */}
          <div ref={passwordRef} style={{ marginBottom: accountError ? 12 : 20 }}>
            <label style={LABEL_STYLE}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8+ characters"
              autoComplete="new-password"
              minLength={8}
              required
              style={{
                ...INPUT_STYLE,
                borderColor: accountError && !validPassword ? "#FF4D4F" : undefined,
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = "#D4A843"}
              onBlur={(e) => e.currentTarget.style.borderColor = accountError && !validPassword ? "#FF4D4F" : "rgba(255,255,255,0.12)"}
            />
          </div>

          {/* Account validation error */}
          {accountError && (
            <div
              style={{
                background: "linear-gradient(135deg, #FFF0F0, #FFF5F5)",
                border: "1.5px solid #FFD4D4",
                color: "#D32F2F",
                borderRadius: 12,
                padding: "12px 16px",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: 20,
                lineHeight: 1.4,
                display: "flex",
                alignItems: "center",
                gap: 10,
                animation: accountShake
                  ? "shake 0.5s ease, accountErrorPop 0.3s ease"
                  : "accountErrorPop 0.3s ease",
              }}
            >
              <span style={{
                flexShrink: 0,
                width: 22,
                height: 22,
                borderRadius: 11,
                background: "#FF4D4F",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 800,
              }}>!</span>
              {accountError}
            </div>
          )}

          {/* Continue button */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              padding: "16px",
              background: "#D4A843",
              color: "#fff",
              border: "none",
              borderRadius: 14,
              fontSize: "1rem",
              fontWeight: 700,
              letterSpacing: "-0.2px",
              cursor: submitting ? "wait" : "pointer",
              transition: "background 0.15s",
              boxShadow: "0 4px 16px rgba(212,168,67,0.3)",
            }}
          >
            {submitting ? "Creating account..." : "Continue"}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div style={{
            background: "#FFF0F0",
            color: "#FF4D4F",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: "0.82rem",
            marginTop: 12,
            lineHeight: 1.4,
          }}>
            {error}
          </div>
        )}

        {/* Legal */}
        <p style={{
          fontSize: "0.7rem",
          color: "#8898AA",
          textAlign: "center",
          lineHeight: 1.55,
          margin: "16px 0 0",
        }}>
          By continuing, you agree to our{" "}
          <a href="https://threely.co/terms" style={{ color: "#D4A843", textDecoration: "underline" }}>Terms</a>
          {" "}&{" "}
          <a href="https://threely.co/privacy" style={{ color: "#D4A843", textDecoration: "underline" }}>Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}
