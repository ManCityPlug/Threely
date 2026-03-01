"use client";

import { useCallback, useEffect, useState } from "react";

// ─── Mock data ──────────────────────────────────────────────────────────────

const MOCK_GOAL = {
  title: "Get in the best shape of my life",
  category: "Health & Fitness",
  deadline: (() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  })(),
  dailyTime: "30 min/day",
  workDays: "Mon – Sat",
};

const MOCK_TASKS = [
  {
    id: "t1",
    task: "Complete a 20-minute full-body HIIT circuit",
    description: "4 rounds: 40s burpees, 40s mountain climbers, 40s squat jumps, 40s plank jacks — 20s rest between exercises.",
    estimated_minutes: 20,
    why: "High-intensity intervals build cardiovascular endurance and metabolic conditioning faster than steady-state cardio",
    resources: [
      { type: "youtube_channel" as const, name: "THENX", detail: "Calisthenics HIIT routines" },
    ],
  },
  {
    id: "t2",
    task: "Plan and prep tomorrow's meals around a 40/30/30 macro split",
    description: "Map out breakfast, lunch, dinner, and one snack hitting ~2,200 cal with 40% protein, 30% carbs, 30% fat. Prep what you can tonight.",
    estimated_minutes: 15,
    why: "Nutrition consistency compounds — one prepped day removes decision fatigue for the next",
    resources: [
      { type: "app" as const, name: "MyFitnessPal", detail: "Track macros and calories" },
    ],
  },
  {
    id: "t3",
    task: "Do a 10-minute mobility and recovery flow before bed",
    description: "Hip 90/90 stretch (2 min each side), thoracic spine rotation (1 min each), pigeon pose (1 min each), deep squat hold (2 min).",
    estimated_minutes: 10,
    why: "Active recovery between training days prevents injury and improves range of motion over time",
    resources: [
      { type: "youtube_channel" as const, name: "Tom Merrick", detail: "Follow-along mobility routines" },
    ],
  },
];

const RESOURCE_ICONS: Record<string, string> = {
  youtube_channel: "\u25B6",
  tool: "\u2699",
  website: "\uD83D\uDD17",
  book: "\uD83D\uDCD6",
  app: "\uD83D\uDCF1",
};

// ─── Slide definitions ──────────────────────────────────────────────────────

interface Slide {
  title: string;
  description: string;
  render: (checkedTasks: Set<string>) => React.ReactNode;
}

function MockTaskCard({
  task,
  checked,
  onCheck,
  showAskAi,
  showMenu,
}: {
  task: typeof MOCK_TASKS[number];
  checked: boolean;
  onCheck?: () => void;
  showAskAi?: boolean;
  showMenu?: boolean;
}) {
  return (
    <div
      className={`card${!checked ? " task-card-hover" : ""}`}
      style={{
        padding: "0.875rem 1rem",
        opacity: checked ? 0.7 : 1,
        transition: "opacity 0.2s",
        display: "flex",
        flexDirection: "column",
        gap: "0.4rem",
      }}
    >
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
        <button
          className={`task-checkbox${checked ? " checked" : ""}`}
          onClick={onCheck}
          style={{ marginTop: 2, cursor: onCheck ? "pointer" : "default" }}
        >
          {checked && "\u2713"}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{
              fontWeight: 600,
              fontSize: "0.9rem",
              color: checked ? "var(--muted)" : "var(--text)",
              textDecoration: checked ? "line-through" : "none",
              lineHeight: 1.4,
            }}>
              {task.task}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
              <span style={{
                fontSize: "0.7rem", fontWeight: 600,
                color: "var(--muted)", background: "var(--bg)",
                borderRadius: 20, padding: "2px 8px",
                whiteSpace: "nowrap",
              }}>
                {task.estimated_minutes}m
              </span>
            </div>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--subtext)", marginTop: 3, lineHeight: 1.5 }}>
            {task.description}
          </div>
          {/* Resources */}
          {task.resources && task.resources.length > 0 && (
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
              {task.resources.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", flexShrink: 0 }}>
                    {RESOURCE_ICONS[r.type] ?? "\uD83D\uDD17"}
                  </span>
                  <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text)" }}>{r.name}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--subtext)" }}>{r.detail}</span>
                </div>
              ))}
            </div>
          )}
          {/* Ask AI button */}
          {showAskAi && !checked && (
            <div
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                marginTop: 8, padding: "4px 10px",
                fontSize: "0.78rem", fontWeight: 600,
                color: "var(--primary)", background: "var(--primary-light)",
                borderRadius: 8, border: "none",
              }}
            >
              <span style={{ fontSize: "0.85rem" }}>{"\u2728"}</span> Ask AI
            </div>
          )}
        </div>
        {/* Menu button */}
        {showMenu && !checked && (
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--bg)", cursor: "default", flexShrink: 0,
            fontSize: "0.9rem", fontWeight: 700, color: "var(--muted)", letterSpacing: 2,
          }}>
            {"\u22EF"}
          </div>
        )}
      </div>
      {/* Why badge */}
      {!checked && task.why && (
        <div style={{
          fontSize: "0.75rem", color: "var(--subtext)", lineHeight: 1.45,
          fontStyle: "italic", paddingLeft: "2.25rem", marginTop: 2,
        }}>
          {task.why}
        </div>
      )}
    </div>
  );
}

