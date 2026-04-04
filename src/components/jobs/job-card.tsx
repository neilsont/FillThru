"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MatchScoreBadge } from "./match-score-badge";
import { useKanbanStore } from "@/stores/kanban-store";
import { MapPin, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Job } from "@/types/database";

const STATUS_BORDER_COLORS: Record<string, string> = {
  discovered: "border-l-slate-400",
  in_progress: "border-l-blue-500",
  applied: "border-l-indigo-500",
  interviewing: "border-l-violet-500",
  rejected: "border-l-red-400",
  offer: "border-l-emerald-500",
};

export function JobCard({ job }: { job: Job }) {
  const { setDraggedJobId } = useKanbanStore();

  return (
    <Link href={`/dashboard/jobs/${job.id}`}>
      <Card
        className={cn(
          "cursor-pointer bg-white border border-border/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 border-l-[3px]",
          STATUS_BORDER_COLORS[job.status] || "border-l-slate-300"
        )}
        draggable
        onDragStart={() => setDraggedJobId(job.id)}
        onDragEnd={() => setDraggedJobId(null)}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm leading-snug truncate">{job.title}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{job.company}</span>
              </div>
              {job.location && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{job.location}</span>
                </div>
              )}
            </div>
            {job.match_score !== null && <MatchScoreBadge score={job.match_score} />}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            {job.job_type && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {job.job_type}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {job.source}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
