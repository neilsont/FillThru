import type { AIModel } from "./types";
import { DEFAULT_MODEL } from "./types";
import { chatWithFallback, stripCodeFences } from "./index";
import type { ParsedResume } from "@/types/resume";

// ─── The in-page assistant ("Ask Fillthru") ─────────────────────────────────────
// One model turn = one JSON object. The extension executes `fill` / `actions`,
// shows `reply`, and keeps `ask` around so the user's next message can be
// mapped back to the fields the assistant was asking about.

export interface PageField {
  id: string;
  label: string;
  type: "short_answer" | "essay" | "multiple_choice" | "multi_select";
  options?: string[];
  required?: boolean;
  currentValue?: string;
  helpText?: string;
  placeholder?: string;
  mappedField?: string | null;
}

export interface ChatAttachment {
  name: string;
  text: string;
}

export interface PageContext {
  attachments?: ChatAttachment[];
  url?: string;
  title?: string;
  job?: { title?: string; company?: string; description?: string; url?: string } | null;
  fields?: PageField[];
  selection?: string;
  pendingQuestions?: { id: string; question: string }[];
  language?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type AssistantAction =
  | { type: "save_job" }
  | { type: "write_cover_letter"; notes?: string }
  | { type: "search_jobs"; keywords?: string; location?: string; jobTypes?: string[] }
  | { type: "start_autopilot"; keywords?: string; location?: string; jobTypes?: string[]; limit?: number }
  | { type: "pause_autopilot" }
  | { type: "resume_autopilot" }
  | { type: "stop_autopilot" }
  | { type: "translate_page"; target?: string }
  | { type: "insert_text"; text: string }
  | { type: "set_resume"; name?: string };

export interface AssistantTurn {
  reply: string;
  fill: { id: string; value: string }[];
  ask: { id: string | null; question: string }[];
  remember: { key: string; label: string; value: string }[];
  actions: AssistantAction[];
}

export type AssistantIntent = "chat" | "fill_form" | "cover_letter";

const SYSTEM = `You are Fillthru, an assistant that lives inside a browser extension and helps people fill out job applications and other web forms.
You always answer with ONE JSON object and nothing else — no markdown, no code fences, no commentary outside the JSON.

JSON shape:
{
  "reply": string,                     // what to tell the user. Short, friendly, plain text. Use "\\n" for line breaks.
  "fill": [{ "id": string, "value": string }],          // page fields to fill now (ids come from PAGE FIELDS)
  "ask": [{ "id": string|null, "question": string }],   // things you need from the user before you can fill a field (id = that field's id)
  "remember": [{ "key": string, "label": string, "value": string }], // durable facts about the user worth saving for future forms
  "actions": [ ... ]                   // zero or more of the actions listed below
}

Actions you may emit:
  { "type": "save_job" }                                   — save the job on this page to the user's tracker
  { "type": "write_cover_letter", "notes": string }        — generate a cover letter for the job on this page; notes = anything the user told you to emphasise
  { "type": "search_jobs", "keywords": string, "location": string, "jobTypes": ["fulltime"|"parttime"|"contract"|"temporary"|"internship"] }
  { "type": "start_autopilot", "keywords": string, "location": string, "jobTypes": [...], "limit": number } — auto-apply to matching jobs (only when the user clearly asks to apply automatically)
  { "type": "pause_autopilot" } / { "type": "resume_autopilot" } / { "type": "stop_autopilot" } — when the user says pause / resume / stop (Autopilot runs silently in the background otherwise)
  { "type": "translate_page", "target": "en" }             — translate the whole page into a language code
  { "type": "insert_text", "text": string }                — put text into the field the user last clicked
  { "type": "set_resume", "name": string }                 — save an ATTACHED FILE as the user's résumé (only when they confirm they want that; name = the attachment's file name)

Rules:
1. Fill only with values you are confident about, taken from WHAT YOU KNOW or from what the user just told you. Never invent names, dates, numbers, or answers.
2. For select / radio / checkbox fields, "value" must be one of the listed options, copied exactly.
3. If a field (especially a required one) can't be answered from what you know, put it in "ask" with a clear, specific question. Group related questions; at most 5 per turn. Don't ask about optional fields that obviously don't apply.
4. When the user answers questions from PENDING QUESTIONS, fill those fields (use their ids) AND add durable facts to "remember" — things like name, phone, address, work authorization, salary expectations, notice period, years of experience, links. Do not "remember" one-off answers that only apply to this specific job.
5. "remember" keys are snake_case. If the fact answers a field that has known_as=<key>, use exactly that key (e.g. work_authorization, salary_expectation, street_address, zip_code, sponsorship_needed, willing_to_relocate); otherwise pick a clear one (full_name, phone, linkedin_url, desired_salary, notice_period…).
6. If the user asks to translate selected text or a passage, put the translation in "reply". If they ask to translate the whole page, emit translate_page.
7. If the user asks about themselves ("do I have React experience?") answer from WHAT YOU KNOW; if it isn't there, say so and offer to remember it.
8. Keep replies short. When you filled fields, say how many and what you still need. Never claim you filled something you didn't put in "fill".
9. If there is no résumé and little known about the user, that's fine — work from what they tell you and remember it.
10. ATTACHED FILES are documents the user added to this conversation (a job description, a cover-letter draft, notes, a previous application…). Use them to answer, fill, and write. If an attachment is clearly a job posting and the page has none, treat it as the job posting. Attachments are not the user's résumé unless they say so — when they do ("use this as my résumé", "yes, replace it"), emit set_resume with that file's name.`;

function describeFields(fields: PageField[] = []): string {
  if (!fields.length) return "(no fillable fields detected on this page)";
  return fields
    .slice(0, 80)
    .map((f) => {
      const parts = [`id=${f.id}`, `label="${f.label}"`, `type=${f.type}`];
      if (f.mappedField) parts.push(`known_as=${f.mappedField}`);
      if (f.required) parts.push("required");
      if (f.options?.length) parts.push(`options=[${f.options.slice(0, 25).map((o) => `"${o}"`).join(", ")}]`);
      if (f.currentValue) parts.push(`current="${f.currentValue.slice(0, 80)}"`);
      if (f.helpText) parts.push(`help="${f.helpText.slice(0, 120)}"`);
      return "- " + parts.join(" | ");
    })
    .join("\n");
}

function describeAttachments(attachments: ChatAttachment[] = []): string {
  if (!attachments.length) return "";
  let budget = 60_000;
  const parts: string[] = [];
  for (const a of attachments.slice(0, 6)) {
    const text = (a.text || "").trim().slice(0, Math.max(0, Math.min(30_000, budget)));
    budget -= text.length;
    parts.push(`--- ${a.name} ---\n${text}${a.text.length > text.length ? "\n[…truncated]" : ""}`);
    if (budget <= 0) break;
  }
  return "ATTACHED FILES:\n" + parts.join("\n\n");
}

function intentInstruction(intent: AssistantIntent): string {
  switch (intent) {
    case "fill_form":
      return "TASK: The user clicked \"Fill out this form\". Fill every field you can from WHAT YOU KNOW (skip fields that already have a current value unless it's clearly wrong). Put anything you can't answer into \"ask\". In \"reply\", summarise what you filled and list what you need.";
    case "cover_letter":
      return "TASK: The user clicked \"Write a cover letter\". If the page has a job title and description and you know enough about the user, emit write_cover_letter (put any emphasis the user mentioned in notes). If the job details are missing, or the résumé is missing and you know almost nothing about the user, ask for what you need instead — one short message.";
    default:
      return "TASK: Respond to the user's latest message. Use fill/actions when the message asks you to do something on the page.";
  }
}

export function buildAssistantPrompt(args: {
  intent: AssistantIntent;
  messages: ChatMessage[];
  context: PageContext;
  resume: ParsedResume | null;
  resumeText?: string | null;
  facts: Record<string, string>;
}): string {
  const { intent, messages, context, resume, resumeText, facts } = args;
  const known = {
    resume: resume ?? "(no résumé uploaded)",
    saved_facts: Object.keys(facts).length ? facts : "(nothing saved yet)",
  };
  const resumeExcerpt = resumeText?.trim()
    ? `\nRÉSUMÉ TEXT (verbatim, for details the summary above may miss):\n"""${resumeText.trim().slice(0, 7000)}"""`
    : "";
  const transcript = messages
    .slice(-14)
    .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
    .join("\n");

  return [
    intentInstruction(intent),
    "",
    "WHAT YOU KNOW ABOUT THE USER:",
    JSON.stringify(known, null, 1).slice(0, 12000) + resumeExcerpt,
    "",
    "PAGE:",
    `url: ${context.url ?? ""}`,
    `title: ${context.title ?? ""}`,
    context.language ? `page language: ${context.language}` : "",
    context.job?.title || context.job?.description
      ? `job posting: ${JSON.stringify({ title: context.job?.title, company: context.job?.company, description: (context.job?.description ?? "").slice(0, 3000) })}`
      : "job posting: (none detected)",
    context.selection ? `TEXT THE USER HAS SELECTED ON THE PAGE:\n"""${context.selection.slice(0, 3000)}"""` : "",
    "",
    "PAGE FIELDS:",
    describeFields(context.fields),
    "",
    describeAttachments(context.attachments),
    "",
    context.pendingQuestions?.length
      ? `PENDING QUESTIONS you asked last turn (map the user's answers to these ids):\n${context.pendingQuestions.map((q) => `- id=${q.id ?? "null"}: ${q.question}`).join("\n")}`
      : "",
    "",
    "CONVERSATION:",
    transcript || "(none yet)",
    "",
    "Respond with the JSON object now.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function parseTurn(raw: string): AssistantTurn {
  let text = stripCodeFences(raw);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);

  let parsed: Partial<AssistantTurn>;
  try {
    parsed = JSON.parse(text);
  } catch {
    // The model answered in prose — surface it rather than failing the turn.
    return { reply: raw.trim().slice(0, 2000), fill: [], ask: [], remember: [], actions: [] };
  }

  const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
  return {
    reply: str(parsed.reply).trim(),
    fill: Array.isArray(parsed.fill)
      ? parsed.fill.filter((f) => f && typeof f.id === "string").map((f) => ({ id: f.id, value: str(f.value) }))
      : [],
    ask: Array.isArray(parsed.ask)
      ? parsed.ask.filter((q) => q && q.question).map((q) => ({ id: typeof q.id === "string" ? q.id : null, question: str(q.question) }))
      : [],
    remember: Array.isArray(parsed.remember)
      ? parsed.remember
          .filter((r) => r && r.key && r.value)
          .map((r) => ({ key: str(r.key).toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60), label: str(r.label || r.key), value: str(r.value).slice(0, 1000) }))
      : [],
    actions: Array.isArray(parsed.actions) ? (parsed.actions.filter((a) => a && typeof a.type === "string") as AssistantAction[]) : [],
  };
}

export async function runAssistantTurn(
  args: Parameters<typeof buildAssistantPrompt>[0] & { model?: AIModel; fallbackModels?: AIModel[] }
): Promise<AssistantTurn> {
  const raw = await chatWithFallback(args.model ?? DEFAULT_MODEL, SYSTEM, buildAssistantPrompt(args), args.fallbackModels ?? [], 2048);
  return parseTurn(raw);
}
