"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Understanding your situation…",
  "Mapping out your path…",
  "Creating today's tasks…",
  "Locking it in…",
];
const GOLD = "#D4A843";
const DURATION_MS = 6000;

export default function BuildingProgress() {
  const [progress, setProgress] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const startTime = Date.now();

    const animate = () => {
      if (cancelled) return;
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / DURATION_MS, 0.98);
      setProgress(t);
      if (t < 0.98) requestAnimationFrame(animate);
    };
    animate();

    const interval = setInterval(() => {
      setStepIdx((prev) => Math.min(prev + 1, STEPS.length - 1));
    }, 1500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: "3rem 1.5rem",
      maxWidth: 480, margin: "0 auto",
    }}>
      <h2 style={{
        fontSize: "clamp(1.2rem, 3.5vw, 1.5rem)",
        fontWeight: 700,
        color: "var(--text)",
        marginBottom: 8,
        letterSpacing: "-0.02em",
      }}>
        Threely Intelligence is building your plan
      </h2>

      <p style={{
        fontSize: "0.95rem",
        color: "rgba(255,255,255,0.7)",
        marginBottom: 28,
        minHeight: "1.4em",
        transition: "opacity 200ms ease",
      }}>
        {STEPS[stepIdx]}
      </p>

      {/* Progress bar — gold, themed */}
      <div style={{
        position: "relative",
        width: "100%", maxWidth: 360, height: 8,
        background: "rgba(212,168,67,0.15)",
        borderRadius: 999, overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${progress * 100}%`,
          background: `linear-gradient(90deg, ${GOLD}, #E8C547)`,
          borderRadius: 999,
          transition: "width 0.05s linear",
          boxShadow: `0 0 12px rgba(212,168,67,0.5)`,
        }} />
        {/* Shimmer sweep */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)",
          animation: "shimmerSweep 1.6s linear infinite",
          pointerEvents: "none",
          borderRadius: 999,
        }} />
      </div>

      <style>{`
        @keyframes shimmerSweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
