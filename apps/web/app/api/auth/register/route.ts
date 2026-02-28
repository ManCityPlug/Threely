import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { notifyNewSignup } from "@/lib/discord";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    // Create user with email already confirmed (skips verification email)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      // Supabase returns a specific message for duplicate emails
      if (error.message?.includes("already been registered")) {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Start automatic 3-day Pro trial (no credit card required)
    const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    await prisma.user.upsert({
      where: { id: data.user.id },
      update: { trialEndsAt },
      create: { id: data.user.id, email, trialEndsAt },
    });

    // Discord notification (fire and forget)
    notifyNewSignup(email);

    return NextResponse.json({ user: { id: data.user.id, email: data.user.email } });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
