import { createClient } from "@/lib/supabase/server";
import { generateCoverLetter, getModelFallbackChain } from "@/lib/ai";
import type { ParsedResume } from "@/types/resume";
import type { AIModel } from "@/lib/ai/types";
import { DEFAULT_MODEL } from "@/lib/ai/types";
import { userIsPremium } from "@/lib/subscription";
import { NextResponse, after } from "next/server";
import { recordGeneration } from "@/lib/generations";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { job_id, model = DEFAULT_MODEL } = await request.json();

    const requestedModel = model as AIModel;
    const isPremium = await userIsPremium(supabase, user.id, user.email);

    // Every AI feature requires an active trial or subscription.
    if (!isPremium) {
      return NextResponse.json({ error: "subscription_required" }, { status: 402 });
    }

    // Fetch job
    const { data: job } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", job_id)
      .eq("user_id", user.id)
      .single();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Fetch resume
    const { data: resumeRow } = await supabase
      .from("resume_data")
      .select("parsed_json")
      .eq("user_id", user.id)
      .single();

    if (!resumeRow?.parsed_json) {
      return NextResponse.json({ error: "No resume found" }, { status: 400 });
    }

    // Fetch supplemental
    const { data: supplementalRows } = await supabase
      .from("supplemental_answers")
      .select("question_key, answer")
      .eq("user_id", user.id);

    const supplemental: Record<string, string> = {};
    supplementalRows?.forEach((row) => {
      supplemental[row.question_key] = row.answer;
    });

    const startedAt = Date.now();
    const coverLetter = await generateCoverLetter(
      job.description || "",
      job.company,
      job.title,
      resumeRow.parsed_json as unknown as ParsedResume,
      supplemental,
      requestedModel,
      getModelFallbackChain(requestedModel, isPremium)
    );

    // Update application with cover letter
    await supabase
      .from("applications")
      .update({
        cover_letter: coverLetter,
        updated_at: new Date().toISOString(),
      })
      .eq("job_id", job_id)
      .eq("user_id", user.id);

    // Persist to MongoDB after the response is sent so it never adds latency.
    after(() =>
      recordGeneration({
        userId: user.id,
        kind: "cover_letter",
        source: "web",
        model: requestedModel,
        job: { id: job.id, title: job.title, company: job.company, url: job.url ?? undefined },
        durationMs: Date.now() - startedAt,
        output: { coverLetter },
      })
    );

    return NextResponse.json({ cover_letter: coverLetter });
  } catch (error) {
    console.error("Cover letter generation error:", error);
    return NextResponse.json({ error: "Failed to generate cover letter" }, { status: 500 });
  }
}
