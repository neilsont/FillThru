import { createClient } from "@/lib/supabase/server";
import { parseResumeText } from "@/lib/anthropic/resume-parser";
import { NextResponse } from "next/server";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";

export const maxDuration = 60;

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument(data).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => (item.str as string).replace(/\s+/g, " "))
      .join(" ");
    fullText += pageText + "\n";
  }

  return fullText.trim();
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

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be under 10MB" }, { status: 400 });
    }

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = `${user.id}/resume.pdf`;

    const { error: storageError } = await supabase.storage
      .from("resumes")
      .upload(filePath, buffer, {
        upsert: true,
        contentType: "application/pdf",
      });

    if (storageError) {
      console.error("Storage upload error:", storageError);
      return NextResponse.json({ error: "Failed to upload file to storage" }, { status: 500 });
    }

    // Extract text with PDF.js (legacy Node build)
    let rawText: string;
    try {
      rawText = await extractTextFromPDF(buffer);
    } catch (pdfError) {
      console.error("PDF parsing error:", pdfError);
      return NextResponse.json(
        { error: "Failed to extract text from PDF. Please ensure the file is a valid PDF." },
        { status: 422 }
      );
    }

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract any text from the PDF. The file may be image-based or empty." },
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
