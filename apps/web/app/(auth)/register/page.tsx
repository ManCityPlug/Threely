"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase-client";
import { SocialAuthButtons, AuthDivider } from "@/components/SocialAuthButtons";

const APP_STORE_URL = "#";
const PLAY_STORE_URL = "#";

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

/* -- Registration Form ------------------------------------------------------- */

function RegistrationForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create account.");
        setLoading(false);
        return;
      }

      const supabase = getSupabase();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError("Account created! Please sign in.");
        setLoading(false);
        router.push("/login");
        return;
      }

      router.push("/onboarding");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="card fade-in" style={{ padding: "2.5rem 2rem" }}>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <img src="/favicon.png" alt="Threely" width={52} height={52} style={{ borderRadius: 14, margin: "0 auto 1rem", display: "block" }} />
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>
          Create account
        </h1>
        <p style={{ color: "var(--subtext)", fontSize: "0.9rem" }}>
          Start turning your goals into action
        </p>
      </div>

      <SocialAuthButtons />
      <AuthDivider />

      <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
            placeholder="Min. 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
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
          {loading ? <span className="spinner" /> : "Create account"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: "1.5rem", color: "var(--subtext)", fontSize: "0.875rem" }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}

/* -- Main Register Page ------------------------------------------------------- */

export default function RegisterPage() {
  const router = useRouter();
  const [device, setDevice] = useState<DeviceType>("desktop");
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    setDevice(detectDevice());
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/dashboard");
      } else {
        setCheckingAuth(false);
      }
    });
  }, [router]);

  const isMobileDevice = device !== "desktop";

  if (checkingAuth) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="spinner spinner-dark" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  // Mobile/tablet: show "get the app" screen
  if (isMobileDevice) {
    const isAppleDevice = device === "iphone" || device === "ipad";
    const isAndroidDevice = device === "android_phone" || device === "android_tablet";

    return (
      <div className="card fade-in" style={{ padding: "2.5rem 2rem", textAlign: "center" }}>
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
              href={APP_STORE_URL}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 18px", background: "#0a2540", color: "#fff",
                borderRadius: 10, fontSize: "0.8rem", fontWeight: 600,
                textDecoration: "none", position: "relative",
              }}
            >
              <span className="new-badge" style={{ position: "absolute", top: -14, right: -6 }}>New</span>
              <AppleIcon />
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
                <span style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.8 }}>Download on the</span>
                <span>App Store</span>
              </span>
            </a>
          )}
          {!isAppleDevice && (
            <a
              href={PLAY_STORE_URL}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 18px", background: "#0a2540", color: "#fff",
                borderRadius: 10, fontSize: "0.8rem", fontWeight: 600,
                textDecoration: "none", position: "relative",
              }}
            >
              <span className="new-badge" style={{ position: "absolute", top: -14, right: -6 }}>New</span>
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
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  // Desktop: show registration form directly
  return <RegistrationForm />;
}
