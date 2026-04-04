"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Job } from "@/types/database";

export function useJobs() {
  return useQuery<Job[]>({
    queryKey: ["jobs"],
    queryFn: async () => {
      const res = await fetch("/api/jobs");
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return res.json();
    },
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${id}`);
      if (!res.ok) throw new Error("Failed to fetch job");
      return res.json();
    },
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      title: string;
      company: string;
      location?: string;
      job_type?: string;
      description?: string;
      url?: string;
      source?: string;
      match_score?: number;
    }) => {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create job");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Job>) => {
      const res = await fetch(`/api/jobs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update job");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useSearchJobs() {
  return useMutation({
    mutationFn: async (params: { query: string; location?: string }) => {
      const res = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error("Failed to search jobs");
      return res.json();
    },
  });
}
