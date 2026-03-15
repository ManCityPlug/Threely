"use client";

import { useEffect, useState } from "react";

const APP_STORE_URL = "https://apps.apple.com/app/threely/id6759625661";

function getTrialEndDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function SuccessPage() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Trigger animation on mount
    requestAnimationFrame(() => setShow(true));
  }, []);

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

      {/* Download App button */}
      <a
        href={APP_STORE_URL}
        style={{
          display: "block",
          width: "100%",
          maxWidth: 300,
          margin: "0 auto 16px",
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
        Download the App
      </a>

      {/* Desktop hint */}
      <p
        style={{
          fontSize: "0.8rem",
          color: "rgba(255,255,255,0.45)",
          margin: "16px 0 0",
          fontWeight: 500,
          opacity: show ? 1 : 0,
          transition: "opacity 0.5s ease 0.5s",
        }}
      >
        Or use a computer to access threely.co
      </p>
    </main>
  );
}
