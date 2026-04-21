export type FunnelCategory = "business" | "daytrading" | "health";

export interface FunnelCategoryMeta {
  id: FunnelCategory;
  label: string;
  subtitle: string;
}

export const FUNNEL_CATEGORIES: FunnelCategoryMeta[] = [
  { id: "daytrading", label: "\u{1F4C8} Day Trading", subtitle: "Grow a trading account" },
  { id: "business", label: "\u{1F4BC} Business", subtitle: "Start or grow a business" },
  { id: "health", label: "\u{1F4AA} Health", subtitle: "Transform your body" },
];

export interface FunnelStepConfig {
  question: string;
  buttons: { label: string; path: string; description?: string }[];
}

// Each category answers 2 questions: income/target + sub-path routing.
// The sub-path answer directly maps to a library path id in packages/tasks.
export const FUNNEL_STEPS: Record<FunnelCategory, FunnelStepConfig[]> = {
  business: [
    {
      question: "What are you building?",
      buttons: [
        { label: "Ecommerce — starting fresh", path: "business_ecommerce", description: "Physical product, Shopify, dropshipping" },
        { label: "Ecommerce — already have a store", path: "business_ecommerce_existing", description: "Grow traffic and revenue" },
        { label: "Service / freelancing", path: "business_service", description: "Trade skills for money" },
        { label: "Content / audience", path: "business_content", description: "TikTok, YouTube, IG, X" },
        { label: "Software / SaaS", path: "business_saas", description: "Digital product or SaaS" },
      ],
    },
    {
      question: "How much do you want to make per month?",
      buttons: [
        { label: "$500", path: "" },
        { label: "$1K-$5K", path: "" },
        { label: "$10K+", path: "" },
      ],
    },
  ],
  daytrading: [
    {
      question: "Where are you starting?",
      buttons: [
        { label: "Never traded", path: "daytrading_beginner", description: "Learn from scratch with paper trading" },
        { label: "I have experience", path: "daytrading_experienced", description: "Build discipline and consistency" },
      ],
    },
    {
      question: "How much do you want to make per month?",
      buttons: [
        { label: "$500", path: "" },
        { label: "$1K-$5K", path: "" },
        { label: "$10K+", path: "" },
      ],
    },
  ],
  health: [
    {
      question: "What's your goal?",
      buttons: [
        { label: "Lose weight", path: "health_weight_loss", description: "Calorie deficit + movement" },
        { label: "Build muscle", path: "health_muscle", description: "Progressive overload + protein" },
        { label: "Get fit / feel better", path: "health_general", description: "Daily habits and movement" },
      ],
    },
  ],
};

// Daily-time defaults. Library is tuned for 15 min/day.
export const DEFAULT_DAILY_MINUTES = 15;

export const EFFORT_TO_MINUTES: Record<string, number> = {
  mild: 30,
  moderate: 60,
  heavy: 120,
};

export const EFFORT_TO_INTENSITY: Record<string, number> = {
  mild: 1,
  moderate: 2,
  heavy: 3,
};

// Build the display title for the goal, based on category + answers.
export function buildGoalTitle(category: FunnelCategory, answers: string[], path: string): string {
  switch (category) {
    case "business": {
      const income = answers[1] ?? "";
      if (path === "business_ecommerce") return income ? `Make ${income}/Month (Ecommerce)` : "Start an Ecommerce Brand";
      if (path === "business_ecommerce_existing") return income ? `Grow My Store to ${income}/Month` : "Grow My Ecommerce Store";
      if (path === "business_service") return income ? `Make ${income}/Month (Service)` : "Start a Service Business";
      if (path === "business_content") return income ? `Build an Audience + ${income}/Month` : "Build a Content Brand";
      if (path === "business_saas") return income ? `Launch a SaaS + ${income}/Month` : "Launch a SaaS";
      return "Start a Business";
    }
    case "daytrading": {
      const income = answers[1] ?? "";
      if (path === "daytrading_beginner") return income ? `Learn Day Trading → ${income}/Month` : "Learn to Day Trade";
      if (path === "daytrading_experienced") return income ? `Day Trading → ${income}/Month` : "Day Trade With Discipline";
      return "Day Trading";
    }
    case "health":
      if (path === "health_weight_loss") return "Lose Weight";
      if (path === "health_muscle") return "Build Muscle";
      if (path === "health_general") return "Get Fit + Feel Better";
      return "Health Goal";
  }
}

// Kept for backwards-compat: some call sites expect a natural-language "goalText".
export function buildGoalText(category: FunnelCategory, answers: string[], path: string): string {
  return buildGoalTitle(category, answers, path);
}
