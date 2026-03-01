"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

// ─── Tutorial step definitions ────────────────────────────────────────────────

interface TutorialStep {
  icon: string;
  title: string;
  description: string;
  page: string;       // which page this step belongs on
  buttonText?: string; // override for the "Next" button on the last step
}

const STEPS: TutorialStep[] = [
  {
    icon: "\u26A1",
    title: "Your Daily Tasks",
    description:
      "Every day, Threely generates 3 personalized tasks for each of your goals. Click any task to see details, refine it, or ask AI about it.",
    page: "/dashboard",
  },
  {
    icon: "\uD83D\uDE80",
    title: "Want More?",
    description:
      "Finished all your tasks? Complete them and click here to generate more. You get one extra set per goal each day.",
    page: "/dashboard",
  },
  {
    icon: "\uD83C\uDFAF",
    title: "Your Goals",
    description:
      "View and manage all your goals here. Click any goal to open its options \u2014 you'll see everything you need to manage it.",
    page: "/goals",
  },
  {
    icon: "\u2699\uFE0F",
    title: "Goal Options",
    description:
      "Edit goal \u2014 adjust your daily time, intensity, schedule, and deadline through an AI chat.\n\nPause goal \u2014 take a break without losing progress. Resume anytime.\n\nMark as complete \u2014 finished a goal? Celebrate and archive it.\n\nDelete goal \u2014 remove it entirely if you no longer need it.",
    page: "/goals",
  },
  {
    icon: "\uD83D\uDC64",
    title: "Your Profile",
    description:
      "Track your streaks, view weekly summaries, manage notifications, and adjust your subscription settings.",
    page: "/profile",
  },
  {
    icon: "\uD83C\uDF89",
    title: "You\u2019re all set!",
    description:
      "Threely learns from your progress and adapts your tasks over time. The more you use it, the better it gets. Let\u2019s crush those goals!",
    page: "/dashboard",
    buttonText: "Let\u2019s go!",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface AppTutorialProps {
  visible: boolean;
  onComplete: () => void;
}

export default function AppTutorial({ visible, onComplete }: AppTutorialProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [fadeClass, setFadeClass] = useState("tutorial-card-enter");

  // Navigate to the correct page whenever the step changes
  useEffect(() => {
    if (!visible) return;
    const targetPage = STEPS[step].page;
    const currentPage = pathname === "/" ? "/dashboard" : pathname;
    if (currentPage !== targetPage) {
      router.push(targetPage);
    }
  }, [step, visible, pathname, router]);

  const animateTransition = useCallback((callback: () => void) => {
    setAnimating(true);
    setFadeClass("tutorial-card-exit");
    setTimeout(() => {
      callback();
      setFadeClass("tutorial-card-enter");
      setTimeout(() => {
        setAnimating(false);
      }, 300);
    }, 250);
  }, []);

  const handleNext = useCallback(() => {
    if (animating) return;
    if (step === STEPS.length - 1) {
      // Last step — complete the tutorial
      onComplete();
      return;
    }
    animateTransition(() => {
      setStep((s) => s + 1);
    });
  }, [step, animating, onComplete, animateTransition]);

  const handleSkip = useCallback(() => {
    if (animating) return;
    onComplete();
  }, [animating, onComplete]);

  // Keyboard support: Enter/Right for next, Escape for skip
  useEffect(() => {
    if (!visible) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === "ArrowRight") handleNext();
      if (e.key === "Escape") handleSkip();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, handleNext, handleSkip]);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="tutorial-overlay" onClick={handleSkip}>
      <div
        className={`tutorial-card ${fadeClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step indicator dots */}
        <div className="tutorial-dots">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`tutorial-dot${i === step ? " active" : ""}${i < step ? " done" : ""}`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="tutorial-icon">{current.icon}</div>

        {/* Content */}
        <h2 className="tutorial-title">{current.title}</h2>
        <p className="tutorial-description">{current.description}</p>

        {/* Step counter */}
        <div className="tutorial-counter">
          {step + 1} of {STEPS.length}
        </div>

        {/* Buttons */}
        <div className="tutorial-buttons">
          {!isLast && (
            <button
              className="btn btn-outline tutorial-btn-skip"
              onClick={handleSkip}
            >
              Skip
            </button>
          )}
          <button
            className="btn btn-primary tutorial-btn-next"
            onClick={handleNext}
            style={isLast ? { width: "100%" } : undefined}
          >
            {current.buttonText || "Next"}
            {!isLast && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{ marginLeft: 4 }}
              >
                <path
                  d="M6 3l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
