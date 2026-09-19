import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { userIsPremium } from "@/lib/subscription";

// Pipeline stages a job can be in (matches the job_status enum).
const JOB_STATUSES = ["discovered", "in_progress", "applied", "interviewing", "rejected", "offer"] as const;
type JobStatus = (typeof JOB_STATUSES)[number];

function sourceForUrl(url: string): "indeed" | "linkedin" | "other" {
  try {
    const host = new URL(url).hostname;
    if (/(^|\.)indeed\./.test(host)) return "indeed";
    if (/(^|\.)linkedin\./.test(host)) return "linkedin";
  } catch { /* not a URL */ }
  return "other";
}

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

    if (!(await userIsPremium(supabase, user.id, user.email))) {
      return NextResponse.json({ error: "subscription_required" }, { status: 402, headers: CORS_HEADERS });
    }

    const { title, company, url, location, description, filled_fields, status: requestedStatus } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400, headers: CORS_HEADERS });
    }
    const initialStatus: JobStatus = JOB_STATUSES.includes(requestedStatus) ? requestedStatus : "in_progress";

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
          source: sourceForUrl(url),
          status: initialStatus,
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

    const { data: savedJob } = await supabase.from("jobs").select("id, title, company, status").eq("id", jobId).single();
    return NextResponse.json({ job: savedJob ?? { id: jobId }, created: !existingJob }, { headers: CORS_HEADERS });
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

    if (!(await userIsPremium(supabase, user.id, user.email))) {
      return NextResponse.json({ error: "subscription_required" }, { status: 402, headers: CORS_HEADERS });
    }

    const { url, company, title, status } = await request.json();
    if (!JOB_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${JOB_STATUSES.join(", ")}` }, { status: 400, headers: CORS_HEADERS });
    }
    if (!url && !company && !title) {
      return NextResponse.json({ error: "url, company, or title is required" }, { status: 400, headers: CORS_HEADERS });
    }

    // Find the job: exact URL first, then the most recent match on company/title.
    let job: { id: string; title: string; company: string } | null = null;
    if (url) {
      ({ data: job } = await supabase.from("jobs").select("id, title, company").eq("user_id", user.id).eq("url", url).maybeSingle());
    }
    if (!job && (company || title)) {
      let q = supabase.from("jobs").select("id, title, company").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1);
      if (company) q = q.ilike("company", `%${company}%`);
      if (title) q = q.ilike("title", `%${title}%`);
      ({ data: job } = await q.maybeSingle());
    }
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404, headers: CORS_HEADERS });

    const now = new Date().toISOString();
    await supabase.from("jobs").update({ status, updated_at: now }).eq("id", job.id).eq("user_id", user.id);

    // The application record tracks submission separately (application_status enum).
    if (status === "applied" || status === "interviewing" || status === "offer") {
      await supabase
        .from("applications")
        .update({ status: "submitted", submitted_at: now, updated_at: now })
        .eq("user_id", user.id)
        .eq("job_id", job.id)
        .is("submitted_at", null);
    }

    return NextResponse.json({ ok: true, job: { ...job, status } }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("Extension save-job PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}
