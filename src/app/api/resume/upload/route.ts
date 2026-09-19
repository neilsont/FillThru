import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getModelFallbackChain, parseResumeText } from "@/lib/ai";
import { normalizeModel } from "@/lib/ai/types";
import { userIsPremium } from "@/lib/subscription";
import { NextResponse } from "next/server";
import { detectDocumentKind, extractDocumentText } from "@/lib/documents";
export const maxDuration = 60;

// The browser extension uploads with a bearer token from a different origin.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// Website requests carry the Supabase session cookie; the extension sends
// `Authorization: Bearer <access_token>` instead. Both resolve to the same user.
async function resolveUser(request: Request) {
  const bearer = request.headers.get("Authorization")?.replace("Bearer ", "").trim();
  if (bearer) {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${bearer}` } } }
    );
    const { data: { user } } = await supabase.auth.getUser(bearer);
    return { supabase, user };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await resolveUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400, headers: CORS_HEADERS });
    }

    const kind = detectDocumentKind(file);
    if (!kind || kind === "text") {
      return NextResponse.json(
        { error: "Please upload your resume as a PDF, Word document, or image (PNG/JPG)." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be under 10MB" }, { status: 400, headers: CORS_HEADERS });
    }

    const model = normalizeModel(formData.get("model"));

    const isPremium = await userIsPremium(supabase, user.id, user.email);
    if (!isPremium) {
      return NextResponse.json({ error: "subscription_required" }, { status: 402, headers: CORS_HEADERS });
    }

    const ext = kind === "pdf" ? "pdf" : kind === "docx" ? "docx" : (file.name.split(".").pop()?.toLowerCase() || "png");
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = `${user.id}/resume.${ext}`;

    // Upload to Supabase Storage
    const { error: storageError } = await supabase.storage
      .from("resumes")
      .upload(filePath, buffer, {
        upsert: true,
        contentType: file.type,
      });

    if (storageError) {
      console.error("Storage upload error:", storageError);
      return NextResponse.json({ error: "Failed to upload file to storage" }, { status: 500, headers: CORS_HEADERS });
    }

    // Extract text (scanned PDFs and images are transcribed by Gemini)
    let rawText: string;
    try {
      ({ text: rawText } = await extractDocumentText(kind, buffer, file));
    } catch (extractError) {
      console.error("Text extraction error:", extractError);
      return NextResponse.json(
        { error: "Failed to read the file. Please make sure it's a valid PDF, Word document, or image." },
        { status: 422, headers: CORS_HEADERS }
      );
    }

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json(
        { error: "I couldn't find any readable text in that file." },
        { status: 422, headers: CORS_HEADERS }
      );
    }

    // Parse with the model fallback chain
    let parsedJson;
    try {
      parsedJson = await parseResumeText(rawText, model, getModelFallbackChain(model, isPremium));
    } catch (aiError) {
      console.error("AI parsing error:", aiError);
      return NextResponse.json({ error: "Failed to analyze resume with AI. Please try again." }, { status: 500, headers: CORS_HEADERS });
    }

    // Upsert into resume_data
    const { error: dbError } = await supabase.from("resume_data").upsert(
      {
        user_id: user.id,
        raw_text: rawText,
        parsed_json: parsedJson as unknown as Record<string, unknown>,
        file_path: filePath,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (dbError) {
      console.error("Database upsert error:", dbError);
      return NextResponse.json({ error: "Failed to save resume data" }, { status: 500, headers: CORS_HEADERS });
    }

    return NextResponse.json(parsedJson, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("Resume upload error:", error);
    return NextResponse.json({ error: "Failed to process resume" }, { status: 500, headers: CORS_HEADERS });
  }
}
