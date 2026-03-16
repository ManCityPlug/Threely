"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase-client";

function getTrialEndDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function PlanPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setShow(true));
  }, []);

  async function handleConfirm(plan: "yearly" | "monthly") {
    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError("Session expired. Please go back and sign up again.");
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/start/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Subscription creation failed.");
      }

      router.push("/start/success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 440,
        margin: "0 auto",
        padding: "24px 16px 60px",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Progress dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 40 }}>
        <div style={{ width: 8, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.3)" }} />
        <div style={{ width: 8, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.3)" }} />
        <div style={{ width: 8, height: 8, borderRadius: 4, background: "#fff" }} />
      </div>

      {/* Simple question */}
      <h2
        style={{
          fontSize: "1.7rem",
          fontWeight: 800,
          color: "#fff",
          textAlign: "center",
          letterSpacing: "-0.5px",
          margin: "0 0 10px",
          lineHeight: 1.3,
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(12px)",
          transition: "all 0.4s ease",
        }}
      >
        Would you like the yearly plan?
      </h2>

      <p
        style={{
          fontSize: "0.95rem",
          color: "rgba(255,255,255,0.6)",
          textAlign: "center",
          margin: "0 0 32px",
          lineHeight: 1.5,
          opacity: show ? 1 : 0,
          transition: "opacity 0.4s ease 0.1s",
        }}
      >
        No charge until your trial ends. Cancel anytime.
      </p>


      {/* Total due today card */}
      <div
        style={{
          width: "100%",
          background: "rgba(62,207,142,0.1)",
          border: "1.5px solid rgba(62,207,142,0.25)",
          borderRadius: 16,
          padding: "20px 24px",
          marginBottom: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          opacity: show ? 1 : 0,
          transition: "opacity 0.4s ease 0.2s",
        }}
      >
        <div>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "#fff" }}>
            Total due today
          </div>
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginTop: 3 }}>
            Free for 7 days
          </div>
        </div>
        <div
          style={{
            fontSize: "1.8rem",
            fontWeight: 800,
            color: "#3ecf8e",
            letterSpacing: "-0.5px",
          }}
        >
          $0.00
        </div>
      </div>

      {/* Pricing + trial end note */}
      <p
        style={{
          fontSize: "0.75rem",
          color: "rgba(255,255,255,0.4)",
          textAlign: "center",
          margin: "0 0 32px",
          opacity: show ? 1 : 0,
          transition: "opacity 0.4s ease 0.25s",
        }}
      >
        $99.99/yr or $12.99/mo after your trial ends on {getTrialEndDate()}
      </p>

      {/* Yes — Yearly */}
      <button
        onClick={() => handleConfirm("yearly")}
        disabled={submitting}
        style={{
          width: "100%",
          maxWidth: 400,
          display: "block",
          padding: "17px",
          background: "#fff",
          color: "#635BFF",
          border: "none",
          borderRadius: 16,
          fontSize: "1.1rem",
          fontWeight: 700,
          letterSpacing: "-0.2px",
          cursor: submitting ? "wait" : "pointer",
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
          marginBottom: 14,
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(12px)",
          transition: "all 0.3s ease",
          transitionDelay: "0.3s",
        }}
      >
        {submitting ? "Starting..." : "Yes, Go Yearly"}
      </button>

      {/* No — Monthly */}
      <button
        onClick={() => handleConfirm("monthly")}
        disabled={submitting}
        style={{
          background: "none",
          border: "none",
          color: "rgba(255,255,255,0.45)",
          fontSize: "0.9rem",
          fontWeight: 500,
          cursor: "pointer",
          padding: "8px 16px",
          opacity: show ? 1 : 0,
          transition: "opacity 0.4s ease 0.35s",
        }}
      >
        No, Keep Monthly
      </button>

      {/* Error */}
      {error && (
        <div
          style={{
            width: "100%",
            background: "rgba(255,77,79,0.15)",
            color: "#ff6b6b",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: "0.82rem",
            marginTop: 16,
            lineHeight: 1.4,
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}
    </main>
  );
}
