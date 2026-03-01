import type { TaskItem, Goal, DailyTask } from "./api-client";

export const MOCK_TUTORIAL_GOAL: Goal = {
  id: "mock-tutorial-goal",
  title: "Get in the best shape of my life",
  description: "Build a sustainable fitness routine combining HIIT, nutrition planning, and mobility work",
  rawInput: "I want to get in the best shape of my life",
  structuredSummary: "Build sustainable fitness with HIIT training, macro-based nutrition, and daily mobility work",
  category: "Health & Fitness",
  deadline: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
  dailyTimeMinutes: 45,
  intensityLevel: 2,
  workDays: [1, 2, 3, 4, 5, 6],
  isActive: true,
  isPaused: false,
  createdAt: new Date().toISOString(),
};

export const MOCK_TUTORIAL_TASKS: TaskItem[] = [
  {
    id: "mock-t1",
    task: "Complete a 20-minute full-body HIIT circuit",
    description: "4 rounds: 40s burpees, 40s mountain climbers, 40s squat jumps, 40s plank jacks \u2014 20s rest between exercises.",
    estimated_minutes: 20,
    goal_id: "mock-tutorial-goal",
    why: "High-intensity intervals build cardiovascular endurance and metabolic conditioning faster than steady-state cardio",
    isCompleted: false,
    resources: [{ type: "youtube_channel", name: "THENX", detail: "Calisthenics HIIT routines" }],
  },
  {
    id: "mock-t2",
    task: "Plan and prep tomorrow's meals around a 40/30/30 macro split",
    description: "Map out breakfast, lunch, dinner, and one snack hitting ~2,200 cal with 40% protein, 30% carbs, 30% fat.",
    estimated_minutes: 15,
    goal_id: "mock-tutorial-goal",
    why: "Nutrition consistency compounds \u2014 one prepped day removes decision fatigue for the next",
    isCompleted: false,
    resources: [{ type: "app", name: "MyFitnessPal", detail: "Track macros and calories" }],
  },
  {
    id: "mock-t3",
    task: "Do a 10-minute mobility and recovery flow before bed",
    description: "Hip 90/90 stretch (2 min each side), thoracic spine rotation (1 min each), pigeon pose (1 min each), deep squat hold (2 min).",
    estimated_minutes: 10,
    goal_id: "mock-tutorial-goal",
    why: "Active recovery between training days prevents injury and improves range of motion over time",
    isCompleted: false,
    resources: [{ type: "youtube_channel", name: "Tom Merrick", detail: "Follow-along mobility routines" }],
  },
];

export const MOCK_TUTORIAL_DAILY_TASK: DailyTask = {
  id: "mock-dt-1",
  userId: "mock",
  goalId: "mock-tutorial-goal",
  date: new Date().toISOString().slice(0, 10),
  tasks: MOCK_TUTORIAL_TASKS,
  isCompleted: false,
  generatedAt: new Date().toISOString(),
  goal: { id: "mock-tutorial-goal", title: "Get in the best shape of my life", description: null },
};
