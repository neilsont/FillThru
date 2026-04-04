import type { ApplicationWithJob } from "@/types/application";

export function exportApplicationsCSV(data: ApplicationWithJob[]): string {
  const headers = [
    "Job Title",
    "Company",
    "Location",
    "Status",
    "Match Score",
    "Cover Letter",
    "Applied Date",
    "Last Updated",
    "URL",
  ];

  const rows = data.map((d) => [
    d.job.title,
    d.job.company,
    d.job.location ?? "",
    d.status,
    d.job.match_score?.toString() ?? "",
    d.cover_letter ? "Yes" : "No",
    d.submitted_at ?? "",
    d.updated_at,
    d.job.url ?? "",
  ]);

  return [headers, ...rows]
    .map((r) =>
      r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
}
