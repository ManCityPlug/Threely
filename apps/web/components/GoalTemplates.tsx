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

      {/* Two category cards side by side */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.625rem",
        }}
      >
        {goalCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat)}
            style={{
              padding: "1.25rem 1rem",
              borderRadius: "var(--radius-lg)",
              border: "1.5px solid var(--border)",
              background: "var(--card)",
              cursor: "pointer",
              textAlign: "center",
              transition: "all 0.15s",
              height: 140,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
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
            <div style={{ fontSize: 36, marginBottom: 8 }}>{cat.emoji}</div>
            <div
              style={{
                fontWeight: 600,
                fontSize: "0.9rem",
                color: "var(--text)",
                marginBottom: 4,
              }}
            >
              {cat.label}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--subtext)",
                lineHeight: 1.4,
              }}
            >
              {cat.description}
            </div>
          </button>
        ))}
      </div>

      {/* "Something else" full-width */}
      {onOther && (
        <button
          onClick={onOther}
          style={{
            width: "100%",
            marginTop: "0.625rem",
            padding: "1.25rem 1rem",
            borderRadius: "var(--radius-lg)",
            border: "1.5px solid var(--border)",
            background: "var(--card)",
            cursor: "pointer",
            textAlign: "center",
            transition: "all 0.15s",
            height: 140,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
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
          <div style={{ fontSize: 36, marginBottom: 8 }}>✏️</div>
          <div
            style={{
              fontWeight: 600,
              fontSize: "0.9rem",
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            Something else
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--subtext)",
              lineHeight: 1.4,
            }}
          >
            Let me describe my own goal
          </div>
        </button>
      )}
    </div>
  );
}
