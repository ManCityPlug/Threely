import { createClient } from "@supabase/supabase-js";

// Server-side admin client (service role — never expose to client)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Verify a Supabase JWT from the Authorization header.
 * Returns the user if valid, or null if not.
 */
export async function getUserFromRequest(
  request: Request
): Promise<{ id: string; email: string } | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user || !user.email) return null;
  return { id: user.id, email: user.email };
}