function MockGoalCard() {
  return (
    <div className="card" style={{ padding: "1rem 1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: "0.65rem", fontWeight: 700, color: "#fff",
              background: "var(--primary)", borderRadius: 6,
              padding: "2px 7px", textTransform: "uppercase", letterSpacing: "0.04em",
            }}>
              {MOCK_GOAL.category}
            </span>
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.3, marginBottom: 6 }}>
            {MOCK_GOAL.title}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: "0.75rem", color: "var(--subtext)" }}>
            <span style={{ background: "var(--bg)", borderRadius: 6, padding: "2px 8px" }}>
              {MOCK_GOAL.workDays}
            </span>
            <span style={{ background: "var(--bg)", borderRadius: 6, padding: "2px 8px" }}>
              {MOCK_GOAL.dailyTime}
            </span>
            <span style={{ background: "var(--bg)", borderRadius: 6, padding: "2px 8px" }}>
              Deadline: {MOCK_GOAL.deadline}
            </span>
          </div>
        </div>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--bg)", fontSize: "0.9rem", fontWeight: 700,
          color: "var(--muted)", letterSpacing: 2,
        }}>
          {"\u22EF"}
        </div>
      </div>
      <div style={{
        display: "flex", gap: 6, marginTop: 10,
      }}>
        <div style={{
          fontSize: "0.78rem", fontWeight: 600, color: "var(--primary)",
          background: "var(--primary-light)", borderRadius: 8,
          padding: "5px 12px", cursor: "default",
        }}>
          View tasks
        </div>
      </div>
    </div>
  );
}

