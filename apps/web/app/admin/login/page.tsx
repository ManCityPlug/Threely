"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        return;
      }

      router.replace("/admin");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#111111",
          border: "1px solid #1e1e1e",
          borderRadius: 16,
          padding: "2rem",
        }}
      >
        <h1
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "#fff",
            marginBottom: "0.25rem",
            textAlign: "center",
          }}
        >
          Admin Login
        </h1>
        <p
          style={{
            fontSize: "0.85rem",
            color: "#71717a",
            textAlign: "center",
            marginBottom: "1.5rem",
          }}
        >
          Threely Dashboard
        </p>

        {error && (
          <div
            style={{
              padding: "0.5rem 0.75rem",
              background: "#3f1219",
              border: "1px solid #7f1d1d",
              borderRadius: 8,
              color: "#fca5a5",
              fontSize: "0.85rem",
              marginBottom: "1rem",
            }}
          >
            {error}
          </div>
        )}

        <label
          style={{
            display: "block",
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "#a1a1aa",
            marginBottom: 6,
          }}
        >
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "0.6rem 0.75rem",
            background: "#0a0a0a",
            border: "1px solid #1e1e1e",
            borderRadius: 8,
            color: "#fff",
            fontSize: "0.9rem",
            marginBottom: "1rem",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        <label
          style={{
            display: "block",
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "#a1a1aa",
            marginBottom: 6,
          }}
        >
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "0.6rem 0.75rem",
            background: "#0a0a0a",
            border: "1px solid #1e1e1e",
            borderRadius: 8,
            color: "#fff",
            fontSize: "0.9rem",
            marginBottom: "1.5rem",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.65rem",
            background: "#D4A843",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: "0.9rem",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
