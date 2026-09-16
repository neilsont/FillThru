import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { userIsPremium } from "@/lib/subscription";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ isPremium: false });
  }

  const isPremium = await userIsPremium(supabase, user.id, user.email);

  return NextResponse.json({ isPremium });
}
