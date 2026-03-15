"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase-client";

function getTrialEndDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

type Plan = "yearly" | "monthly";

export default function PlanPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Plan>("yearly");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setShow(true));
  }, []);

  async function handleConfirm() {
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
        body: JSON.stringify({ plan: selected }),
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
      }}
    >
      {/* Progress dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 28 }}>
        <div style={{ width: 8, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.3)" }} />
        <div style={{ width: 8, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.3)" }} />
        <div style={{ width: 8, height: 8, borderRadius: 4, background: "#fff" }} />
      </div>

      {/* Heading */}
      <h2
        style={{
          fontSize: "1.6rem",
          fontWeight: 800,
          color: "#fff",
          textAlign: "center",
          letterSpacing: "-0.5px",
          margin: "0 0 6px",
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(12px)",
          transition: "all 0.4s ease",
        }}
      >
        Choose your plan
      </h2>
      <p
        style={{
          fontSize: "0.9rem",
          color: "rgba(255,255,255,0.6)",
          textAlign: "center",
          margin: "0 0 28px",
          opacity: show ? 1 : 0,
          transition: "opacity 0.4s ease 0.1s",
        }}
      >
        Both plans include a 7-day free trial
      </p>

      {/* Plan cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {/* Yearly plan */}
        <button
          type="button"
          onClick={() => setSelected("yearly")}
          style={{
            position: "relative",
            width: "100%",
            padding: "20px 20px",
            background: selected === "yearly" ? "#fff" : "rgba(255,255,255,0.08)",
            border: selected === "yearly" ? "2.5px solid #635BFF" : "2px solid rgba(255,255,255,0.15)",
            borderRadius: 16,
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.2s ease",
            opacity: show ? 1 : 0,
            transform: show ? "translateY(0)" : "translateY(12px)",
            transitionDelay: "0.15s",
          }}
        >
          {/* Best value badge */}
          <div
            style={{
              position: "absolute",
              top: -11,
              right: 16,
              background: "linear-gradient(135deg, #635BFF, #8B5CF6)",
              color: "#fff",
              fontSize: "0.65rem",
              fontWeight: 700,
              padding: "4px 12px",
              borderRadius: 20,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Best Value
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: selected === "yearly" ? "#0A2540" : "#fff",
                  marginBottom: 4,
                }}
              >
                Yearly
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: selected === "yearly" ? "#425466" : "rgba(255,255,255,0.5)",
                }}
              >
                $8.33/mo &middot; billed annually
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 800,
                  color: selected === "yearly" ? "#0A2540" : "#fff",
                  letterSpacing: "-0.5px",
                }}
              >
                $99.99
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: "#3ecf8e",
                }}
              >
                SAVE 36%
              </div>
            </div>
          </div>

          {/* Radio indicator */}
          <div
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              width: 20,
              height: 20,
              borderRadius: 10,
              border: selected === "yearly" ? "6px solid #635BFF" : "2px solid rgba(255,255,255,0.3)",
              background: selected === "yearly" ? "#fff" : "transparent",
              transition: "all 0.2s ease",
              display: "none", // hidden since the whole card is selectable
            }}
          />
        </button>

        {/* Monthly plan */}
        <button
          type="button"
          onClick={() => setSelected("monthly")}
          style={{
            position: "relative",
            width: "100%",
            padding: "20px 20px",
            background: selected === "monthly" ? "#fff" : "rgba(255,255,255,0.08)",
            border: selected === "monthly" ? "2.5px solid #635BFF" : "2px solid rgba(255,255,255,0.15)",
            borderRadius: 16,
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.2s ease",
            opacity: show ? 1 : 0,
            transform: show ? "translateY(0)" : "translateY(12px)",
            transitionDelay: "0.25s",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: selected === "monthly" ? "#0A2540" : "#fff",
                  marginBottom: 4,
                }}
              >
                Monthly
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: selected === "monthly" ? "#425466" : "rgba(255,255,255,0.5)",
                }}
              >
                Billed monthly
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 800,
                  color: selected === "monthly" ? "#0A2540" : "#fff",
                  letterSpacing: "-0.5px",
                }}
              >
                $12.99
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: selected === "monthly" ? "#8898AA" : "rgba(255,255,255,0.4)",
                }}
              >
                /month
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Total due today */}
      <div
        style={{
          background: "rgba(62,207,142,0.1)",
          border: "1.5px solid rgba(62,207,142,0.25)",
          borderRadius: 14,
          padding: "16px 20px",
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          opacity: show ? 1 : 0,
          transition: "opacity 0.4s ease 0.3s",
        }}
      >
        <div>
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff" }}>
            Total due today
          </div>
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
            Free for 7 days &middot; cancel anytime
          </div>
        </div>
        <div
          style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            color: "#3ecf8e",
            letterSpacing: "-0.5px",
          }}
        >
          $0.00
        </div>
      </div>

      {/* After trial info */}
      <p
        style={{
          fontSize: "0.78rem",
          color: "rgba(255,255,255,0.45)",
          textAlign: "center",
          margin: "0 0 20px",
          lineHeight: 1.5,
        }}
      >
        After your trial ends on {getTrialEndDate()}, you&apos;ll be charged{" "}
        {selected === "yearly" ? "$99.99/year" : "$12.99/month"}.
      </p>

      {/* CTA button */}
      <button
        onClick={handleConfirm}
        disabled={submitting}
        style={{
          width: "100%",
          maxWidth: 400,
          display: "block",
          margin: "0 auto 12px",
          padding: "16px",
          background: "#fff",
          color: "#635BFF",
          border: "none",
          borderRadius: 16,
          fontSize: "1.05rem",
          fontWeight: 700,
          letterSpacing: "-0.2px",
          cursor: submitting ? "wait" : "pointer",
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
          transition: "transform 0.15s, box-shadow 0.15s",
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(12px)",
          transitionDelay: "0.35s",
        }}
      >
        {submitting ? "Starting trial..." : "Start Free Trial"}
      </button>

      {/* Error */}
      {error && (
        <div
          style={{
            background: "rgba(255,77,79,0.15)",
            color: "#ff6b6b",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: "0.82rem",
            marginBottom: 12,
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
