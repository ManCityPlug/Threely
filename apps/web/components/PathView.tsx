"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PathViewProps {
  dayNumber: number;
  completedDays: number;
  onDayClick: (day: number, type: "completed" | "today" | "next" | "locked") => void;
  allDoneToday: boolean;
  totalTasks: number;
  onStartDay?: () => void;
  tasksVisible?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MILESTONE_DAYS = [7, 14, 30, 60, 100];
const GOLD = "#D4A843";
const GOLD_DARK = "#9A7A2A";

// S-curve horizontal offset pattern (percentage of container width)
// center → slight left → left → slight left → center → slight right → right → slight right → repeat
const S_CURVE_OFFSETS = [50, 38, 28, 35, 50, 62, 72, 65];

// ─── Inline Countdown (shows under next locked day) ──────────────────────────

function InlineCountdown() {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function calc() {
      const now = Date.now();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now;
      if (diff <= 0) { setTimeLeft(""); return; }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${h}h ${m}m`);
    }
    calc();
    const interval = setInterval(calc, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!timeLeft) return null;
  return (
    <div style={{ fontSize: "0.62rem", fontWeight: 600, color: "rgba(212,168,67,0.5)", marginTop: 2 }}>
      Unlocks in {timeLeft}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PathView({
  dayNumber,
  completedDays,
  onDayClick,
  allDoneToday,
  totalTasks,
  onStartDay,
  tasksVisible,
}: PathViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [todayPopup, setTodayPopup] = useState(false);
  const [lockedModal, setLockedModal] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(true);

  // Stage system: 20 nodes per stage (1-20, 21-40, 41-60, ...)
  const VISIBLE_NODES = 20;
  const stage = Math.ceil(dayNumber / VISIBLE_NODES) || 1;
  const windowStart = (stage - 1) * VISIBLE_NODES + 1;

  const days: number[] = [];
  for (let i = 0; i < VISIBLE_NODES; i++) {
    days.push(windowStart + i);
  }
  const lastVisibleDay = days[days.length - 1];

  // ─── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    setMounted(true);
  }, []);

  // Scroll today's node into view on mount and whenever path becomes visible
  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => {
      if (todayRef.current && scrollRef.current) {
        const container = scrollRef.current;
        const node = todayRef.current;
        const containerRect = container.getBoundingClientRect();
        const scrollTarget = node.offsetTop - containerRect.height / 2 + 36;
        container.scrollTo({ top: Math.max(0, scrollTarget), behavior: "smooth" });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [mounted, tasksVisible, dayNumber]);

  // Hide scroll hint on first scroll
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    function handleScroll() {
      // Hide scroll hint only when near the bottom
      const el = scrollRef.current;
      if (el && (el.scrollTop + el.clientHeight >= el.scrollHeight - 50)) {
        setShowScrollHint(false);
      }
    }
    container.addEventListener("scroll", handleScroll, { once: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [mounted]);

  // Close today popup on outside click
  useEffect(() => {
    if (!todayPopup) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-today-popup]") && !target.closest("[data-today-node]")) {
        setTodayPopup(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [todayPopup]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const getNodeType = useCallback(
    (day: number): "completed" | "today" | "next" | "locked" => {
      if (day < dayNumber) return "completed";
      if (day === dayNumber) return "today";
      if (day === dayNumber + 1 && allDoneToday) return "next";
      return "locked";
    },
    [dayNumber, allDoneToday]
  );

  function isMilestone(day: number): boolean {
    return MILESTONE_DAYS.includes(day);
  }

  function isCrownNode(day: number): boolean {
    return day === lastVisibleDay;
  }

  function getHorizontalOffset(index: number): number {
    return S_CURVE_OFFSETS[index % S_CURVE_OFFSETS.length];
  }

  function handleNodeClick(day: number, nodeType: "completed" | "today" | "next" | "locked") {
    if (nodeType === "today") {
      if (onStartDay) onStartDay();
      else onDayClick(day, nodeType);
      return;
    }
    if (nodeType === "locked") {
      setLockedModal(true);
      return;
    }
    onDayClick(day, nodeType);
  }

  // ─── Progress ring for today's node ─────────────────────────────────────

  function renderProgressRing(size: number) {
    const ringRadius = size / 2 + 6;
    const circumference = 2 * Math.PI * ringRadius;
    const completedTasks = allDoneToday ? totalTasks : completedDays >= dayNumber ? totalTasks : 0;
    // Determine progress: if allDoneToday, full. Otherwise estimate from completedDays
    // We don't have per-task progress, so: 0 tasks done = 0%, allDoneToday = 100%
    const progress = allDoneToday ? 1 : 0;
    const dashOffset = circumference * (1 - progress);
    const svgSize = (ringRadius + 4) * 2;

    return (
      <svg
        width={svgSize}
        height={svgSize}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      >
        {/* Background track */}
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={ringRadius}
          fill="none"
          stroke="rgba(212,168,67,0.15)"
          strokeWidth={3}
        />
        {/* Progress arc */}
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={ringRadius}
          fill="none"
          stroke={GOLD}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${svgSize / 2} ${svgSize / 2})`}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
    );
  }

  // ─── Render node icon ─────────────────────────────────────────────────────

  function renderNodeIcon(day: number, nodeType: string, size: number) {
    const crown = isCrownNode(day);
    const milestone = isMilestone(day);

    if (crown) {
      return <span style={{ fontSize: size * 0.42, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>{"\uD83D\uDC51"}</span>;
    }

    if (milestone && (nodeType === "completed" || nodeType === "today")) {
      return <span style={{ fontSize: size * 0.4, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>{"\uD83C\uDFC6"}</span>;
    }

    if (milestone && (nodeType === "locked" || nodeType === "next")) {
      return <span style={{ fontSize: size * 0.36, lineHeight: 1, opacity: 0.5, display: "flex", alignItems: "center", justifyContent: "center" }}>{"\uD83C\uDFC6"}</span>;
    }

    if (nodeType === "completed") {
      return (
        <svg width={size * 0.38} height={size * 0.38} viewBox="0 0 14 14" fill="none">
          <path d="M3 7L6 10L11 4" stroke={GOLD_DARK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    if (nodeType === "today") {
      if (allDoneToday) {
        return (
          <svg width={size * 0.38} height={size * 0.38} viewBox="0 0 14 14" fill="none">
            <path d="M3 7L6 10L11 4" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      }
      return (
        <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 24 24" fill={GOLD} stroke="none">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      );
    }

    // Locked / next: lock icon
    return (
      <svg
        width={size * 0.28}
        height={size * 0.28}
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    );
  }

  // ─── Today popup ──────────────────────────────────────────────────────────

  function renderTodayPopup(day: number) {
    if (day !== dayNumber || !todayPopup || allDoneToday) return null;

    return (
      <div
        data-today-popup="true"
        style={{
          position: "absolute",
          bottom: "calc(100% + 18px)",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100,
          animation: "popupFadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div
          style={{
            background: "rgba(22,22,22,0.97)",
            border: `1.5px solid ${GOLD}`,
            borderRadius: 16,
            padding: "20px 28px",
            textAlign: "center",
            minWidth: 190,
            boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 24px rgba(212,168,67,0.08)`,
            position: "relative",
          }}
        >
          {/* Triangle arrow */}
          <div
            style={{
              position: "absolute",
              bottom: -8,
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "9px solid transparent",
              borderRight: "9px solid transparent",
              borderTop: "9px solid rgba(22,22,22,0.97)",
              filter: `drop-shadow(0 1px 0 ${GOLD})`,
            }}
          />
          <div
            style={{
              fontSize: "1rem",
              fontWeight: 800,
              color: "#fff",
              marginBottom: 4,
            }}
          >
            Day {day}
          </div>
          <div
            style={{
              fontSize: "0.84rem",
              fontWeight: 600,
              color: "rgba(255,255,255,0.85)",
              marginBottom: 16,
            }}
          >
            {totalTasks} tasks ready
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTodayPopup(false);
              if (onStartDay) onStartDay();
              onDayClick(day, "today");
            }}
            style={{
              width: "100%",
              padding: "11px 24px",
              borderRadius: 12,
              background: `linear-gradient(135deg, ${GOLD}, #C49A3C)`,
              color: "#000",
              fontSize: "0.92rem",
              fontWeight: 800,
              border: "none",
              cursor: "pointer",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              transition: "filter 0.2s, transform 0.2s",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = "brightness(1.12)";
              e.currentTarget.style.transform = "scale(1.02)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "brightness(1)";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            START
          </button>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes breathe {
          0%, 100% { box-shadow: 0 0 24px 8px rgba(212,168,67,0.35), 0 4px 16px rgba(212,168,67,0.4), inset 0 2px 4px rgba(255,255,255,0.05); }
          50% { box-shadow: 0 0 48px 20px rgba(212,168,67,0.55), 0 4px 16px rgba(212,168,67,0.4), inset 0 2px 4px rgba(255,255,255,0.05); }
        }

        @keyframes crownGlow {
          0%, 100% {
            box-shadow: 0 0 24px 8px rgba(212,168,67,0.3), 0 4px 12px rgba(212,168,67,0.3);
          }
          50% {
            box-shadow: 0 0 40px 14px rgba(212,168,67,0.5), 0 4px 12px rgba(212,168,67,0.3);
          }
        }

        @keyframes nodeEnterBounce {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(24px) scale(0.7);
          }
          60% {
            opacity: 1;
            transform: translateX(-50%) translateY(-4px) scale(1.06);
          }
          80% {
            transform: translateX(-50%) translateY(2px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }

        @keyframes popupFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(6px) scale(0.96); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }

        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes modalSlideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes startBadgePulse {
          0%, 100% { transform: translateX(-50%) scale(1); }
          50% { transform: translateX(-50%) scale(1.06); }
        }

        @keyframes scrollHintFade {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        @keyframes scrollArrowBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(4px); }
        }
        @keyframes startPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .path-container::-webkit-scrollbar { display: none; }

        .path-node-btn {
          font-family: inherit;
          -webkit-tap-highlight-color: transparent;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), filter 0.25s ease;
        }
        .path-node-btn:hover {
          filter: brightness(1.1);
          transform: scale(1.08);
        }
        .path-node-btn:active {
          transform: scale(0.95);
        }

        /* Responsive vertical spacing */
        .path-field {
          --node-spacing: 130px;
          --max-path-width: 500px;
        }
        @media (min-width: 900px) {
          .path-field {
            --node-spacing: 140px;
          }
        }
        @media (max-width: 499px) {
          .path-field {
            --node-spacing: 90px;
          }
        }
      `}</style>

      <div style={{ position: "relative", width: "100%" }}>
      <div
        ref={scrollRef}
        className="path-container"
        style={{
          position: "relative",
          width: "100%",
          maxHeight: "70vh",
          paddingTop: 60,
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          className="path-field"
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "var(--max-path-width, 500px)",
            margin: "0 auto",
            height: `calc(${days.length} * var(--node-spacing, 100px) + 80px)`,
          }}
        >
          {days.map((day, i) => {
            const nodeType = getNodeType(day);
            const crown = isCrownNode(day);
            const milestone = isMilestone(day);
            const isToday = day === dayNumber;

            // Node sizes
            let size = 64;
            if (isToday) size = 76;
            else if (crown) size = 68;
            else if (milestone) size = 68;
            else if (nodeType === "locked") size = 58;
            else if (nodeType === "next") size = 58;

            const xOffset = getHorizontalOffset(i);

            // Determine if label should show — all nodes get labels
            const showLabel = true;

            // Section divider: every 7 nodes, between week boundaries
            const weekNumber = Math.floor((day - windowStart) / 7) + 1;
            const isWeekBoundary = i > 0 && i % 7 === 0;

            return (
              <div key={day}>
                {/* Week section divider */}
                {isWeekBoundary && (
                  <div
                    style={{
                      position: "absolute",
                      top: `calc(40px + ${i} * var(--node-spacing, 100px) - 20px)`,
                      left: "10%",
                      right: "10%",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      zIndex: 2,
                    }}
                  >
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                    <span style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.3)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      whiteSpace: "nowrap",
                    }}>
                      Week {weekNumber}
                    </span>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                  </div>
                )}
              <div
                ref={isToday ? todayRef : undefined}
                style={{
                  position: "absolute",
                  top: `calc(40px + ${i} * var(--node-spacing, 100px))`,
                  left: `${xOffset}%`,
                  transform: "translateX(-50%)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  zIndex: isToday ? 10 : crown ? 5 : 1,
                  opacity: mounted ? 1 : 0,
                  animation: mounted
                    ? `nodeEnterBounce 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.04}s both`
                    : "none",
                }}
              >

                {/* Node wrapper for progress ring positioning */}
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>

                  {/* Progress ring - today only */}
                  {isToday && renderProgressRing(size)}

                  {/* The node button */}
                  <button
                    data-today-node={isToday ? "true" : undefined}
                    onClick={() => handleNodeClick(day, nodeType)}
                    className="path-node-btn"
                    aria-label={crown ? "Huge Progress" : `Day ${day}`}
                    style={{
                      width: size,
                      height: size,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      padding: 0,
                      flexShrink: 0,
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      position: "relative",
                      outline: "none",

                      // Type-specific styles
                      ...(nodeType === "completed"
                        ? {
                            border: `4px solid ${GOLD_DARK}`,
                            background: `linear-gradient(145deg, #E8C547, ${GOLD})`,
                            boxShadow: `0 4px 12px rgba(212,168,67,0.3), inset 0 -3px 6px rgba(0,0,0,0.15), inset 0 3px 6px rgba(255,255,255,0.3)`,
                          }
                        : isToday
                        ? {
                            border: `3px solid ${GOLD}`,
                            background: "rgba(20,20,20,0.95)",
                            animation: "breathe 3s ease-in-out infinite",
                          }
                        : nodeType === "next"
                        ? {
                            border: `2.5px dashed ${GOLD}`,
                            background: "#1e1e1e",
                            boxShadow: `0 4px 8px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.03)`,
                            opacity: 0.6,
                          }
                        : crown
                        ? {
                            border: `4px solid ${GOLD_DARK}`,
                            background: `linear-gradient(145deg, #E8C547, ${GOLD})`,
                            animation: "crownGlow 4s ease-in-out infinite",
                          }
                        : milestone
                        ? {
                            // locked milestone — gold tint + glow
                            border: `3px solid ${GOLD_DARK}`,
                            background: "rgba(212,168,67,0.08)",
                            boxShadow: `0 0 16px 4px rgba(212,168,67,0.15), 0 4px 8px rgba(0,0,0,0.3)`,
                            opacity: 0.7,
                          }
                        : {
                            // locked
                            border: "4px solid #1e1e1e",
                            background: "#1e1e1e",
                            boxShadow: `0 4px 8px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.03)`,
                            opacity: 0.45,
                          }),
                    }}
                  >
                    {renderNodeIcon(day, nodeType, size)}
                  </button>

                  {/* Today popup - positioned above the node */}
                  {renderTodayPopup(day)}
                </div>

                {/* Label */}
                {showLabel && (
                  <div
                    style={{
                      marginTop: 8,
                      textAlign: "center",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isToday && crown && allDoneToday && (
                      <>
                        <div style={{ fontSize: "0.82rem", fontWeight: 800, color: GOLD }}>
                          Stage {stage} Complete!
                        </div>
                        <div style={{ fontSize: "0.68rem", fontWeight: 600, color: GOLD, opacity: 0.8 }}>
                          Next stage unlocks soon
                        </div>
                      </>
                    )}
                    {isToday && !crown && (
                      <>
                        <div
                          style={{
                            fontSize: "0.82rem",
                            fontWeight: 800,
                            color: GOLD,
                            letterSpacing: "-0.02em",
                          }}
                        >
                          Day {day}
                        </div>
                        <div
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            color: allDoneToday ? GOLD : "rgba(255,255,255,0.9)",
                            marginTop: 1,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {allDoneToday ? "Complete!" : "TODAY"}
                        </div>
                        {!allDoneToday && (
                          <div style={{
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            color: GOLD,
                            marginTop: 6,
                            animation: "startPulse 2s ease-in-out infinite",
                          }}>
                            Tap to start →
                          </div>
                        )}
                      </>
                    )}
                    {isToday && crown && !allDoneToday && (
                      <>
                        <div style={{ fontSize: "0.82rem", fontWeight: 800, color: GOLD }}>
                          Day {day}
                        </div>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "rgba(255,255,255,0.9)", marginTop: 1, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          TODAY
                        </div>
                        <div style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: GOLD,
                          marginTop: 6,
                          animation: "startPulse 2s ease-in-out infinite",
                        }}>
                          Tap to start →
                        </div>
                      </>
                    )}
                    {crown && !isToday && (
                      <>
                        <div style={{ fontSize: "0.82rem", fontWeight: 800, color: GOLD }}>
                          Huge Progress
                        </div>
                        <div style={{ fontSize: "0.68rem", fontWeight: 600, color: GOLD, opacity: 0.8 }}>
                          Enter next stage →
                        </div>
                      </>
                    )}
                    {milestone && !isToday && !crown && (
                      <>
                        <div style={{ fontSize: "0.8rem", fontWeight: 800, color: GOLD }}>
                          {day === 7 ? "1 Week!" : day === 14 ? "2 Weeks!" : day === 30 ? "1 Month!" : day === 60 ? "2 Months!" : day === 100 ? "100 Days!" : `Day ${day}`}
                        </div>
                        <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "rgba(212,168,67,0.7)" }}>
                          Milestone
                        </div>
                      </>
                    )}
                    {nodeType === "next" && allDoneToday && !milestone && !crown && (
                      <>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
                          Day {day}
                        </div>
                        <InlineCountdown />
                      </>
                    )}
                    {nodeType === "completed" && !milestone && !crown && (
                      <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(212,168,67,0.6)" }}>
                        Day {day}
                      </div>
                    )}
                    {nodeType === "locked" && !milestone && !crown && (
                      <>
                        <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.25)" }}>
                          Day {day}
                        </div>
                        {day === dayNumber + 1 && <InlineCountdown />}
                      </>
                    )}
                  </div>
                )}
              </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scroll hint overlay */}
      {showScrollHint && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 60,
            background: "linear-gradient(transparent, var(--bg, #141414))",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: 8,
            pointerEvents: "none",
            transition: "opacity 0.5s ease",
            zIndex: 5,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: "scrollArrowBounce 1.5s ease-in-out infinite" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      )}
      </div>

      {/* Locked day modal */}
      {lockedModal && (
        <div
          onClick={() => setLockedModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            animation: "modalFadeIn 0.2s ease",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(22,22,22,0.97)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 20,
              padding: "32px 28px 28px",
              width: "calc(100vw - 2rem)",
              maxWidth: 380,
              textAlign: "center",
              animation: "modalSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 18px",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <p
              style={{
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
                lineHeight: 1.65,
                margin: "0 0 24px",
              }}
            >
              This day hasn&apos;t been unlocked yet. Complete the previous day to continue.
            </p>
            <button
              onClick={() => setLockedModal(false)}
              style={{
                padding: "13px 40px",
                borderRadius: 12,
                background: `linear-gradient(135deg, ${GOLD}, #C49A3C)`,
                color: "#000",
                fontSize: "0.92rem",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                transition: "filter 0.2s, transform 0.2s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = "brightness(1.12)";
                e.currentTarget.style.transform = "scale(1.03)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = "brightness(1)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
