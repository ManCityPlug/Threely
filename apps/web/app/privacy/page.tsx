import type { Metadata } from "next";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how Threely collects, uses, and protects your personal information. Your data is encrypted, never sold, and never shared with third parties for AI training.",
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "February 25, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-neutral-900 antialiased">
      <MarketingNav />

      {/* Hero */}
      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 md:py-20">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold">
            Legal
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-neutral-900 md:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-neutral-500">
            Last updated: {LAST_UPDATED}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 md:py-20">
          <p className="mb-10 leading-relaxed text-neutral-700">
            This Privacy Policy explains how Threely (&quot;we&quot;,
            &quot;us&quot;, &quot;our&quot;) collects, uses, and protects your
            personal information when you use our website at threely.co and
            mobile applications (collectively, the &quot;Service&quot;).
          </p>

          <div className="space-y-10">
            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                1. Information We Collect
              </h2>
              <p className="leading-relaxed text-neutral-700">
                <strong className="font-semibold text-neutral-900">
                  Account information:
                </strong>{" "}
                When you create an account, we collect your email address and
                a hashed password. We do not store your password in plain text.
              </p>
              <p className="leading-relaxed text-neutral-700">
                <strong className="font-semibold text-neutral-900">
                  Goal and task data:
                </strong>{" "}
                We collect the goals you enter, daily tasks generated for you,
                task completion status, daily reviews, and coaching feedback.
                This data is used solely to provide your personalized
                experience.
              </p>
              <p className="leading-relaxed text-neutral-700">
                <strong className="font-semibold text-neutral-900">
                  Profile preferences:
                </strong>{" "}
                We store your selected daily time commitment, intensity level,
                notification preferences, and timezone to tailor the Service to
                you.
              </p>
              <p className="leading-relaxed text-neutral-700">
                <strong className="font-semibold text-neutral-900">
                  Usage analytics:
                </strong>{" "}
                We use analytics tools to understand how users interact with
                the Service. This may include session recordings and heatmaps.
                No personally identifiable information is shared with analytics
                providers.
              </p>
              <p className="leading-relaxed text-neutral-700">
                <strong className="font-semibold text-neutral-900">
                  Device information:
                </strong>{" "}
                We may collect basic device information such as device type,
                operating system, and app version to provide technical support
                and improve compatibility.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                2. How We Use Your Information
              </h2>
              <p className="leading-relaxed text-neutral-700">
                We use your information to: provide and personalize the
                Service; generate AI-powered daily tasks and coaching insights;
                send daily reminders and notifications you have opted into;
                process subscription payments; improve the Service based on
                usage patterns; and respond to support requests.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                3. AI Processing
              </h2>
              <p className="leading-relaxed text-neutral-700">
                Your goals, profile preferences, and task history are sent to
                our AI provider to generate personalized daily tasks and
                coaching insights. This data is not shared with or used to
                train any third-party AI models.
              </p>
              <p className="leading-relaxed text-neutral-700">
                We may use anonymized and aggregated interaction data to
                improve and personalize our AI-powered features, including
                training our own internal models to provide a better coaching
                experience. We do not sell or share your personal content with
                external parties for AI training purposes.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                4. Data Storage and Security
              </h2>
              <p className="leading-relaxed text-neutral-700">
                Your data is stored securely on cloud infrastructure with
                encryption at rest and in transit. We use industry-standard
                security measures including TLS encryption, secure
                authentication tokens, and regular security reviews.
              </p>
              <p className="leading-relaxed text-neutral-700">
                While we take reasonable measures to protect your data, no
                system is completely secure. We encourage you to use a strong,
                unique password for your account.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                5. Data Sharing
              </h2>
              <p className="leading-relaxed text-neutral-700">
                We do not sell your personal information. We share data only
                with trusted third-party service providers, solely to operate
                the Service. These include providers for:
              </p>
              <p className="leading-relaxed text-neutral-700">
                Cloud hosting and database infrastructure. Authentication and
                account security. AI-powered task generation and coaching.
                Payment processing (we do not store your payment card
                details). Usage analytics to improve the product. Push
                notification delivery on mobile devices.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                6. Your Rights
              </h2>
              <p className="leading-relaxed text-neutral-700">
                You have the right to: access all personal data we hold about
                you; correct inaccurate information via your profile settings;
                delete your account and all associated data at any time from
                your profile settings; export your data by contacting us at
                support@threely.co; and opt out of non-essential
                communications.
              </p>
              <p className="leading-relaxed text-neutral-700">
                Account deletion is permanent and irreversible. All your
                goals, tasks, reviews, and personal information will be
                permanently removed from our systems.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                7. Cookies and Local Storage
              </h2>
              <p className="leading-relaxed text-neutral-700">
                Our website uses essential cookies and local storage for
                authentication and theme preferences. We do not use advertising
                or tracking cookies. Our analytics provider may use its own
                cookies to help us understand usage patterns.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                8. Children&apos;s Privacy
              </h2>
              <p className="leading-relaxed text-neutral-700">
                Threely is not intended for children under 13 years of age. We
                do not knowingly collect personal information from children
                under 13. If we learn that we have collected information from a
                child under 13, we will promptly delete it.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                9. Changes to This Policy
              </h2>
              <p className="leading-relaxed text-neutral-700">
                We may update this Privacy Policy from time to time. If we
                make material changes, we will notify you via email or through
                the Service. Continued use of the Service after changes take
                effect constitutes acceptance of the updated policy.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                10. Contact
              </h2>
              <p className="leading-relaxed text-neutral-700">
                If you have questions about this Privacy Policy or your data,
                contact us at support@threely.co.
              </p>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
