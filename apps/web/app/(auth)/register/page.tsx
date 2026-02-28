"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase-client";
import { SocialAuthButtons, AuthDivider } from "@/components/SocialAuthButtons";

const APP_STORE_URL = "#";
const PLAY_STORE_URL = "#";

function AppleIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="22" viewBox="0 0 17 20" fill="currentColor">
      <path d="M.517 1.206A1.4 1.4 0 0 0 0 2.275v15.45a1.4 1.4 0 0 0 .517 1.069l.056.05 8.662-8.663v-.204L.573 1.156l-.056.05z"/>
      <path d="M12.122 13.068l-2.887-2.887v-.204l2.887-2.887.065.037 3.42 1.943c.977.555.977 1.463 0 2.018l-3.42 1.943-.065.037z"/>
      <path d="M12.187 13.031L9.235 10.08.517 18.794c.322.34.856.382 1.456.043l10.214-5.806"/>
      <path d="M12.187 7.127L1.973 1.322C1.373.982.84 1.024.517 1.365L9.235 10.08l2.952-2.952z"/>
    </svg>
  );
}

type DeviceType = "iphone" | "ipad" | "android_phone" | "android_tablet" | "desktop";

function detectDevice(): DeviceType {
  const ua = navigator.userAgent;
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ipad";
  if (/iPhone|iPod/i.test(ua)) return "iphone";
  if (/Android/i.test(ua)) {
    return /Mobile/i.test(ua) ? "android_phone" : "android_tablet";
  }
  if (/webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return "android_phone";
  return "desktop";
}

function deviceLabel(device: DeviceType): string {
  switch (device) {
    case "ipad": return "your iPad";
    case "android_tablet": return "your tablet";
    default: return "your phone";
  }
}

/* ── Slide gradients ─────────────────────────────────────────────────────────── */

const GRADIENTS = [
  "linear-gradient(180deg, #1A1040 0%, #2D1B69 50%, #635BFF 100%)",
  "linear-gradient(180deg, #0D1117 0%, #1A1040 50%, #3D2B8C 100%)",
  "linear-gradient(180deg, #0F2027 0%, #203A43 50%, #2C5364 100%)",
  "linear-gradient(180deg, #1A1040 0%, #2D1B69 50%, #635BFF 100%)",
];

const TOTAL_SLIDES = 4;

/* ── Floating particles (CSS-animated) ────────────────────────────────────── */

interface Particle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  floatRange: number;
  duration: number;
  delay: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 85,
    size: 3 + Math.random() * 5,
    opacity: 0.1 + Math.random() * 0.3,
    floatRange: 15 + Math.random() * 25,
    duration: 2.5 + Math.random() * 2,
    delay: Math.random() * 2,
  }));
}

