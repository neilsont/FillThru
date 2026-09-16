"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GenerationKind, GenerationRecord, GenerationUsage } from "@/types/generation";

export function useGenerations(kind?: GenerationKind) {
  return useQuery<GenerationRecord[]>({
    queryKey: ["generations", { kind: kind ?? "all" }],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50" });
      if (kind) params.set("kind", kind);
      const res = await fetch(`/api/generations?${params}`);
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
  });
}

export function useGenerationUsage() {
  return useQuery<GenerationUsage>({
    queryKey: ["generations", "usage"],
    queryFn: async () => {
      const res = await fetch("/api/generations/usage");
      if (!res.ok) throw new Error("Failed to fetch usage");
      return res.json();
    },
  });
}

export function useDeleteGeneration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/generations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generations"] });
    },
  });
}
