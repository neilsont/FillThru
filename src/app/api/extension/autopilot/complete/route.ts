import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { userIsPremium, isAdminEmail } from "@/lib/subscription";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const FREE_LIMIT = 10;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function makeSupabase(token: string) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

// GET — check current count/limit/paywall status without incrementing
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });

    const supabase = makeSupabase(token);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });

    const admin = isAdminEmail(user.email);
    const premium = await userIsPremium(supabase, user.id, user.email);

    const { data: profile } = await supabase
      .from("profiles")
      .select("auto_apply_count, auto_apply_limit")
      .eq("id", user.id)
      .single();

    const totalApplied = profile?.auto_apply_count ?? 0;
    const limit = admin ? 999999 : (profile?.auto_apply_limit ?? FREE_LIMIT);
    const paywalled = !premium && totalApplied >= FREE_LIMIT;

    return NextResponse.json({ totalApplied, limit, isPremium: premium, isAdmin: admin, paywalled }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("Autopilot status error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}

// POST — record one completed application, return updated status
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });

    const supabase = makeSupabase(token);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });

    const { jobUrl, title, company } = await request.json();

    const admin = isAdminEmail(user.email);
    const premium = await userIsPremium(supabase, user.id, user.email);

    // Fetch current count
    const { data: profile } = await supabase
      .from("profiles")
      .select("auto_apply_count, auto_apply_limit")
      .eq("id", user.id)
      .single();

    const currentCount = profile?.auto_apply_count ?? 0;
    const limit = admin ? 999999 : (profile?.auto_apply_limit ?? FREE_LIMIT);

    // Enforce paywall for non-premium, non-creator users
    if (!premium && currentCount >= FREE_LIMIT) {
      return NextResponse.json(
        { error: "free_limit_reached", totalApplied: currentCount, limit: FREE_LIMIT, paywalled: true },
        { status: 402, headers: CORS_HEADERS }
      );
    }

    // Increment count
    const newCount = currentCount + 1;
    await supabase
      .from("profiles")
      .update({ auto_apply_count: newCount })
      .eq("id", user.id);

    // Mark the application as "applied" in the jobs/applications tables
    if (jobUrl) {
      const { data: job } = await supabase
        .from("jobs")
        .select("id")
        .eq("user_id", user.id)
        .eq("url", jobUrl)
        .single();

      if (job?.id) {
        await supabase
          .from("applications")
          .update({ status: "applied", updated_at: new Date().toISOString() })
          .eq("job_id", job.id)
          .eq("user_id", user.id);
      } else if (title) {
        // Save the job if not yet recorded
        const { data: newJob } = await supabase
          .from("jobs")
          .insert({ user_id: user.id, title, company: company || "Unknown", url: jobUrl, source: "autopilot", status: "applied" })
          .select("id")
          .single();
        if (newJob?.id) {
          await supabase.from("applications").insert({
            user_id: user.id, job_id: newJob.id, status: "applied",
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    const paywalled = !premium && newCount >= FREE_LIMIT;
    return NextResponse.json(
      { ok: true, totalApplied: newCount, limit, isPremium: premium, isAdmin: admin, paywalled },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("Autopilot complete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}
