import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getEntitlement, TRIAL_DAYS } from "@/lib/subscription";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    // Pass token in global headers so RLS policies (auth.uid()) work on all queries
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    // Fetch resume data
    const { data: resumeRow } = await supabase
      .from("resume_data")
      .select("parsed_json")
      .eq("user_id", user.id)
      .single();

    // Fetch supplemental answers
    const { data: supplementalRows } = await supabase
      .from("supplemental_answers")
      .select("question_key, question_label, answer")
      .eq("user_id", user.id);

    const supplemental: Record<string, string> = {};
    supplementalRows?.forEach((row) => {
      supplemental[row.question_key] = row.answer;
    });

    const parsed = resumeRow?.parsed_json as Record<string, unknown> | null;

    // Also starts the 7-day trial the first time this user opens the extension.
    const entitlement = await getEntitlement(supabase, user.id, user.email);
    const trialDaysLeft = entitlement.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(entitlement.trialEndsAt).getTime() - Date.now()) / 86_400_000))
      : null;

    return NextResponse.json(
      {
        user: { id: user.id, email: user.email },
        profile: parsed ?? null,
        supplemental,
        entitlement: { ...entitlement, trialDaysLeft, trialDays: TRIAL_DAYS },
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("Extension profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
