export type FunnelCategory = "business" | "daytrading" | "health" | "other";

export interface FunnelCategoryMeta {
  id: FunnelCategory;
  label: string;
  subtitle: string;
}

export const FUNNEL_CATEGORIES: FunnelCategoryMeta[] = [
  { id: "daytrading", label: "\u{1F4C8} Day Trading", subtitle: "Grow a trading account" },
  { id: "business", label: "\u{1F911} Business", subtitle: "Start or grow a business" },
  { id: "health", label: "\u{1F4AA} Health", subtitle: "Transform your body" },
  { id: "other", label: "Other", subtitle: "Set any goal" },
];

export interface FunnelStepConfig {
  question: string;
  buttons?: string[];
  isTextInput?: boolean;
  placeholder?: string;
  skippable?: boolean;
  continueButton?: string;
}

export const FUNNEL_STEPS: Record<FunnelCategory, FunnelStepConfig[]> = {
  business: [
    { question: "How much do you want to make per month?", buttons: ["$500", "$1K-$5K", "$10K+"] },
    { question: "Level of work?", buttons: ["Mild", "Moderate", "Heavy"] },
    { question: "Got a business idea?", isTextInput: true, placeholder: "Enter your idea...", skippable: true },
  ],
  daytrading: [
    { question: "How much do you want to make per month?", buttons: ["$500", "$1K-$5K", "$10K+"] },
    { question: "Level of work?", buttons: ["Mild", "Moderate", "Heavy"] },
    { question: "Any previous experience?", isTextInput: true, placeholder: "e.g. traded stocks for 6 months, complete beginner...", skippable: true },
  ],
  health: [
    { question: "What do you want?", buttons: ["Lose weight", "Glow up", "Gain more muscle"] },
    { question: "Level of work?", buttons: ["Mild", "Moderate", "Heavy"] },
    { question: "Do you have a specific target goal?", isTextInput: true, placeholder: "Enter my goal...", skippable: true },
  ],
  other: [
    { question: "What's your goal?", isTextInput: true, placeholder: "Describe your goal...", continueButton: "Continue" },
    { question: "Level of work?", buttons: ["Mild", "Moderate", "Heavy"] },
    { question: "Anything specific?", isTextInput: true, placeholder: "Enter details...", skippable: true },
  ],
};

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

export function buildGoalText(category: FunnelCategory, answers: string[]): string {
  switch (category) {
    case "business":
      return `I want to make ${answers[0]} per month. I can put in ${answers[1].toLowerCase()} work. ${answers[2] ? `My business idea: ${answers[2]}` : "I need help finding a business idea."}`;
    case "daytrading":
      return `I want to day trade to make ${answers[0]} per month. I can put in ${answers[1].toLowerCase()} work. ${answers[2] ? `Previous experience: ${answers[2]}` : "I'm a complete beginner with no day trading experience."}`;
    case "health":
      return `I want to ${answers[0].toLowerCase()}. I can put in ${answers[1].toLowerCase()} work. ${answers[2] ? `My target: ${answers[2]}` : ""}`.trim();
    case "other":
      return `My goal: ${answers[0]}. I can put in ${answers[1].toLowerCase()} work. ${answers[2] ? `Details: ${answers[2]}` : ""}`.trim();
  }
}
