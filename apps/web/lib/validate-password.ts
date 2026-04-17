// Shared password policy for all signup and password-change flows.
// Keep this in sync with the mobile-side helper in
// apps/mobile/app/(auth)/register.tsx (validatePassword).
export function validatePassword(password: string): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters";
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include uppercase, lowercase, and a number";
  }
  return null;
}
