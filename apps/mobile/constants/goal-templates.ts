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
    description: "Exercise, training, and physical goals",
    starterMessage: "I want to improve my fitness.",
  },
  {
    id: "health",
    emoji: "\u{1F9D8}",
    label: "Health",
    description: "Wellness, nutrition, sleep, and mental health",
    starterMessage: "I want to improve my health and wellness.",
  },
  {
    id: "wealth",
    emoji: "\u{1F4B0}",
    label: "Wealth",
    description: "Saving, investing, and financial freedom",
    starterMessage: "I want to build wealth and improve my finances.",
  },
  {
    id: "career",
    emoji: "\u{1F4BC}",
    label: "Career",
    description: "Professional growth, promotions, and side hustles",
    starterMessage: "I want to advance my career.",
  },
  {
    id: "learning",
    emoji: "\u{1F4DA}",
    label: "Learning",
    description: "New skills, courses, and education",
    starterMessage: "I want to learn something new.",
  },
  {
    id: "creative",
    emoji: "\u{1F3A8}",
    label: "Creative",
    description: "Art, writing, music, and creative projects",
    starterMessage: "I want to pursue a creative project.",
  },
  {
    id: "relationships",
    emoji: "\u{1F91D}",
    label: "Relationships",
    description: "Networking, friendships, and connections",
    starterMessage: "I want to strengthen my relationships.",
  },
  {
    id: "productivity",
    emoji: "\u{26A1}",
    label: "Productivity",
    description: "Habits, routines, and time management",
    starterMessage: "I want to be more productive.",
  },
  {
    id: "mindfulness",
    emoji: "\u{1F9E0}",
    label: "Mindfulness",
    description: "Meditation, journaling, and self-awareness",
    starterMessage: "I want to practice mindfulness and self-awareness.",
  },
];