function MockMenuDropdown() {
  const items = [
    { icon: "\u2728", label: "Ask AI to refine", desc: "Adjust difficulty or focus" },
    { icon: "\u2192", label: "Move to tomorrow", desc: "Reschedule for later" },
    { icon: "\u2212", label: "Remove task", desc: "Skip this one entirely" },
  ];
  return (
    <div style={{
      background: "var(--card)", borderRadius: 12,
      border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)",
      padding: "0.5rem", width: "100%", maxWidth: 260,
    }}>
      {items.map((item, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "0.6rem 0.75rem", borderRadius: 8,
          cursor: "default",
        }}>
          <span style={{ fontSize: "1rem" }}>{item.icon}</span>
          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>{item.label}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--subtext)" }}>{item.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MockStatsBar() {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
      marginBottom: 8,
    }}>
      {[
        { label: "Streak", value: "3 days", icon: "\uD83D\uDD25" },
        { label: "Completed", value: "47", icon: "\u2705" },
        { label: "Invested", value: "12.5h", icon: "\u23F1" },
      ].map(s => (
        <div key={s.label} className="card" style={{
          padding: "0.75rem", textAlign: "center",
        }}>
          <div style={{ fontSize: "1.25rem", marginBottom: 4 }}>{s.icon}</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>{s.value}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

const SLIDES: Slide[] = [
  {
    title: "Your Daily Tasks",
    description: "Every day, Threely generates 3 personalized tasks for each of your goals \u2014 with time estimates, step-by-step instructions, and curated resources to help you execute.",
    render: (checked) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {MOCK_TASKS.map(t => (
          <MockTaskCard key={t.id} task={t} checked={checked.has(t.id)} showAskAi={t.id === "t1"} showMenu />
        ))}
      </div>
    ),
  },
  {
    title: "Complete Tasks as You Go",
    description: "Tap the circle to check off tasks. Threely tracks your progress, builds streaks, and uses your completion data to calibrate tomorrow\u2019s difficulty.",
    render: (checked) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {MOCK_TASKS.map(t => (
          <MockTaskCard key={t.id} task={t} checked={checked.has(t.id)} showAskAi={false} showMenu={false} />
        ))}
      </div>
    ),
  },
  {
    title: "Ask AI & Task Options",
    description: "Stuck on a task? Tap \u201cAsk AI\u201d for instant help, alternative approaches, or tips. Use the menu (\u22EF) to refine tasks, reschedule them, or remove them entirely.",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <MockTaskCard task={MOCK_TASKS[0]} checked={false} showAskAi showMenu />
        <MockMenuDropdown />
      </div>
    ),
  },
  {
    title: "Generate More When You\u2019re Done",
    description: "Finish all 3 tasks and a new \u201cGenerate more tasks\u201d button appears. Keep the momentum going \u2014 Threely always has more for you.",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {MOCK_TASKS.map(t => (
          <MockTaskCard key={t.id} task={t} checked showMenu={false} />
        ))}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 8, padding: "0.75rem 1rem",
          background: "var(--primary)", borderRadius: "var(--radius)",
          cursor: "default",
        }}>
          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#fff" }}>
            {"\u2728"} Generate more tasks
          </span>
        </div>
      </div>
    ),
  },
  {
    title: "Track Your Goals",
    description: "See all your goals with their schedule, time commitment, and deadline. Tap \u201cView tasks\u201d to jump to today\u2019s tasks, or use the menu to edit, pause, or complete a goal.",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <MockGoalCard />
      </div>
    ),
  },
  {
    title: "Your Stats & Insights",
    description: "Track your streaks, total tasks completed, and time invested. Threely generates AI-powered weekly insights to help you stay on track and optimize your approach.",
    render: () => <MockStatsBar />,
  },
  {
    title: "You\u2019re all set!",
    description: "Threely adapts to your progress and evolves your tasks over time. The more you use it, the smarter it gets. Let\u2019s crush those goals!",
    render: () => (
      <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
        <span style={{ fontSize: 64 }}>{"\uD83D\uDE80"}</span>
      </div>
    ),
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

interface AppTutorialProps {
  visible: boolean;
  onComplete: () => void;
}

export default function AppTutorial({ visible, onComplete }: AppTutorialProps) {
  const [step, setStep] = useState(0);
  const [checkedTasks, setCheckedTasks] = useState<Set<string>>(new Set());

  // Auto-check tasks during step 2 (complete tasks) for demo
  useEffect(() => {
    if (!visible || step !== 1) return; // step index 1 = "Complete Tasks"
    const timers: ReturnType<typeof setTimeout>[] = [];
    MOCK_TASKS.forEach((t, i) => {
      timers.push(setTimeout(() => {
        setCheckedTasks(prev => new Set(prev).add(t.id));
      }, 800 + i * 700));
    });
    return () => timers.forEach(clearTimeout);
  }, [visible, step]);

  // Reset checks when leaving step 2
  useEffect(() => {
    if (step !== 1) setCheckedTasks(new Set());
  }, [step]);

  const handleNext = useCallback(() => {
    if (step === SLIDES.length - 1) {
      onComplete();
      return;
    }
    setStep(s => s + 1);
  }, [step, onComplete]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Keyboard nav
  useEffect(() => {
    if (!visible) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === "ArrowRight") handleNext();
      if (e.key === "Escape") handleSkip();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, handleNext, handleSkip]);

  // Lock body scroll
  useEffect(() => {
    if (!visible) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [visible]);

  if (!visible) return null;

  const current = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "rgba(0, 0, 0, 0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
      animation: "fadeIn 0.3s ease",
    }}>
      <div
        style={{
          background: "var(--card)",
          borderRadius: 20,
          maxWidth: 440,
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 16px 64px rgba(0,0,0,0.3)",
          overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "1.5rem 1.5rem 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <h2 style={{
              fontSize: "1.15rem", fontWeight: 700,
              color: "var(--text)", letterSpacing: "-0.02em", margin: 0,
            }}>
              {current.title}
            </h2>
            <span style={{
              fontSize: "0.7rem", fontWeight: 600,
              color: "var(--muted)", background: "var(--bg)",
              borderRadius: 20, padding: "3px 10px",
            }}>
              {step + 1}/{SLIDES.length}
            </span>
          </div>
          <p style={{
            fontSize: "0.85rem", color: "var(--subtext)",
            lineHeight: 1.55, margin: "0.5rem 0 0",
          }}>
            {current.description}
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ padding: "0.875rem 1.5rem 0", flexShrink: 0 }}>
          <div style={{
            height: 3, borderRadius: 2,
            background: "var(--border)",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${((step + 1) / SLIDES.length) * 100}%`,
              background: "var(--primary)",
              borderRadius: 2,
              transition: "width 0.3s ease",
            }} />
          </div>
        </div>

        {/* Mock content */}
        <div style={{
          padding: "1rem 1.5rem",
          flex: 1,
          overflowY: "auto",
          minHeight: 0,
        }}>
          {current.render(checkedTasks)}
        </div>

        {/* Buttons */}
        <div style={{
          padding: "0 1.5rem 1.5rem",
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.75rem",
          flexShrink: 0,
        }}>
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
  );
}
