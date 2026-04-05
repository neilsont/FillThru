import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { generateCoverLetter } from "@/lib/ai";
import { ParsedResume } from "@/types/resume";

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

    const { jobTitle, companyName, jobDescription } = await request.json();
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
    const coverLetter = await generateCoverLetter(
      jobDescription,
      companyName,
      jobTitle,
      resumeRow.parsed_json as ParsedResume,
      supplemental
    );

    return NextResponse.json({ coverLetter }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error("Generate cover letter error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
