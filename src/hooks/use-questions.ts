"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { FlaggedQuestionWithJob } from "@/types/question";

export function useQuestions(resolved: boolean = false) {
  return useQuery<FlaggedQuestionWithJob[]>({
    queryKey: ["questions", { resolved }],
    queryFn: async () => {
      const res = await fetch(`/api/questions?resolved=${resolved}`);
      if (!res.ok) throw new Error("Failed to fetch questions");
      return res.json();
    },
    refetchInterval: 30000,
  });
}

export function useResolveQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: string;
      answer: string;
      saveToSupplemental?: boolean;
    }) => {
      const res = await fetch("/api/questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to resolve question");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions"] });
      queryClient.invalidateQueries({ queryKey: ["supplemental"] });
    },
  });
}
