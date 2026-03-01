import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "threely-api",
    minAppVersion: "1.0.0", // Bump this when a breaking update is released
    timestamp: new Date().toISOString(),
  });
}
