"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAIStore } from "@/stores/ai-store";
import type { FieldMapping } from "@/types/application";

export function useGenerateCoverLetter() {
  const queryClient = useQueryClient();
  const { selectedModel } = useAIStore();
  return useMutation<{ cover_letter: string }, Error, string>({
    mutationFn: async (jobId: string) => {
      const res = await fetch("/api/ai/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, model: selectedModel }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error === "subscription_required" ? "Your free trial has ended — subscribe to keep generating." : body.error || "Failed to generate cover letter");
      }
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
  const { selectedModel } = useAIStore();
  return useMutation<{ mappings: FieldMapping[] }, Error, { job_id: string }>({
    mutationFn: async (data) => {
      const res = await fetch("/api/ai/field-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, model: selectedModel }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error === "subscription_required" ? "Your free trial has ended — subscribe to keep using AI features." : body.error || "Failed to map fields");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application"] });
      queryClient.invalidateQueries({ queryKey: ["questions"] });
    },
  });
}
