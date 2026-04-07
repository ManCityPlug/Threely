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

      // Password recovery flow — redirect to reset-password page with code
      const type = searchParams.get("type");
      if (type === "recovery") {
        if (error) {
          // PKCE exchange failed (cross-device: reset requested from app, link opened in browser)
          // Pass the code to reset-password page to try client-side exchange
          return NextResponse.redirect(`${origin}/reset-password?code=${code}`);
        }
        return NextResponse.redirect(`${origin}/reset-password`);
      }

      if (error) {
        console.error("[auth/callback] exchangeCodeForSession error:", error.message);
        return NextResponse.redirect(`${origin}/login?error=auth`);
      }

      // Get the authenticated user
      const { data: { user } } = await supabase.auth.getUser();

      if (user?.email) {
        // Capture name from OAuth provider (Apple/Google) if not already set
        const meta = user.user_metadata;
        const existingName = meta?.display_name || meta?.full_name;
        if (!existingName) {
          // Google puts name in "name" or "full_name", Apple in "full_name"
          const providerName = meta?.name || meta?.full_name || null;
          // Extract first name only
          const firstName = providerName?.split(" ")[0];
          if (firstName && !firstName.includes("@") && !firstName.includes(".")) {
            const { supabaseAdmin } = await import("@/lib/supabase");
            await supabaseAdmin.auth.admin.updateUserById(user.id, {
              user_metadata: { display_name: firstName, full_name: providerName },
            });
          }
        }

        // Upsert Prisma User record — no auto-trial, user must add CC for trial
        const existing = await prisma.user.findUnique({ where: { id: user.id } });

        await prisma.user.upsert({
          where: { id: user.id },
          update: { email: user.email },
          create: { id: user.id, email: user.email },
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
