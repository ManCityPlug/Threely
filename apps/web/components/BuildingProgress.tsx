"use client";

import { useEffect, useState } from "react";

export default function BuildingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const startTime = Date.now();
    const DURATION = 8000; // 8 seconds to fill

    const animate = () => {
      if (cancelled) return;
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / DURATION, 0.98);
      // Linear steady fill — slow and consistent
      setProgress(t);
      if (t < 0.98) requestAnimationFrame(animate);
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
      <div style={{ fontSize: 48, marginBottom: 24, animation: "bounce 1.5s ease-in-out infinite" }}>
        {"🚀"}
      </div>

      {/* Progress bar — blue */}
      <div style={{
        width: "100%", maxWidth: 320, height: 10,
        background: "rgba(255,255,255,0.1)", borderRadius: 999, overflow: "hidden",
        marginBottom: 16,
      }}>
        <div style={{
          height: "100%",
          width: `${progress * 100}%`,
          background: "linear-gradient(90deg, #4A90D9 0%, #5B9FE6 50%, #3B7DD8 100%)",
          borderRadius: 999,
          transition: "width 0.05s linear",
          boxShadow: "0 0 12px rgba(74,144,217,0.4)",
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
