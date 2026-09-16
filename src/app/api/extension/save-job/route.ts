import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, PATCH, OPTIONS",
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

    const { title, company, url, location, description, filled_fields } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400, headers: CORS_HEADERS });
    }

    // Step 1: Handle Job record
    let jobId: string;
    const { data: existingJob } = await supabase
      .from("jobs")
      .select("id")
      .eq("user_id", user.id)
      .eq("url", url)
      .maybeSingle();

    if (existingJob) {
      jobId = existingJob.id;
    } else {
      const { data: newJob, error: jobError } = await supabase
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
        .select("id")
        .single();

      if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500, headers: CORS_HEADERS });
      jobId = newJob.id;
    }

    // Step 2: Handle Application record (tracking "Applications adding to CareerLaunch Applications")
    const { data: existingApp } = await supabase
      .from("applications")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("job_id", jobId)
      .maybeSingle();

    if (existingApp) {
      // Update fields if they were passed (even for existing application)
      if (filled_fields) {
        await supabase
          .from("applications")
          .update({
            filled_fields_json: filled_fields,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingApp.id);
      }
    } else {
      const { error: appError } = await supabase
        .from("applications")
        .insert({
          user_id: user.id,
          job_id: jobId,
          status: "draft",
          filled_fields_json: filled_fields || {},
        });
      
      if (appError) {
        console.error("Failed to create application record:", appError);
        // We continue because the job was saved, which is the primary goal
      }
    }

    return NextResponse.json({ job: { id: jobId }, created: !existingJob }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("Extension save-job error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}

// PATCH — update application status (e.g. mark as "applied" after autopilot completes)
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });

    const { url, status } = await request.json();
    if (!url || !status) return NextResponse.json({ error: "url and status are required" }, { status: 400, headers: CORS_HEADERS });

    const { data: job } = await supabase.from("jobs").select("id").eq("user_id", user.id).eq("url", url).maybeSingle();
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404, headers: CORS_HEADERS });

    await supabase
      .from("applications")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("job_id", job.id);

    await supabase.from("jobs").update({ status }).eq("id", job.id).eq("user_id", user.id);

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("Extension save-job PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}
