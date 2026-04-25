"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const type = searchParams.get("type") || "recovery";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="card fade-in" style={{ padding: "2.5rem 2rem", textAlign: "center" }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: "rgba(239,68,68,0.1)", color: "#ef4444",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, fontWeight: 700, margin: "0 auto 1rem",
        }}>!</div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 8 }}>
          Invalid link
        </h1>
        <p style={{ color: "var(--subtext)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
          This password reset link is invalid. Please request a new one.
        </p>
        <button className="btn btn-primary" onClick={() => router.replace("/login")} style={{ height: 46, fontSize: "0.95rem" }}>
          Back to sign in
        </button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || !confirm) return;
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, type, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
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
        <p style={{ color: "var(--subtext)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
          Your password has been changed successfully.
        </p>
        <button className="btn btn-primary" onClick={() => router.replace("/login")} style={{ height: 46, fontSize: "0.95rem" }}>
          Sign in
        </button>
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
          <input className="field-input" type="password" placeholder="Min. 8 characters"
            value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required />
        </div>
        <div>
          <label className="field-label">Confirm password</label>
          <input className="field-input" type="password" placeholder="Re-enter your password"
            value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required />
        </div>

        {error && (
          <div style={{ background: "var(--danger-light)", color: "var(--danger)", padding: "0.65rem 0.875rem", borderRadius: "var(--radius)", fontSize: "0.875rem" }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4, height: 46, fontSize: "0.95rem" }}>
          {loading ? <span className="spinner" /> : "Update password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="spinner spinner-dark" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
