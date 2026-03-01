"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSubscription } from "@/lib/subscription-context";

// ─── Step definitions ─────────────────────────────────────────────────────────

interface TutorialStep {
  title: string;
  description: string;
  target: string | null;          // data-walkthrough value, null = centered
  route: string | null;           // route to navigate to, null = stay
  position: "below" | "above" | "center";
  scrollTo?: boolean;
  openMenu?: string;              // data-walkthrough value of the button to click to open menu
}

const STEPS: TutorialStep[] = [
  {
    title: "Your Daily Tasks",
    description: "Every day, Threely generates 3 personalized tasks for each of your goals \u2014 with time estimates, step-by-step instructions, and curated resources to help you execute.",
    target: "first-task-card",
    route: "/dashboard",
    position: "below",
  },
  {
    title: "Ask AI for Help",
    description: "Stuck on a task? Tap \u201cAsk AI\u201d for instant tips, alternative approaches, or a deeper breakdown of any step.",
    target: "ask-ai-button",
    route: "/dashboard",
    position: "below",
    scrollTo: true,
  },
  {
    title: "Task Options",
    description: "Use the menu to refine tasks with AI, reschedule them for tomorrow, or remove them entirely. Every action teaches Threely your preferences.",
    target: "task-menu-button",
    route: "/dashboard",
    position: "below",
    openMenu: "task-menu-button",
  },
  {
    title: "Complete Tasks to Unlock More",
    description: "Finish all 3 tasks and a new \u201cGet more tasks\u201d button appears. Keep the momentum going \u2014 Threely always has more for you.",
    target: "unlock-more-bar",
    route: "/dashboard",
    position: "below",
    scrollTo: true,
  },
  {
    title: "Your Goals",
    description: "See all your goals with their schedule, time commitment, and deadline. Each goal gets its own set of daily tasks.",
    target: "first-goal-card",
    route: "/goals",
    position: "below",
  },
  {
    title: "Goal Options",
    description: "Use the menu to edit, pause, or complete a goal. You can also adjust its schedule and intensity at any time.",
    target: "goal-menu-button",
    route: "/goals",
    position: "below",
    openMenu: "goal-menu-button",
  },
  {
    title: "Your Profile & Stats",
    description: "Track your streaks, total tasks completed, and time invested. Threely generates AI-powered weekly insights to help you stay on track.",
    target: "profile-stats",
    route: "/profile",
    position: "below",
  },
  {
    title: "You\u2019re all set!",
    description: "Threely adapts to your progress and evolves your tasks over time. The more you use it, the smarter it gets. Let\u2019s crush those goals!",
    target: null,
    route: null,
    position: "center",
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const PAD = 8; // padding around the spotlight cutout
const MAX_RETRIES = 8;
const RETRY_DELAY = 250;

function getTargetRect(target: string): DOMRect | null {
  const el = document.querySelector(`[data-walkthrough="${target}"]`);
  if (!el) return null;
  return el.getBoundingClientRect();
}

function getCombinedRect(target: string, menuTarget?: string): DOMRect | null {
  const main = getTargetRect(target);
  if (!main) return null;
  if (!menuTarget) return main;

  // Also include a dropdown if visible
  const dropdown = document.querySelector(`[data-walkthrough="${menuTarget}-dropdown"]`);
  if (!dropdown) return main;

  const dropRect = dropdown.getBoundingClientRect();
  const top = Math.min(main.top, dropRect.top);
  const left = Math.min(main.left, dropRect.left);
  const right = Math.max(main.right, dropRect.right);
  const bottom = Math.max(main.bottom, dropRect.bottom);

  return new DOMRect(left, top, right - left, bottom - top);
}

// ─── Component ──────────────────────────────────────────────────────────────

interface AppTutorialProps {
  visible: boolean;
  onComplete: () => void;
}

export default function AppTutorial({ visible, onComplete }: AppTutorialProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { setWalkthroughActive } = useSubscription();

  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const [ready, setReady] = useState(false);
  const retryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const measureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Set walkthroughActive when visible changes ───────────────────────────
  useEffect(() => {
    if (visible) {
      setWalkthroughActive(true);
    }
    // Cleanup: if tutorial unmounts while visible, deactivate
    return () => {
      if (visible) {
        setWalkthroughActive(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── Lock body scroll ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [visible]);

  // ── Navigate to correct route when step changes ──────────────────────────
  useEffect(() => {
    if (!visible) return;
    const s = STEPS[step];
    if (s.route && pathname !== s.route) {
      router.push(s.route);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, visible]);

  // ── Measure target (with retry logic) ────────────────────────────────────
  const measure = useCallback(() => {
    const s = STEPS[step];
    if (!s.target) {
      // Centered step — no target to measure
      setRect(null);
      setTooltipPos(null);
      setReady(true);
      return;
    }

    // If we need to open a menu, click the button first
    if (s.openMenu) {
      const menuContainer = document.querySelector(`[data-walkthrough="${s.openMenu}"]`);
      if (menuContainer) {
        const btn = menuContainer.querySelector("button");
        if (btn) {
          // Check if dropdown is already open
          const existing = document.querySelector(`[data-walkthrough="${s.openMenu}-dropdown"]`);
          if (!existing) {
            btn.click();
          }
        }
      }
    }

    // Small delay to let menu render
    const measureDelay = s.openMenu ? 150 : 0;
    measureTimerRef.current = setTimeout(() => {
      const targetRect = s.openMenu
        ? getCombinedRect(s.target!, s.openMenu)
        : getTargetRect(s.target!);

      if (targetRect && targetRect.width > 0) {
        retryRef.current = 0;

        // Scroll into view if needed
        if (s.scrollTo) {
          const el = document.querySelector(`[data-walkthrough="${s.target}"]`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            // Re-measure after scroll
            setTimeout(() => {
              const newRect = s.openMenu
                ? getCombinedRect(s.target!, s.openMenu)
                : getTargetRect(s.target!);
              if (newRect) {
                setRect(newRect);
                positionTooltip(newRect, s.position);
              }
              setReady(true);
            }, 400);
            return;
          }
        }

        setRect(targetRect);
        positionTooltip(targetRect, s.position);
        setReady(true);
      } else {
        // Retry
        if (retryRef.current < MAX_RETRIES) {
          retryRef.current++;
          retryTimerRef.current = setTimeout(measure, RETRY_DELAY);
        } else {
          // Fallback: centered tooltip, no spotlight
          setRect(null);
          setTooltipPos(null);
          setReady(true);
        }
      }
    }, measureDelay);
  }, [step]);

  function positionTooltip(r: DOMRect, position: string) {
    const tooltipWidth = Math.min(340, window.innerWidth - 32);
    let top: number;
    let left: number;

    if (position === "below") {
      top = r.bottom + PAD + 12;
      left = Math.max(16, Math.min(r.left, window.innerWidth - tooltipWidth - 16));
      // If tooltip goes below viewport, show above
      if (top + 200 > window.innerHeight) {
        top = r.top - PAD - 12 - 200;
        if (top < 16) top = 16;
      }
    } else {
      // above
      top = r.top - PAD - 12 - 200;
      left = Math.max(16, Math.min(r.left, window.innerWidth - tooltipWidth - 16));
      if (top < 16) {
        top = r.bottom + PAD + 12;
      }
    }

    setTooltipPos({ top, left });
  }

  // Trigger measure when step changes or route arrives
  useEffect(() => {
    if (!visible) return;
    setReady(false);
    retryRef.current = 0;

    const s = STEPS[step];
    if (!s.target) {
      setRect(null);
      setTooltipPos(null);
      setReady(true);
      return;
    }

    // Wait for route navigation to settle
    const delay = s.route && pathname !== s.route ? 500 : 200;
    const timer = setTimeout(measure, delay);
    return () => {
      clearTimeout(timer);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (measureTimerRef.current) clearTimeout(measureTimerRef.current);
    };
  }, [step, visible, pathname, measure]);

  // Re-measure on resize
  useEffect(() => {
    if (!visible) return;
    function onResize() { measure(); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [visible, measure]);

  // ── Navigation handlers ──────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    // Close any open menus before advancing
    closeOpenMenus();

    if (step === STEPS.length - 1) {
      setWalkthroughActive(false);
      onComplete();
      return;
    }
    setStep(s => s + 1);
  }, [step, onComplete, setWalkthroughActive]);

  const handleSkip = useCallback(() => {
    closeOpenMenus();
    setWalkthroughActive(false);
    onComplete();
  }, [onComplete, setWalkthroughActive]);

  function closeOpenMenus() {
    // Click outside any open menu to close it
    const s = STEPS[step];
    if (s?.openMenu) {
      const dropdown = document.querySelector(`[data-walkthrough="${s.openMenu}-dropdown"]`);
      if (dropdown) {
        // Dispatch a click outside to close the menu
        document.body.click();
      }
    }
  }

  // ── Keyboard nav ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); handleNext(); }
      if (e.key === "Escape") { e.preventDefault(); handleSkip(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, handleNext, handleSkip]);

  // ── Reset when closed ────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      setStep(0);
      setRect(null);
      setTooltipPos(null);
      setReady(false);
      retryRef.current = 0;
    }
  }, [visible]);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // ── Centered overlay (no target) ─────────────────────────────────────────
  if (current.position === "center" || (!rect && ready)) {
    return (
      <>
        {/* Block clicks everywhere */}
        <div
          className="spotlight-center-overlay"
          onClick={e => e.stopPropagation()}
          style={{ cursor: "default" }}
        >
          <div
            className="spotlight-tooltip"
            style={{ position: "relative" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="spotlight-tooltip-title">{current.title}</div>
            <div className="spotlight-tooltip-desc">{current.description}</div>
            <div className="spotlight-tooltip-counter">
              {step + 1} of {STEPS.length}
            </div>
            <div className="spotlight-tooltip-buttons">
              {!isLast && (
                <button className="spotlight-btn-skip" onClick={handleSkip}>
                  Skip tutorial
                </button>
              )}
              <button
                className="spotlight-btn-next"
                onClick={handleNext}
                style={isLast ? { flex: 1 } : undefined}
              >
                {isLast ? "Let\u2019s go!" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Spotlight overlay (has target) ───────────────────────────────────────
  if (!ready) {
    // Still measuring — show dark overlay while waiting
    return (
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(0,0,0,0.75)",
          cursor: "default",
        }}
        onClick={e => e.stopPropagation()}
      />
    );
  }

  return (
    <>
      {/* Click blocker — full screen overlay that blocks all interaction outside tooltip */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          cursor: "default",
        }}
        onClick={e => e.stopPropagation()}
      />

      {/* Spotlight cutout */}
      {rect && (
        <>
          <div
            className="spotlight-cutout"
            style={{
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
            }}
          />
          <div
            className="spotlight-pulse"
            style={{
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
            }}
          />
        </>
      )}

      {/* Tooltip */}
      {tooltipPos && (
        <div
          className="spotlight-tooltip"
          style={{
            top: tooltipPos.top,
            left: tooltipPos.left,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="spotlight-tooltip-title">{current.title}</div>
          <div className="spotlight-tooltip-desc">{current.description}</div>
          <div className="spotlight-tooltip-counter">
            {step + 1} of {STEPS.length}
          </div>
          <div className="spotlight-tooltip-buttons">
            {!isLast && (
              <button className="spotlight-btn-skip" onClick={handleSkip}>
                Skip tutorial
              </button>
            )}
            <button className="spotlight-btn-next" onClick={handleNext}>
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
