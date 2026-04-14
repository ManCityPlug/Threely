"use client";

import { useEffect, useState } from "react";
import { offersApi, type UserOffer } from "@/lib/api-client";
import { useToast } from "./ToastProvider";

interface Props {
  onActiveChange?: (hasActive: boolean) => void;
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

export default function OfferBanner({ onActiveChange }: Props) {
  const { showToast } = useToast();
  const [offer, setOffer] = useState<UserOffer | null>(null);
  const [countdown, setCountdown] = useState<{ text: string; urgent: boolean }>(
    { text: "", urgent: false }
  );
  const [confirming, setConfirming] = useState(false);
  const [claiming, setClaiming] = useState(false);

  // Load offer on mount
  useEffect(() => {
    let cancelled = false;
    offersApi
      .me()
      .then((res) => {
        if (cancelled) return;
        setOffer(res.offer);
        if (onActiveChange) onActiveChange(!!res.offer);
      })
      .catch(() => {
        if (onActiveChange) onActiveChange(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown updates every minute
  useEffect(() => {
    if (!offer) return;
    const update = () => setCountdown(formatCountdown(offer.expiresAt));
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [offer]);

  async function handleClaim() {
    if (!offer) return;
    setClaiming(true);
    try {
      const res = await offersApi.claim(offer.id);
      showToast(`Offer applied! ${res.description}`, "success");
      setOffer(null);
      if (onActiveChange) onActiveChange(false);
      setConfirming(false);
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

  if (!offer) return null;

  return (
    <>
      <div
        className="fade-in"
        style={{
          padding: "1rem 1.25rem",
          background: "linear-gradient(135deg, #D4A843, #B8862D)",
          borderRadius: 14,
          marginBottom: "1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          boxShadow: "0 4px 20px rgba(212,168,67,0.18)",
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <div
            style={{
              fontSize: "0.95rem",
              fontWeight: 700,
              color: "#fff",
              marginBottom: 2,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>{"\uD83C\uDF81"}</span>
            <span>Special offer: {offer.description}</span>
          </div>
          <div
            style={{
              fontSize: "0.82rem",
              color: countdown.urgent ? "#fee2e2" : "rgba(255,255,255,0.85)",
              fontWeight: 600,
            }}
          >
            Expires in {countdown.text || "..."}
          </div>
        </div>
        <button
          onClick={() => setConfirming(true)}
          style={{
            padding: "0.7rem 1.4rem",
            borderRadius: 10,
            background: "#fff",
            color: "#B8862D",
            fontWeight: 800,
            fontSize: "0.88rem",
            border: "none",
            cursor: "pointer",
            whiteSpace: "nowrap",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          Claim now {"\u2192"}
        </button>
      </div>

      {/* Confirmation modal */}
      {confirming && (
        <div
          onClick={() => !claiming && setConfirming(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#141414",
              border: "1.5px solid #D4A843",
              borderRadius: 16,
              padding: "1.75rem 1.5rem",
              maxWidth: 380,
              width: "100%",
              color: "#fff",
              boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
            }}
          >
            <h3
              style={{
                fontSize: "1.2rem",
                fontWeight: 800,
                marginBottom: "0.5rem",
                color: "#fff",
              }}
            >
              Apply this offer?
            </h3>
            <p
              style={{
                fontSize: "0.9rem",
                color: "#a1a1aa",
                lineHeight: 1.55,
                marginBottom: "1.25rem",
              }}
            >
              {offer.description}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setConfirming(false)}
                disabled={claiming}
                style={{
                  flex: 1,
                  padding: "0.7rem",
                  borderRadius: 10,
                  background: "transparent",
                  color: "#a1a1aa",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  border: "1px solid #3f3f46",
                  cursor: claiming ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleClaim}
                disabled={claiming}
                style={{
                  flex: 2,
                  padding: "0.7rem",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #D4A843, #B8862D)",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  border: "none",
                  cursor: claiming ? "not-allowed" : "pointer",
                  opacity: claiming ? 0.7 : 1,
                }}
              >
                {claiming ? "Applying..." : "Confirm & Apply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
