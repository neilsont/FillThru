"use client";

import { useState } from "react";
import { useJobs, useUpdateJob } from "@/hooks/use-jobs";
import { KANBAN_COLUMNS } from "@/lib/constants";
import { KanbanColumn } from "./kanban-column";
import { JobSearchBar } from "./job-search-bar";
import { AddJobDialog } from "./add-job-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Plus, Briefcase } from "lucide-react";
import { useKanbanStore } from "@/stores/kanban-store";
import { useToast } from "@/components/ui/toast";
import type { JobStatus } from "@/types/database";

export function KanbanBoard() {
  const { data: jobs, isLoading } = useJobs();
  const updateJob = useUpdateJob();
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { draggedJobId, setDraggedJobId } = useKanbanStore();

  const handleDrop = (status: JobStatus) => {
    if (!draggedJobId) return;
    updateJob.mutate(
      { id: draggedJobId, status },
      {
        onSuccess: () => {
          toast({ title: "Job moved" });
        },
      }
    );
    setDraggedJobId(null);
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto flex-1 pb-4">
        {KANBAN_COLUMNS.map((col) => (
          <div key={col.id} className="w-72 shrink-0">
            <Skeleton className="h-8 w-full mb-3" />
            <Skeleton className="h-32 w-full mb-2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!jobs?.length) {
    return (
      <EmptyState
        icon={Briefcase}
        title="No jobs yet"
        description="Search for jobs or add one manually to get started."
        actionLabel="Add a job"
        onAction={() => setShowAddDialog(true)}
      />
    );
  }

  const jobsByStatus = KANBAN_COLUMNS.map((col) => ({
    ...col,
    jobs: jobs?.filter((j) => j.status === col.id) ?? [],
  }));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-3 mb-4">
        <JobSearchBar />
        <Button onClick={() => setShowAddDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Job
        </Button>
      </div>

      <div className="flex gap-4 overflow-x-auto flex-1 pb-4">
        {jobsByStatus.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            label={col.label}
            color={col.color}
            jobs={col.jobs}
            isDragTarget={!!draggedJobId}
            onDrop={() => handleDrop(col.id)}
          />
        ))}
      </div>

      <AddJobDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
    </div>
  );
}
