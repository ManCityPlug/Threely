import { NextResponse } from "next/server";

export type ErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "RATE_LIMITED"
  | "AI_ERROR"
  | "INTERNAL_ERROR";

const STATUS_MAP: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  RATE_LIMITED: 429,
  AI_ERROR: 502,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(code: ErrorCode, message: string) {
  return NextResponse.json(
    { error: message, code },
    { status: STATUS_MAP[code] }
  );
}
