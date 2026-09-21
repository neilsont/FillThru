import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS, resolveUser } from "@/lib/auth-request";
import { detectDocumentKind, extractDocumentText } from "@/lib/documents";
import { userIsPremium } from "@/lib/subscription";

// Turns a file dropped into the website chat into text for that conversation.
// Like the extension's /api/extension/attachments, nothing is stored: the
// browser keeps the text and sends it with each turn.

export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_CHARS = 40_000;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await resolveUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  if (!(await userIsPremium(supabase, user.id, user.email))) {
    return NextResponse.json({ error: "subscription_required" }, { status: 402, headers: CORS_HEADERS });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400, headers: CORS_HEADERS });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Files must be under 15MB" }, { status: 400, headers: CORS_HEADERS });
  const kind = detectDocumentKind(file);
  if (!kind) {
    return NextResponse.json(
      { error: "I can read PDF, Word, plain-text files (.txt, .md, .csv), and images (PNG, JPG, WebP, HEIC)." },
      { status: 415, headers: CORS_HEADERS }
    );
  }

  try {
    const { text, ocr } = await extractDocumentText(kind, Buffer.from(await file.arrayBuffer()), file);
    if (!text) return NextResponse.json({ error: "I couldn't find any readable text in that file." }, { status: 422, headers: CORS_HEADERS });
    const truncated = text.length > MAX_CHARS;
    return NextResponse.json(
      { name: file.name, kind, ocr, chars: text.length, truncated, text: truncated ? text.slice(0, MAX_CHARS) : text },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("Chat attachment extraction error:", err);
    const message = err instanceof Error && /too large/i.test(err.message) ? err.message : "Couldn't read that file. Is it a valid PDF, Word document, or image?";
    return NextResponse.json({ error: message }, { status: 422, headers: CORS_HEADERS });
  }
}
