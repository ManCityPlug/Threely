"use client";

import { useState, FormEvent, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase-client";
import { SocialAuthButtons, AuthDivider } from "@/components/SocialAuthButtons";

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromStart = searchParams.get("from") === "start";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAnon, setIsAnon] = useState(false);

  // Detect anonymous session — if anon, we convert instead of creating new
  useEffect(() => {
    (async () => {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.is_anonymous) {
        setIsAnon(true);
      } else if (session?.user && !session.user.is_anonymous) {
        // Already a real user — go to dashboard
        router.replace("/dashboard");
      }
    })();
  }, [router]);

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError("");

    try {
      const supabase = getSupabase();

      if (isAnon) {
        // Convert anon user to real user — same user ID, all data persists
        const { error: updateError } = await supabase.auth.updateUser({ email, password });
        if (updateError) {
          throw new Error(updateError.message.includes("already") ? "An account with this email already exists." : updateError.message);
        }
        router.push("/dashboard?welcome=1");
        return;
      }

      // Regular signup flow
      const res = await fetch("/api/start/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Registration failed.");
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error("Account created but sign-in failed. Please try again.");

      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="card fade-in" style={{ padding: "2.5rem 2rem" }}>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>
          {fromStart || isAnon ? "Save your plan" : "Create your account"}
        </h1>
        <p style={{ color: "var(--subtext)", fontSize: "0.9rem" }}>
          {fromStart || isAnon ? "Free account. No credit card required." : "Start your free account"}
        </p>
      </div>

      <SocialAuthButtons />

      <AuthDivider />

      <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
            background: "var(--danger-light)",
            color: "var(--danger)",
            padding: "0.65rem 0.875rem",
            borderRadius: "var(--radius)",
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

      <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
        <p style={{ color: "var(--subtext)", fontSize: "0.85rem" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>
            Sign in
          </Link>
        </p>
      </div>

      <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--muted)", marginTop: "1rem", lineHeight: 1.5 }}>
        By continuing, you agree to our{" "}
        <a href="https://threely.co/terms" style={{ color: "var(--muted)", textDecoration: "underline" }}>Terms</a> and{" "}
        <a href="https://threely.co/privacy" style={{ color: "var(--muted)", textDecoration: "underline" }}>Privacy Policy</a>.
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="card fade-in" style={{ padding: "2.5rem 2rem", textAlign: "center" }}><span className="spinner spinner-dark" /></div>}>
      <SignupContent />
    </Suspense>
  );
}
