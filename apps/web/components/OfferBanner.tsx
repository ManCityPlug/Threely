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
            <span className="gift-wobble" style={{ fontSize: "1.1rem", display: "inline-block" }}>{"\uD83C\uDF81"}</span>
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

      {/* Gift offer modal — matches OfferLoginModal style */}
      {confirming && (
        <>
          <div
            onClick={() => !claiming && setConfirming(false)}
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
              background: "#141414",
              border: "1.5px solid #D4A843",
              borderRadius: 18,
              padding: "2rem 1.75rem",
              zIndex: 10001,
              color: "#fff",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(212,168,67,0.15)",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
              <div className="gift-hero-wrap">
                <div className="gift-hero-glow gift-hero-glow-outer" aria-hidden />
                <div className="gift-hero-glow gift-hero-glow-inner" aria-hidden />
                <div className="gift-hero">{"\uD83C\uDF81"}</div>
              </div>
              <h2
                style={{
                  fontSize: "1.55rem",
                  fontWeight: 800,
                  color: "#fff",
                  letterSpacing: "-0.02em",
                  marginBottom: 6,
                }}
              >
                We have a gift for you
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
                onClick={() => setConfirming(false)}
                disabled={claiming}
                style={{
                  background: "none",
                  border: "none",
                  color: "#71717a",
                  fontSize: "0.85rem",
                  cursor: claiming ? "not-allowed" : "pointer",
                  padding: "0.25rem 0.5rem",
                  textDecoration: "underline",
                }}
              >
                Maybe later
              </button>
            </div>
          </div>
        </>
      )}

      <style>{giftAnimationCss}</style>
    </>
  );
}

// Shared gift-emoji animations. Declared once here and re-imported by
// OfferLoginModal so the two components never drift out of sync visually.
export const giftAnimationCss = `
  @keyframes giftPopIn {
    0%   { transform: scale(0) rotate(-25deg); opacity: 0; }
    55%  { transform: scale(1.25) rotate(12deg); opacity: 1; }
    80%  { transform: scale(0.95) rotate(-6deg); }
    100% { transform: scale(1) rotate(0deg); }
  }
  @keyframes giftShake {
    0%, 8%, 92%, 100% { transform: rotate(0deg); }
    15%, 45%, 75%     { transform: rotate(-12deg); }
    30%, 60%, 90%     { transform: rotate(12deg); }
  }
  @keyframes giftGlowPulse {
    0%, 100% { transform: scale(0.85); opacity: 0.35; }
    50%      { transform: scale(1.08); opacity: 0.7; }
  }
  .gift-hero-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 120px;
    height: 120px;
    margin-bottom: 8px;
  }
  .gift-hero {
    position: relative;
    font-size: 64px;
    line-height: 1;
    transform-origin: center;
    animation:
      giftPopIn 700ms cubic-bezier(0.34, 1.56, 0.64, 1) both,
      giftShake 2800ms cubic-bezier(0.36, 0.07, 0.19, 0.97) 700ms infinite;
    filter: drop-shadow(0 4px 12px rgba(212,168,67,0.55));
    z-index: 1;
  }
  .gift-hero-glow {
    position: absolute;
    top: 50%;
    left: 50%;
    border-radius: 50%;
    pointer-events: none;
    transform-origin: center;
    animation: giftGlowPulse 2400ms ease-in-out infinite;
  }
  .gift-hero-glow-outer {
    width: 120px;
    height: 120px;
    margin: -60px 0 0 -60px;
    background: radial-gradient(circle, rgba(212,168,67,0.55) 0%, rgba(212,168,67,0.2) 50%, transparent 75%);
  }
  .gift-hero-glow-inner {
    width: 80px;
    height: 80px;
    margin: -40px 0 0 -40px;
    background: radial-gradient(circle, rgba(255,215,100,0.7) 0%, rgba(212,168,67,0.3) 55%, transparent 80%);
    animation-delay: 500ms;
  }
  .gift-wobble {
    transform-origin: center;
    animation: giftShake 2800ms cubic-bezier(0.36, 0.07, 0.19, 0.97) infinite;
  }
`;
