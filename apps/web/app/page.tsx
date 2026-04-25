"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Plus,
  Sparkles,
  Star,
  Target,
  TrendingUp,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TESTIMONIALS: {
  quote: string;
  author: string;
  label: string;
  image: string;
}[] = [
  {
    quote:
      "I fr grew my shopify store with Threely. 10/10 recommend to everyone.",
    author: "George T.",
    label: "E-commerce",
    image: "/George.png",
  },
  {
    quote:
      "Was so confused on how to start an ecommerce brand until Threely. In a month my store was actually making money.",
    author: "Daniel",
    label: "Brand Owner",
    image: "/daniel.png",
  },
  {
    quote:
      "Had no idea where to start with my clothing brand. Threely grew it way faster than I thought possible. This app is insane.",
    author: "Nikolay M.",
    label: "Clothing Brand",
    image: "/nikolay.png",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Tell us your goal",
    desc: "Type one line — \"launch my Shopify store and hit $5K in revenue.\" Threely asks the right questions to find the best path for you.",
  },
  {
    n: "2",
    title: "Get a step-by-step plan",
    desc: "A real path based on where you are right now. Threely tells you exactly what to do every day to actually grow.",
  },
  {
    n: "3",
    title: "Make money",
    desc: "Complete your daily moves. Threely tracks your progress and rebuilds the next set of tasks around what you finished.",
  },
];

const FEATURES = [
  {
    icon: Target,
    title: "Goal-aware tasks",
    desc: "Three moves a day, written for your specific goal — not generic productivity bullets.",
  },
  {
    icon: Compass,
    title: "Real path forward",
    desc: "Threely maps the route from where you are now to where you want to be.",
  },
  {
    icon: TrendingUp,
    title: "Adapts as you grow",
    desc: "Finish a sprint and your next set of tasks rebuilds around what actually worked.",
  },
  {
    icon: CheckCircle2,
    title: "Built for action",
    desc: "Every task is concrete. No journaling. No frameworks. Just the next move.",
  },
  {
    icon: Sparkles,
    title: "No generic AI fluff",
    desc: "Threely tells you what to do — it doesn't ask what you'd like to discuss today.",
  },
  {
    icon: Star,
    title: "Cancel anytime",
    desc: "$1 to start. No contracts, no trials, no hidden fees. Cancel from settings whenever you want.",
  },
];

const FAQ = [
  { q: "How much is it?", a: "$1 to start. Cancel anytime." },
  {
    q: "How long before I see results?",
    a: "Our users have quit their jobs and started making money their first week.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel in your settings whenever you want. No contracts, no hidden fees, no questions asked.",
  },
  {
    q: "How is this different from ChatGPT?",
    a: "ChatGPT answers questions. Threely tells you what to do. You get a daily set of moves built around your specific goal — not a chat thread you have to drive.",
  },
  {
    q: "Do I need any experience?",
    a: "No. Threely is built for people who don't know where to start. Tell it your goal — it does the rest.",
  },
];

