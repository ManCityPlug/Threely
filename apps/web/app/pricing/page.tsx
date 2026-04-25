import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import CheckoutButton from "@/components/CheckoutButton";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Threely Pro is $1 to start. Then $39/month after your 3-day Launch Preview. Cancel anytime.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Threely Pricing — $1 to start",
    description:
      "Threely Pro is $1 to start. Then $39/month after your 3-day Launch Preview. Cancel anytime.",
  },
};

const INCLUDED = [
  "3 personalized moves every day",
  "Goal-aware path, rebuilt as you go",
  "Daily review + coaching insight",
  "Mobile + web access",
  "Cancel anytime from settings",
];

const FAQ = [
  {
    q: "What happens after the $1 Launch Preview?",
    a: "After your 3-day Launch Preview, your subscription renews at $39/month. Cancel anytime in settings before then and you won't be charged again.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your profile settings whenever you want — no contracts, no questions asked. You keep access through the end of your current billing period.",
  },
  {
    q: "Is there a refund policy?",
    a: "Yes. We offer a 14-day, no-questions-asked refund on your first charge. Email refund@threely.co and we'll handle it.",
  },
];

export default function PricingPage() {
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
              href="/#how-it-works"
              className="rounded-md px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
            >
              How It Works
            </Link>
            <Link
              href="/pricing"
              className="rounded-md px-3 py-2 text-sm font-medium text-neutral-900"
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
            <Link
              href="/login"
              className="rounded-md px-3 py-2 text-sm font-semibold text-neutral-600 transition-colors hover:text-neutral-900"
            >
              Log In
            </Link>
            <Button asChild variant="gold" size="sm">
              <Link href="/start">
                Start for $1
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Hero ────────────────────────────────────────────────────────── */}
      <section className="border-b border-neutral-200">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center md:py-24">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold">
            Pricing
          </p>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-neutral-900 md:text-5xl">
            One plan. $1 to start.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-neutral-600 md:text-lg">
            Threely Pro: a 3-day Launch Preview for $1, then $39/month. No
            contracts, no hidden fees. Cancel anytime.
          </p>
        </div>
      </section>

      {/* ─── Plan card ───────────────────────────────────────────────────── */}
      <section className="bg-neutral-50">
        <div className="mx-auto max-w-md px-4 py-16 md:py-20">
          <Card className="relative border-2 border-gold shadow-md">
            <CardContent className="p-8 md:p-10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge
                  variant="gold"
                  className="rounded-full border-gold/30 bg-gold px-4 py-1 text-[11px] uppercase tracking-wider text-gold-foreground"
                >
                  $1 Launch Preview
                </Badge>
              </div>

              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-gold">
                Threely Pro
              </p>

              <div className="mb-3 flex items-baseline justify-center gap-2">
                <span className="text-6xl font-extrabold tracking-tight text-neutral-900">
                  $1
                </span>
                <span className="text-base text-neutral-500">today</span>
              </div>

              <p className="mb-8 text-center text-sm leading-relaxed text-neutral-600">
                Then $39/month after your 3-day Launch Preview.
              </p>

              <CheckoutButton
                plan="monthly"
                className="inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-gold px-8 text-base font-medium text-gold-foreground shadow-sm transition-colors hover:bg-gold/90 hover:shadow-md disabled:pointer-events-none disabled:opacity-50"
              >
                Start for $1
                <ArrowRight className="h-4 w-4" />
              </CheckoutButton>

              <p className="mt-4 text-center text-xs text-neutral-500">
                Secured by Stripe. Cancel anytime in settings.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ─── What's included ─────────────────────────────────────────────── */}
      <section className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-20 md:py-24">
          <div className="mx-auto max-w-xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold">
              What&apos;s included
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 md:text-4xl">
              Everything you need to launch.
            </h2>
          </div>

          <ul className="mx-auto mt-12 max-w-md space-y-4">
            {INCLUDED.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-base text-neutral-700"
              >
                <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-gold" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── Billing FAQ ─────────────────────────────────────────────────── */}
      <section className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-2xl px-4 py-20 md:py-24">
          <h2 className="mb-10 text-center text-3xl font-bold tracking-tight text-neutral-900 md:text-4xl">
            Billing FAQ
          </h2>

          <div className="space-y-4">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group cursor-pointer rounded-lg border border-neutral-200 bg-white px-5 py-4 shadow-sm [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex list-none items-center justify-between gap-4 text-left text-base font-semibold text-neutral-900">
                  {item.q}
                  <Plus
                    className="h-5 w-5 flex-shrink-0 text-neutral-400 transition-transform group-open:rotate-45"
                    aria-hidden="true"
                  />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                  {item.a}
                </p>
              </details>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <Button asChild variant="outline" size="lg">
              <Link href="/refund">
                View refund policy
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ───────────────────────────────────────────────────── */}
      <section className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center md:py-24">
          <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 md:text-4xl">
            Ready to start?
          </h2>
          <p className="mt-4 text-base text-neutral-600 md:text-lg">
            $1 today. Cancel anytime.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Button asChild variant="gold" size="xl">
              <Link href="/start">
                Start for $1
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <p className="text-sm text-neutral-500">No contracts. No hidden fees.</p>
          </div>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────────── */}
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
