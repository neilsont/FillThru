import { createClient } from "@/lib/supabase/server";
import { mapApplicationFields } from "@/lib/ai";
import type { ParsedResume } from "@/types/resume";
import type { AIModel } from "@/lib/ai/types";
import { DEFAULT_MODEL } from "@/lib/ai/types";
import { NextResponse } from "next/server";

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

    const mappings = await mapApplicationFields(
      job.description || "",
      resumeRow.parsed_json as unknown as ParsedResume,
      supplemental,
      model as AIModel
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

    return NextResponse.json({ mappings });
  } catch (error) {
    console.error("Field mapping error:", error);
    return NextResponse.json({ error: "Failed to map fields" }, { status: 500 });
  }
}
