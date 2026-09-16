import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

// Both free-tier databases pause when idle — Supabase after 7 days without
// API activity, Atlas M0 after 60 days without a connection — which takes the
// app down until someone manually restores them. Vercel Cron hits this route
// daily (see vercel.json) so neither ever goes idle. Vercel sends
// `Authorization: Bearer <CRON_SECRET>` automatically when the CRON_SECRET env
// var is set on the project.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [supabase, mongodb] = await Promise.all([pingSupabase(), pingMongo()]);
  const ok = supabase.ok && mongodb.ok;

  if (!ok) {
    console.error("Keep-alive ping failed:", { supabase, mongodb });
  }

  return NextResponse.json(
    { ok, supabase, mongodb, pingedAt: new Date().toISOString() },
    { status: ok ? 200 : 500 }
  );
}

type PingResult = { ok: true; ms: number } | { ok: false; error: string };

async function pingSupabase(): Promise<PingResult> {
  const startedAt = Date.now();
  // Service role so the query works with no user session and bypasses RLS.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error } = await supabase.from("jobs").select("id").limit(1);
  return error ? { ok: false, error: error.message } : { ok: true, ms: Date.now() - startedAt };
}

async function pingMongo(): Promise<PingResult> {
  const startedAt = Date.now();
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return { ok: true, ms: Date.now() - startedAt };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
