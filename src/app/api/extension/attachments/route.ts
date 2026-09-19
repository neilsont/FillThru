import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { detectDocumentKind, extractDocumentText } from "@/lib/documents";
import { userIsPremium } from "@/lib/subscription";

// Turns a chat attachment into text the assistant can use for this
// conversation. Nothing is stored server-side: the extension keeps the text
// and sends it back with each turn, so the file never touches the profile.

export const maxDuration = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_CHARS = 40_000;

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "").trim();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }
    if (!(await userIsPremium(supabase, user.id, user.email))) {
      return NextResponse.json({ error: "subscription_required" }, { status: 402, headers: CORS_HEADERS });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400, headers: CORS_HEADERS });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Files must be under 15MB" }, { status: 400, headers: CORS_HEADERS });
    }
    const kind = detectDocumentKind(file);
    if (!kind) {
      return NextResponse.json(
        { error: "I can read PDF, Word, plain-text files (.txt, .md, .csv), and images (PNG, JPG, WebP, HEIC)." },
        { status: 415, headers: CORS_HEADERS }
      );
    }

    let text: string;
    let ocr = false;
    try {
      ({ text, ocr } = await extractDocumentText(kind, Buffer.from(await file.arrayBuffer()), file));
    } catch (extractError) {
      console.error("Attachment extraction error:", extractError);
      const message = extractError instanceof Error && /too large/i.test(extractError.message)
        ? extractError.message
        : "Couldn't read that file. Is it a valid PDF, Word document, or image?";
      return NextResponse.json({ error: message }, { status: 422, headers: CORS_HEADERS });
    }
    if (!text) {
      return NextResponse.json(
        { error: "I couldn't find any readable text in that file." },
        { status: 422, headers: CORS_HEADERS }
      );
    }

    const truncated = text.length > MAX_CHARS;
    return NextResponse.json(
      { name: file.name, kind, ocr, chars: text.length, truncated, text: truncated ? text.slice(0, MAX_CHARS) : text },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("Attachment error:", err);
    return NextResponse.json({ error: "Failed to process the file" }, { status: 500, headers: CORS_HEADERS });
  }
}
