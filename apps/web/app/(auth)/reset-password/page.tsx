"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase-client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

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
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: "var(--primary)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, fontWeight: 700, margin: "0 auto 1rem",
        }}>3</div>
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
