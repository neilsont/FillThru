import type { SupabaseClient } from "@supabase/supabase-js";
import { AI_MODELS, type AIModel } from "@/lib/ai/types";

export function isPaidModel(model: AIModel): boolean {
  const config = AI_MODELS.find((m) => m.id === model);
  return config ? !config.free : false;
}

export async function userIsPremium(supabase: SupabaseClient, userId: string): Promise<boolean> {
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