function FloatingParticles() {
  const [particles] = useState(() => generateParticles(20));

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1, overflow: "hidden" }}>
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            backgroundColor: "#FFFFFF",
            opacity: p.opacity,
            animation: `floatParticle ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Page 1: The Hook ────────────────────────────────────────────────────────── */

function PageHook({ visible }: { visible: boolean }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "100%", padding: "0 2rem",
      opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)",
      transition: "opacity 0.6s ease, transform 0.6s ease",
    }}>
      {/* Logo with pulsing glow + sparkles */}
      <div style={{ position: "relative", width: 80, height: 80, marginBottom: 32 }}>
        {/* Glow */}
        <div style={{
          position: "absolute", left: -10, top: -10,
          width: 100, height: 100, borderRadius: 50,
          backgroundColor: "rgba(99, 91, 255, 0.25)",
          animation: "pulse 3s ease-in-out infinite",
        }} />
        {/* Logo */}
        <img
          src="/favicon.png"
          alt="Threely"
          width={80}
          height={80}
          style={{
            position: "relative", borderRadius: 20,
            animation: "pulse 3s ease-in-out infinite",
            zIndex: 2,
          }}
        />
        {/* Sparkles */}
        {[0, 60, 120, 180, 240, 300].map((angle, idx) => {
          const rad = (angle * Math.PI) / 180;
          const dist = 55;
          return (
            <div
              key={idx}
              style={{
                position: "absolute",
                left: 40 + Math.cos(rad) * dist - 3,
                top: 40 + Math.sin(rad) * dist - 3,
                width: 6, height: 6, borderRadius: 3,
                backgroundColor: "#FFF",
                animation: `sparkle 2s ease-in-out ${0.6 + idx * 0.08}s infinite`,
                zIndex: 3,
              }}
            />
          );
        })}
      </div>

      <h1 style={{
        fontSize: "clamp(2.5rem, 5vw, 3.5rem)", fontWeight: 800, color: "#FFF",
        textAlign: "center", letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0,
      }}>
        Do less.
      </h1>
      <h1 style={{
        fontSize: "clamp(2.5rem, 5vw, 3.5rem)", fontWeight: 800, color: "#FFF",
        textAlign: "center", letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0,
      }}>
        <span style={{ color: "#635BFF" }}>Achieve</span> more.
      </h1>

      <p style={{
        color: "rgba(255,255,255,0.7)", fontSize: "clamp(1rem, 2vw, 1.15rem)",
        textAlign: "center", lineHeight: 1.6, maxWidth: 340, marginTop: 24,
      }}>
        Set a goal. Get 3 daily tasks.<br />
        Make progress every single day.
      </p>
    </div>
  );
}

/* ── Page 2: How It Works ────────────────────────────────────────────────────── */

const STEPS = [
  { icon: "💬", title: "Share your ambition", desc: "Describe any goal in your own words — no templates, no limits" },
  { icon: "✨", title: "AI crafts your path", desc: "Personalized daily tasks shaped by your schedule, pace, and priorities" },
  { icon: "✅", title: "Take action daily", desc: "Complete focused tasks that compound into real progress" },
  { icon: "📊", title: "Grow with insights", desc: "Weekly AI analysis adapts your plan as you evolve" },
];

function PageHowItWorks({ visible }: { visible: boolean }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "100%", padding: "0 2rem",
      opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)",
      transition: "opacity 0.6s ease, transform 0.6s ease",
    }}>
      <h2 style={{
        fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 800, color: "#FFF",
        textAlign: "center", letterSpacing: "-0.03em", marginBottom: 8,
      }}>
        Your AI coach
      </h2>
      <p style={{
        color: "rgba(255,255,255,0.7)", fontSize: "1rem",
        textAlign: "center", marginBottom: 32, maxWidth: 340,
      }}>
        Personalized to your life, your pace, your goals.
      </p>

      <div style={{ width: "100%", maxWidth: 380, position: "relative" }}>
        {/* Connecting line */}
        <div style={{
          position: "absolute", left: 23, top: 48, width: 2, bottom: 24,
          background: "rgba(255,255,255,0.15)", borderRadius: 1,
          animation: visible ? "lineGrow 1s ease-out 0.2s both" : "none",
        }} />

        {STEPS.map((step, i) => (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "flex-start", gap: 16,
              marginBottom: i < STEPS.length - 1 ? 28 : 0,
              opacity: visible ? 1 : 0,
              transform: visible ? "none" : "translateX(-30px)",
              transition: `opacity 0.4s ease ${i * 0.18}s, transform 0.4s ease ${i * 0.18}s`,
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 24,
              backgroundColor: "rgba(255,255,255,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, flexShrink: 0,
            }}>
              {step.icon}
            </div>
            <div>
              <div style={{ color: "#FFF", fontSize: "1.05rem", fontWeight: 600 }}>{step.title}</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.875rem", marginTop: 2 }}>{step.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Page 3: The Payoff ──────────────────────────────────────────────────────── */

function PagePayoff({ visible }: { visible: boolean }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "100%", padding: "0 2rem",
      opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)",
      transition: "opacity 0.6s ease, transform 0.6s ease",
    }}>
      {/* Animated checkmark */}
      <div style={{
        width: 88, height: 88, borderRadius: 44,
        backgroundColor: "#3ECF8E",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: visible ? "bounceIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both" : "none",
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="#FFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h1 style={{
        fontSize: "clamp(2.5rem, 5vw, 3.5rem)", fontWeight: 800, color: "#FFF",
        textAlign: "center", letterSpacing: "-0.03em", lineHeight: 1.05,
        marginTop: 32, marginBottom: 0,
      }}>
        Stay on <span style={{ color: "#3ECF8E" }}>track.</span>
      </h1>
      <h1 style={{
        fontSize: "clamp(2.5rem, 5vw, 3.5rem)", fontWeight: 800, color: "#FFF",
        textAlign: "center", letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0,
      }}>
        Every day.
      </h1>

      <p style={{
        color: "rgba(255,255,255,0.7)", fontSize: "clamp(1rem, 2vw, 1.15rem)",
        textAlign: "center", lineHeight: 1.6, maxWidth: 340, marginTop: 24,
      }}>
        Complete 3 focused tasks daily.<br />
        Watch your goals come to life.
      </p>

      {/* Frosted stat card */}
      <div style={{
        marginTop: 32,
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: 14, padding: "16px 24px",
        border: "1px solid rgba(255,255,255,0.15)",
        maxWidth: 340,
      }}>
        <p style={{
          color: "rgba(255,255,255,0.85)", fontSize: "1rem",
          fontWeight: 500, textAlign: "center", margin: 0,
        }}>
          Small steps. Big results. AI keeps you moving.
        </p>
      </div>
    </div>
  );
}

/* ── Page 4: Auth ────────────────────────────────────────────────────────────── */

function PageAuth({ visible, onSignUp, onSignIn }: {
  visible: boolean;
  onSignUp: () => void;
  onSignIn: () => void;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "100%", padding: "0 2rem",
      opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)",
      transition: "opacity 0.6s ease, transform 0.6s ease",
    }}>
      {/* Logo */}
      <img
        src="/favicon.png"
        alt="Threely"
        width={56}
        height={56}
        style={{
          borderRadius: 14,
          boxShadow: "0 0 30px rgba(99, 91, 255, 0.4)",
        }}
      />

      <h2 style={{
        fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 800, color: "#FFF",
        textAlign: "center", letterSpacing: "-0.03em", marginTop: 24, marginBottom: 8,
      }}>
        Ready to begin?
      </h2>
      <p style={{
        color: "rgba(255,255,255,0.7)", fontSize: "1rem",
        textAlign: "center", maxWidth: 320, marginBottom: 32,
      }}>
        Your goals are waiting. Let&apos;s make them happen.
      </p>

      <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Google */}
        <button
          onClick={async () => {
            const supabase = getSupabase();
            await supabase.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo: `${window.location.origin}/api/auth/callback` },
            });
          }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            height: 52, borderRadius: 14, backgroundColor: "#FFF",
            border: "none", cursor: "pointer", fontSize: "1rem", fontWeight: 600,
            color: "#1F2937", width: "100%",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>

        {/* Apple */}
        <button
          onClick={async () => {
            const supabase = getSupabase();
            await supabase.auth.signInWithOAuth({
              provider: "apple",
              options: { redirectTo: `${window.location.origin}/api/auth/callback` },
            });
          }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            height: 52, borderRadius: 14, backgroundColor: "#000",
            border: "none", cursor: "pointer", fontSize: "1rem", fontWeight: 600,
            color: "#FFF", width: "100%",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
          Continue with Apple
        </button>

        {/* Email sign up */}
        <button
          onClick={onSignUp}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            height: 52, borderRadius: 14, backgroundColor: "transparent",
            border: "1.5px solid rgba(255,255,255,0.3)", cursor: "pointer",
            fontSize: "1rem", fontWeight: 500, color: "#FFF", width: "100%",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M22 7l-10 7L2 7" />
          </svg>
          Sign up with email
        </button>
      </div>

      <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.875rem", textAlign: "center", marginTop: 28 }}>
        Already have an account?{" "}
        <button
          onClick={onSignIn}
          style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.95)",
            fontWeight: 600, cursor: "pointer", fontSize: "0.875rem", padding: 0,
          }}
        >
          Sign in
        </button>
      </p>
    </div>
  );
}

/* ── Dot Indicators ──────────────────────────────────────────────────────────── */

function DotIndicators({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: "#FFF",
            opacity: i === current ? 1 : 0.3,
            transition: "width 0.3s ease, opacity 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

/* ── Onboarding Slideshow ────────────────────────────────────────────────────── */

function OnboardingSlides({ onSignUp, onSignIn, onBack }: { onSignUp: () => void; onSignIn: () => void; onBack: () => void }) {
  const [current, setCurrent] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));

  // Drag/swipe state
  const dragRef = useRef<{ startX: number; startY: number; dragging: boolean } | null>(null);
  const SWIPE_THRESHOLD = 50;

  const goTo = useCallback((page: number) => {
    const clamped = Math.max(0, Math.min(TOTAL_SLIDES - 1, page));
    setCurrent(clamped);
    setVisited(prev => new Set(prev).add(clamped));
  }, []);

  const handleNext = useCallback(() => {
    if (current < TOTAL_SLIDES - 1) goTo(current + 1);
  }, [current, goTo]);

  const handlePrev = useCallback(() => {
    if (current > 0) goTo(current - 1);
  }, [current, goTo]);

  // Mouse drag
  const onDragStart = useCallback((clientX: number, clientY: number) => {
    dragRef.current = { startX: clientX, startY: clientY, dragging: true };
  }, []);

  const onDragEnd = useCallback((clientX: number) => {
    if (!dragRef.current?.dragging) return;
    const dx = dragRef.current.startX - clientX;
    dragRef.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (dx > 0) {
      // Swiped left → next
      if (current < TOTAL_SLIDES - 1) goTo(current + 1);
    } else {
      // Swiped right → prev
      if (current > 0) goTo(current - 1);
    }
  }, [current, goTo]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start drag on buttons/links/inputs
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "BUTTON" || tag === "A" || tag === "INPUT") return;
    onDragStart(e.clientX, e.clientY);
  }, [onDragStart]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    onDragEnd(e.clientX);
  }, [onDragEnd]);

  const handleMouseLeave = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Touch swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    onDragStart(e.touches[0].clientX, e.touches[0].clientY);
  }, [onDragStart]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    onDragEnd(e.changedTouches[0].clientX);
  }, [onDragEnd]);

  // Mouse wheel (horizontal scroll or vertical scroll to change slides)
  useEffect(() => {
    let wheelTimeout: ReturnType<typeof setTimeout> | null = null;
    let wheelAccum = 0;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      wheelAccum += e.deltaY || e.deltaX;

      if (wheelTimeout) clearTimeout(wheelTimeout);
      wheelTimeout = setTimeout(() => { wheelAccum = 0; }, 200);

      if (Math.abs(wheelAccum) > 80) {
        if (wheelAccum > 0) {
          setCurrent(prev => {
            const next = Math.min(TOTAL_SLIDES - 1, prev + 1);
            setVisited(old => new Set(old).add(next));
            return next;
          });
        } else {
          setCurrent(prev => Math.max(0, prev - 1));
        }
        wheelAccum = 0;
      }
    }

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setCurrent(prev => {
          if (prev >= TOTAL_SLIDES - 1) return prev;
          const next = prev + 1;
          setVisited(old => new Set(old).add(next));
          return next;
        });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrent(prev => Math.max(0, prev - 1));
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, overflow: "hidden",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      {/* CSS keyframes */}
      <style>{`
        @keyframes floatParticle {
          from { transform: translateY(0); }
          to { transform: translateY(-25px); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes bounceIn {
          0% { transform: scale(0); }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes lineGrow {
          from { transform: scaleY(0); transform-origin: top; }
          to { transform: scaleY(1); transform-origin: top; }
        }
      `}</style>

      {/* Background gradients — cross-fade */}
      {GRADIENTS.map((grad, i) => (
        <div
          key={i}
          style={{
            position: "absolute", inset: 0,
            background: grad,
            opacity: i === current ? 1 : 0,
            transition: "opacity 0.8s ease",
            zIndex: 0,
          }}
        />
      ))}

      <FloatingParticles />

      {/* Slide content — drag/swipe area */}
      <div
        style={{ position: "relative", zIndex: 2, height: "100%", display: "flex", flexDirection: "column", cursor: "grab", userSelect: "none" }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Back button — always visible; page 0 goes to homepage */}
        <button
          onClick={current === 0 ? onBack : handlePrev}
          style={{
            position: "absolute", top: 24, left: 24,
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", cursor: "pointer", zIndex: 10, color: "#FFF", fontSize: 18,
          }}
        >
          ‹
        </button>

        {/* Pages */}
        <div style={{ flex: 1, position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, display: current === 0 ? "block" : "none" }}>
            <PageHook visible={current === 0} />
          </div>
          <div style={{ position: "absolute", inset: 0, display: current === 1 ? "block" : "none" }}>
            <PageHowItWorks visible={current === 1 && visited.has(1)} />
          </div>
          <div style={{ position: "absolute", inset: 0, display: current === 2 ? "block" : "none" }}>
            <PagePayoff visible={current === 2 && visited.has(2)} />
          </div>
          <div style={{ position: "absolute", inset: 0, display: current === 3 ? "block" : "none" }}>
            <PageAuth visible={current === 3 && visited.has(3)} onSignUp={onSignUp} onSignIn={onSignIn} />
          </div>
        </div>

        {/* Bottom: dots + next */}
        <div style={{
          padding: "0 2rem 2rem",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
        }}>
          <DotIndicators current={current} total={TOTAL_SLIDES} />

          {current < 3 && (
            <button
              onClick={handleNext}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                backgroundColor: "#FFFFFF", color: "#1A1040",
                height: 52, borderRadius: 14,
                fontSize: "1rem", fontWeight: 700,
                border: "none", cursor: "pointer",
                width: "100%", maxWidth: 400,
                boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
              }}
            >
              Next
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Registration Form ───────────────────────────────────────────────────────── */

function RegistrationForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create account.");
        setLoading(false);
        return;
      }

      const supabase = getSupabase();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError("Account created! Please sign in.");
        setLoading(false);
        router.push("/login");
        return;
      }

      router.push("/onboarding");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="card fade-in" style={{ padding: "2.5rem 2rem" }}>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <img src="/favicon.png" alt="Threely" width={52} height={52} style={{ borderRadius: 14, margin: "0 auto 1rem", display: "block" }} />
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>
          Create account
        </h1>
        <p style={{ color: "var(--subtext)", fontSize: "0.9rem" }}>
          Start turning your goals into action
        </p>
      </div>

      <SocialAuthButtons />
      <AuthDivider />

      <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label className="field-label">Email</label>
          <input
            className="field-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label className="field-label">Password</label>
          <input
            className="field-input"
            type="password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        {error && (
          <div style={{
            background: "var(--danger-light)", color: "var(--danger)",
            padding: "0.65rem 0.875rem", borderRadius: "var(--radius)",
            fontSize: "0.875rem",
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ marginTop: 4, height: 46, fontSize: "0.95rem" }}
        >
          {loading ? <span className="spinner" /> : "Create account"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: "1.5rem", color: "var(--subtext)", fontSize: "0.875rem" }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}

/* ── Main Register Page ──────────────────────────────────────────────────────── */

export default function RegisterPage() {
  const router = useRouter();
  const [device, setDevice] = useState<DeviceType>("desktop");
  const [showSlides, setShowSlides] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    setDevice(detectDevice());
    // Redirect if already logged in
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/dashboard");
      } else {
        setCheckingAuth(false);
      }
    });
  }, [router]);

  const isMobileDevice = device !== "desktop";

  // Show nothing while checking auth
  if (checkingAuth) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="spinner spinner-dark" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  // Mobile/tablet: show "get the app" screen
  if (isMobileDevice) {
    const isAppleDevice = device === "iphone" || device === "ipad";
    const isAndroidDevice = device === "android_phone" || device === "android_tablet";

    return (
      <div className="card fade-in" style={{ padding: "2.5rem 2rem", textAlign: "center" }}>
        <img src="/favicon.png" alt="Threely" width={64} height={64} style={{
          borderRadius: 16, margin: "0 auto 1.25rem", display: "block",
          boxShadow: "0 8px 24px rgba(99,91,255,0.25)",
        }} />

        <h1 style={{
          fontSize: "1.5rem", fontWeight: 800,
          letterSpacing: "-0.03em", marginBottom: 8, lineHeight: 1.2,
        }}>
          Threely is built for {deviceLabel(device)}
        </h1>

        <p style={{
          color: "var(--subtext)", fontSize: "0.9rem",
          lineHeight: 1.6, marginBottom: "1.75rem",
          maxWidth: 320, margin: "0 auto 1.75rem",
        }}>
          Get the full experience — daily reminders, task tracking, and AI coaching — all in the app.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: "1.25rem" }}>
          {!isAndroidDevice && (
            <a
              href={APP_STORE_URL}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 18px", background: "#0a2540", color: "#fff",
                borderRadius: 10, fontSize: "0.8rem", fontWeight: 600,
                textDecoration: "none", position: "relative",
              }}
            >
              <span className="new-badge" style={{ position: "absolute", top: -14, right: -6 }}>New</span>
              <AppleIcon />
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
                <span style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.8 }}>Download on the</span>
                <span>App Store</span>
              </span>
            </a>
          )}
          {!isAppleDevice && (
            <a
              href={PLAY_STORE_URL}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 18px", background: "#0a2540", color: "#fff",
                borderRadius: 10, fontSize: "0.8rem", fontWeight: 600,
                textDecoration: "none", position: "relative",
              }}
            >
              <span className="new-badge" style={{ position: "absolute", top: -14, right: -6 }}>New</span>
              <PlayIcon />
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
                <span style={{ fontSize: "0.6rem", fontWeight: 400, opacity: 0.8 }}>Get it on</span>
                <span>Google Play</span>
              </span>
            </a>
          )}
        </div>

        <p style={{ color: "var(--subtext)", fontSize: "0.95rem", lineHeight: 1.5, marginBottom: "1.25rem" }}>
          On a computer? Use the web version at{" "}
          <a href="https://threely.co" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>threely.co</a>
        </p>

        <p style={{ color: "var(--subtext)", fontSize: "0.875rem" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  // Desktop: show animated slides, then form
  if (showSlides) {
    return (
      <OnboardingSlides
        onSignUp={() => setShowSlides(false)}
        onSignIn={() => router.push("/login")}
        onBack={() => router.push("/")}
      />
    );
  }

  return <RegistrationForm />;
}
