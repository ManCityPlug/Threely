"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { label: "Understanding your situation\u2026", target: 0.25, duration: 3000 },
  { label: "Mapping out your path\u2026", target: 0.55, duration: 5000, delay: 3000 },
  { label: "Creating today's tasks\u2026", target: 0.85, duration: 7000, delay: 8000 },
  { label: "Locking it in\u2026", target: 0.95, duration: 10000, delay: 15000 },
];

interface BuildingProgressProps {
  title?: string;
  compact?: boolean;
}

export default function BuildingProgress({
  title = "Threely Intelligence is building your plan\u2026",
  compact = false,
}: BuildingProgressProps) {
  const [progress, setProgress] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Animate progress via incremental updates
    let current = 0;
    const tick = (target: number, duration: number) => {
      const start = current;
      const startTime = Date.now();
      const animate = () => {
        if (cancelled) return;
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const eased = start + (target - start) * t;
        current = eased;
        setProgress(eased);
        if (t < 1) requestAnimationFrame(animate);
      };
      animate();
    };

    // Kick off stages at their delays
    STEPS.forEach((step, i) => {
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          setStepIdx(i);
          tick(step.target, step.duration);
        }, step.delay ?? 0)
      );
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: compact ? "2rem 1.5rem" : "3rem 1.5rem",
      maxWidth: 480, margin: "0 auto",
    }}>
      <h2 style={{ fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)", marginBottom: 8 }}>
        {title}
      </h2>
      <p style={{ fontSize: "0.9rem", color: "var(--subtext)", marginBottom: 24, minHeight: 24, transition: "opacity 0.3s" }}>
        {STEPS[stepIdx].label}
      </p>

      {/* Progress bar */}
      <div style={{
        width: "100%", maxWidth: 360, height: 6,
        background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden",
        marginBottom: 20,
      }}>
        <div style={{
          height: "100%",
          width: `${progress * 100}%`,
          background: "linear-gradient(90deg, #E8C547 0%, #D4A843 50%, #B8862D 100%)",
          borderRadius: 999,
          transition: "width 0.15s linear",
        }} />
      </div>

      {/* Step indicators */}
      <div style={{ display: "flex", gap: 6 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: i <= stepIdx ? "#D4A843" : "rgba(255,255,255,0.15)",
            transition: "background-color 0.3s",
          }} />
        ))}
      </div>
    </div>
  );
}
