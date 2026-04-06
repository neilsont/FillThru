"use client";

import { PageHeader } from "@/components/shared/page-header";
import { KanbanBoard } from "@/components/jobs/kanban-board";
import { SankeyDiagram } from "@/components/jobs/sankey-diagram";

export default function DashboardPage() {
  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Job Dashboard" description="Track your job search pipeline" />
      <KanbanBoard />
      <SankeyDiagram />
    </div>
  );
}
