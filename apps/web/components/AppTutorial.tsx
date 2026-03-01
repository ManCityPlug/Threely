"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

// ─── Spotlight step definitions ──────────────────────────────────────────────

interface SpotlightStep {
  title: string;
  description: string;
  target: string | null;      // data-walkthrough attribute value, or null for centered
  route: string | null;       // route to navigate to, or null for no navigation
  tooltipPosition: "above" | "below" | "center";
}

const STEPS: SpotlightStep[] = [
  {
    title: "Your Daily Tasks",
    description:
      "Every day, Threely generates 3 personalized tasks for each of your goals. Tap any task to see details, refine it, or ask AI about it.",
    target: "first-task-card",
    route: "/dashboard",
    tooltipPosition: "below",
  },
  {
    title: "Want More?",
    description:
      "Finished all your tasks? Tap here to generate more. You get one extra set per goal each day.",
    target: "get-more-button",
    route: "/dashboard",
    tooltipPosition: "above",
  },
  {
    title: "Your Goals",
    description:
      "View and manage all your goals here. Tap any goal to open its options.",
    target: "first-goal-card",
    route: "/goals",
    tooltipPosition: "below",
  },
  {
    title: "Goal Options",
    description:
      "Edit, pause, complete, or delete goals. Adjust your schedule, intensity, and deadline through an AI chat.",
    target: "goal-menu-button",
    route: "/goals",
    tooltipPosition: "below",
  },
  {
    title: "Your Profile",
    description:
      "Track streaks, view weekly summaries, manage notifications, and adjust your settings.",
    target: "profile-stats",
    route: "/profile",
    tooltipPosition: "below",
  },
  {
    title: "You\u2019re all set!",
    description:
      "Threely adapts to your progress and evolves your tasks over time. The more you use it, the better it gets. Let\u2019s crush those goals!",
    target: null,
    route: null,
    tooltipPosition: "center",
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface AppTutorialProps {
  visible: boolean;
  onComplete: () => void;
}

export default function AppTutorial({ visible, onComplete }: AppTutorialProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const measureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Measure the target element ──────────────────────────────────────────

  const measureTarget = useCallback((targetAttr: string | null) => {
    if (!targetAttr) {
      setTargetRect(null);
      setMeasuring(false);
      return;
    }
    const el = document.querySelector(`[data-walkthrough="${targetAttr}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      const padding = 10;
      setTargetRect({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
      setMeasuring(false);
    } else {
      // Target not found — show centered fallback
      setTargetRect(null);
      setMeasuring(false);
    }
  }, []);

  // ─── Navigate + measure on step change ───────────────────────────────────

  useEffect(() => {
    if (!visible) return;

    const current = STEPS[step];

    // Navigate to the correct route if needed
    if (current.route) {
      const currentPage = pathname === "/" ? "/dashboard" : pathname;
      if (currentPage !== current.route) {
        router.push(current.route);
      }
    }

    // Wait for render, then measure
    setMeasuring(true);
    if (measureTimerRef.current) clearTimeout(measureTimerRef.current);
    measureTimerRef.current = setTimeout(() => {
      measureTarget(current.target);
    }, 300);

    return () => {
      if (measureTimerRef.current) clearTimeout(measureTimerRef.current);
    };
  }, [step, visible, pathname, router, measureTarget]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    if (step === STEPS.length - 1) {
      onComplete();
      return;
    }
    setStep((s) => s + 1);
  }, [step, onComplete]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // ─── Keyboard support ────────────────────────────────────────────────────

  useEffect(() => {
    if (!visible) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === "ArrowRight") handleNext();
      if (e.key === "Escape") handleSkip();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, handleNext, handleSkip]);

  // ─── Don't render if not visible ─────────────────────────────────────────

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isCentered = current.target === null || (!targetRect && !measuring);

  // ─── Compute tooltip position ────────────────────────────────────────────

  let tooltipStyle: React.CSSProperties = {};

  if (!isCentered && targetRect) {
    const tooltipWidth = 340;
    // Center tooltip horizontally relative to the target
    let tooltipLeft = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
    // Clamp to viewport
    tooltipLeft = Math.max(16, Math.min(tooltipLeft, window.innerWidth - tooltipWidth - 16));

    if (current.tooltipPosition === "below") {
      tooltipStyle = {
        left: tooltipLeft,
        top: targetRect.top + targetRect.height + 16,
      };
    } else if (current.tooltipPosition === "above") {
      tooltipStyle = {
        left: tooltipLeft,
        bottom: window.innerHeight - targetRect.top + 16,
      };
    }
  }

  // ─── Tooltip content ────────────────────────────────────────────────────

  const tooltipContent = (
    <>
      <div className="spotlight-tooltip-title">{current.title}</div>
      <div className="spotlight-tooltip-desc">{current.description}</div>
      <div className="spotlight-tooltip-counter">
        {step + 1} of {STEPS.length}
      </div>
      <div className="spotlight-tooltip-buttons">
        {!isLast && (
          <button className="spotlight-btn-skip" onClick={handleSkip}>
            Skip
          </button>
        )}
        <button
          className="spotlight-btn-next"
          onClick={handleNext}
          style={isLast ? { width: "100%" } : undefined}
        >
          {isLast ? "Let\u2019s go!" : "Next"}
        </button>
      </div>
    </>
  );

  // ─── Centered layout (no target or target not found) ─────────────────────

  if (isCentered) {
    return (
      <div className="spotlight-center-overlay" onClick={handleSkip}>
        <div
          className="spotlight-tooltip"
          style={{ position: "relative" }}
          onClick={(e) => e.stopPropagation()}
        >
          {tooltipContent}
        </div>
      </div>
    );
  }

  // ─── Spotlight layout (target found) ─────────────────────────────────────

  return (
    <>
      {/* Dark overlay with cutout */}
      <div
        className="spotlight-cutout"
        style={{
          top: targetRect!.top,
          left: targetRect!.left,
          width: targetRect!.width,
          height: targetRect!.height,
        }}
      />

      {/* Pulse ring around cutout */}
      <div
        className="spotlight-pulse"
        style={{
          top: targetRect!.top,
          left: targetRect!.left,
          width: targetRect!.width,
          height: targetRect!.height,
        }}
      />

      {/* Click-capture overlay (transparent areas around the cutout) */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          pointerEvents: "auto",
          background: "transparent",
        }}
        onClick={handleSkip}
      />

      {/* Tooltip */}
      <div
        className="spotlight-tooltip"
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {tooltipContent}
      </div>
    </>
  );
}
