import type { ParsedResume } from "@/types/resume";
import type { ChatAttachment } from "./assistant";

// The website chat (fillthru.com/chat). Unlike the extension assistant, which
// answers in a strict JSON envelope so the panel can act on it, this one talks
// like a normal chat model — markdown in, markdown out — and its edge is that
// it already knows the user: résumé, saved facts, and the jobs they're tracking.

export interface TrackedJob {
  title: string;
  company: string;
  status: string;
  location?: string | null;
  url?: string | null;
  updated_at?: string;
}

export interface WebChatKnowledge {
  name?: string | null;
  resume: ParsedResume | null;
  resumeText?: string | null;
  facts: Record<string, string>;
  jobs: TrackedJob[];
  attachments?: ChatAttachment[];
}

const IDENTITY = `You are Fillthru — a job-search copilot on fillthru.com. You help people find roles, tailor résumés and cover letters, answer application questions, prepare for interviews, negotiate offers, and think through their careers. You also answer general questions like any capable assistant would.

How you work:
- Be direct and useful. Lead with the answer; skip preamble and disclaimers.
- Use Markdown when it helps (headings, lists, tables, bold). For drafts — cover letters, emails, résumé bullets — give the finished text, ready to paste.
- Ground everything about the user in WHAT YOU KNOW below. Never invent experience, dates, employers, or numbers. If something you'd need isn't there, ask one focused question or state the assumption you're making.
- Match the user's language.
- The Fillthru Chrome extension fills applications on any site, writes cover letters in-page, and can auto-apply; the dashboard tracks jobs on a board. Mention them only when they'd genuinely help.`;

function describeResume(resume: ParsedResume | null, resumeText?: string | null): string {
  if (!resume && !resumeText) return "Résumé: (none uploaded yet)";
  const parts: string[] = [];
  if (resume) parts.push("Résumé (structured):\n" + JSON.stringify(resume, null, 1).slice(0, 10_000));
  if (resumeText?.trim()) parts.push(`Résumé text (verbatim, for anything the structured view misses):\n"""${resumeText.trim().slice(0, 6000)}"""`);
  return parts.join("\n\n");
}

function describeFacts(facts: Record<string, string>): string {
  const entries = Object.entries(facts);
  if (!entries.length) return "Saved facts: (none yet)";
  return "Saved facts about the user (from previous applications and chats):\n" + entries.slice(0, 60).map(([k, v]) => `- ${k}: ${String(v).slice(0, 300)}`).join("\n");
}

function describeJobs(jobs: TrackedJob[]): string {
  if (!jobs.length) return "Tracked jobs: (none yet)";
  return "Tracked jobs (the user's board, newest first):\n" + jobs.slice(0, 40).map((j) => {
    const bits = [`${j.title} @ ${j.company}`, `status=${j.status}`];
    if (j.location) bits.push(j.location);
    if (j.url) bits.push(j.url);
    return "- " + bits.join(" | ");
  }).join("\n");
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
  return "FILES THE USER ATTACHED TO THIS CONVERSATION:\n" + parts.join("\n\n");
}

export function buildWebChatSystem(k: WebChatKnowledge): string {
  return [
    IDENTITY,
    "",
    "WHAT YOU KNOW ABOUT THE USER:",
    k.name ? `Name: ${k.name}` : "",
    describeResume(k.resume, k.resumeText),
    "",
    describeFacts(k.facts),
    "",
    describeJobs(k.jobs),
    "",
    describeAttachments(k.attachments),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** A short title for the sidebar, from the first thing the user said. */
export function titleFromMessage(text: string): string {
  const firstLine = text.replace(/\s+/g, " ").trim().split(/[.!?\n]/)[0] ?? "";
  const t = firstLine.length > 60 ? firstLine.slice(0, 57).replace(/\s+\S*$/, "") + "…" : firstLine;
  return t || "New conversation";
}
