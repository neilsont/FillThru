"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SupplementalAnswer } from "@/types/database";

export function useSupplemental() {
  return useQuery<SupplementalAnswer[]>({
    queryKey: ["supplemental"],
    queryFn: async () => {
      const res = await fetch("/api/supplemental");
      if (!res.ok) throw new Error("Failed to fetch supplemental answers");
      return res.json();
    },
  });
}

export function useSaveSupplemental() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      question_key: string;
      question_label: string;
      answer: string;
    }) => {
      const res = await fetch("/api/supplemental", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save answer");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplemental"] });
    },
  });
}

export function useDeleteSupplemental() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (question_key: string) => {
      const res = await fetch(`/api/supplemental?key=${encodeURIComponent(question_key)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplemental"] });
    },
  });
}
