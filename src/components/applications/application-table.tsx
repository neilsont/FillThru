"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown } from "lucide-react";
import type { ApplicationWithJob } from "@/types/application";
import { useUpdateJob } from "@/hooks/use-jobs";
import type { JobStatus } from "@/types/database";
import { useQueryClient } from "@tanstack/react-query";

type SortKey = "title" | "company" | "status" | "match_score" | "updated_at";

// Pipeline stages (jobs.status). The application row's own draft/submitted
// status is an internal detail; this is what the user tracks.
const STAGES: { value: string; label: string; variant: "default" | "secondary" | "success" | "destructive" | "warning" }[] = [
  { value: "discovered", label: "Saved", variant: "secondary" },
  { value: "in_progress", label: "In progress", variant: "default" },
  { value: "applied", label: "Applied", variant: "success" },
  { value: "interviewing", label: "Interviewing", variant: "warning" },
  { value: "offer", label: "Offer", variant: "success" },
  { value: "rejected", label: "Rejected", variant: "destructive" },
];
const STAGE_ORDER = Object.fromEntries(STAGES.map((s, i) => [s.value, i]));
const stageOf = (value: string) => STAGES.find((s) => s.value === value) ?? { value, label: value, variant: "secondary" as const };

export function ApplicationTable({ applications }: { applications: ApplicationWithJob[] }) {
  const updateJob = useUpdateJob();
  const queryClient = useQueryClient();
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    let result = applications;
    if (statusFilter !== "all") {
      result = result.filter((a) => a.job.status === statusFilter);
    }
    return [...result].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";

      switch (sortKey) {
        case "title":
          aVal = a.job.title.toLowerCase();
          bVal = b.job.title.toLowerCase();
          break;
        case "company":
          aVal = a.job.company.toLowerCase();
          bVal = b.job.company.toLowerCase();
          break;
        case "status":
          aVal = STAGE_ORDER[a.job.status] ?? 99;
          bVal = STAGE_ORDER[b.job.status] ?? 99;
          break;
        case "match_score":
          aVal = a.job.match_score ?? 0;
          bVal = b.job.match_score ?? 0;
          break;
        case "updated_at":
          aVal = a.updated_at;
          bVal = b.updated_at;
          break;
      }

      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [applications, sortKey, sortAsc, statusFilter]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => handleSort(field)}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-medium text-muted-foreground">Filter:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} application{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="rounded-lg border border-border/60 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead><SortHeader label="Job Title" field="title" /></TableHead>
              <TableHead className="hidden sm:table-cell"><SortHeader label="Company" field="company" /></TableHead>
              <TableHead><SortHeader label="Status" field="status" /></TableHead>
              <TableHead className="hidden md:table-cell"><SortHeader label="Match" field="match_score" /></TableHead>
              <TableHead className="hidden md:table-cell">Cover Letter</TableHead>
              <TableHead className="hidden md:table-cell"><SortHeader label="Updated" field="updated_at" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((app) => (
              <TableRow key={app.id} className="group">
                <TableCell>
                  <Link
                    href={`/dashboard/jobs/${app.job_id}`}
                    className="font-medium text-sm text-primary hover:underline"
                  >
                    {app.job.title}
                  </Link>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm">{app.job.company}</TableCell>
                <TableCell>
                  <Select
                    value={app.job.status}
                    onValueChange={(value) =>
                      updateJob.mutate(
                        { id: app.job_id, status: value as JobStatus },
                        { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications"] }) }
                      )
                    }
                  >
                    <SelectTrigger className="h-7 w-auto border-none bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:ml-1 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-0 group-hover:[&>svg]:opacity-60">
                      <Badge variant={stageOf(app.job.status).variant} className="text-[11px] cursor-pointer">
                        {stageOf(app.job.status).label}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm">
                  {app.job.match_score !== null ? `${app.job.match_score}%` : "-"}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {app.cover_letter ? (
                    <Badge variant="success" className="text-[11px]">Yes</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">No</span>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                  {new Date(app.updated_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
