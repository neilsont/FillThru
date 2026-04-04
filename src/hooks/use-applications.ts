"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApplicationWithJob } from "@/types/application";

export function useApplications() {
  return useQuery<ApplicationWithJob[]>({
    queryKey: ["applications"],
    queryFn: async () => {
      const res = await fetch("/api/applications?include=job");
      if (!res.ok) throw new Error("Failed to fetch applications");
      return res.json();
    },
  });
}

export function useApplication(jobId: string) {
  return useQuery({
    queryKey: ["application", jobId],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${jobId}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch application");
      return res.json();
    },
  });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { job_id: string }) => {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create application");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["application", variables.job_id] });
    },
  });
}

export function useUpdateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      cover_letter?: string;
      filled_fields_json?: Record<string, unknown>;
      status?: string;
      notes?: string;
    }) => {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update application");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["application"] });
    },
  });
}
