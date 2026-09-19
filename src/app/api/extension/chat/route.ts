import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getModelFallbackChain } from "@/lib/ai";
import { normalizeModel } from "@/lib/ai/types";
import { runAssistantTurn, type AssistantIntent, type ChatMessage, type PageContext } from "@/lib/ai/assistant";
import { userIsPremium } from "@/lib/subscription";
import type { ParsedResume } from "@/types/resume";

export const maxDuration = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const INTENTS: AssistantIntent[] = ["chat", "fill_form", "cover_letter"];

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

    const body = await request.json();
    const intent: AssistantIntent = INTENTS.includes(body.intent) ? body.intent : "chat";
    const messages: ChatMessage[] = Array.isArray(body.messages)
      ? body.messages
          .filter((m: ChatMessage) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .map((m: ChatMessage) => ({ role: m.role, content: m.content.slice(0, 4000) }))
      : [];
    const context: PageContext = body.context && typeof body.context === "object" ? body.context : {};
    if (intent === "chat" && !messages.some((m) => m.role === "user")) {
      return NextResponse.json({ error: "Nothing to respond to" }, { status: 400, headers: CORS_HEADERS });
    }

    const [{ data: resumeRow }, { data: supplementalRows }] = await Promise.all([
      supabase.from("resume_data").select("parsed_json").eq("user_id", user.id).maybeSingle(),
      supabase.from("supplemental_answers").select("question_key, answer").eq("user_id", user.id),
    ]);
    const facts: Record<string, string> = {};
    supplementalRows?.forEach((row) => { facts[row.question_key] = row.answer; });

    const model = normalizeModel(body.model);
    const turn = await runAssistantTurn({
      intent,
      messages,
      context,
      resume: (resumeRow?.parsed_json as ParsedResume | null) ?? null,
      facts,
      model,
      fallbackModels: getModelFallbackChain(model, true),
    });

    // Durable facts become supplemental answers, so autofill and future chats know them.
    if (turn.remember.length) {
      const rows = turn.remember.map((r) => ({
        user_id: user.id,
        question_key: r.key,
        question_label: r.label,
        answer: r.value,
        source: "ai_suggested" as const,
      }));
      const { error: memError } = await supabase
        .from("supplemental_answers")
        .upsert(rows, { onConflict: "user_id,question_key" });
      if (memError) console.error("Could not save assistant facts:", memError);
    }

    return NextResponse.json(turn, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("Assistant chat error:", err);
    return NextResponse.json({ error: "The assistant hit an error. Please try again." }, { status: 500, headers: CORS_HEADERS });
  }
}
