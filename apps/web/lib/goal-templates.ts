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
    description: "Business, investing, and financial freedom",
    starterMessage: "I want to build wealth through business and investing.",
  },
  {
    id: "career",
    emoji: "\u{1F4BC}",
    label: "Career",
    description: "Promotions, skill-building, and landing your next role",
    starterMessage: "I want to grow professionally and advance in my career.",
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
    id: "religion",
    emoji: "\u{1F64F}",
    label: "Religion",
    description: "Faith, spiritual growth, and devotion",
    starterMessage: "I want to deepen my faith and spiritual practice.",
  },
  {
    id: "mindfulness",
    emoji: "\u{1F9E0}",
    label: "Mindfulness",
    description: "Meditation, journaling, and self-awareness",
    starterMessage: "I want to practice mindfulness and self-awareness.",
  },
];
