import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    const { title, company, url, location, description } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400, headers: CORS_HEADERS });
    }

    // Check if this job URL is already saved
    const { data: existing } = await supabase
      .from("jobs")
      .select("id, title, company, status")
      .eq("user_id", user.id)
      .eq("url", url)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ job: existing, created: false }, { headers: CORS_HEADERS });
    }

    // Save new job with status "in_progress" since the user is actively applying
    const { data: job, error } = await supabase
      .from("jobs")
      .insert({
        user_id: user.id,
        title: title || "Job Application",
        company: company || "Unknown Company",
        location: location || null,
        description: description || null,
        url,
        source: "extension",
        status: "in_progress",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
    }

    return NextResponse.json({ job, created: true }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("Extension save-job error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}
