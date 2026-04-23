"use client";

import { useState } from "react";
import DfyModal from "./DfyModal";

export type DfyType = "names" | "products" | "logo";

export function detectDfyType(taskText: string): DfyType | null {
  const t = taskText.toLowerCase();
  if (/\bbusiness name\b|\bstore name\b|\bbrand name\b|\bname the (business|store|brand)\b/.test(t)) return "names";
  if (/\blogo\b/.test(t)) return "logo";
  if (/pick a product|choose a product|pick a top|top-performing product/.test(t)) return "products";
  return null;
}

export default function DfyButton({
  type,
  taskText,
  onDelivered,
}: {
  type: DfyType;
  taskText: string;
  onDelivered?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          marginTop: 8,
          borderRadius: 8,
          background: "rgba(212,168,67,0.12)",
          border: "1px solid rgba(212,168,67,0.4)",
          color: "#D4A843",
          fontSize: "0.78rem",
          fontWeight: 700,
          cursor: "pointer",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(212,168,67,0.2)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(212,168,67,0.12)"; }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.91 5.78L20 10l-4.73 3.43L17 20l-5-3.5L7 20l1.73-6.57L4 10l6.09-1.22L12 3z" />
        </svg>
        Do it for me
      </button>
      {open && (
        <DfyModal
          type={type}
          taskText={taskText}
          onClose={() => setOpen(false)}
          onDelivered={onDelivered}
        />
      )}
    </>
  );
}
