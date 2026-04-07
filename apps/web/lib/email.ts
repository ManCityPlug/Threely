import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendRefundConfirmation(
  toEmail: string,
  amount: string
): Promise<void> {
  const resend = getResend();
  await resend.emails.send({
    from: "Threely <refund@threely.co>",
    to: toEmail,
    subject: "Your refund has been processed — Threely",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; color: #0a2540;">
        <div style="text-align: center; padding: 2rem 0 1.5rem;">
          <img src="https://threely.co/favicon.png" alt="Threely" width="48" height="48" style="border-radius: 12px;" />
        </div>
        <h1 style="font-size: 1.4rem; font-weight: 700; text-align: center; margin-bottom: 0.5rem;">Your refund has been processed</h1>
        <p style="font-size: 0.95rem; color: #425466; line-height: 1.7; text-align: center;">
          We're sorry to see you go. We've issued a refund of <strong>${amount}</strong> to your original payment method. It should appear on your statement within <strong>5–7 business days</strong>, depending on your bank.
        </p>
        <div style="background: #f6f9fc; border-radius: 12px; padding: 1.25rem; margin: 1.5rem 0; border: 1px solid #e3e8ef;">
          <p style="font-size: 0.9rem; color: #425466; line-height: 1.7; margin: 0;">
            Your subscription has been cancelled and you will not be charged again. If you ever want to give Threely another try, we'd love to have you back — you can resubscribe anytime from the app or at <a href="https://threely.co/pricing" style="color: #635bff;">threely.co/pricing</a>.
          </p>
        </div>
        <p style="font-size: 0.9rem; color: #425466; line-height: 1.7;">
          We'd love to know what we could do better. If you have any feedback or questions, feel free to reply to this email or contact us at <a href="mailto:support@threely.co" style="color: #635bff;">support@threely.co</a>.
        </p>
        <p style="font-size: 0.9rem; color: #425466; line-height: 1.7;">
          Thank you for giving Threely a try — we wish you the best on your goals!
        </p>
        <div style="border-top: 1px solid #e3e8ef; margin-top: 2rem; padding-top: 1.25rem; text-align: center;">
          <p style="font-size: 0.78rem; color: #8898aa;">
            Threely — AI-powered goal coaching<br/>
            <a href="https://threely.co" style="color: #635bff; text-decoration: none;">threely.co</a>
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendOfferNotification(
  toEmail: string,
  description: string
): Promise<void> {
  const resend = getResend();
  await resend.emails.send({
    from: "Threely <offers@threely.co>",
    to: toEmail,
    subject: "You have a special offer waiting — Threely",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; color: #0a2540;">
        <div style="text-align: center; padding: 2rem 0 1.5rem;">
          <img src="https://threely.co/favicon.png" alt="Threely" width="48" height="48" style="border-radius: 12px;" />
        </div>
        <h1 style="font-size: 1.4rem; font-weight: 700; text-align: center; margin-bottom: 0.5rem;">A gift for you</h1>
        <p style="font-size: 0.95rem; color: #425466; line-height: 1.7; text-align: center;">
          We've put together a special offer just for you: <strong>${description}</strong>.
        </p>
        <div style="background: #fef7e6; border-radius: 12px; padding: 1.25rem; margin: 1.5rem 0; border: 1px solid #f6e0a8; text-align: center;">
          <p style="font-size: 0.9rem; color: #425466; line-height: 1.7; margin: 0 0 1rem;">
            Sign in to your account to claim it before it expires.
          </p>
          <a href="https://threely.co/dashboard" style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #D4A843, #B8862D); color: #fff; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 0.95rem;">
            Claim my offer
          </a>
        </div>
        <p style="font-size: 0.9rem; color: #425466; line-height: 1.7;">
          If you have questions, feel free to reply to this email or contact us at <a href="mailto:support@threely.co" style="color: #635bff;">support@threely.co</a>.
        </p>
        <div style="border-top: 1px solid #e3e8ef; margin-top: 2rem; padding-top: 1.25rem; text-align: center;">
          <p style="font-size: 0.78rem; color: #8898aa;">
            Threely — AI-powered goal coaching<br/>
            <a href="https://threely.co" style="color: #635bff; text-decoration: none;">threely.co</a>
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendOfferAutoApplied(
  toEmail: string,
  description: string
): Promise<void> {
  const resend = getResend();
  await resend.emails.send({
    from: "Threely <offers@threely.co>",
    to: toEmail,
    subject: "We applied a special offer to your account — Threely",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; color: #0a2540;">
        <div style="text-align: center; padding: 2rem 0 1.5rem;">
          <img src="https://threely.co/favicon.png" alt="Threely" width="48" height="48" style="border-radius: 12px;" />
        </div>
        <h1 style="font-size: 1.4rem; font-weight: 700; text-align: center; margin-bottom: 0.5rem;">We applied a special offer to your account</h1>
        <p style="font-size: 0.95rem; color: #425466; line-height: 1.7; text-align: center;">
          As a thank you for being a Threely member, we've automatically applied this offer for you: <strong>${description}</strong>.
        </p>
        <div style="background: #f6f9fc; border-radius: 12px; padding: 1.25rem; margin: 1.5rem 0; border: 1px solid #e3e8ef;">
          <p style="font-size: 0.9rem; color: #425466; line-height: 1.7; margin: 0;">
            Nothing further is required from you — the offer is already active on your subscription. You'll see it reflected on your next invoice.
          </p>
        </div>
        <p style="font-size: 0.9rem; color: #425466; line-height: 1.7;">
          Thanks for being part of Threely. If you have any questions, reach out at <a href="mailto:support@threely.co" style="color: #635bff;">support@threely.co</a>.
        </p>
        <div style="border-top: 1px solid #e3e8ef; margin-top: 2rem; padding-top: 1.25rem; text-align: center;">
          <p style="font-size: 0.78rem; color: #8898aa;">
            Threely — AI-powered goal coaching<br/>
            <a href="https://threely.co" style="color: #635bff; text-decoration: none;">threely.co</a>
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendRenewalReminder(
  toEmail: string,
  plan: "Yearly" | "Monthly",
  amount: string,
  renewalDate: string,
  cancelUrl = "https://threely.co/subscription"
): Promise<void> {
  const resend = getResend();
  await resend.emails.send({
    from: "Threely <billing@threely.co>",
    to: toEmail,
    subject: `Your Threely ${plan} subscription renews in 3 days`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; color: #0a2540;">
        <div style="text-align: center; padding: 2rem 0 1.5rem;">
          <img src="https://threely.co/favicon.png" alt="Threely" width="48" height="48" style="border-radius: 12px;" />
        </div>
        <h1 style="font-size: 1.4rem; font-weight: 700; text-align: center; margin-bottom: 0.5rem;">Heads up — your subscription renews soon</h1>
        <p style="font-size: 0.95rem; color: #425466; line-height: 1.7; text-align: center;">
          Hi there, your Threely <strong>${plan}</strong> subscription will renew on <strong>${renewalDate}</strong> for <strong>${amount}</strong>. We just wanted to give you a heads up so there are no surprises on your statement.
        </p>
        <div style="background: #f6f9fc; border-radius: 12px; padding: 1.25rem; margin: 1.5rem 0; border: 1px solid #e3e8ef;">
          <p style="font-size: 0.9rem; color: #425466; line-height: 1.7; margin: 0 0 0.75rem;">
            <strong>Don't need it anymore?</strong>
          </p>
          <p style="font-size: 0.9rem; color: #425466; line-height: 1.7; margin: 0;">
            You can cancel anytime from your account settings — you'll keep full access until your current period ends.
          </p>
        </div>
        <div style="text-align: center; margin: 1.5rem 0;">
          <a href="${cancelUrl}" style="display: inline-block; padding: 0.65rem 1.5rem; background: #635bff; color: #fff; text-decoration: none; border-radius: 8px; font-size: 0.9rem; font-weight: 600;">
            Manage subscription
          </a>
        </div>
        <p style="font-size: 0.9rem; color: #425466; line-height: 1.7;">
          Questions? Reply to this email or reach us at <a href="mailto:support@threely.co" style="color: #635bff;">support@threely.co</a>.
        </p>
        <p style="font-size: 0.9rem; color: #425466; line-height: 1.7;">
          Thanks for being part of Threely!
        </p>
        <div style="border-top: 1px solid #e3e8ef; margin-top: 2rem; padding-top: 1.25rem; text-align: center;">
          <p style="font-size: 0.78rem; color: #8898aa;">
            Threely — AI-powered goal coaching<br/>
            <a href="https://threely.co" style="color: #635bff; text-decoration: none;">threely.co</a>
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendRefundDenial(toEmail: string): Promise<void> {
  const resend = getResend();
  await resend.emails.send({
    from: "Threely <refund@threely.co>",
    to: toEmail,
    subject: "Regarding your refund request — Threely",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; color: #0a2540;">
        <div style="text-align: center; padding: 2rem 0 1.5rem;">
          <img src="https://threely.co/favicon.png" alt="Threely" width="48" height="48" style="border-radius: 12px;" />
        </div>
        <h1 style="font-size: 1.4rem; font-weight: 700; text-align: center; margin-bottom: 0.5rem;">Regarding your refund request</h1>
        <p style="font-size: 0.95rem; color: #425466; line-height: 1.7; text-align: center;">
          Thank you for reaching out. Unfortunately, your subscription is outside our <strong>14-day refund window</strong>, so we're unable to process a refund at this time.
        </p>
        <div style="background: #f6f9fc; border-radius: 12px; padding: 1.25rem; margin: 1.5rem 0; border: 1px solid #e3e8ef;">
          <p style="font-size: 0.9rem; color: #425466; line-height: 1.7; margin: 0 0 0.5rem;">
            <strong>Our refund policy:</strong>
          </p>
          <p style="font-size: 0.9rem; color: #425466; line-height: 1.7; margin: 0;">
            Refunds are available within 14 days of your first paid subscription charge. After this window, all charges are non-refundable. You can read our full refund policy at <a href="https://threely.co/refund" style="color: #635bff;">threely.co/refund</a>.
          </p>
        </div>
        <p style="font-size: 0.9rem; color: #425466; line-height: 1.7;">
          You can cancel your subscription at any time from your profile settings in the app. When you cancel, you'll keep access to all paid features until the end of your current billing period, and no further charges will be made.
        </p>
        <p style="font-size: 0.9rem; color: #425466; line-height: 1.7;">
          If you have any other questions or concerns, feel free to reply to this email or contact us at <a href="mailto:support@threely.co" style="color: #635bff;">support@threely.co</a>.
        </p>
        <div style="border-top: 1px solid #e3e8ef; margin-top: 2rem; padding-top: 1.25rem; text-align: center;">
          <p style="font-size: 0.78rem; color: #8898aa;">
            Threely — AI-powered goal coaching<br/>
            <a href="https://threely.co" style="color: #635bff; text-decoration: none;">threely.co</a>
          </p>
        </div>
      </div>
    `,
  });
}
