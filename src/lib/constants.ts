import type { JobStatus } from "@/types/database";

export const KANBAN_COLUMNS: { id: JobStatus; label: string; color: string }[] = [
  { id: "in_progress", label: "In Progress", color: "bg-blue-100" },
  { id: "applied", label: "Applied", color: "bg-indigo-100" },
  { id: "interviewing", label: "Interviewing", color: "bg-violet-100" },
  { id: "rejected", label: "Rejected", color: "bg-red-100" },
  { id: "offer", label: "Offer", color: "bg-green-100" },
];

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-200 text-slate-700",
  ready: "bg-blue-100 text-blue-700",
  submitted: "bg-emerald-100 text-emerald-700",
  withdrawn: "bg-red-100 text-red-700",
};

export const SUPPLEMENTAL_QUESTIONS = [
  { key: "street_address", label: "Street Address", type: "text" as const },
  { key: "zip_code", label: "ZIP / Postal Code", type: "text" as const },
  { key: "ethnicity", label: "Ethnicity", type: "text" as const },
  { key: "disability_status", label: "Disability status", type: "select" as const, options: ["Yes", "No", "Prefer not to say"] },
  { key: "veteran_status", label: "Veteran status", type: "select" as const, options: ["Yes", "No", "Prefer not to say"] },
  { key: "work_authorization", label: "Are you authorized to work in the US?", type: "select" as const, options: ["Yes", "No"] },
  { key: "sponsorship_needed", label: "Will you now or in the future require sponsorship?", type: "select" as const, options: ["Yes", "No"] },
  { key: "gender", label: "Gender", type: "text" as const },
  { key: "pronouns", label: "Pronouns", type: "text" as const },
  { key: "linkedin_url", label: "LinkedIn URL", type: "text" as const },
  { key: "github_url", label: "GitHub URL", type: "text" as const },
  { key: "portfolio_url", label: "Portfolio URL", type: "text" as const },
  { key: "salary_expectation", label: "Desired salary", type: "text" as const },
  { key: "willing_to_relocate", label: "Willing to relocate?", type: "select" as const, options: ["Yes", "No", "Depends on location"] },
  { key: "work_arrangement", label: "Preferred work arrangement", type: "select" as const, options: ["Remote", "Hybrid", "On-site", "No preference"] },
];
