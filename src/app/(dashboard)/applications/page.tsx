"use client";

import { useApplications } from "@/hooks/use-applications";
import { PageHeader } from "@/components/shared/page-header";
import { ApplicationTable } from "@/components/applications/application-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { exportApplicationsCSV } from "@/lib/csv-export";

export default function ApplicationsPage() {
  const { data: applications, isLoading } = useApplications();

  const handleExport = () => {
    if (!applications?.length) return;
    const csv = exportApplicationsCSV(applications);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `careerlaunch-applications-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Applications" />
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Applications" description="Track all your job applications">
        {applications && applications.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
          </Button>
        )}
      </PageHeader>

      {!applications?.length ? (
        <EmptyState
          icon={FileText}
          title="No applications yet"
          description="Start by viewing a job and creating an application."
          actionLabel="Go to Dashboard"
          actionHref="/dashboard"
        />
      ) : (
        <ApplicationTable applications={applications} />
      )}
    </div>
  );
}
