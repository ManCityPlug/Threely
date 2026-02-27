"use client";

import { goalCategories, type GoalCategory } from "@/lib/goal-templates";

export default function GoalTemplates({
  onSelect,
  onClose,
  onOther,
}: {
  onSelect: (category: GoalCategory) => void;
  onClose: () => void;
  onOther?: () => void;
}) {
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 6 }}>
        <h3
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          What is your goal?
        </h3>
      </div>
      <p
        style={{
          color: "var(--subtext)",
          fontSize: "0.85rem",
          lineHeight: 1.5,
          marginBottom: "1.25rem",
        }}
      >
        Pick a category and Threely Intelligence will ask personalized questions
        to build your perfect plan.
      </p>

      {/* Category grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "0.625rem",
        }}
      >
        {goalCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat)}
            style={{
              padding: "1rem 0.75rem",
              borderRadius: "var(--radius-lg)",
              border: "1.5px solid var(--border)",
              background: "var(--card)",
              cursor: "pointer",
              textAlign: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--primary)";
              e.currentTarget.style.background = "var(--primary-light)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.background = "var(--card)";
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 6 }}>{cat.emoji}</div>
            <div
              style={{
                fontWeight: 600,
                fontSize: "0.85rem",
                color: "var(--text)",
                marginBottom: 2,
              }}
            >
              {cat.label}
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "var(--subtext)",
                lineHeight: 1.3,
              }}
            >
              {cat.description}
            </div>
          </button>
        ))}
      </div>

      {/* Other option */}
      {onOther && (
        <button
          onClick={onOther}
          style={{
            width: "100%",
            marginTop: "0.75rem",
            padding: "0.7rem 1rem",
            borderRadius: "var(--radius)",
            border: "1.5px dashed var(--border)",
            background: "transparent",
            color: "var(--subtext)",
            fontSize: "0.85rem",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--primary)";
            e.currentTarget.style.color = "var(--primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--subtext)";
          }}
        >
          Something else — let me describe it
        </button>
      )}
    </div>
  );
}
