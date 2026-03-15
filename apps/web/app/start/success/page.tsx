"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const APP_STORE_URL = "https://apps.apple.com/app/threely/id6759625661";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.threely";

function getTrialEndDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function getMobilePlatform(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export default function SuccessPage() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    setPlatform(getMobilePlatform());
    requestAnimationFrame(() => setShow(true));
  }, []);

  const isMobile = platform !== "desktop";
  const storeUrl = platform === "android" ? PLAY_STORE_URL : APP_STORE_URL;
  const storeName = platform === "android" ? "Google Play" : "App Store";

  return (
    <main
      style={{
        maxWidth: 440,
        margin: "0 auto",
        padding: "60px 24px",
        textAlign: "center",
        flex: 1,
      }}
    >
      {/* Animated checkmark */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          background: "rgba(62,207,142,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px",
          transform: show ? "scale(1)" : "scale(0.5)",
          opacity: show ? 1 : 0,
          transition: "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease",
        }}
      >
        <span style={{ fontSize: 38, color: "#3ecf8e" }}>✓</span>
      </div>

      {/* Heading */}
      <h1
        style={{
          fontSize: "2rem",
          fontWeight: 800,
          color: "#fff",
          letterSpacing: "-0.5px",
          margin: "0 0 12px",
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(16px)",
          transition: "all 0.5s ease 0.15s",
        }}
      >
        You&apos;re in!
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: "1.05rem",
          color: "rgba(255,255,255,0.75)",
          lineHeight: 1.5,
          margin: "0 0 8px",
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(16px)",
          transition: "all 0.5s ease 0.25s",
        }}
      >
        Your 7-day free trial starts now.
      </p>

      <p
        style={{
          fontSize: "0.85rem",
          color: "rgba(255,255,255,0.5)",
          margin: "0 0 40px",
          opacity: show ? 1 : 0,
          transition: "opacity 0.5s ease 0.35s",
        }}
      >
        You won&apos;t be charged until {getTrialEndDate()}.
      </p>

      {/* Continue on Web — primary action */}
      <Link
        href="/onboarding"
        style={{
          display: "block",
          width: "100%",
          maxWidth: 300,
          margin: "0 auto 12px",
          padding: "16px 0",
          background: "#fff",
          color: "#635BFF",
          fontSize: "1.05rem",
          fontWeight: 700,
          letterSpacing: "-0.2px",
          borderRadius: 16,
          textDecoration: "none",
          textAlign: "center",
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(16px)",
          transition: "all 0.5s ease 0.4s",
        }}
      >
        Continue on Web
      </Link>

      {/* Download App — secondary action (mobile only) or primary for desktop */}
      {isMobile ? (
        <a
          href={storeUrl}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            maxWidth: 300,
            margin: "0 auto 16px",
            padding: "16px 0",
            background: "rgba(255,255,255,0.12)",
            color: "#fff",
            fontSize: "1rem",
            fontWeight: 700,
            letterSpacing: "-0.2px",
            borderRadius: 16,
            textDecoration: "none",
            textAlign: "center",
            border: "1.5px solid rgba(255,255,255,0.2)",
            opacity: show ? 1 : 0,
            transform: show ? "translateY(0)" : "translateY(16px)",
            transition: "all 0.5s ease 0.5s",
            position: "relative",
          }}
        >
          <span>Download App</span>
          <span style={{
            background: "#F59E0B",
            color: "#fff",
            fontSize: "0.55rem",
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: 6,
            letterSpacing: "0.03em",
            position: "absolute",
            top: -8,
            right: 40,
          }}>NEW</span>
        </a>
      ) : (
        <a
          href={APP_STORE_URL}
          style={{
            display: "block",
            width: "100%",
            maxWidth: 300,
            margin: "0 auto 16px",
            padding: "16px 0",
            background: "rgba(255,255,255,0.12)",
            color: "#fff",
            fontSize: "1rem",
            fontWeight: 700,
            letterSpacing: "-0.2px",
            borderRadius: 16,
            textDecoration: "none",
            textAlign: "center",
            border: "1.5px solid rgba(255,255,255,0.2)",
            opacity: show ? 1 : 0,
            transform: show ? "translateY(0)" : "translateY(16px)",
            transition: "all 0.5s ease 0.5s",
          }}
        >
          Download the App
        </a>
      )}

      {/* Helper text */}
      <p
        style={{
          fontSize: "0.78rem",
          color: "rgba(255,255,255,0.4)",
          margin: "8px 0 0",
          fontWeight: 500,
          opacity: show ? 1 : 0,
          transition: "opacity 0.5s ease 0.6s",
        }}
      >
        {isMobile
          ? `Available on the ${storeName}. Faster experience with daily reminders.`
          : "Also available on iOS and Android for the best experience."
        }
      </p>
    </main>
  );
}
