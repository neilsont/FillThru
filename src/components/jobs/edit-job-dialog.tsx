"use client";

import { useState, useEffect } from "react";
import { useUpdateJob } from "@/hooks/use-jobs";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { Job } from "@/types/database";

export function EditJobDialog({
  job,
  open,
  onOpenChange,
}: {
  job: Job;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState({
    title: job.title ?? "",
    company: job.company ?? "",
    location: job.location ?? "",
    job_type: job.job_type ?? "",
    url: job.url ?? "",
    description: job.description ?? "",
  });
  const updateJob = useUpdateJob();
  const { toast } = useToast();

  // Sync form when job prop changes
  useEffect(() => {
    setForm({
      title: job.title ?? "",
      company: job.company ?? "",
      location: job.location ?? "",
      job_type: job.job_type ?? "",
      url: job.url ?? "",
      description: job.description ?? "",
    });
  }, [job]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.company) return;
    try {
      await updateJob.mutateAsync({ id: job.id, ...form });
      toast({ title: "Job updated" });
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to update job", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit job</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-title" className="text-xs">Job Title *</Label>
              <Input id="edit-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-company" className="text-xs">Company *</Label>
              <Input id="edit-company" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} required className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-location" className="text-xs">Location</Label>
              <Input id="edit-location" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Job Type</Label>
              <Select value={form.job_type} onValueChange={(v) => setForm((f) => ({ ...f, job_type: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Full-time">Full-time</SelectItem>
                  <SelectItem value="Part-time">Part-time</SelectItem>
                  <SelectItem value="Contract">Contract</SelectItem>
                  <SelectItem value="Internship">Internship</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-url" className="text-xs">URL</Label>
            <Input id="edit-url" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://..." className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-description" className="text-xs">Description</Label>
            <Textarea id="edit-description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={updateJob.isPending}>
              {updateJob.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Saving...</> : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
