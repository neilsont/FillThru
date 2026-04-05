"use client";

import { useJob } from "@/hooks/use-jobs";
import { useApplication, useCreateApplication, useUpdateApplication } from "@/hooks/use-applications";
import { useGenerateCoverLetter, useMapFields } from "@/hooks/use-ai";
import { useToast } from "@/components/ui/toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { CoverLetterPanel } from "./cover-letter-panel";
import { FieldMappingForm } from "./field-mapping-form";
import { ArrowLeft, ExternalLink, MapPin, Building2, Briefcase, Loader2, Sparkles, FileText, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { FieldMapping } from "@/types/application";
import { EditJobDialog } from "@/components/jobs/edit-job-dialog";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "destructive" | "warning"> = {
  draft: "secondary",
  ready: "default",
  submitted: "success",
  withdrawn: "destructive",
};

export function ApplicationDetail({ jobId }: { jobId: string }) {
  const { data: job, isLoading: jobLoading } = useJob(jobId);
  const { data: application, isLoading: appLoading } = useApplication(jobId);
  const createApp = useCreateApplication();
  const updateApp = useUpdateApplication();
  const generateCL = useGenerateCoverLetter();
  const mapFields = useMapFields();
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const isLoading = jobLoading || appLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Job not found.</p>
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  const handleStartApplication = async () => {
    try {
      await createApp.mutateAsync({ job_id: jobId });
      toast({ title: "Application started" });
    } catch {
      toast({ title: "Failed to start application", variant: "destructive" });
    }
  };

  const handleGenerateCoverLetter = async () => {
    try {
      await generateCL.mutateAsync(jobId);
      toast({ title: "Cover letter generated!" });
    } catch {
      toast({ title: "Failed to generate cover letter", variant: "destructive" });
    }
  };

  const handleMapFields = async () => {
    try {
      await mapFields.mutateAsync({ job_id: jobId });
      toast({ title: "Fields mapped!" });
    } catch {
      toast({ title: "Failed to map fields", variant: "destructive" });
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!application) return;
    try {
      await updateApp.mutateAsync({ id: application.id, status });
      toast({ title: `Application marked as ${status}` });
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const handleSaveNotes = async () => {
    if (!application) return;
    try {
      await updateApp.mutateAsync({ id: application.id, notes });
      toast({ title: "Notes saved" });
    } catch {
      toast({ title: "Failed to save notes", variant: "destructive" });
    }
  };

  const fieldMappings: FieldMapping[] =
    (application?.filled_fields_json as { mappings?: FieldMapping[] })?.mappings ?? [];

  return (
    <div>
      <div className="mb-5">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Job Description */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{job.title}</CardTitle>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" /> {job.company}
                  </span>
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {job.location}
                    </span>
                  )}
                  {job.job_type && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" /> {job.job_type}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                {job.url && (
                  <a href={job.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> View
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {job.description ? (
              <div className="whitespace-pre-wrap text-sm text-foreground/80 leading-relaxed">
                {job.description}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No job description provided.</p>
            )}
          </CardContent>
        </Card>

        {/* Right: Application Panel */}
        <div className="space-y-4">
          {!application ? (
            <Card className="border-border/60">
              <CardContent className="py-12 text-center">
                <div className="rounded-2xl bg-muted/80 p-4 inline-block mb-4">
                  <FileText className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  No application started for this job yet.
                </p>
                <Button onClick={handleStartApplication} disabled={createApp.isPending}>
                  {createApp.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Starting...</>
                  ) : (
                    "Start Application"
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[application.status] || "secondary"}>
                  {application.status}
                </Badge>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateCoverLetter}
                  disabled={generateCL.isPending}
                >
                  {generateCL.isPending ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Generating...</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5 mr-1" /> Cover Letter</>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleMapFields}
                  disabled={mapFields.isPending}
                >
                  {mapFields.isPending ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Mapping...</>
                  ) : (
                    "Auto-fill Fields"
                  )}
                </Button>
              </div>

              <Tabs defaultValue="cover-letter">
                <TabsList>
                  <TabsTrigger value="cover-letter">Cover Letter</TabsTrigger>
                  <TabsTrigger value="fields">
                    Fields
                    {fieldMappings.some((f) => f.confidence < 0.7) && (
                      <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-accent inline-block" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>

                <TabsContent value="cover-letter">
                  <CoverLetterPanel
                    coverLetter={application.cover_letter}
                    applicationId={application.id}
                  />
                </TabsContent>

                <TabsContent value="fields">
                  <FieldMappingForm mappings={fieldMappings} />
                </TabsContent>

                <TabsContent value="notes">
                  <Card className="border-border/60">
                    <CardContent className="p-4">
                      <Textarea
                        placeholder="Add personal notes about this application..."
                        value={notes || application.notes || ""}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={6}
                      />
                      <Button size="sm" className="mt-3" onClick={handleSaveNotes}>
                        Save Notes
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="flex flex-wrap gap-2">
                {application.status === "draft" && (
                  <Button size="sm" onClick={() => handleStatusChange("ready")}>
                    Mark as Ready
                  </Button>
                )}
                {application.status === "ready" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleStatusChange("draft")}>
                      Back to Draft
                    </Button>
                    <Button size="sm" onClick={() => handleStatusChange("submitted")}>
                      Mark as Submitted
                    </Button>
                  </>
                )}
                {application.status === "submitted" && (
                  <Button size="sm" variant="outline" onClick={() => handleStatusChange("ready")}>
                    Reopen
                  </Button>
                )}
                {application.status === "withdrawn" && (
                  <Button size="sm" variant="outline" onClick={() => handleStatusChange("draft")}>
                    Reopen Application
                  </Button>
                )}
                {(application.status === "draft" || application.status === "ready" || application.status === "submitted") && (
                  <Button size="sm" onClick={() => handleStatusChange("withdrawn")} variant="outline">
                    Withdraw
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <EditJobDialog job={job} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
