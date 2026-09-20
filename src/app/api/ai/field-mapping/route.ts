import { createClient } from "@/lib/supabase/server";
import { getModelFallbackChain, mapApplicationFields } from "@/lib/ai";
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
    const mappings = await mapApplicationFields(
      job.description || "",
      (resumeRow?.parsed_json ?? {}) as unknown as ParsedResume,
      supplemental,
      requestedModel,
      getModelFallbackChain(requestedModel, isPremium)
    );

    // Flag low-confidence fields
    const lowConfidence = mappings.filter((m) => m.confidence < 0.7 && !m.value);
    if (lowConfidence.length > 0) {
      await supabase.from("flagged_questions").insert(
        lowConfidence.map((f) => ({
          user_id: user.id,
          job_id: job.id,
          question_text: f.field_label,
          field_key: f.field_key,
          resolved: false,
        }))
      );
    }

    // Update application with field mappings
    await supabase
      .from("applications")
      .update({
        filled_fields_json: { mappings } as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq("job_id", job_id)
      .eq("user_id", user.id);

    // Persist to MongoDB after the response is sent so it never adds latency.
    after(() =>
      recordGeneration({
        userId: user.id,
        kind: "field_mapping",
        source: "web",
        model: requestedModel,
        job: { id: job.id, title: job.title, company: job.company, url: job.url ?? undefined },
        durationMs: Date.now() - startedAt,
        output: { mappings, lowConfidenceCount: lowConfidence.length },
      })
    );

    return NextResponse.json({ mappings });
  } catch (error) {
    console.error("Field mapping error:", error);
    const message = error instanceof Error && error.message ? error.message : "Failed to map fields";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
