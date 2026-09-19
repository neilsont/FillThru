import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse, after } from "next/server";
import { recordGeneration } from "@/lib/generations";
import { generateCoverLetter, getModelFallbackChain } from "@/lib/ai";
import { DEFAULT_MODEL, type AIModel } from "@/lib/ai/types";
import { ParsedResume } from "@/types/resume";
import { userIsPremium } from "@/lib/subscription";

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

    const { jobTitle, companyName, jobDescription, notes = "", model = DEFAULT_MODEL } = await request.json();
    if (!jobTitle || !companyName || !jobDescription) {
      return NextResponse.json({ error: "Missing job details" }, { status: 400, headers: CORS_HEADERS });
    }

    // Pass token in global headers so RLS policies work
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    const requestedModel = model as AIModel;
    const isPremium = await userIsPremium(supabase, user.id, user.email);

    // Every AI feature requires an active trial or subscription.
    if (!isPremium) {
      return NextResponse.json({ error: "subscription_required" }, { status: 402, headers: CORS_HEADERS });
    }

    // Fetch resume data
    const { data: resumeRow } = await supabase
      .from("resume_data")
      .select("parsed_json")
      .eq("user_id", user.id)
      .single();

    if (!resumeRow?.parsed_json) {
      return NextResponse.json({ error: "No resume found. Please upload a resume first." }, { status: 404, headers: CORS_HEADERS });
    }

    // Fetch supplemental answers
    const { data: supplementalRows } = await supabase
      .from("supplemental_answers")
      .select("question_key, answer")
      .eq("user_id", user.id);

    const supplemental: Record<string, string> = {};
    supplementalRows?.forEach((row) => {
      supplemental[row.question_key] = row.answer;
    });

    // Generate cover letter
    const startedAt = Date.now();
    const coverLetter = await generateCoverLetter(
      jobDescription,
      companyName,
      jobTitle,
      resumeRow.parsed_json as ParsedResume,
      supplemental,
      requestedModel,
      getModelFallbackChain(requestedModel, isPremium),
      typeof notes === "string" ? notes.slice(0, 2000) : ""
    );

    // Persist to MongoDB after the response is sent so it never adds latency.
    after(() =>
      recordGeneration({
        userId: user.id,
        kind: "cover_letter",
        source: "extension",
        model: requestedModel,
        job: { title: jobTitle, company: companyName },
        durationMs: Date.now() - startedAt,
        output: { coverLetter },
      })
    );

    return NextResponse.json({ coverLetter }, { headers: CORS_HEADERS });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Generate cover letter error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
