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
import { ArrowLeft, ExternalLink, MapPin, Building2, Briefcase, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { FieldMapping } from "@/types/application";

export function ApplicationDetail({ jobId }: { jobId: string }) {
  const { data: job, isLoading: jobLoading } = useJob(jobId);
  const { data: application, isLoading: appLoading } = useApplication(jobId);
  const createApp = useCreateApplication();
  const updateApp = useUpdateApplication();
  const generateCL = useGenerateCoverLetter();
  const mapFields = useMapFields();
  const { toast } = useToast();
  const [notes, setNotes] = useState("");

  const isLoading = jobLoading || appLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!job) {
    return <p className="text-muted-foreground">Job not found.</p>;
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
      <div className="mb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Job Description */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{job.title}</CardTitle>
                <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" /> {job.company}
                  </span>
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" /> {job.location}
                    </span>
                  )}
                  {job.job_type && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-4 w-4" /> {job.job_type}
                    </span>
                  )}
                </div>
              </div>
              {job.url && (
                <a href={job.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" /> View posting
                  </Button>
                </a>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              {job.description ? (
                <div className="whitespace-pre-wrap text-sm">{job.description}</div>
              ) : (
                <p className="text-muted-foreground italic">No job description provided.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right: Application Panel */}
        <div className="space-y-4">
          {!application ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground mb-4">
                  No application started for this job yet.
                </p>
                <Button onClick={handleStartApplication} disabled={createApp.isPending}>
                  {createApp.isPending ? "Starting..." : "Start Application"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Badge variant={application.status === "submitted" ? "success" : "secondary"}>
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
                    <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Generating...</>
                  ) : (
                    "Generate Cover Letter"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleMapFields}
                  disabled={mapFields.isPending}
                >
                  {mapFields.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Mapping...</>
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
                      <span className="ml-1 h-2 w-2 rounded-full bg-accent inline-block" />
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
                  <Card>
                    <CardContent className="p-4">
                      <Textarea
                        placeholder="Add personal notes about this application..."
                        value={notes || application.notes || ""}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={6}
                      />
                      <Button size="sm" className="mt-2" onClick={handleSaveNotes}>
                        Save Notes
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="flex gap-2">
                {application.status === "draft" && (
                  <Button onClick={() => handleStatusChange("ready")}>
                    Mark as Ready
                  </Button>
                )}
                {application.status === "ready" && (
                  <Button onClick={() => handleStatusChange("submitted")} variant="accent">
                    Mark as Submitted
                  </Button>
                )}
                {(application.status === "draft" || application.status === "ready") && (
                  <Button
                    onClick={() => handleStatusChange("withdrawn")}
                    variant="outline"
                  >
                    Withdraw
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
