import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyNewSignup } from "@/lib/discord";

// GET /api/auth/callback
// Handles the OAuth / magic-link redirect from Supabase
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const code = searchParams.get("code");

  if (code) {
    try {
      const cookieStore = await cookies();

      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            },
          },
        }
      );

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("[auth/callback] exchangeCodeForSession error:", error.message);
        return NextResponse.redirect(`${origin}/login?error=auth`);
      }

      // Password recovery flow — redirect to reset-password page
      const type = searchParams.get("type");
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/reset-password`);
      }

      // Get the authenticated user
      const { data: { user } } = await supabase.auth.getUser();

      if (user?.email) {
        // Upsert Prisma User record with 7-day trial for new users
        const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const existing = await prisma.user.findUnique({ where: { id: user.id } });

        await prisma.user.upsert({
          where: { id: user.id },
          update: { email: user.email },
          create: { id: user.id, email: user.email, trialEndsAt },
        });

        // Discord notification for new users only
        if (!existing) {
          await notifyNewSignup(user.email);
        }

        // Check if user has a profile (onboarding completed)
        const profile = await prisma.userProfile.findUnique({
          where: { userId: user.id },
        });

        if (profile) {
          return NextResponse.redirect(`${origin}/dashboard`);
        }
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    } catch (err) {
      console.error("[auth/callback] Unhandled error:", err);
      return NextResponse.redirect(`${origin}/login?error=auth`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
