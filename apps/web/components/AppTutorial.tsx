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
  openMenu?: string;          // data-walkthrough of a menu button to click open
  scrollTo?: boolean;         // scroll target into view first
}

const STEPS: SpotlightStep[] = [
  {
    title: "Your Daily Tasks",
    description:
      "Every day, Threely generates 3 personalized tasks for each of your goals. You can see the full details, estimated time, and relevant resources for every task right here.",
    target: "first-task-card",
    route: "/dashboard",
    tooltipPosition: "below",
  },
  {
    title: "Ask AI for Help",
    description:
      "Have a question about your task? Tap \"Ask AI\" to get instant clarification, alternative approaches, or tips on how to get started.",
    target: "ask-ai-button",
    route: "/dashboard",
    tooltipPosition: "below",
    scrollTo: true,
  },
  {
    title: "Task Options",
    description:
      "Tap the three dots (\u22EF) on any task to see more options:\n\u2022 Ask AI to refine \u2014 adjust the task if it\u2019s too easy, too hard, or unclear\n\u2022 Ask about this \u2014 get help or context for this task\n\u2022 Move to tomorrow \u2014 reschedule if you can\u2019t do it today\n\u2022 Remove task \u2014 skip this one entirely",
    target: "task-menu-button",
    route: "/dashboard",
    tooltipPosition: "below",
    openMenu: "task-menu-button",
  },
  {
    title: "Complete Tasks to Unlock More",
    description:
      "Finish all 3 of your daily tasks to unlock extra tasks. Threely generates a fresh set of 3 tasks for you each day \u2014 but once you\u2019ve completed them all, you can generate more to keep going.",
    target: "unlock-more-bar",
    route: "/dashboard",
    tooltipPosition: "below",
    scrollTo: true,
  },
  {
    title: "Your Goals",
    description:
      "Here are all your goals with their schedule, time commitment, and status. Tap \"View tasks\" on any goal to jump to today\u2019s tasks for that goal.",
    target: "first-goal-card",
    route: "/goals",
    tooltipPosition: "below",
  },
  {
    title: "Goal Options",
    description:
      "Tap the three dots (\u22EF) on any goal for more options:\n\u2022 Edit goal \u2014 adjust details via an AI chat\n\u2022 Pause goal \u2014 temporarily stop generating tasks\n\u2022 Mark as complete \u2014 celebrate and archive it\n\u2022 Delete goal \u2014 remove it permanently",
    target: "goal-menu-button",
    route: "/goals",
    tooltipPosition: "below",
    openMenu: "goal-menu-button",
  },
  {
    title: "Your Profile & Stats",
    description:
      "Track your streaks, total tasks completed, time invested, and more. Check your weekly analysis for AI-powered insights, adjust your settings, and manage notifications.",
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
  const [animating, setAnimating] = useState(false);
  const measureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedMenuRef = useRef<string | null>(null);

  // ─── Close any menu we opened ──────────────────────────────────────────

  const closeOpenedMenu = useCallback(() => {
    if (openedMenuRef.current) {
      // Click the button again to close the menu
      const btn = document.querySelector(`[data-walkthrough="${openedMenuRef.current}"] button`);
      if (btn) {
        (btn as HTMLElement).click();
      }
      openedMenuRef.current = null;
    }
  }, []);

  // ─── Measure the target element ──────────────────────────────────────────

  const measureTarget = useCallback((targetAttr: string | null, scrollTo?: boolean) => {
    if (!targetAttr) {
      setTargetRect(null);
      setAnimating(false);
      return;
    }

    const el = document.querySelector(`[data-walkthrough="${targetAttr}"]`);
    if (el) {
      // Scroll into view if needed
      if (scrollTo) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      // Small delay after scroll to get accurate rect
      const delay = scrollTo ? 400 : 50;
      setTimeout(() => {
        const rect = el.getBoundingClientRect();
        const padding = 10;
        setTargetRect({
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        });
        setAnimating(false);
      }, delay);
    } else {
      // Target not found — show centered fallback
      setTargetRect(null);
      setAnimating(false);
    }
  }, []);

  // ─── Open menu if step requires it ─────────────────────────────────────

  const openMenuForStep = useCallback((openMenu: string | undefined, targetAttr: string | null, scrollTo?: boolean) => {
    if (!openMenu) {
      measureTarget(targetAttr, scrollTo);
      return;
    }

    // Find the menu button wrapper
    const wrapper = document.querySelector(`[data-walkthrough="${openMenu}"]`);
    if (!wrapper) {
      measureTarget(targetAttr, scrollTo);
      return;
    }

    // Click the button inside to open the menu
    const btn = wrapper.querySelector("button");
    if (btn) {
      (btn as HTMLElement).click();
      openedMenuRef.current = openMenu;

      // Wait for menu to render, then measure the whole wrapper (button + dropdown)
      setTimeout(() => {
        const rect = wrapper.getBoundingClientRect();
        // Find the dropdown that appeared
        const dropdown = wrapper.querySelector("div[style*='position: absolute']") as HTMLElement | null;
        if (dropdown) {
          const dropdownRect = dropdown.getBoundingClientRect();
          const padding = 10;
          // Combine button + dropdown rects
          const combinedTop = Math.min(rect.top, dropdownRect.top) - padding;
          const combinedLeft = Math.min(rect.left, dropdownRect.left) - padding;
          const combinedRight = Math.max(rect.right, dropdownRect.right) + padding;
          const combinedBottom = Math.max(rect.bottom, dropdownRect.bottom) + padding;
          setTargetRect({
            top: combinedTop,
            left: combinedLeft,
            width: combinedRight - combinedLeft,
            height: combinedBottom - combinedTop,
          });
        } else {
          // Fallback: just measure the wrapper
          const padding = 10;
          setTargetRect({
            top: rect.top - padding,
            left: rect.left - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
          });
        }
        setAnimating(false);
      }, 200);
    } else {
      measureTarget(targetAttr, scrollTo);
    }
  }, [measureTarget]);

  // ─── Navigate + measure on step change ───────────────────────────────────

  useEffect(() => {
    if (!visible) return;

    const current = STEPS[step];
    setAnimating(true);

    // Close any previously opened menu
    closeOpenedMenu();

    // Navigate to the correct route if needed
    if (current.route) {
      const currentPage = pathname === "/" ? "/dashboard" : pathname;
      if (currentPage !== current.route) {
        router.push(current.route);
      }
    }

    // Wait for render, then measure (longer delay for route change)
    if (measureTimerRef.current) clearTimeout(measureTimerRef.current);
    const currentPage = pathname === "/" ? "/dashboard" : pathname;
    const needsNavigation = current.route && currentPage !== current.route;
    const delay = needsNavigation ? 600 : 300;

    measureTimerRef.current = setTimeout(() => {
      openMenuForStep(current.openMenu, current.target, current.scrollTo);
    }, delay);

    return () => {
      if (measureTimerRef.current) clearTimeout(measureTimerRef.current);
    };
  }, [step, visible, pathname, router, measureTarget, openMenuForStep, closeOpenedMenu]);

  // ─── Clean up menus on unmount ─────────────────────────────────────────

  useEffect(() => {
    return () => {
      closeOpenedMenu();
    };
  }, [closeOpenedMenu]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    if (step === STEPS.length - 1) {
      closeOpenedMenu();
      onComplete();
      return;
    }
    setStep((s) => s + 1);
  }, [step, onComplete, closeOpenedMenu]);

  const handleSkip = useCallback(() => {
    closeOpenedMenu();
    onComplete();
  }, [onComplete, closeOpenedMenu]);

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
  const isCentered = current.target === null || !targetRect;

  // ─── Compute tooltip position ────────────────────────────────────────────

  let tooltipStyle: React.CSSProperties = {};

  if (!isCentered && targetRect) {
    const tooltipWidth = 360;
    let tooltipLeft = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
    tooltipLeft = Math.max(16, Math.min(tooltipLeft, window.innerWidth - tooltipWidth - 16));

    if (current.tooltipPosition === "below") {
      tooltipStyle = {
        left: tooltipLeft,
        top: targetRect.top + targetRect.height + 16,
        width: tooltipWidth,
      };
    } else if (current.tooltipPosition === "above") {
      tooltipStyle = {
        left: tooltipLeft,
        bottom: window.innerHeight - targetRect.top + 16,
        width: tooltipWidth,
      };
    }
  }

  // ─── Format description with line breaks ───────────────────────────────

  const descriptionLines = current.description.split("\n");

  // ─── Tooltip content ────────────────────────────────────────────────────

  const tooltipContent = (
    <>
      <div className="spotlight-tooltip-title">{current.title}</div>
      <div className="spotlight-tooltip-desc">
        {descriptionLines.map((line, i) => (
          <span key={i}>
            {line}
            {i < descriptionLines.length - 1 && <br />}
          </span>
        ))}
      </div>
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
          style={{ position: "relative", maxWidth: 400 }}
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
          transition: animating ? "none" : "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
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
          transition: animating ? "none" : "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
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
        style={{
          ...tooltipStyle,
          transition: animating ? "none" : "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {tooltipContent}
      </div>
    </>
  );
}
