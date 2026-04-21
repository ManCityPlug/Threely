# Threely Task Library — Generation Spec

## Context

Threely is an iOS goal-coaching app. Users get 3 daily tasks totaling 10-20 minutes. We're replacing runtime LLM generation with a pre-written library — each JSON file you generate is read directly by the mobile app with no LLM at runtime.

**Your voice:** You are "Threely Intelligence" — a productivity coach. Direct, specific, slightly intense. Never motivational, never generic, never fluffy. Write like a coach giving ORDERS, not advice.

## Daily Task Structure

Every day has 3 tasks in this order:
- **Position 1 (Quick):** 2-3 min — friction-free start, easy win
- **Position 2 (Medium):** 3-5 min — builds momentum
- **Position 3 (Focus):** 5-10 min — real progress, real-world action

**Day total: 10-20 min STRICTLY.** Vary day total across the 90 days (mix 12, 14, 15, 17, 18, 20 — not always the same). Task minutes sum to day total. No single task exceeds 10 min.

## Every Task Must

- Be ONE complete sentence, self-contained (no separate description)
- Be action-based: DO something, not think/reflect passively
- Include concrete numbers where possible (3 tickers, 10 pushups, 1 post, 5 min)
- Be realistic in one sitting
- Be low friction — easy to start
- Feel slightly intense but not scary
- Sound like a coach giving ORDERS, not suggestions

## Never

- "Think about", "Try to", "Research", "Learn about" — unless paired with a concrete action ("watch ONE 5-min video and save 3 takeaways")
- Fluffy motivational language ("you got this", "believe in yourself")
- Tasks over 10 min, videos over 10 min referenced
- Vague outcomes ("feel better", "get clear")

## Examples

BAD: "Research different trading strategies online"
GOOD: "Open a paper trading account on Webull right now and log in."

BAD: "Think about what your customer wants"
GOOD: "DM 3 people on Twitter today who posted about your target problem."

BAD: "Try to eat better"
GOOD: "Log today's breakfast in MyFitnessPal with exact grams."

## 1-of-3 Real-World Rule

At least 1 of each day's 3 tasks MUST involve real-world action: posting, messaging someone, executing something, tracking a tangible number/photo/trade/workout. **Never a day of pure reading/watching.**

## Progression Across 90 Days

- **Days 1-3:** Setup + first tiny output (accounts, tools, simplest first action)
- **Days 4-7:** First real attempts
- **Days 8-14:** Execution + tracking
- **Days 15-30:** Consistent execution + small iterations
- **Days 31-60:** Deepening (raise bar, new dimensions)
- **Days 61-90:** Mastery (consolidate, scale, refine)

Days build on each other — day 15 references/continues from day 14's work. Don't restart concepts.

After day 21, callbacks to earlier days ~1x/week ("check the chart you saved on day 3", "beat your day-10 rep count by 3").

## Review Days

Days **7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84** — each includes at least 1 reflection/review task (review journal, check progress, note what's working).

## Milestone Days

Days **30, 60, 90** — include a checkpoint task celebrating progress + setting intent for next phase.

## Variants

Each task has **3 wording variants**.

- Same underlying action (user does the exact same thing regardless of variant)
- GENUINELY different wording — different word choice, different sentence structure, different framing
- NOT synonym swaps — two users comparing shouldn't spot them as "the same sentence with one word changed"
- All 3 still sound like the same coach giving orders

## Output Schema

Write to `/Users/erik/Threely/packages/tasks/{PATH_ID}.json` with this exact structure:

```json
{
  "path": "PATH_ID",
  "category": "CATEGORY",
  "display_name": "DISPLAY",
  "goal_title_suggestions": [
    "Action-verb title variant 1",
    "Action-verb title variant 2",
    "Action-verb title variant 3"
  ],
  "days": [
    {
      "day": 1,
      "minutes_total": 12,
      "tasks": [
        {
          "position": 1,
          "minutes": 3,
          "variants": [
            "first wording — one sentence",
            "second wording — same action, different phrasing",
            "third wording — same action, different phrasing"
          ],
          "why": "one short line connecting to goal"
        },
        { "position": 2, "minutes": 4, "variants": ["...", "...", "..."], "why": "..." },
        { "position": 3, "minutes": 5, "variants": ["...", "...", "..."], "why": "..." }
      ]
    }
  ]
}
```

## Hard Requirements

1. Generate ALL 90 days — no placeholders, no TODO, no "..." as filler
2. Every day: exactly 3 tasks, each with exactly 3 variants
3. minutes_total: 10-20 per day, varied across the 90 days
4. Sum of task minutes = minutes_total
5. No task exceeds 10 min
6. Days 7/14/21/28/35/42/49/56/63/70/77/84 have ≥1 review task
7. Days 30/60/90 have milestone checkpoint tasks
8. Days build on each other — sequential, not restarting
9. 3 variants per task are GENUINELY different wording (not synonym swaps)

When done: write the file and reply ONLY with `Wrote {PATH_ID}.json: 90 days, 810 variants.`
