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

const MILESTONE_DAYS = [7, 14, 30, 60, 100];
const GOLD = "#D4A843";
const GOLD_DIM = "rgba(212,168,67,0.35)";
const GREY = "rgba(255,255,255,0.25)";
const GREY_NODE = "rgba(255,255,255,0.15)";
const NODE_SIZE = 50;
const TODAY_SIZE = 68;
const MILESTONE_SIZE = 58;
const ZIGZAG_OFFSET = 80;
const ZIGZAG_MOBILE = 48;
const NODE_SPACING = 108;
const VISIBLE_NODES = 20;

// ─── Section banner helper ───────────────────────────────────────────────────

function getWeekPhase(dayNumber: number): { week: number; phase: string } {
  const week = Math.ceil(dayNumber / 7);
  if (week <= 1) return { week: 1, phase: "Getting Started" };
  if (week <= 3) return { week, phase: "Building Momentum" };
  return { week, phase: "Taking Action" };
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
  const [isMobileView, setIsMobileView] = useState(false);
  const [containerWidth, setContainerWidth] = useState(400);
  const [todayPopup, setTodayPopup] = useState(false);
  const [lockedModal, setLockedModal] = useState(false);

  const windowStart = Math.max(1, dayNumber - Math.min(dayNumber - 1, 7));
  const days: number[] = [];
  for (let i = 0; i < VISIBLE_NODES; i++) {
    days.push(windowStart + i);
  }

  const { week, phase } = getWeekPhase(dayNumber);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => {
      if (todayRef.current && scrollRef.current) {
        const container = scrollRef.current;
        const node = todayRef.current;
        const containerRect = container.getBoundingClientRect();
        const scrollTarget = node.offsetTop - containerRect.height / 2 + 32;
        container.scrollTo({ top: Math.max(0, scrollTarget), behavior: "smooth" });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    function handleResize() {
      setIsMobileView(window.innerWidth < 500);
      if (scrollRef.current) {
        setContainerWidth(scrollRef.current.clientWidth);
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close today popup when clicking outside
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

  const zigzag = isMobileView ? ZIGZAG_MOBILE : ZIGZAG_OFFSET;
  const centerX = containerWidth / 2;

  const getNodeType = useCallback((day: number): "completed" | "today" | "next" | "locked" => {
    if (day < dayNumber) return "completed";
    if (day === dayNumber) return "today";
    if (day === dayNumber + 1 && allDoneToday) return "next";
    return "locked";
  }, [dayNumber, allDoneToday]);

  function isMilestone(day: number): boolean {
    return MILESTONE_DAYS.includes(day);
  }

  function getNodeSize(day: number): number {
    if (day === dayNumber) return TODAY_SIZE;
    if (isMilestone(day)) return MILESTONE_SIZE;
    return NODE_SIZE;
  }

  function getNodeX(index: number): number {
    const dir = index % 2 === 0 ? 1 : -1;
    return centerX + dir * zigzag;
  }

  function getNodeY(index: number): number {
    return 60 + index * NODE_SPACING;
  }

  function handleNodeClick(day: number, nodeType: "completed" | "today" | "next" | "locked") {
    if (nodeType === "today") {
      // If tasks are already visible, just scroll to them
      if (tasksVisible) {
        onDayClick(day, nodeType);
        return;
      }
      // Otherwise show the popup
      setTodayPopup(prev => !prev);
      return;
    }
    if (nodeType === "locked") {
      setLockedModal(true);
      return;
    }
    onDayClick(day, nodeType);
  }

  // Find today's index for popup positioning
  const todayIndex = days.indexOf(dayNumber);
  const todayIsRight = todayIndex >= 0 ? todayIndex % 2 === 0 : true;

  return (
    <>
      <style>{`
        @keyframes pathPulse {
          0%, 100% { transform: translate(-50%, 0) scale(1); box-shadow: 0 0 0 0 rgba(212,168,67,0.4); }
          50% { transform: translate(-50%, 0) scale(1.08); box-shadow: 0 0 32px 8px rgba(212,168,67,0.25); }
        }
        @keyframes pathFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes popupFadeIn {
          from { opacity: 0; transform: translateY(8px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .path-scroll::-webkit-scrollbar { display: none; }
        .path-node-btn { font-family: inherit; }
        .path-node-btn:hover { filter: brightness(1.12); }
      `}</style>


      <div
        ref={scrollRef}
        className="path-scroll"
        style={{
          position: "relative",
          width: "100%",
          maxHeight: 480,
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          marginBottom: 20,
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: days.length * NODE_SPACING + 80,
          }}
        >
          {/* Connecting lines */}
          {mounted && days.slice(0, -1).map((day, i) => {
            const nextDay = days[i + 1];
            const x1 = getNodeX(i);
            const y1 = getNodeY(i) + getNodeSize(day) / 2;
            const x2 = getNodeX(i + 1);
            const y2 = getNodeY(i + 1) + getNodeSize(nextDay) / 2;

            const nodeType = getNodeType(day);
            const nextNodeType = getNodeType(nextDay);
            const lineGold = nodeType === "completed" && (nextNodeType === "completed" || nextNodeType === "today");
            const lineColor = lineGold ? GOLD : GREY;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);

            return (
              <div
                key={`line-${day}`}
                style={{
                  position: "absolute",
                  left: x1,
                  top: y1,
                  width: length,
                  height: 3,
                  background: lineColor,
                  transformOrigin: "0 50%",
                  transform: `rotate(${angle}deg)`,
                  borderRadius: 2,
                  opacity: 1,
                  transition: "opacity 0.4s ease",
                  pointerEvents: "none",
                }}
              />
            );
          })}

          {/* Nodes */}
          {days.map((day, i) => {
            const nodeType = getNodeType(day);
            const milestone = isMilestone(day);
            const size = getNodeSize(day);
            const xPos = getNodeX(i);
            const yPos = getNodeY(i);
            const isRight = i % 2 === 0;

            return (
              <div
                key={day}
                ref={day === dayNumber ? todayRef : undefined}
                style={{
                  position: "absolute",
                  top: yPos,
                  left: xPos,
                  transform: "translate(-50%, 0)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexDirection: isRight ? "row" : "row-reverse",
                  opacity: mounted ? 1 : 0,
                  animation: mounted ? `pathFadeIn 0.35s ease ${i * 0.035}s both` : "none",
                  zIndex: nodeType === "today" ? 10 : 1,
                }}
              >
                {/* Node circle */}
                <button
                  data-today-node={day === dayNumber ? "true" : undefined}
                  onClick={() => handleNodeClick(day, nodeType)}
                  className="path-node-btn"
                  style={{
                    position: "relative",
                    width: size,
                    height: size,
                    borderRadius: "50%",
                    border: nodeType === "today"
                      ? `3.5px solid ${GOLD}`
                      : nodeType === "completed"
                      ? `2.5px solid ${GOLD}`
                      : nodeType === "next"
                      ? `2.5px dashed ${GOLD_DIM}`
                      : `2px solid ${GREY}`,
                    background: nodeType === "completed"
                      ? GOLD
                      : nodeType === "today"
                      ? "rgba(212,168,67,0.15)"
                      : nodeType === "next"
                      ? "rgba(212,168,67,0.06)"
                      : GREY_NODE,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    padding: 0,
                    flexShrink: 0,
                    opacity: nodeType === "locked" ? 0.45 : 1,
                    transition: "all 0.25s ease",
                    animation: nodeType === "today" ? "pathPulse 2.5s ease-in-out infinite" : "none",
                    boxShadow: nodeType === "today"
                      ? "0 0 32px 8px rgba(212,168,67,0.25), 0 0 60px 12px rgba(212,168,67,0.1)"
                      : nodeType === "completed"
                      ? "0 2px 10px rgba(212,168,67,0.15)"
                      : "none",
                  }}
                  aria-label={`Day ${day}`}
                >
                  {/* Completed: checkmark */}
                  {nodeType === "completed" && !milestone && (
                    <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 14 14" fill="none">
                      <path d="M3 7L6 10L11 4" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {nodeType === "completed" && milestone && (
                    <span style={{ fontSize: size * 0.42, lineHeight: 1 }}>{"🏆"}</span>
                  )}

                  {/* Today: star/play icon or checkmark if done */}
                  {nodeType === "today" && !milestone && (
                    allDoneToday ? (
                      <svg width={size * 0.38} height={size * 0.38} viewBox="0 0 14 14" fill="none">
                        <path d="M3 7L6 10L11 4" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      /* Star icon for today */
                      <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 24 24" fill={GOLD} stroke="none">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    )
                  )}
                  {nodeType === "today" && milestone && (
                    <span style={{ fontSize: size * 0.42, lineHeight: 1 }}>{"⭐"}</span>
                  )}

                  {/* Locked: lock icon inside node */}
                  {(nodeType === "locked" || nodeType === "next") && !milestone && (
                    <svg
                      width={size * 0.3}
                      height={size * 0.3}
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
                  )}
                  {(nodeType === "locked" || nodeType === "next") && milestone && (
                    <span style={{ fontSize: size * 0.38, lineHeight: 1, opacity: 0.5 }}>{"🏆"}</span>
                  )}
                </button>

                {/* Label — always visible next to nodes */}
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isRight ? "flex-start" : "flex-end",
                  whiteSpace: "nowrap",
                }}>
                  {nodeType === "today" ? (
                    <>
                      <span style={{
                        fontSize: "1rem",
                        fontWeight: 800,
                        color: GOLD,
                        letterSpacing: "-0.02em",
                      }}>
                        Day {day}
                      </span>
                      <span style={{
                        fontSize: "0.74rem",
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.85)",
                        marginTop: 2,
                      }}>
                        {allDoneToday ? "Complete!" : "TODAY"}
                      </span>
                    </>
                  ) : milestone ? (
                    <>
                      <span style={{
                        fontSize: "0.88rem",
                        fontWeight: 700,
                        color: nodeType === "completed" ? GOLD : "rgba(255,255,255,0.85)",
                        letterSpacing: "-0.01em",
                      }}>
                        Day {day}
                      </span>
                      <span style={{
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: nodeType === "completed" ? GOLD : "rgba(255,255,255,0.5)",
                      }}>
                        {nodeType === "completed" ? "Milestone!" : "Milestone"}
                      </span>
                    </>
                  ) : nodeType === "completed" ? (
                    <>
                      <span style={{
                        fontSize: "0.84rem",
                        fontWeight: 700,
                        color: GOLD,
                      }}>
                        Day {day}
                      </span>
                      <span style={{
                        fontSize: "0.68rem",
                        fontWeight: 600,
                        color: GOLD,
                        opacity: 0.75,
                      }}>
                        Complete!
                      </span>
                    </>
                  ) : nodeType === "next" && allDoneToday ? (
                    <span style={{
                      fontSize: "0.84rem",
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.85)",
                    }}>
                      Day {day}
                    </span>
                  ) : (
                    /* Locked days: day number label outside */
                    <span style={{
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.5)",
                    }}>
                      Day {day}
                    </span>
                  )}
                </div>

                {/* Today popup — attached to node like Duolingo */}
                {day === dayNumber && todayPopup && !allDoneToday && (
                  <div
                    data-today-popup="true"
                    style={{
                      position: "absolute",
                      top: size + 12,
                      left: "50%",
                      transform: "translateX(-50%)",
                      zIndex: 100,
                      animation: "popupFadeIn 0.2s ease",
                    }}
                  >
                    {/* Triangle arrow pointing up to node */}
                    <div style={{
                      width: 0,
                      height: 0,
                      borderLeft: "10px solid transparent",
                      borderRight: "10px solid transparent",
                      borderBottom: `10px solid rgba(30,28,24,0.95)`,
                      margin: "0 auto",
                      position: "relative",
                      zIndex: 2,
                    }} />
                    <div style={{
                      width: 0,
                      height: 0,
                      borderLeft: "11px solid transparent",
                      borderRight: "11px solid transparent",
                      borderBottom: `11px solid ${GOLD}`,
                      margin: "-11px auto 0",
                      position: "relative",
                      zIndex: 1,
                      top: -10,
                    }} />
                    <div style={{
                      background: "rgba(30,28,24,0.95)",
                      border: `1.5px solid ${GOLD}`,
                      borderRadius: 14,
                      padding: "18px 28px",
                      textAlign: "center",
                      minWidth: 180,
                      boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(212,168,67,0.1)`,
                      marginTop: -11,
                      position: "relative",
                      zIndex: 2,
                    }}>
                      <div style={{
                        fontSize: "0.95rem",
                        fontWeight: 800,
                        color: "#fff",
                        marginBottom: 4,
                      }}>
                        Day {day}
                      </div>
                      <div style={{
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.85)",
                        marginBottom: 14,
                      }}>
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
                          padding: "10px 24px",
                          borderRadius: 10,
                          background: `linear-gradient(135deg, ${GOLD}, #C49A3C)`,
                          color: "#000",
                          fontSize: "0.92rem",
                          fontWeight: 800,
                          border: "none",
                          cursor: "pointer",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          transition: "filter 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.1)"; }}
                        onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
                      >
                        START
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Locked day modal */}
      {lockedModal && (
        <div
          onClick={() => setLockedModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            animation: "modalFadeIn 0.2s ease",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "rgba(30,28,24,0.97)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 16,
              padding: "28px 24px 24px",
              width: "calc(100vw - 2rem)",
              maxWidth: 360,
              textAlign: "center",
              animation: "modalSlideIn 0.25s ease",
              boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <p style={{
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "rgba(255,255,255,0.9)",
              lineHeight: 1.6,
              marginBottom: 20,
            }}>
              This day hasn&apos;t been unlocked yet. Complete the previous day to continue.
            </p>
            <button
              onClick={() => setLockedModal(false)}
              style={{
                padding: "12px 36px",
                borderRadius: 10,
                background: GOLD,
                color: "#000",
                fontSize: "0.9rem",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                transition: "filter 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
