"use client";

import { useState } from "react";
import { JobCard } from "./job-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Job } from "@/types/database";

interface KanbanColumnProps {
  id: string;
  label: string;
  color: string;
  jobs: Job[];
  isDragTarget: boolean;
  onDrop: () => void;
}

export function KanbanColumn({ id, label, color, jobs, isDragTarget, onDrop }: KanbanColumnProps) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={cn(
        "w-72 shrink-0 flex flex-col rounded-lg transition-colors",
        color,
        dragOver && isDragTarget && "ring-2 ring-primary"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        if (isDragTarget) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onDrop();
      }}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <h3 className="text-sm font-semibold text-foreground/80">{label}</h3>
        <Badge variant="secondary" className="text-xs">
          {jobs.length}
        </Badge>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 px-2 pb-2">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
