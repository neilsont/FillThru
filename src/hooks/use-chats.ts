"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatDoc, ChatSummary } from "@/lib/chats";

export function useChats() {
  return useQuery<ChatSummary[]>({
    queryKey: ["chats"],
    queryFn: async () => {
      const res = await fetch("/api/chats?limit=100");
      if (!res.ok) throw new Error("Failed to load chat history");
      return (await res.json()).chats;
    },
  });
}

export function useChat(chatId: string | null) {
  return useQuery<ChatDoc>({
    queryKey: ["chat", chatId],
    enabled: Boolean(chatId),
    queryFn: async () => {
      const res = await fetch(`/api/chats/${chatId}`);
      if (!res.ok) throw new Error("Failed to load conversation");
      return (await res.json()).chat;
    },
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (chatId: string | "all") => {
      const res = await fetch(chatId === "all" ? "/api/chats" : `/api/chats/${chatId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chats"] }),
  });
}
