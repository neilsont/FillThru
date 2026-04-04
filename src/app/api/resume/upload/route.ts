import { createClient } from "@/lib/supabase/server";
import { parseResumeText } from "@/lib/anthropic/resume-parser";
import { NextResponse } from "next/server";
export const maxDuration = 60;

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text.trim();
}

async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  // mammoth is CJS — use require() so Turbopack skips static analysis
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require("mammoth") as {
    extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
  };
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PDF and Word documents (.pdf, .docx) are accepted" },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be under 10MB" }, { status: 400 });
    }

    const isPDF = file.type === "application/pdf";
    const ext = isPDF ? "pdf" : "docx";
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
      return NextResponse.json({ error: "Failed to upload file to storage" }, { status: 500 });
    }

    // Extract text
    let rawText: string;
    try {
      rawText = isPDF
        ? await extractTextFromPDF(buffer)
        : await extractTextFromDOCX(buffer);
    } catch (extractError) {
      console.error("Text extraction error:", extractError);
      return NextResponse.json(
        { error: "Failed to extract text from file. Please ensure the file is a valid PDF or Word document." },
        { status: 422 }
      );
    }

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract any text from the file. The PDF may be image-based — try a Word document instead." },
        { status: 422 }
      );
    }

    // Parse with Claude AI
    let parsedJson;
    try {
      parsedJson = await parseResumeText(rawText);
    } catch (aiError) {
      console.error("AI parsing error:", aiError);
      return NextResponse.json({ error: "Failed to analyze resume with AI. Please try again." }, { status: 500 });
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
      return NextResponse.json({ error: "Failed to save resume data" }, { status: 500 });
    }

    return NextResponse.json(parsedJson);
  } catch (error) {
    console.error("Resume upload error:", error);
    return NextResponse.json({ error: "Failed to process resume" }, { status: 500 });
  }
}
