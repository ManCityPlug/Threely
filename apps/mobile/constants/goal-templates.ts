export interface GoalCategory {
  id: string;
  emoji: string;
  label: string;
  description: string;
  starterMessage: string;
}

export const goalCategories: GoalCategory[] = [
  {
    id: "fitness",
    emoji: "\u{1F4AA}",
    label: "Fitness",
    description: "Gym routines, running, weight loss, and physical training",
    starterMessage: "I want to improve my fitness.",
  },
  {
    id: "wealth",
    emoji: "\u{1F4B0}",
    label: "Wealth",
    description: "Business, ecommerce, investing, and building income",
    starterMessage: "I want to build wealth through business and investing.",
  },
];
