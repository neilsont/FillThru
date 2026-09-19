import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getEntitlement, TRIAL_DAYS } from "@/lib/subscription";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ isPremium: false, reason: "signed_out", trialDays: TRIAL_DAYS });
  }

  const entitlement = await getEntitlement(supabase, user.id, user.email);
  const trialDaysLeft = entitlement.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(entitlement.trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : null;

  return NextResponse.json({
    isPremium: entitlement.active,
    ...entitlement,
    trialDaysLeft,
    trialDays: TRIAL_DAYS,
  });
}
