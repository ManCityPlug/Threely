import type { Metadata } from "next";
import { ArrowRight, Mail, MessageCircle } from "lucide-react";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Need help with Threely? Reach out to our support team and we'll get back to you as soon as possible.",
  alternates: { canonical: "/support" },
};

const FAQ = [
  {
    q: "How much is Threely?",
    a: "$1 to start. Then $39/mo. Cancel anytime from your settings.",
  },
  {
    q: "How do I cancel my subscription?",
    a: "Open the app, go to Settings, and tap Cancel subscription. Access continues until the end of your billing period.",
  },
  {
    q: "How do I request a refund?",
    a: "Email refund@threely.co within 14 days of your first paid charge. Full refund, no questions asked.",
  },
  {
    q: "I forgot my password — what now?",
    a: "Use the \"Forgot password\" link on the login screen. We'll email you a reset link.",
  },
  {
    q: "Does Threely work offline?",
    a: "You can view your daily moves offline once they're loaded, but generating new ones requires a connection.",
  },
];

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-neutral-900 antialiased">
      <MarketingNav />

      {/* Hero */}
      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center md:py-28">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold">
            Support
          </p>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-neutral-900 md:text-5xl">
            We&apos;re here to help.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-neutral-600 md:text-lg">
            Have a question, issue, or feedback? Reach out and we&apos;ll get
            back to you as soon as possible.
          </p>
        </div>
      </section>

      {/* Contact options */}
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-5xl px-4 py-20 md:py-28">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-neutral-200 shadow-sm">
              <CardContent className="flex flex-col items-start p-8">
                <MessageCircle
                  className="mb-4 h-6 w-6 text-neutral-700"
                  aria-hidden="true"
                />
                <h2 className="mb-2 text-lg font-semibold text-neutral-900">
                  Live chat
                </h2>
                <p className="mb-6 text-sm leading-relaxed text-neutral-600">
                  Chat directly with our team. Fastest way to get an answer.
                </p>
                <Button asChild variant="gold" size="sm" className="mt-auto">
                  <a
                    href="https://go.crisp.chat/chat/embed/?website_id=498b2c8b-bec0-4790-a2bb-795f9c295898"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Start chat
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-neutral-200 shadow-sm">
              <CardContent className="flex flex-col items-start p-8">
                <Mail
                  className="mb-4 h-6 w-6 text-neutral-700"
                  aria-hidden="true"
                />
                <h2 className="mb-2 text-lg font-semibold text-neutral-900">
                  Email
                </h2>
                <p className="mb-6 text-sm leading-relaxed text-neutral-600">
                  Send us an email — we typically reply within a business day.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-auto">
                  <a href="mailto:support@threely.co">
                    support@threely.co
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-20 md:py-28">
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight text-neutral-900 md:text-4xl">
            Common questions
          </h2>

          <div className="divide-y divide-neutral-200 border-y border-neutral-200">
            {FAQ.map((faq, i) => (
              <details
                key={i}
                className="group cursor-pointer px-1 py-5 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex list-none items-center justify-between gap-4 text-left text-base font-semibold text-neutral-900">
                  {faq.q}
                  <span
                    className="text-2xl leading-none text-neutral-400 transition-transform group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>

          <div className="mt-10 text-center text-sm text-neutral-500">
            For refunds, email{" "}
            <a
              href="mailto:refund@threely.co"
              className="font-medium text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
            >
              refund@threely.co
            </a>
            .
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
