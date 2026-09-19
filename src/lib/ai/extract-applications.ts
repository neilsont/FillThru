import { chatWithFallback, stripCodeFences } from "./index";
import { DEFAULT_MODEL, type AIModel } from "./types";

// Turns the text of an ATS "My Applications" page (Workday candidate home,
// LinkedIn applied jobs, …) into rows the tracker can store.

export type ImportedStage = "in_progress" | "applied" | "interviewing" | "rejected" | "offer";

export interface ImportedApplication {
  title: string;
  company: string;
  status: ImportedStage;
  statusText: string;
  appliedOn: string | null; // ISO date when it can be parsed
  location: string | null;
}

const SYSTEM = `You extract job applications from the text of a careers-site "My Applications" page.
Return ONLY a JSON object: { "applications": [ { "title": string, "company": string, "statusText": string, "status": "in_progress"|"applied"|"interviewing"|"rejected"|"offer", "appliedOn": string|null, "location": string|null } ] }
Rules:
- One entry per application row. Ignore navigation, headings, footers, and job recommendations that the user has NOT applied to.
- statusText is the site's own wording (e.g. "Under Consideration", "Not Selected"). Map it to status:
  applied      → received / under consideration / in review / application submitted / in process
  interviewing → interview / assessment / phone screen
  offer        → offer / hired
  rejected     → not selected / no longer under consideration / withdrawn / position closed / declined / closed
  in_progress  → draft / not submitted / incomplete
  If the section is labelled Inactive and the status is unclear, use rejected.
- appliedOn: convert to YYYY-MM-DD when a date is present, else null.
- If the company isn't in the row, use the DEFAULT COMPANY.
- No commentary, no markdown fences.`;

const STAGES: ImportedStage[] = ["in_progress", "applied", "interviewing", "rejected", "offer"];

function fallbackStage(statusText: string, tab: string): ImportedStage {
  const t = statusText.toLowerCase();
  if (/interview|assessment|screen/.test(t)) return "interviewing";
  if (/offer|hired/.test(t)) return "offer";
  if (/not selected|no longer|withdrawn|closed|declined|reject|unsuccessful/.test(t)) return "rejected";
  if (/draft|incomplete|not submitted/.test(t)) return "in_progress";
  if (/inactive/i.test(tab)) return "rejected";
  return "applied";
}

export async function extractApplications(args: {
  company: string;
  sections: { tab: string; text: string }[];
  model?: AIModel;
  fallbackModels?: AIModel[];
}): Promise<ImportedApplication[]> {
  const body = args.sections
    .map((s) => `=== ${s.tab || "Applications"} ===\n${s.text.slice(0, 12000)}`)
    .join("\n\n");
  const raw = await chatWithFallback(
    args.model ?? DEFAULT_MODEL,
    SYSTEM,
    `DEFAULT COMPANY: ${args.company || "(unknown)"}\n\nPAGE TEXT:\n${body}\n\nReturn the JSON object now.`,
    args.fallbackModels ?? [],
    4096
  );
  let text = stripCodeFences(raw);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  let parsed: { applications?: unknown[] } = {};
  try { parsed = JSON.parse(text); } catch { return []; }

  const rows = Array.isArray(parsed.applications) ? parsed.applications : [];
  const seen = new Set<string>();
  const out: ImportedApplication[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const title = String(r?.title ?? "").trim().slice(0, 200);
    if (!title) continue;
    const company = String(r?.company ?? args.company ?? "").trim().slice(0, 200) || args.company;
    const key = `${title.toLowerCase()}|${company.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const statusText = String(r?.statusText ?? "").trim().slice(0, 120);
    const status = STAGES.includes(r?.status as ImportedStage) ? (r!.status as ImportedStage) : fallbackStage(statusText, "");
    const appliedRaw = r?.appliedOn ? String(r.appliedOn) : "";
    const appliedOn = /^\d{4}-\d{2}-\d{2}$/.test(appliedRaw) && !Number.isNaN(Date.parse(appliedRaw)) ? appliedRaw : null;
    out.push({ title, company, status, statusText, appliedOn, location: r?.location ? String(r.location).slice(0, 120) : null });
  }
  return out;
}
