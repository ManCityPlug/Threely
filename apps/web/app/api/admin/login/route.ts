import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminCredentials,
  createAdminSession,
  setAdminCookie,
} from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }

    // Temporary debug — remove after fixing
    const debugInfo = {
      hasEmail: !!process.env.ADMIN_EMAIL,
      hasPassword: !!process.env.ADMIN_PASSWORD,
      hasJwt: !!process.env.ADMIN_JWT_SECRET,
      envEmail: process.env.ADMIN_EMAIL,
      envPwdLen: process.env.ADMIN_PASSWORD?.length,
      envPwdLast3: process.env.ADMIN_PASSWORD?.slice(-3),
      inputEmail: email,
      inputPwdLen: password?.length,
      emailMatch: email?.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase(),
      pwdMatch: password === process.env.ADMIN_PASSWORD,
    };
    console.log("ADMIN_LOGIN_DEBUG:", JSON.stringify(debugInfo));

    const valid = await verifyAdminCredentials(email, password);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials", debug: debugInfo },
        { status: 401 }
      );
    }

    const token = await createAdminSession(email);
    const res = NextResponse.json({ ok: true });
    setAdminCookie(res, token);
    return res;
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
