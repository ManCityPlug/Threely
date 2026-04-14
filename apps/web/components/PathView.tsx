"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PathViewProps {
  dayNumber: number;
  completedDays: number;
  onDayClick: (day: number, type: "completed" | "today" | "next" | "locked") => void;
  allDoneToday: boolean;
  totalTasks: number;
}

const MILESTONE_DAYS = [7, 14, 30, 60, 100];
const GOLD = "#D4A843";
const GOLD_DIM = "rgba(212,168,67,0.35)";
const GREY = "rgba(255,255,255,0.25)";
const GREY_NODE = "rgba(255,255,255,0.15)";
const NODE_SIZE = 48;
const TODAY_SIZE = 64;
const MILESTONE_SIZE = 56;
const ZIGZAG_OFFSET = 70;
const ZIGZAG_MOBILE = 40;
const NODE_SPACING = 88;
const VISIBLE_NODES = 20;

// ─── Component ────────────────────────────────────────────────────────────────

export default function PathView({
  dayNumber,
  completedDays,
  onDayClick,
  allDoneToday,
  totalTasks,
}: PathViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [containerWidth, setContainerWidth] = useState(400);

  const windowStart = Math.max(1, dayNumber - Math.min(dayNumber - 1, 7));
  const days: number[] = [];
  for (let i = 0; i < VISIBLE_NODES; i++) {
    days.push(windowStart + i);
  }

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

  const zigzag = isMobileView ? ZIGZAG_MOBILE : ZIGZAG_OFFSET;
  const centerX = containerWidth / 2;

  function getNodeType(day: number): "completed" | "today" | "next" | "locked" {
    if (day < dayNumber) return "completed";
    if (day === dayNumber) return "today";
    if (day === dayNumber + 1 && allDoneToday) return "next";
    return "locked";
  }

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
    return 28 + index * NODE_SPACING;
  }

  return (
    <>
      <style>{`
        @keyframes pathPulse {
          0%, 100% { transform: translate(-50%, 0) scale(1); box-shadow: 0 0 0 0 rgba(212,168,67,0.4); }
          50% { transform: translate(-50%, 0) scale(1.06); box-shadow: 0 0 24px 6px rgba(212,168,67,0.2); }
        }
        @keyframes pathFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
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
          maxHeight: 460,
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
            height: days.length * NODE_SPACING + 48,
          }}
        >
          {/* Connecting lines as absolutely positioned divs */}
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
                  height: 2.5,
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
                  gap: 10,
                  flexDirection: isRight ? "row" : "row-reverse",
                  opacity: mounted ? 1 : 0,
                  animation: mounted ? `pathFadeIn 0.35s ease ${i * 0.035}s both` : "none",
                  zIndex: nodeType === "today" ? 10 : 1,
                }}
              >
                {/* Node circle */}
                <button
                  onClick={() => onDayClick(day, nodeType)}
                  className="path-node-btn"
                  style={{
                    width: size,
                    height: size,
                    borderRadius: "50%",
                    border: nodeType === "today"
                      ? `3px solid ${GOLD}`
                      : nodeType === "completed"
                      ? `2.5px solid ${GOLD}`
                      : nodeType === "next"
                      ? `2.5px dashed ${GOLD_DIM}`
                      : `2px solid ${GREY}`,
                    background: nodeType === "completed"
                      ? GOLD
                      : nodeType === "today"
                      ? "rgba(212,168,67,0.12)"
                      : nodeType === "next"
                      ? "rgba(212,168,67,0.06)"
                      : GREY_NODE,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    padding: 0,
                    flexShrink: 0,
                    opacity: nodeType === "locked" ? 0.4 : 1,
                    transition: "all 0.25s ease",
                    animation: nodeType === "today" ? "pathPulse 2.5s ease-in-out infinite" : "none",
                    boxShadow: nodeType === "today"
                      ? "0 0 20px 4px rgba(212,168,67,0.2)"
                      : nodeType === "completed"
                      ? "0 2px 8px rgba(212,168,67,0.12)"
                      : "none",
                  }}
                  aria-label={`Day ${day}`}
                >
                  {nodeType === "completed" && !milestone && (
                    <svg width={size * 0.38} height={size * 0.38} viewBox="0 0 14 14" fill="none">
                      <path d="M3 7L6 10L11 4" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {nodeType === "completed" && milestone && (
                    <span style={{ fontSize: size * 0.42, lineHeight: 1 }}>{"🏆"}</span>
                  )}
                  {nodeType === "today" && !milestone && (
                    <span style={{ fontSize: size * 0.32, fontWeight: 800, color: GOLD }}>
                      {allDoneToday ? "✓" : day}
                    </span>
                  )}
                  {nodeType === "today" && milestone && (
                    <span style={{ fontSize: size * 0.42, lineHeight: 1 }}>{"⭐"}</span>
                  )}
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

                {/* Label */}
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isRight ? "flex-start" : "flex-end",
                  whiteSpace: "nowrap",
                }}>
                  {nodeType === "today" ? (
                    <>
                      <span style={{
                        fontSize: "0.92rem",
                        fontWeight: 800,
                        color: GOLD,
                        letterSpacing: "-0.02em",
                      }}>
                        Day {day}
                      </span>
                      <span style={{
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.6)",
                        marginTop: 1,
                      }}>
                        {allDoneToday ? "Complete!" : totalTasks > 0 ? "Tap to view tasks" : "TODAY"}
                      </span>
                    </>
                  ) : milestone ? (
                    <>
                      <span style={{
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        color: nodeType === "completed" ? GOLD : "rgba(255,255,255,0.4)",
                        letterSpacing: "-0.01em",
                      }}>
                        Day {day}
                      </span>
                      <span style={{
                        fontSize: "0.66rem",
                        fontWeight: 600,
                        color: nodeType === "completed" ? "rgba(212,168,67,0.65)" : "rgba(255,255,255,0.3)",
                      }}>
                        {nodeType === "completed" ? "Milestone!" : "Milestone"}
                      </span>
                    </>
                  ) : nodeType === "next" && allDoneToday ? (
                    <span style={{
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.5)",
                    }}>
                      Day {day}
                    </span>
                  ) : nodeType === "completed" ? (
                    <span style={{
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      color: "rgba(212,168,67,0.6)",
                    }}>
                      Day {day}
                    </span>
                  ) : (
                    <span style={{
                      fontSize: "0.7rem",
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.3)",
                    }}>
                      Day {day}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
