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
        "w-full md:w-[272px] md:shrink-0 flex flex-col rounded-lg transition-all duration-150",
        color,
        dragOver && isDragTarget && "ring-2 ring-primary/60 ring-offset-1"
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
      <div className="flex items-center justify-between px-3 py-2.5">
        <h3 className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">{label}</h3>
        <Badge variant="secondary" className="text-[10px] h-5 min-w-[20px] justify-center">
          {jobs.length}
        </Badge>
      </div>
      <div className="space-y-2 px-2 pb-2 min-h-[60px] md:flex-1 md:overflow-y-auto">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
