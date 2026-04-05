import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    const { job_url, company, job_title, blocker_type, blocker_detail } = await request.json();

    // Store as a flagged question so it shows in the Questions tab
    await supabase.from("flagged_questions").insert({
      user_id: user.id,
      question_text: blocker_detail ?? `Manual action required on ${company ?? job_url}`,
      field_key: `extension_alert_${Date.now()}`,
      job_id: null,
      resolved: false,
    });

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("Extension alert error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}
