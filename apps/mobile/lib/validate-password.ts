// Mirrors apps/web/lib/validate-password.ts — keep in sync.
// Shared password policy for signup, password reset, and password change flows.
// Returns null for a valid password, otherwise a user-facing error message.
export function validatePassword(pw: string): string | null {
  if (typeof pw !== "string" || pw.length < 8) {
    return "Password must be at least 8 characters";
  }
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return "Password must include uppercase, lowercase, and a number";
  }
  return null;
}
