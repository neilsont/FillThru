import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Supabase pauses free-tier projects after 7 days without API activity, which
// takes auth (and everything else) down until someone manually restores it.
// Vercel Cron hits this route daily (see vercel.json) so the project never
// goes idle. Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically
// when the CRON_SECRET env var is set on the project.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Service role so the query works with no user session and bypasses RLS.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.from("jobs").select("id").limit(1);

  if (error) {
    console.error("Keep-alive ping failed:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pingedAt: new Date().toISOString() });
}
