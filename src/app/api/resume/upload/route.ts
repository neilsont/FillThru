import { createClient } from "@/lib/supabase/server";
import { parseResumeText } from "@/lib/anthropic/resume-parser";
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

    await supabase.storage.from("resumes").upload(filePath, buffer, {
      upsert: true,
      contentType: "application/pdf",
    });

    // Extract text with pdf-parse (v2 API uses class constructor)
    const pdfParse = await import("pdf-parse");
    const Parser = pdfParse.PDFParse;
    const parser = new Parser({ data: buffer });
    const pdfResult = await parser.getText();
    const rawText = typeof pdfResult === "string" ? pdfResult : (pdfResult as { text: string }).text;

    // Parse with Claude AI
    const parsedJson = await parseResumeText(rawText);

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
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json(parsedJson);
  } catch (error) {
    console.error("Resume upload error:", error);
    return NextResponse.json({ error: "Failed to process resume" }, { status: 500 });
  }
}
