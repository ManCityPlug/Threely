"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

// TODO: Replace these with actual App Store / Play Store URLs
const APP_STORE_URL = "#";
const PLAY_STORE_URL = "#";

const DISMISS_KEY = "threely_banner_dismissed";

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
@keyframes mobilePromptBannerIn {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
`;

export default function MobileAppPrompt() {
  const [view, setView] = useState<"none" | "banner">("none");
  const pathname = usePathname();

  useEffect(() => {
    if (!isMobileDevice()) return;

    // Only show banner on the marketing/landing page (/)
    if (pathname !== "/") return;

    // Don't show if previously dismissed this session
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // sessionStorage unavailable — proceed
    }

    const t = setTimeout(() => setView("banner"), 600);
    return () => clearTimeout(t);
  }, [pathname]);

  // Hide banner when navigating away from /
  useEffect(() => {
    if (pathname !== "/") {
      setView("none");
    }
  }, [pathname]);

  const dismissBanner = () => {
    setView("none");
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // sessionStorage unavailable — just hide for current render
    }
  };

  if (view === "none") return null;

  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES_STYLE }} />

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
          {/* Close / dismiss button */}
          <button
            onClick={dismissBanner}
            style={{
              background: "none",
              border: "none",
              color: "#8898aa",
              fontSize: 18,
              cursor: "pointer",
              padding: 4,
              lineHeight: 1,
              flexShrink: 0,
            }}
            aria-label="Dismiss"
          >
            &#10005;
          </button>

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
