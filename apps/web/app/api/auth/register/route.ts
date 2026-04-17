import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { notifyNewSignup } from "@/lib/discord";
import { validatePassword } from "@/lib/validate-password";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }
    const pwError = validatePassword(password);
    if (pwError) {
      return NextResponse.json({ error: `${pwError}.` }, { status: 400 });
    }

    // Create user (requires email verification)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
    });

    if (error) {
      if (error.message?.includes("already been registered")) {
        // Return same shape as success to prevent user enumeration
        return NextResponse.json({ user: { id: "redacted", email } });
      }
      return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 400 });
    }

    // Create user record (no trial — trial starts via Stripe Checkout with card)
    await prisma.user.upsert({
      where: { id: data.user.id },
      update: {},
      create: { id: data.user.id, email },
    });

    // Discord notification (fire and forget)
    notifyNewSignup(email);

    return NextResponse.json({ user: { id: data.user.id, email: data.user.email } });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
