import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/auth/reset-password
// Body: { token, type, password }
// Verifies the recovery token server-side and updates the password using admin API
export async function POST(request: NextRequest) {
  try {
    const { token, type, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: "Missing token or password" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Verify the recovery token via Supabase Auth API
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const verifyRes = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: type || "recovery",
        token_hash: token,
      }),
    });

    if (!verifyRes.ok) {
      const err = await verifyRes.json().catch(() => ({}));
      console.error("[reset-password] verify failed:", err);
      return NextResponse.json({ error: "Link expired or already used. Please request a new one." }, { status: 400 });
    }

    const verifyData = await verifyRes.json();
    const userId = verifyData?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Invalid recovery token" }, { status: 400 });
    }

    // Update password via admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password,
    });

    if (updateError) {
      console.error("[reset-password] updateUser error:", updateError.message);
      return NextResponse.json({ error: "Failed to update password. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[reset-password]", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
