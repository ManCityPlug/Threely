"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase-client";

export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");

    const supabase = getSupabase();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    setLoading(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div style={{
        background: "var(--success-light)",
        border: "1px solid var(--success)",
        borderRadius: "var(--radius)",
        padding: "1rem 1.25rem",
        textAlign: "center",
      }}>
        <p style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text)", marginBottom: 4 }}>
          Check your email
        </p>
        <p style={{ fontSize: "0.85rem", color: "var(--subtext)" }}>
          We sent a login link to <strong>{email}</strong>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
        style={{ height: 46, fontSize: "0.95rem" }}
      >
        {loading ? <span className="spinner" /> : "Send login link"}
      </button>
    </form>
  );
}
