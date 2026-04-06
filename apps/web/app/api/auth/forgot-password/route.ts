import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || "https://threely.co";

    // Use admin API to generate a recovery link — this creates a token_hash
    // that can be verified client-side without PKCE code verifier
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email.trim(),
      options: {
        redirectTo: `${origin}/reset-password`,
      },
    });

    if (error) {
      console.error("[forgot-password] generateLink error:", error.message);
      // Don't reveal if email exists or not
      return NextResponse.json({ sent: true });
    }

    // Extract the hashed_token from the generated link
    const linkUrl = new URL(data.properties.action_link);
    const token = linkUrl.searchParams.get("token");
    const type = linkUrl.searchParams.get("type");

    // Send the email via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resetLink = `${origin}/reset-password?token=${token}&type=${type}`;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Threely <noreply@threely.co>",
          to: [email.trim()],
          subject: "Reset Your Password",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem;">
              <h2 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">Reset Your Password</h2>
              <p style="color: #71717a; font-size: 0.9rem; line-height: 1.6;">
                Click the button below to set a new password for your Threely account.
              </p>
              <a href="${resetLink}" style="display: inline-block; margin: 1.5rem 0; padding: 0.75rem 2rem; background: #000; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 0.9rem;">
                Reset Password
              </a>
              <p style="color: #a1a1aa; font-size: 0.8rem;">
                This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
              </p>
            </div>
          `,
        }),
      });
    }

    return NextResponse.json({ sent: true });
  } catch (e) {
    console.error("[forgot-password]", e);
    return NextResponse.json({ sent: true }); // Don't reveal errors
  }
}
