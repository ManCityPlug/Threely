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
          We've issued a refund of <strong>${amount}</strong> to your original payment method. It should appear on your statement within <strong>5–7 business days</strong>, depending on your bank.
        </p>
        <div style="background: #f6f9fc; border-radius: 12px; padding: 1.25rem; margin: 1.5rem 0; border: 1px solid #e3e8ef;">
          <p style="font-size: 0.9rem; color: #425466; line-height: 1.7; margin: 0;">
            Your subscription has been cancelled and you will not be charged again. Your account remains active — you can continue using Threely's free features, and resubscribe anytime.
          </p>
        </div>
        <p style="font-size: 0.9rem; color: #425466; line-height: 1.7;">
          If you have any questions, feel free to reply to this email or contact us at <a href="mailto:support@threely.co" style="color: #635bff;">support@threely.co</a>.
        </p>
        <p style="font-size: 0.9rem; color: #425466; line-height: 1.7;">
          Thank you for trying Threely. We hope to see you again!
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
          Thank you for reaching out. Unfortunately, your subscription is outside our <strong>7-day refund window</strong>, so we're unable to process a refund at this time.
        </p>
        <div style="background: #f6f9fc; border-radius: 12px; padding: 1.25rem; margin: 1.5rem 0; border: 1px solid #e3e8ef;">
          <p style="font-size: 0.9rem; color: #425466; line-height: 1.7; margin: 0 0 0.5rem;">
            <strong>Our refund policy:</strong>
          </p>
          <p style="font-size: 0.9rem; color: #425466; line-height: 1.7; margin: 0;">
            Refunds are available within 7 days of your first paid subscription charge. After this window, all charges are non-refundable. You can read our full refund policy at <a href="https://threely.co/refund" style="color: #635bff;">threely.co/refund</a>.
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
