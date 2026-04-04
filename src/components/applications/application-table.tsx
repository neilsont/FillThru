"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_COLORS } from "@/lib/constants";
import { ArrowUpDown } from "lucide-react";
import type { ApplicationWithJob } from "@/types/application";

type SortKey = "title" | "company" | "status" | "match_score" | "updated_at";

export function ApplicationTable({ applications }: { applications: ApplicationWithJob[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    let result = applications;
    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }
    return result.sort((a, b) => {
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
      className="flex items-center gap-1 hover:text-foreground"
      onClick={() => handleSort(field)}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-muted-foreground">Filter:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
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
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead><SortHeader label="Job Title" field="title" /></TableHead>
            <TableHead><SortHeader label="Company" field="company" /></TableHead>
            <TableHead><SortHeader label="Status" field="status" /></TableHead>
            <TableHead><SortHeader label="Match" field="match_score" /></TableHead>
            <TableHead>Cover Letter</TableHead>
            <TableHead><SortHeader label="Last Updated" field="updated_at" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((app) => (
            <TableRow key={app.id} className="cursor-pointer">
              <TableCell>
                <Link
                  href={`/dashboard/jobs/${app.job_id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {app.job.title}
                </Link>
              </TableCell>
              <TableCell>{app.job.company}</TableCell>
              <TableCell>
                <Badge className={STATUS_COLORS[app.status] || ""}>
                  {app.status}
                </Badge>
              </TableCell>
              <TableCell>
                {app.job.match_score !== null ? `${app.job.match_score}%` : "-"}
              </TableCell>
              <TableCell>
                {app.cover_letter ? (
                  <Badge variant="success">Yes</Badge>
                ) : (
                  <span className="text-muted-foreground">No</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {new Date(app.updated_at).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
