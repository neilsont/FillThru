"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FieldMapping } from "@/types/application";

export function useGenerateCoverLetter() {
  const queryClient = useQueryClient();
  return useMutation<{ cover_letter: string }, Error, string>({
    mutationFn: async (jobId: string) => {
      const res = await fetch("/api/ai/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
      if (!res.ok) throw new Error("Failed to generate cover letter");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}

export function useMapFields() {
  const queryClient = useQueryClient();
  return useMutation<{ mappings: FieldMapping[] }, Error, { job_id: string }>({
    mutationFn: async (data) => {
      const res = await fetch("/api/ai/field-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to map fields");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application"] });
      queryClient.invalidateQueries({ queryKey: ["questions"] });
    },
  });
}
