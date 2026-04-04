"use client";

import { useState } from "react";
import { useJobs, useUpdateJob } from "@/hooks/use-jobs";
import { KANBAN_COLUMNS } from "@/lib/constants";
import { KanbanColumn } from "./kanban-column";
import { JobSearchBar } from "./job-search-bar";
import { AddJobDialog } from "./add-job-dialog";
import { JobSourceGroups } from "./job-source-group";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Plus, Briefcase, Columns3, LayoutGrid } from "lucide-react";
import { useKanbanStore } from "@/stores/kanban-store";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/types/database";

type ViewMode = "kanban" | "source";

export function KanbanBoard() {
  const { data: jobs, isLoading } = useJobs();
  const updateJob = useUpdateJob();
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
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
            <Skeleton className="h-8 w-full mb-3 rounded-lg" />
            <Skeleton className="h-28 w-full mb-2 rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (!jobs?.length) {
    return (
      <>
        <EmptyState
          icon={Briefcase}
          title="No jobs yet"
          description="Search for jobs or add one manually to get started."
          actionLabel="Add a job"
          onAction={() => setShowAddDialog(true)}
        />
        <AddJobDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
      </>
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
        <div className="flex items-center border rounded-md bg-white">
          <button
            onClick={() => setViewMode("kanban")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-l-md transition-colors",
              viewMode === "kanban"
                ? "bg-primary text-white"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Columns3 className="h-3.5 w-3.5" /> Pipeline
          </button>
          <button
            onClick={() => setViewMode("source")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-r-md transition-colors",
              viewMode === "source"
                ? "bg-primary text-white"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> By Source
          </button>
        </div>
        <Button onClick={() => setShowAddDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Job
        </Button>
      </div>

      {viewMode === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto flex-1 pb-4">
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
      ) : (
        <div className="flex-1 overflow-y-auto pb-4">
          <JobSourceGroups jobs={jobs} />
        </div>
      )}

      <AddJobDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
    </div>
  );
}
