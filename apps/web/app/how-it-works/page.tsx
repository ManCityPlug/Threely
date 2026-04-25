import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "Describe your goal, get 3 personalized tasks every day. Complete them, leave a quick review, and watch the AI adapt to your progress. See how Threely works.",
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    title: "How Threely Works",
    description:
      "Describe your goal, get 3 personalized tasks every day. Complete, review, and watch the AI coaching adapt to you.",
  },
};

const STEPS = [
  {
    num: "01",
    subtitle: "In your own words",
    title: "Describe your goal",
    desc: "Tell Threely what you're working toward — \"I want to learn guitar,\" \"Launch my online store,\" \"Get in shape for summer.\" Include your experience level, how much time you have each day, and any deadlines.",
    detail:
      "Threely Intelligence analyzes your input and extracts the key details: category, timeline, skill level, daily time budget, and intensity. No forms to fill out — just natural language.",
  },
  {
    num: "02",
    subtitle: "Every single day",
    title: "Get 3 tailored tasks",
    desc: "Each morning, Threely generates exactly three tasks designed for where you are right now. Not yesterday's plan. Not a generic template. Tasks that account for your progress, your pace, and your available time.",
    detail:
      "Each task includes a clear title, a detailed description, an estimated time, and a \"why it matters\" explanation so you understand how it connects to your bigger goal.",
  },
  {
    num: "03",
    subtitle: "A 30-second feedback loop",
    title: "Complete and review",
    desc: "Check off your tasks as you go. When you're done for the day, leave a quick review: was it too easy, just right, or overwhelming? Add any notes about what went well or what was difficult.",
    detail:
      "This review takes less than 30 seconds, but it's the most powerful part of Threely. Your feedback directly shapes what happens next.",
  },
  {
    num: "04",
    subtitle: "Smarter every day",
    title: "AI adapts and coaches",
    desc: "Threely Intelligence uses your review to generate a personalized coaching insight — a 2-3 sentence note that reflects on your progress and primes you for tomorrow. Then it calibrates your next set of tasks.",
    detail:
      "If yesterday was too hard, tomorrow gets recalibrated. If you're ahead of schedule, the AI pushes you further. It's a feedback loop that compounds — the more you use it, the better it gets.",
  },
];

const SAMPLE_TASKS = [
  {
    text: "Practice 15 new vocabulary words from the \"food & restaurant\" category using flashcards",
    time: "10m",
    done: true,
  },
  {
    text: "Listen to a 10-minute Spanish podcast episode and write down 5 new phrases you hear",
    time: "12m",
    done: true,
  },
  {
    text: "Write a short paragraph in Spanish describing what you ate today — use at least 3 new words",
    time: "8m",
    done: false,
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-neutral-900 antialiased">
      <MarketingNav />

      {/* Hero */}
      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center md:py-28">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold">
            How It Works
          </p>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-neutral-900 md:text-5xl">
            From goal to done,
            <br />
            <span className="text-neutral-400">every single day.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-neutral-600 md:text-lg">
            Threely is a daily coaching loop. Describe your goal once, then get
            a personalized plan that evolves with you — automatically.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-3xl px-4 py-20 md:py-28">
          <div className="space-y-10">
            {STEPS.map((step) => (
              <div key={step.num} className="flex gap-6">
                <div className="flex flex-shrink-0 flex-col items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-gold bg-white text-sm font-bold text-neutral-900">
                    {step.num}
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gold">
                    {step.subtitle}
                  </p>
                  <h2 className="mb-3 text-xl font-bold tracking-tight text-neutral-900 md:text-2xl">
                    {step.title}
                  </h2>
                  <p className="mb-4 text-sm leading-relaxed text-neutral-600 md:text-base">
                    {step.desc}
                  </p>
                  <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm leading-relaxed text-neutral-700">
                    {step.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Example daily plan */}
      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-20 md:py-28">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 md:text-4xl">
              Here&apos;s what a typical day looks like
            </h2>
            <p className="mt-4 text-base text-neutral-600 md:text-lg">
              A real example from someone building a side business.
            </p>
          </div>

          <Card className="mx-auto mt-10 max-w-md border-neutral-200 shadow-sm">
            <CardContent className="p-6">
              <div className="mb-1 flex items-start justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                  Today&apos;s Plan
                </p>
                <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold text-gold">
                  Day 24
                </span>
              </div>
              <h3 className="text-lg font-bold tracking-tight text-neutral-900">
                Learn conversational Spanish
              </h3>
              <p className="mb-5 text-xs text-neutral-500">
                30 min/day &middot; Moderate intensity
              </p>

              <ul className="space-y-3">
                {SAMPLE_TASKS.map((task) => (
                  <li
                    key={task.text}
                    className="flex items-start gap-3"
                  >
                    <div
                      className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                        task.done
                          ? "bg-gold text-white"
                          : "border-2 border-neutral-300 bg-white"
                      }`}
                    >
                      {task.done && (
                        <span className="text-xs font-bold">✓</span>
                      )}
                    </div>
                    <span
                      className={`flex-1 text-sm leading-relaxed ${
                        task.done
                          ? "text-neutral-400 line-through"
                          : "text-neutral-700"
                      }`}
                    >
                      {task.text}
                    </span>
                    <span className="flex-shrink-0 text-xs font-semibold text-neutral-500">
                      {task.time}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-gold">
                  AI Coaching Insight
                </p>
                <p className="text-xs leading-relaxed text-neutral-600">
                  Your vocabulary retention is strong — you&apos;re consistently
                  remembering 80%+ from previous sessions. Tomorrow I&apos;ll
                  introduce a conversational roleplay exercise to build your
                  confidence speaking.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Why three */}
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center md:py-28">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900 md:text-4xl">
            Why three tasks?
          </h2>
          <div className="mx-auto mt-8 space-y-4 text-left text-base leading-relaxed text-neutral-700">
            <p>
              Decision fatigue is real. The more choices you face, the less
              likely you are to act. Psychologists call it cognitive overload
              — and it&apos;s the #1 reason people abandon their goals.
            </p>
            <p>
              Three sits in the sweet spot: enough to make meaningful progress,
              few enough to stay focused. It&apos;s why we remember things in
              threes, present ideas in threes, and structure stories in three
              acts.
            </p>
            <p>
              Three tasks is a commitment you can keep. And consistency — not
              intensity — is what gets you to your goals.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center md:py-28">
          <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 md:text-5xl">
            Ready to try it?
          </h2>
          <p className="mt-4 text-base text-neutral-600 md:text-lg">
            Describe your first goal. Get 3 personalized moves in under a
            minute.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Button asChild variant="gold" size="xl">
              <Link href="/start">
                Start for $1
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <p className="text-sm text-neutral-500">Cancel anytime</p>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
