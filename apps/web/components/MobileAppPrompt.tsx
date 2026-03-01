"use client";

import { useState, useEffect, useCallback } from "react";

// TODO: Replace these with actual App Store / Play Store URLs
const APP_STORE_URL = "#";
const PLAY_STORE_URL = "#";

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

function getMobilePlatform(): "ios" | "android" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function AppleIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="22" viewBox="0 0 17 20" fill="currentColor">
      <path d="M.517 1.206A1.4 1.4 0 0 0 0 2.275v15.45a1.4 1.4 0 0 0 .517 1.069l.056.05 8.662-8.663v-.204L.573 1.156l-.056.05z" />
      <path d="M12.122 13.068l-2.887-2.887v-.204l2.887-2.887.065.037 3.42 1.943c.977.555.977 1.463 0 2.018l-3.42 1.943-.065.037z" />
      <path d="M12.187 13.031L9.235 10.08.517 18.794c.322.34.856.382 1.456.043l10.214-5.806" />
      <path d="M12.187 7.127L1.973 1.322C1.373.982.84 1.024.517 1.365L9.235 10.08l2.952-2.952z" />
    </svg>
  );
}

/* Inline keyframes so we don't depend on globals.css names */
const KEYFRAMES_STYLE = `
@keyframes mobilePromptFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes mobilePromptSlideUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes mobilePromptScaleIn {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes mobilePromptBannerIn {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}
@keyframes sparkle {
  0%, 100% { opacity: 0; transform: scale(0); }
  50% { opacity: 1; transform: scale(1); }
}
`;

function AnimatedLogo({ size, glowSize, sparkleDistance, sparkleColor = "#635bff" }: { size: number; glowSize: number; sparkleDistance: number; sparkleColor?: string }) {
  const center = size / 2;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {/* Glow */}
      <div style={{
        position: "absolute",
        left: (size - glowSize) / 2,
        top: (size - glowSize) / 2,
        width: glowSize,
        height: glowSize,
        borderRadius: "50%",
        backgroundColor: "rgba(99, 91, 255, 0.25)",
        animation: "pulse 3s ease-in-out infinite",
      }} />
      {/* Logo */}
      <img
        src="/favicon.png"
        alt="Threely"
        width={size}
        height={size}
        style={{
          position: "relative",
          borderRadius: size * 0.22,
          animation: "pulse 3s ease-in-out infinite",
          zIndex: 2,
        }}
      />
      {/* Sparkles */}
      {[0, 60, 120, 180, 240, 300].map((angle, idx) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <div
            key={idx}
            style={{
              position: "absolute",
              left: center + Math.cos(rad) * sparkleDistance - 3,
              top: center + Math.sin(rad) * sparkleDistance - 3,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: sparkleColor,
              animation: `sparkle 2s ease-in-out ${0.6 + idx * 0.08}s infinite`,
              zIndex: 3,
            }}
          />
        );
      })}
    </div>
  );
}

