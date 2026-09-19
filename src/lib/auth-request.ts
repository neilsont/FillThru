import { createClient as createSupabaseClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Resolve the caller for routes used by both the website (Supabase session
// cookie) and the extension (Authorization: Bearer <access_token>).
export async function resolveUser(request: Request): Promise<{ supabase: SupabaseClient; user: User | null }> {
  const bearer = request.headers.get("Authorization")?.replace("Bearer ", "").trim();
  if (bearer) {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${bearer}` } } }
    );
    const { data: { user } } = await supabase.auth.getUser(bearer);
    return { supabase, user };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
