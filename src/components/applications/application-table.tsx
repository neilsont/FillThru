"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown } from "lucide-react";
import type { ApplicationWithJob } from "@/types/application";

type SortKey = "title" | "company" | "status" | "match_score" | "updated_at";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "destructive" | "warning"> = {
  draft: "secondary",
  ready: "default",
  submitted: "success",
  withdrawn: "destructive",
};

export function ApplicationTable({ applications }: { applications: ApplicationWithJob[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    let result = applications;
    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
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
          aVal = a.status;
          bVal = b.status;
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
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="withdrawn">Withdrawn</SelectItem>
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
              <TableHead><SortHeader label="Company" field="company" /></TableHead>
              <TableHead><SortHeader label="Status" field="status" /></TableHead>
              <TableHead><SortHeader label="Match" field="match_score" /></TableHead>
              <TableHead>Cover Letter</TableHead>
              <TableHead><SortHeader label="Updated" field="updated_at" /></TableHead>
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
                <TableCell className="text-sm">{app.job.company}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[app.status] || "secondary"} className="text-[11px]">
                    {app.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {app.job.match_score !== null ? `${app.job.match_score}%` : "-"}
                </TableCell>
                <TableCell>
                  {app.cover_letter ? (
                    <Badge variant="success" className="text-[11px]">Yes</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">No</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
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
