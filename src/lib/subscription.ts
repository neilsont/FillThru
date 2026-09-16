import type { SupabaseClient } from "@supabase/supabase-js";
import { AI_MODELS, type AIModel } from "@/lib/ai/types";

// Admin account — bypasses all subscription paywalls server-side only.
// Never expose this in client-side code.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export function isPaidModel(model: AIModel): boolean {
  const config = AI_MODELS.find((m) => m.id === model);
  return config ? !config.free : false;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email || !ADMIN_EMAIL) return false;
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

/**
 * Returns true if the user has an active premium subscription,
 * OR if their email is the admin account (which bypasses all paywalls).
 *
 * Pass `userEmail` whenever you have it so the admin bypass works
 * without a DB round-trip.
 */
export async function userIsPremium(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string | null
): Promise<boolean> {
  if (isAdminEmail(userEmail)) return true;

  const { data } = await supabase
    .from("user_subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .single();

  return (
    data?.status === "active" &&
    (!data.current_period_end || new Date(data.current_period_end) > new Date())
  );
}
