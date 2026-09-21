import { NextRequest, NextResponse, after } from "next/server";
import { CORS_HEADERS, resolveUser } from "@/lib/auth-request";
import { AI_MODELS, CHAT_FALLBACK_ORDER, normalizeModel, type AIModel } from "@/lib/ai/types";
import { streamChatWithFallback, type ConversationMessage } from "@/lib/ai/stream";
import { buildWebChatSystem, titleFromMessage, type TrackedJob } from "@/lib/ai/web-assistant";
import type { ChatAttachment } from "@/lib/ai/assistant";
import { upsertChat, type ChatMessageRecord } from "@/lib/chats";
import { userIsPremium } from "@/lib/subscription";
import type { ParsedResume } from "@/types/resume";

// The website chat. Streams the reply as newline-delimited JSON events:
//   {"type":"model","model":"…"}   which model answered (after any fallback)
//   {"type":"text","text":"…"}     a chunk of the reply
//   {"type":"done"}                 the reply is complete
//   {"type":"error","message":"…"} something went wrong (may follow partial text)
// The full conversation is persisted to the shared `chats` collection once the
// stream ends, so it shows up in the sidebar and in Chat history.

export const maxDuration = 60;

const CHAT_ID = /^[a-zA-Z0-9_-]{8,64}$/;
const CONTEXT_TURNS = 30;

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
  file?: { name: string; size?: number; type?: string } | null;
  at?: number;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await resolveUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  if (!(await userIsPremium(supabase, user.id, user.email))) {
    return NextResponse.json({ error: "subscription_required" }, { status: 402, headers: CORS_HEADERS });
  }

  const body = await request.json().catch(() => null);
  const chatId = typeof body?.chatId === "string" && CHAT_ID.test(body.chatId) ? body.chatId : null;
  if (!chatId) return NextResponse.json({ error: "chatId is required" }, { status: 400, headers: CORS_HEADERS });

  const messages: IncomingMessage[] = Array.isArray(body.messages)
    ? body.messages
        .filter((m: IncomingMessage) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map((m: IncomingMessage) => ({
          role: m.role,
          content: m.content.slice(0, 12_000),
          file: m.file && typeof m.file.name === "string" ? { name: m.file.name.slice(0, 200), size: Number(m.file.size) || undefined, type: String(m.file.type ?? "").slice(0, 100) } : null,
          at: typeof m.at === "number" ? m.at : undefined,
        }))
    : [];
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || !(last.content.trim() || last.file)) {
    return NextResponse.json({ error: "Nothing to respond to" }, { status: 400, headers: CORS_HEADERS });
  }
  const attachments: ChatAttachment[] = Array.isArray(body.attachments)
    ? body.attachments
        .filter((a: ChatAttachment) => a && typeof a.name === "string" && typeof a.text === "string")
        .slice(0, 6)
        .map((a: ChatAttachment) => ({ name: a.name.slice(0, 200), text: a.text.slice(0, 40_000) }))
    : [];

  const [{ data: resumeRow }, { data: factRows }, { data: jobRows }] = await Promise.all([
    supabase.from("resume_data").select("parsed_json, raw_text").eq("user_id", user.id).maybeSingle(),
    supabase.from("supplemental_answers").select("question_key, answer").eq("user_id", user.id),
    supabase.from("jobs").select("title, company, status, location, url, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(40),
  ]);
  const facts: Record<string, string> = {};
  factRows?.forEach((row) => { facts[row.question_key] = row.answer; });
  const resume = (resumeRow?.parsed_json as ParsedResume | null) ?? null;
  const name = (user.user_metadata?.full_name as string | undefined) || (user.user_metadata?.name as string | undefined) || resume?.personal?.name || null;

  const system = buildWebChatSystem({
    name,
    resume,
    resumeText: (resumeRow?.raw_text as string | null) ?? null,
    facts,
    jobs: (jobRows ?? []) as TrackedJob[],
    attachments,
  });
  const context: ConversationMessage[] = messages
    .slice(-CONTEXT_TURNS)
    .map((m) => ({ role: m.role, content: m.file && !m.content.trim() ? `(attached ${m.file.name})` : m.content }));

  const model = normalizeModel(body.model);
  // Fastest free models first; anything else free (or a paid pick) after.
  const fallbacks: AIModel[] = [...CHAT_FALLBACK_ORDER, ...AI_MODELS.filter((m) => m.free).map((m) => m.id)];
  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, event: Record<string, unknown>) =>
    controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

  // Persist after the response has finished streaming — never on the hot path.
  let finish!: (result: { reply: string; error?: string }) => void;
  const finished = new Promise<{ reply: string; error?: string }>((resolve) => { finish = resolve; });
  after(async () => {
    const { reply, error } = await finished;
    const records: ChatMessageRecord[] = messages.map((m) => ({ kind: m.role, text: m.content, file: m.file ?? null, at: m.at }));
    if (reply || error) records.push({ kind: "assistant", text: reply || error || "", error: reply ? undefined : true, at: Date.now() });
    const firstUser = messages.find((m) => m.role === "user");
    try {
      await upsertChat(user.id, chatId, {
        host: "fillthru.com",
        url: `${process.env.NEXT_PUBLIC_APP_URL || "https://fillthru.com"}/chat/${chatId}`,
        title: titleFromMessage(firstUser?.content || firstUser?.file?.name || ""),
        messages: records,
        history: records.filter((r) => !r.error).map((r) => ({ role: r.kind, content: r.text })),
        attachmentNames: attachments.map((a) => a.name),
      });
    } catch (err) {
      console.error("Could not persist chat:", err);
    }
  });

  // The user hit Stop (or navigated away): stop pulling tokens and keep what arrived.
  let cancelled = false;
  const stream = new ReadableStream({
    async start(controller) {
      let reply = "";
      try {
        for await (const event of streamChatWithFallback(model, system, context, fallbacks, 2048)) {
          if (cancelled) break;
          if (event.type === "text") reply += event.text;
          send(controller, event);
        }
        if (!cancelled) send(controller, { type: "done" });
        finish({ reply });
      } catch (err) {
        if (cancelled) { finish({ reply }); return; }
        console.error("Chat stream error:", err);
        const message = reply ? "The reply was cut off. Send your message again to continue." : "The assistant hit an error. Please try again.";
        try { send(controller, { type: "error", message }); } catch { /* client went away */ }
        finish({ reply, error: message });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
