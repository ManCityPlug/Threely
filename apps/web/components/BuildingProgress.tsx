"use client";

import { useEffect, useState } from "react";

export default function BuildingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let current = 0;
    const startTime = Date.now();

    // Smooth progress: fast start, slows down, never quite reaches 100%
    const animate = () => {
      if (cancelled) return;
      const elapsed = Date.now() - startTime;
      // Fast to 60% in 3s, slow to 90% by 10s, crawl to 95% by 20s
      const t = elapsed / 1000;
      current = t < 3
        ? (t / 3) * 0.6
        : t < 10
        ? 0.6 + ((t - 3) / 7) * 0.3
        : Math.min(0.9 + ((t - 10) / 20) * 0.05, 0.96);
      setProgress(current);
      requestAnimationFrame(animate);
    };
    animate();

    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: "3rem 1.5rem",
      maxWidth: 400, margin: "0 auto",
    }}>
      {/* Animated emoji */}
      <div style={{ fontSize: 48, marginBottom: 24, animation: "bounce 1.5s ease-in-out infinite" }}>
        {"🚀"}
      </div>

      {/* Progress bar */}
      <div style={{
        width: "100%", maxWidth: 320, height: 8,
        background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden",
        marginBottom: 16,
      }}>
        <div style={{
          height: "100%",
          width: `${progress * 100}%`,
          background: "linear-gradient(90deg, #E8C547 0%, #D4A843 50%, #B8862D 100%)",
          borderRadius: 999,
          transition: "width 0.1s linear",
        }} />
      </div>

      <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.85)" }}>
        This will only take a few seconds
      </p>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
