import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { AI_MODELS, normalizeModel, type AIModel } from "@/lib/ai/types";

// Admin account — bypasses all subscription paywalls server-side only.
// Never expose this in client-side code.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export const TRIAL_DAYS = 7;

export type EntitlementReason = "admin" | "subscription" | "trial" | "trial_expired" | "inactive";

export interface Entitlement {
  /** True when the user may use paid features right now. */
  active: boolean;
  reason: EntitlementReason;
  status: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  planInterval: "month" | "year" | null;
}

export function isPaidModel(model: AIModel | string): boolean {
  const config = AI_MODELS.find((m) => m.id === normalizeModel(model));
  return config ? !config.free : false;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email || !ADMIN_EMAIL) return false;
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

// Service-role client: needed to create the trial row, since user_subscriptions
// only grants SELECT to users (writes come from webhooks and this module).
function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

interface SubscriptionRow {
  status: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  plan_interval: "month" | "year" | null;
}

async function startTrial(userId: string): Promise<SubscriptionRow | null> {
  const service = getServiceClient();
  if (!service) return null;
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await service
    .from("user_subscriptions")
    .upsert(
      { user_id: userId, status: "trialing", trial_ends_at: trialEndsAt, updated_at: new Date().toISOString() },
      { onConflict: "user_id", ignoreDuplicates: true } // never overwrite a row a webhook already wrote
    )
    .select("status, current_period_end, trial_ends_at, plan_interval")
    .maybeSingle();
  return data ?? { status: "trialing", current_period_end: null, trial_ends_at: trialEndsAt, plan_interval: null };
}

/**
 * Resolve what the user is entitled to. Starts the free trial on first call.
 * Pass `userEmail` whenever you have it so the admin bypass works without a DB round-trip.
 */
export async function getEntitlement(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string | null
): Promise<Entitlement> {
  if (isAdminEmail(userEmail)) {
    return { active: true, reason: "admin", status: "active", trialEndsAt: null, currentPeriodEnd: null, planInterval: null };
  }

  let { data: row } = await supabase
    .from("user_subscriptions")
    .select("status, current_period_end, trial_ends_at, plan_interval")
    .eq("user_id", userId)
    .maybeSingle<SubscriptionRow>();

  if (!row) row = await startTrial(userId);

  const now = Date.now();
  const periodOk = !row?.current_period_end || new Date(row.current_period_end).getTime() > now;
  const base = {
    status: row?.status ?? null,
    trialEndsAt: row?.trial_ends_at ?? null,
    currentPeriodEnd: row?.current_period_end ?? null,
    planInterval: row?.plan_interval ?? null,
  };

  if (row?.status === "active" && periodOk) {
    return { active: true, reason: "subscription", ...base };
  }
  if (row?.trial_ends_at) {
    const trialActive = new Date(row.trial_ends_at).getTime() > now;
    return { active: trialActive, reason: trialActive ? "trial" : "trial_expired", ...base };
  }
  return { active: false, reason: "inactive", ...base };
}

/** Back-compat: true when the user has an active subscription or trial (or is admin). */
export async function userIsPremium(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string | null
): Promise<boolean> {
  return (await getEntitlement(supabase, userId, userEmail)).active;
}
