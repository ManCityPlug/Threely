"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { offersApi, type UserOffer } from "@/lib/api-client";
import { useToast } from "./ToastProvider";

interface Props {
  firstName: string;
}

function formatCountdown(expiresAt: string): { text: string; urgent: boolean } {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { text: "Expired", urgent: true };

  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (days >= 1) {
    return { text: `${days}d ${hours}h ${minutes}m`, urgent: false };
  }
  return { text: `${hours}h ${minutes}m`, urgent: true };
}

export default function OfferLoginModal({ firstName }: Props) {
  const { showToast } = useToast();
  const [offer, setOffer] = useState<UserOffer | null>(null);
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [countdown, setCountdown] = useState<{ text: string; urgent: boolean }>(
    { text: "", urgent: false }
  );

  // Load offer on mount
  useEffect(() => {
    let cancelled = false;
    offersApi
      .me()
      .then((res) => {
        if (cancelled || !res.offer) return;
        const seenKey = `offer_seen_${res.offer.id}`;
        if (typeof window !== "undefined" && localStorage.getItem(seenKey)) {
          return;
        }
        setOffer(res.offer);
        setOpen(true);
      })
      .catch(() => {
        // silently ignore
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Update countdown every minute
  useEffect(() => {
    if (!offer) return;
    const update = () => setCountdown(formatCountdown(offer.expiresAt));
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [offer]);

  function dismiss() {
    if (offer && typeof window !== "undefined") {
      localStorage.setItem(`offer_seen_${offer.id}`, "1");
    }
    setOpen(false);
  }

  async function handleClaim() {
    if (!offer) return;
    setClaiming(true);
    try {
      const res = await offersApi.claim(offer.id);
      showToast(`Offer applied! ${res.description}`, "success");
      if (typeof window !== "undefined") {
        localStorage.setItem(`offer_seen_${offer.id}`, "1");
      }
      setOpen(false);
      // Reload to refresh subscription state
      setTimeout(() => {
        if (typeof window !== "undefined") window.location.reload();
      }, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to claim";
      showToast(msg, "error");
    } finally {
      setClaiming(false);
    }
  }

  if (!offer || !open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        onClick={dismiss}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(4px)",
          zIndex: 10000,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "calc(100vw - 2rem)",
          maxWidth: 460,
          background: "#0a0a0a",
          border: "1.5px solid #D4A843",
          borderRadius: 18,
          padding: "2rem 1.75rem",
          zIndex: 10001,
          color: "#fff",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(212,168,67,0.15)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>{"\uD83C\uDF81"}</div>
          <h2
            style={{
              fontSize: "1.55rem",
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.02em",
              marginBottom: 6,
            }}
          >
            {firstName}, we have a gift for you
          </h2>
          <p
            style={{
              fontSize: "1rem",
              color: "#D4A843",
              fontWeight: 700,
              lineHeight: 1.4,
            }}
          >
            {offer.description}
          </p>
        </div>

        <div
          style={{
            background: "rgba(212,168,67,0.08)",
            border: "1px solid rgba(212,168,67,0.25)",
            borderRadius: 12,
            padding: "0.875rem 1rem",
            marginBottom: "1.25rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              color: "#a1a1aa",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 4,
            }}
          >
            Expires in
          </div>
          <div
            style={{
              fontSize: "1.3rem",
              fontWeight: 800,
              color: countdown.urgent ? "#f87171" : "#fff",
              fontFeatureSettings: '"tnum"',
            }}
          >
            {countdown.text || "..."}
          </div>
        </div>

        <button
          onClick={handleClaim}
          disabled={claiming}
          style={{
            width: "100%",
            padding: "0.95rem 1.5rem",
            borderRadius: 12,
            background: "linear-gradient(135deg, #D4A843, #B8862D)",
            color: "#fff",
            fontWeight: 800,
            fontSize: "1rem",
            border: "none",
            cursor: claiming ? "not-allowed" : "pointer",
            opacity: claiming ? 0.7 : 1,
            boxShadow: "0 4px 16px rgba(212,168,67,0.3)",
          }}
        >
          {claiming ? "Applying..." : "Claim now"}
        </button>

        <div style={{ textAlign: "center", marginTop: "0.875rem" }}>
          <button
            onClick={dismiss}
            style={{
              background: "none",
              border: "none",
              color: "#71717a",
              fontSize: "0.85rem",
              cursor: "pointer",
              padding: "0.25rem 0.5rem",
              textDecoration: "underline",
            }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