export default function LandingPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    getSupabase()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (session?.user && !session.user.is_anonymous) setLoggedIn(true);
      });
  }, []);

  const ctaHref = loggedIn ? "/dashboard" : "/start";
  const ctaLabel = loggedIn ? "Go to Dashboard" : "Start for $1";

  return (
    <div className="min-h-screen bg-white font-sans text-neutral-900 antialiased">
      {/* ─── Nav ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link
            href="/"
            className="text-base font-bold tracking-tight text-neutral-900"
          >
            Threely
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link
              href="#how-it-works"
              className="rounded-md px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
            >
              How It Works
            </Link>
            <Link
              href="/pricing"
              className="rounded-md px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
            >
              Pricing
            </Link>
            <Link
              href="/support"
              className="rounded-md px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
            >
              Support
            </Link>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {!loggedIn && (
              <Link
                href="/login"
                className="rounded-md px-3 py-2 text-sm font-semibold text-neutral-600 transition-colors hover:text-neutral-900"
              >
                Log In
              </Link>
            )}
            <Button asChild variant="gold" size="sm">
              <Link href={ctaHref}>
                {ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <button
            type="button"
            aria-label="Menu"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-md md:hidden"
          >
            <span className="block h-0.5 w-5 bg-neutral-900" />
            <span className="block h-0.5 w-5 bg-neutral-900" />
            <span className="block h-0.5 w-5 bg-neutral-900" />
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-neutral-200 bg-white md:hidden">
            <nav className="mx-auto flex max-w-6xl flex-col gap-1 p-4">
              <Link
                href="#how-it-works"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-3 text-base font-medium text-neutral-700 hover:bg-neutral-50"
              >
                How It Works
              </Link>
              <Link
                href="/pricing"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-3 text-base font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Pricing
              </Link>
              <Link
                href="/support"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-3 text-base font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Support
              </Link>
              {!loggedIn && (
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md px-3 py-3 text-base font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Log In
                </Link>
              )}
              <Button asChild variant="gold" size="lg" className="mt-2">
                <Link href={ctaHref} onClick={() => setMenuOpen(false)}>
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </nav>
          </div>
        )}
      </header>

      {/* ─── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center md:py-32">
          <Badge
            variant="gold"
            className="mb-6 rounded-full border-gold/30 bg-gold/10 px-4 py-1 text-[11px] uppercase tracking-wider text-neutral-700"
          >
            The fastest path to your goals
          </Badge>

          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-neutral-900 md:text-5xl lg:text-6xl">
            10x your income.
            <br />
            <span className="text-neutral-400">Reach your goals.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-neutral-600 md:text-lg">
            Tell Threely what you want. It tells you exactly what to do every
            day to get there — built around your life, not generic advice.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3">
            <Button asChild variant="gold" size="xl">
              <Link href={ctaHref}>
                {ctaLabel}
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <p className="text-sm text-neutral-500">Cancel anytime</p>
          </div>
        </div>
      </section>

      {/* ─── ChatGPT comparison ────────────────────────────────────────── */}
      <section className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-20 md:py-28">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-gold">
            How is this different from ChatGPT?
          </p>
          <h2 className="text-center text-3xl font-bold leading-tight tracking-tight text-neutral-900 md:text-4xl">
            You&apos;ve had ChatGPT for 4 years.
            <br />
            What have you accomplished?
          </h2>

          <Card className="mt-10 border-neutral-200 shadow-sm">
            <CardContent className="p-8 text-center md:p-10">
              <p className="text-base leading-relaxed text-neutral-700 md:text-lg">
                Threely tells you exactly what needs to be done, built around
                your life — not generic BS that&apos;s keeping you stuck while
                everyone else moves forward.
              </p>
            </CardContent>
          </Card>

          <div className="mt-8 flex justify-center">
            <Button asChild variant="gold" size="lg">
              <Link href={ctaHref}>
                {ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Results / Testimonials ────────────────────────────────────── */}
      <section className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-gold">
            Results
          </p>
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight text-neutral-900 md:text-4xl">
            From zero to revenue.
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <Card
                key={t.author}
                className="flex flex-col items-center border-neutral-200 bg-white p-8 text-center shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.image}
                  alt={t.author}
                  className="mb-5 h-20 w-20 rounded-full object-cover"
                />
                <div className="mb-4 flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-gold text-gold"
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <p className="mb-5 text-sm leading-relaxed text-neutral-700">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-auto">
                  <div className="text-sm font-semibold text-neutral-900">
                    {t.author}
                  </div>
                  <div className="text-xs text-neutral-500">{t.label}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ──────────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="border-t border-neutral-200 bg-white"
      >
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold">
              How It Works
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 md:text-4xl">
              Stop guessing.
            </h2>
            <p className="mt-4 text-base text-neutral-600 md:text-lg">
              Three steps from a goal you&apos;ve been sitting on to the work
              that actually moves it.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="flex flex-col items-start text-left">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full border-2 border-gold bg-white text-sm font-bold text-neutral-900">
                  {s.n}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-neutral-900">
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed text-neutral-600">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ──────────────────────────────────────────────────── */}
      <section className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold">
              What you get
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 md:text-4xl">
              The shortcut between intent and action.
            </h2>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
              >
                <f.icon
                  className="mb-4 h-6 w-6 text-neutral-700"
                  aria-hidden="true"
                />
                <h3 className="mb-2 text-base font-semibold text-neutral-900">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-neutral-600">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing teaser ────────────────────────────────────────────── */}
      <section className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-20 md:py-28">
          <div className="text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold">
              Pricing
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 md:text-4xl">
              Start for $1.
            </h2>
            <p className="mt-4 text-base text-neutral-600 md:text-lg">
              Try Threely Pro for $1. Renews at $39/mo. Cancel anytime.
            </p>
          </div>

          <Card className="mt-10 border-neutral-200 shadow-sm">
            <CardHeader className="border-b border-neutral-200 pb-6 text-center">
              <CardTitle className="text-2xl font-bold text-neutral-900">
                Threely Pro
              </CardTitle>
              <CardDescription className="text-neutral-600">
                Everything you need to actually finish what you started.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="mb-8 flex flex-col items-center text-center">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold text-neutral-900">
                    $1
                  </span>
                  <span className="text-base text-neutral-500">to start</span>
                </div>
                <p className="mt-2 text-sm text-neutral-500">
                  Then $39/mo. Cancel anytime.
                </p>
              </div>

              <ul className="space-y-3">
                {[
                  "3 personalized moves every day",
                  "Goal-aware path, rebuilt as you go",
                  "Daily review + coaching insight",
                  "Mobile + web access",
                ].map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-sm text-neutral-700"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-gold" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button asChild variant="gold" size="lg" className="mt-8 w-full">
                <Link href={ctaHref}>
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <div className="mt-4 text-center">
                <Link
                  href="/pricing"
                  className="text-sm text-neutral-500 hover:text-neutral-900"
                >
                  See full pricing details →
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ─── FAQ ───────────────────────────────────────────────────────── */}
      <section className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-20 md:py-28">
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight text-neutral-900 md:text-4xl">
            Questions
          </h2>

          <div className="divide-y divide-neutral-200 border-y border-neutral-200">
            {FAQ.map((faq, i) => (
              <details
                key={i}
                className="group cursor-pointer px-1 py-5 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex list-none items-center justify-between gap-4 text-left text-base font-semibold text-neutral-900">
                  {faq.q}
                  <Plus
                    className="h-5 w-5 flex-shrink-0 text-neutral-400 transition-transform group-open:rotate-45"
                    aria-hidden="true"
                  />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <Button asChild variant="outline" size="lg">
              <a
                href="https://go.crisp.chat/chat/embed/?website_id=498b2c8b-bec0-4790-a2bb-795f9c295898"
                target="_blank"
                rel="noopener noreferrer"
              >
                Talk to support
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─────────────────────────────────────────────────── */}
      <section className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center md:py-28">
          <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 md:text-5xl">
            Make your first 10k this week.
          </h2>
          <p className="mt-4 text-base text-neutral-600 md:text-lg">
            Stop reading about it. Start doing it. $1 to begin.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Button asChild variant="gold" size="xl">
              <Link href={ctaHref}>
                {ctaLabel}
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <p className="text-sm text-neutral-500">Cancel anytime</p>
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 md:flex-row md:px-6">
          <p className="text-sm text-neutral-500">
            &copy; {new Date().getFullYear()} Threely. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link
              href="/pricing"
              className="text-sm text-neutral-500 hover:text-neutral-900"
            >
              Pricing
            </Link>
            <Link
              href="/support"
              className="text-sm text-neutral-500 hover:text-neutral-900"
            >
              Support
            </Link>
            <Link
              href="/terms"
              className="text-sm text-neutral-500 hover:text-neutral-900"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-neutral-500 hover:text-neutral-900"
            >
              Privacy
            </Link>
            <Link
              href="/refund"
              className="text-sm text-neutral-500 hover:text-neutral-900"
            >
              Refund
            </Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
