// Static path definitions used by onboarding + runtime. Keep in sync with
// the category filenames in this directory.

export type PathCategory = "daytrading" | "business" | "health";

export interface PathDefinition {
  id: string;
  category: PathCategory;
  display_name: string;
  description: string;
}

export const PATHS: readonly PathDefinition[] = [
  { id: "daytrading_beginner",        category: "daytrading", display_name: "Day Trading — Beginner",       description: "Never traded — want to learn with zero risk" },
  { id: "daytrading_experienced",     category: "daytrading", display_name: "Day Trading — Build Discipline", description: "Have experience — want better consistency" },
  { id: "business_ecommerce",         category: "business",   display_name: "Start an Ecommerce Brand",       description: "No store yet — want to launch" },
  { id: "business_ecommerce_existing", category: "business",  display_name: "Grow My Ecommerce Store",        description: "Already have a store — want more revenue" },
  { id: "business_service",           category: "business",   display_name: "Start a Service Business",       description: "Freelancing / skill-based services" },
  { id: "business_content",           category: "business",   display_name: "Build a Content Brand",          description: "Grow an audience on TikTok / YouTube / IG / X" },
  { id: "business_saas",              category: "business",   display_name: "Launch a SaaS",                  description: "Software or digital product" },
  { id: "health_weight_loss",         category: "health",     display_name: "Lose Weight",                    description: "Calorie deficit + movement" },
  { id: "health_muscle",              category: "health",     display_name: "Build Muscle",                   description: "Progressive overload + protein" },
  { id: "health_general",             category: "health",     display_name: "Get Fit + Feel Better",          description: "Daily habits + movement" },
] as const;

export const PATH_IDS_BY_CATEGORY: Record<PathCategory, string[]> = PATHS.reduce((acc, p) => {
  if (!acc[p.category]) acc[p.category] = [];
  acc[p.category].push(p.id);
  return acc;
}, {} as Record<PathCategory, string[]>);

// Routing questions: category → sub-path selector. Onboarding presents
// these as MC so the app never touches an LLM to determine path.

export interface PathQuestion {
  category: PathCategory;
  question: string;
  options: { label: string; path: string; description?: string }[];
}

export const ROUTING_QUESTIONS: PathQuestion[] = [
  {
    category: "daytrading",
    question: "Where are you starting?",
    options: [
      { label: "Never traded", path: "daytrading_beginner", description: "Learn from scratch with paper trading" },
      { label: "I have experience", path: "daytrading_experienced", description: "Build discipline and consistency" },
    ],
  },
  {
    category: "business",
    question: "What are you building?",
    options: [
      { label: "Ecommerce — starting fresh", path: "business_ecommerce", description: "Physical product, Shopify, dropshipping" },
      { label: "Ecommerce — already have a store", path: "business_ecommerce_existing", description: "Grow traffic and revenue" },
      { label: "Service / freelancing", path: "business_service", description: "Trade skills for money" },
      { label: "Content / audience", path: "business_content", description: "TikTok, YouTube, IG, X" },
      { label: "Software / SaaS", path: "business_saas", description: "Digital product or SaaS" },
    ],
  },
  {
    category: "health",
    question: "What's your goal?",
    options: [
      { label: "Lose weight", path: "health_weight_loss", description: "Calorie deficit + movement" },
      { label: "Build muscle", path: "health_muscle", description: "Progressive overload + protein" },
      { label: "Get fit / feel better", path: "health_general", description: "Daily habits and movement" },
    ],
  },
];
