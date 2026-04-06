import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ isPremium: false });
  }

  const { data } = await supabase
    .from("user_subscriptions")
    .select("status, current_period_end")
    .eq("user_id", user.id)
    .single();

  const isPremium =
    data?.status === "active" &&
    (!data.current_period_end || new Date(data.current_period_end) > new Date());

  return NextResponse.json({ isPremium });
}
