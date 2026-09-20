"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useJob, useUpdateJob } from "@/hooks/use-jobs";
import { useApplication, useUpdateApplication } from "@/hooks/use-applications";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { EditJobDialog } from "./edit-job-dialog";
import { ArrowLeft, Building2, Copy, ExternalLink, MapPin, Pencil, Trash2 } from "lucide-react";
import type { JobStatus } from "@/types/database";

// The tracker's view of a job. Filling, questions, and cover letters happen on
// the job site through the extension; here you see where it is in your
// pipeline, jump to the page, and keep notes.

const STAGES: { value: JobStatus; label: string }[] = [
  { value: "discovered", label: "Saved" },
  { value: "in_progress", label: "In progress" },
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
];

export function JobSummary({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { data: job, isLoading: jobLoading } = useJob(jobId);
  const { data: application, isLoading: appLoading } = useApplication(jobId);
  const updateJob = useUpdateJob();
  const updateApp = useUpdateApplication();
  const { toast } = useToast();
  const [draft, setDraft] = useState<{ appId: string | null; text: string }>({ appId: null, text: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);


  if (jobLoading || appLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-6 w-40 rounded" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }
  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Job not found.</p>
        <Button variant="outline" size="sm" className="mt-3" asChild><Link href="/dashboard">Back to dashboard</Link></Button>
      </div>
    );
  }

  const setStage = (value: string) =>
    updateJob.mutate({ id: job.id, status: value as JobStatus }, {
      onError: () => toast({ title: "Couldn't update the stage", variant: "destructive" }),
    });

  // Local edits apply to the loaded application; a different one resets to its saved notes.
  const notes = draft.appId === (application?.id ?? null) ? draft.text : (application?.notes ?? "");
  const setNotes = (text: string) => setDraft({ appId: application?.id ?? null, text });

  const saveNotes = () => {
    if (!application) return;
    updateApp.mutate({ id: application.id, notes }, {
      onSuccess: () => toast({ title: "Notes saved" }),
      onError: () => toast({ title: "Couldn't save notes", variant: "destructive" }),
    });
  };

  const copyLetter = async () => {
    if (!application?.cover_letter) return;
    await navigator.clipboard.writeText(application.cover_letter);
    toast({ title: "Cover letter copied" });
  };

  const remove = async () => {
    if (!window.confirm(`Remove "${job.title}" at ${job.company} from your tracker?`)) return;
    setDeleting(true);
    const res = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) { toast({ title: "Job removed" }); router.push("/dashboard"); }
    else toast({ title: "Couldn't remove the job", variant: "destructive" });
  };

  const appliedOn = application?.submitted_at ? new Date(application.submitted_at).toLocaleDateString() : null;
  const savedOn = new Date(job.created_at).toLocaleDateString();

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>

      <Card className="border-border/60">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-snug">{job.title}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1.5">
                <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {job.company}</span>
                {job.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.location}</span>}
                {job.job_type && <Badge variant="secondary" className="text-[10px]">{job.job_type}</Badge>}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)} aria-label="Edit job details">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {job.url && (
              <Button asChild>
                <a href={job.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1.5" /> Open job page
                </a>
              </Button>
            )}
            <Select value={job.status} onValueChange={setStage}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            Saved {savedOn}{appliedOn ? ` · Applied ${appliedOn}` : ""}. Filling, questions, and the cover letter happen on the job page with the Fillthru extension — press ⌥F there.
          </p>
        </CardContent>
      </Card>

      {application?.cover_letter && (
        <Card className="border-border/60 mt-4">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Cover letter</h2>
              <Button variant="outline" size="sm" onClick={copyLetter}><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy</Button>
            </div>
            <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/80 max-h-80 overflow-y-auto">{application.cover_letter}</div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60 mt-4">
        <CardContent className="p-6">
          <h2 className="text-sm font-semibold mb-3">Notes</h2>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Recruiter name, interview dates, what you want to remember…"
            rows={4}
            disabled={!application}
          />
          <div className="flex items-center justify-between mt-3">
            <Button size="sm" onClick={saveNotes} disabled={!application || updateApp.isPending || notes === (application?.notes ?? "")}>
              {updateApp.isPending ? "Saving…" : "Save notes"}
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={remove} disabled={deleting}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove from tracker
            </Button>
          </div>
        </CardContent>
      </Card>

      <EditJobDialog job={job} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
