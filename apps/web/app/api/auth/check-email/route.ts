import { NextRequest, NextResponse } from "next/server";

// POST /api/auth/check-email
//
// Always returns `{ exists: true }` regardless of actual state.
//
// Rationale: a boolean response here lets an attacker enumerate registered
// emails by hammering this endpoint. Login/signup UX does not actually need
// this information — Supabase's own error messages surface the right outcome
// at auth time (invalid credentials, already registered, etc.). The route
// handler is kept in place so existing callers don't break; it is now a
// no-op that preserves the response shape.
export async function POST(_request: NextRequest) {
  return NextResponse.json({ exists: true });
}
