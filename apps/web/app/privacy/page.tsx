import type { Metadata } from "next";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how Threely collects, uses, and protects your personal information. Your data is encrypted, never sold, and never used to train AI models.",
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "February 25, 2026";

export default function PrivacyPage() {
  const h2Style = {
    fontSize: "1.2rem" as const,
    fontWeight: 700 as const,
    letterSpacing: "-0.02em" as const,
    marginTop: "2.5rem" as const,
    marginBottom: "0.75rem" as const,
  };

  const pStyle = {
    fontSize: "0.925rem" as const,
    color: "#425466" as const,
    lineHeight: 1.75 as const,
    marginBottom: "0.75rem" as const,
  };

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#0a2540", background: "#fff" }}>
      <MarketingNav />

      {/* Hero */}
      <section style={{
        background: "#f6f9fc",
        padding: "3.5rem 1.5rem 2.5rem",
        borderBottom: "1px solid #e3e8ef",
      }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h1 style={{
            fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            marginBottom: "0.5rem",
          }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: "0.9rem", color: "#8898aa" }}>
            Last updated: {LAST_UPDATED}
          </p>
        </div>
      </section>

      {/* Content */}
      <section style={{ padding: "2.5rem 1.5rem 4rem" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>

          <p style={pStyle}>
            This Privacy Policy explains how Threely (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) collects, uses, and protects your personal information when you use our website at threely.co and mobile applications (collectively, the &quot;Service&quot;).
          </p>

          <h2 style={h2Style}>1. Information We Collect</h2>
          <p style={pStyle}>
            <strong>Account information:</strong> When you create an account, we collect your email address and a hashed password. We do not store your password in plain text.
          </p>
          <p style={pStyle}>
            <strong>Goal and task data:</strong> We collect the goals you enter, daily tasks generated for you, task completion status, daily reviews, and coaching feedback. This data is used solely to provide your personalized experience.
          </p>
          <p style={pStyle}>
            <strong>Profile preferences:</strong> We store your selected daily time commitment, intensity level, notification preferences, and timezone to tailor the Service to you.
          </p>
          <p style={pStyle}>
            <strong>Usage analytics:</strong> We use analytics tools to understand how users interact with the Service. This may include session recordings and heatmaps. No personally identifiable information is shared with analytics providers.
          </p>
          <p style={pStyle}>
            <strong>Device information:</strong> We may collect basic device information such as device type, operating system, and app version to provide technical support and improve compatibility.
          </p>

          <h2 style={h2Style}>2. How We Use Your Information</h2>
          <p style={pStyle}>
            We use your information to: provide and personalize the Service; generate AI-powered daily tasks and coaching insights; send daily reminders and notifications you have opted into; process subscription payments; improve the Service based on usage patterns; and respond to support requests.
          </p>

          <h2 style={h2Style}>3. AI Processing</h2>
          <p style={pStyle}>
            Your goals, profile preferences, and task history are sent to our AI provider to generate personalized daily tasks and coaching insights. This data is processed in real-time and is not used to train any third-party AI models.
          </p>
          <p style={pStyle}>
            We do not sell, share, or use your personal content for AI model training.
          </p>

          <h2 style={h2Style}>4. Data Storage and Security</h2>
          <p style={pStyle}>
            Your data is stored securely on cloud infrastructure with encryption at rest and in transit. We use industry-standard security measures including TLS encryption, secure authentication tokens, and regular security reviews.
          </p>
          <p style={pStyle}>
            While we take reasonable measures to protect your data, no system is completely secure. We encourage you to use a strong, unique password for your account.
          </p>

          <h2 style={h2Style}>5. Data Sharing</h2>
          <p style={pStyle}>
            We do not sell your personal information. We share data only with trusted third-party service providers, solely to operate the Service. These include providers for:
          </p>
          <p style={pStyle}>
            Cloud hosting and database infrastructure. Authentication and account security. AI-powered task generation and coaching. Payment processing (we do not store your payment card details). Usage analytics to improve the product. Push notification delivery on mobile devices.
          </p>

          <h2 style={h2Style}>6. Your Rights</h2>
          <p style={pStyle}>
            You have the right to: access all personal data we hold about you; correct inaccurate information via your profile settings; delete your account and all associated data at any time from your profile settings; export your data by contacting us at support@threely.co; and opt out of non-essential communications.
          </p>
          <p style={pStyle}>
            Account deletion is permanent and irreversible. All your goals, tasks, reviews, and personal information will be permanently removed from our systems.
          </p>

          <h2 style={h2Style}>7. Cookies and Local Storage</h2>
          <p style={pStyle}>
            Our website uses essential cookies and local storage for authentication and theme preferences. We do not use advertising or tracking cookies. Our analytics provider may use its own cookies to help us understand usage patterns.
          </p>

          <h2 style={h2Style}>8. Children&apos;s Privacy</h2>
          <p style={pStyle}>
            Threely is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we learn that we have collected information from a child under 13, we will promptly delete it.
          </p>

          <h2 style={h2Style}>9. Changes to This Policy</h2>
          <p style={pStyle}>
            We may update this Privacy Policy from time to time. If we make material changes, we will notify you via email or through the Service. Continued use of the Service after changes take effect constitutes acceptance of the updated policy.
          </p>

          <h2 style={h2Style}>10. Contact</h2>
          <p style={pStyle}>
            If you have questions about this Privacy Policy or your data, contact us at support@threely.co.
          </p>

        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