export default function MobileAppPrompt() {
  const [view, setView] = useState<"none" | "interstitial" | "banner">("none");
  const [animatingOut, setAnimatingOut] = useState(false);

  useEffect(() => {
    if (!isMobileDevice()) return;

    // Only show interstitial on the homepage (/)
    if (window.location.pathname === "/") {
      const t = setTimeout(() => setView("interstitial"), 600);
      return () => clearTimeout(t);
    } else {
      // On other pages, just show the bottom banner
      const t = setTimeout(() => setView("banner"), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const dismissInterstitial = useCallback(() => {
    setAnimatingOut(true);
    setTimeout(() => {
      setView("none");
      setAnimatingOut(false);
      setTimeout(() => setView("banner"), 150);
    }, 350);
  }, []);

  // Lock body scroll when interstitial is open
  useEffect(() => {
    if (view === "interstitial") {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.top = `-${window.scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || "0") * -1);
      }
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
    };
  }, [view]);

  if (view === "none") return null;

  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES_STYLE }} />

      {view === "interstitial" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#fff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            fontFamily: font,
            animation: animatingOut ? undefined : "mobilePromptFadeIn 0.4s ease both",
            opacity: animatingOut ? 0 : undefined,
            transition: animatingOut ? "opacity 0.35s ease" : undefined,
            overflow: "hidden",
          }}
        >
          {/* Close X button */}
          <button
            onClick={dismissInterstitial}
            style={{
              position: "fixed",
              top: 16,
              right: 16,
              zIndex: 10000,
              background: "none",
              border: "none",
              color: "#8898aa",
              fontSize: 28,
              cursor: "pointer",
              padding: 8,
              lineHeight: 1,
              fontFamily: "inherit",
              animation: "mobilePromptFadeIn 0.4s ease 0.85s both",
            }}
            aria-label="Close"
          >
            ✕
          </button>

          {/* Background gradient accent — fades to white before the benefit cards */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 420,
              background: "linear-gradient(180deg, #ede9ff 0%, #f2efff 60%, #ffffff 100%)",
              zIndex: 0,
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              maxWidth: 380,
              width: "100%",
              padding: "2.5rem 1.5rem 2rem",
            }}
          >
            {/* App icon — animated with glow + sparkles */}
            <div style={{
              marginBottom: "1.5rem",
              animation: "mobilePromptScaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.15s both",
            }}>
              <AnimatedLogo size={72} glowSize={96} sparkleDistance={50} />
            </div>

            {/* Tagline */}
            <p
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "#635bff",
                textTransform: "uppercase" as const,
                textAlign: "center",
                marginBottom: "0.5rem",
                animation: "mobilePromptSlideUp 0.5s ease 0.2s both",
              }}
            >
              Do Less. Achieve More.
            </p>

            {/* Heading — slides up */}
            <h1
              style={{
                fontSize: "1.75rem",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "#0a2540",
                textAlign: "center",
                marginBottom: "0.5rem",
                lineHeight: 1.2,
                animation: "mobilePromptSlideUp 0.5s ease 0.25s both",
              }}
            >
              Your goal.
              <br />
              Your plan. Every day.
            </h1>

            {/* Subtitle — slides up */}
            <p
              style={{
                fontSize: "0.95rem",
                color: "#425466",
                textAlign: "center",
                lineHeight: 1.6,
                marginBottom: "2rem",
                animation: "mobilePromptSlideUp 0.5s ease 0.35s both",
              }}
            >
              Tell us what you want to achieve.
              <br />
              We&apos;ll map out the path.
            </p>

            {/* Benefits — staggered slide up */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                width: "100%",
                marginBottom: "1.75rem",
              }}
            >
              {[
                {
                  icon: "\u{1F3AF}",
                  title: "Know exactly what to do today",
                  desc: "A personalized plan that fits your schedule",
                },
                {
                  icon: "\u2705",
                  title: "A real path to get there",
                  desc: "Structured daily steps that actually move you forward",
                },
                {
                  icon: "\u{1F9E0}",
                  title: "Your plan gets smarter over time",
                  desc: "It adapts based on your real progress",
                },
              ].map((b, i) => (
                <div
                  key={b.title}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "0.875rem 1rem",
                    background: "#f6f9fc",
                    borderRadius: 12,
                    border: "1px solid #e3e8ef",
                    animation: `mobilePromptSlideUp 0.45s ease ${0.4 + i * 0.1}s both`,
                  }}
                >
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{b.icon}</span>
                  <div>
                    <div
                      style={{
                        fontSize: "0.9rem",
                        fontWeight: 700,
                        color: "#0a2540",
                        marginBottom: 1,
                      }}
                    >
                      {b.title}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#8898aa" }}>
                      {b.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Now available on mobile banner */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                width: "100%",
                marginTop: "0.25rem",
                marginBottom: "1.25rem",
                animation: "mobilePromptSlideUp 0.45s ease 0.65s both",
              }}
            >
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 20px",
                background: "#ede9ff",
                borderRadius: 20,
              }}>
                <span style={{ fontSize: "0.95rem" }}>📱</span>
                <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#635bff" }}>Now available on mobile</span>
              </div>
            </div>

            {/* Store button — platform-specific */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 10,
                width: "100%",
                marginBottom: "0.75rem",
                animation: "mobilePromptSlideUp 0.45s ease 0.7s both",
              }}
            >
              {getMobilePlatform() !== "android" && (
                <a
                  href={APP_STORE_URL}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    padding: "14px 28px 14px 18px",
                    minWidth: 190,
                    background: "#0a2540",
                    color: "#fff",
                    borderRadius: 12,
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    textDecoration: "none",
                    position: "relative",
                  }}
                >
                  <span style={{
                    position: "absolute",
                    top: -9,
                    right: -10,
                    background: "#635bff",
                    color: "#fff",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 10,
                    letterSpacing: "0.03em",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  }}>New</span>
                  <AppleIcon />
                  <span
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      lineHeight: 1.2,
                    }}
                  >
                    <span style={{ fontSize: "0.65rem", fontWeight: 400, opacity: 0.8 }}>
                      Download on the
                    </span>
                    <span style={{ fontSize: "1.05rem", fontWeight: 700 }}>App Store</span>
                  </span>
                </a>
              )}
              {getMobilePlatform() !== "ios" && (
                <a
                  href={PLAY_STORE_URL}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    padding: "14px 28px 14px 18px",
                    minWidth: 190,
                    background: "#0a2540",
                    color: "#fff",
                    borderRadius: 12,
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    textDecoration: "none",
                    position: "relative",
                  }}
                >
                  <span style={{
                    position: "absolute",
                    top: -9,
                    right: -10,
                    background: "#635bff",
                    color: "#fff",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 10,
                    letterSpacing: "0.03em",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  }}>New</span>
                  <PlayIcon />
                  <span
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      lineHeight: 1.2,
                    }}
                  >
                    <span style={{ fontSize: "0.65rem", fontWeight: 400, opacity: 0.8 }}>
                      Get it on
                    </span>
                    <span style={{ fontSize: "1.05rem", fontWeight: 700 }}>Google Play</span>
                  </span>
                </a>
              )}
            </div>

            {/* Continue to website — fade in */}
            <button
              onClick={dismissInterstitial}
              style={{
                background: "none",
                border: "none",
                color: "#8898aa",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                padding: "0.5rem 1rem",
                fontFamily: "inherit",
                animation: "mobilePromptFadeIn 0.4s ease 0.85s both",
              }}
            >
              Continue to website
            </button>
          </div>
        </div>
      )}

      {view === "banner" && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 9998,
            background: "#fff",
            borderTop: "1px solid #e3e8ef",
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: font,
            boxShadow: "0 -4px 16px rgba(0,0,0,0.08)",
            animation: "mobilePromptBannerIn 0.35s ease both",
          }}
        >
          {/* App icon */}
          <img
            src="/favicon.png"
            alt="Threely"
            width={40}
            height={40}
            style={{ borderRadius: 10, flexShrink: 0 }}
          />

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "#0a2540",
                lineHeight: 1.3,
              }}
            >
              Threely
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "#8898aa",
                lineHeight: 1.3,
              }}
            >
              Do Less. Achieve More.
            </div>
          </div>

          {/* Open button */}
          <a
            href={getMobilePlatform() === "android" ? PLAY_STORE_URL : APP_STORE_URL}
            style={{
              padding: "7px 16px",
              background: "#635bff",
              color: "#fff",
              borderRadius: 8,
              fontSize: "0.8rem",
              fontWeight: 700,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            Get App
          </a>
        </div>
      )}
    </>
  );
}
