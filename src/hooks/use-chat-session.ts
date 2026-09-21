"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAIStore } from "@/stores/ai-store";
import { useChat } from "@/hooks/use-chats";
import type { AIModel } from "@/lib/ai/types";
import type { ChatAttachment } from "@/lib/ai/assistant";

export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  file?: { name: string; size?: number; type?: string } | null;
  at: number;
  error?: boolean;
  streaming?: boolean;
  /** Which model actually answered (after fallback). */
  model?: AIModel;
}

export interface PendingFile {
  name: string;
  size: number;
  type: string;
  text: string;
}

// The draft a logged-out visitor typed into the landing-page chat bar. It
// rides through login in sessionStorage and is sent as soon as /chat mounts.
export const DRAFT_KEY = "fillthru:chat-draft";

export function newChatId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function useChatSession(initialChatId: string | null) {
  const queryClient = useQueryClient();
  const { chatModel } = useAIStore();
  const [chatId, setChatId] = useState<string | null>(initialChatId);
  const [local, setMessages] = useState<UIMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const attachmentsRef = useRef<ChatAttachment[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // An existing conversation comes from the server; once the user sends
  // something here, the local copy takes over.
  const { data: saved, isLoading: loading, isError: loadFailed } = useChat(initialChatId);
  const hydrated = useMemo<UIMessage[]>(
    () =>
      (saved?.messages ?? []).map((m) => ({
        id: uid(),
        role: m.kind,
        content: m.text,
        file: m.file ? { name: m.file.name, size: m.file.size, type: m.file.type } : null,
        at: m.at ?? new Date(saved!.updatedAt).getTime(),
        error: m.error,
      })),
    [saved]
  );
  const messages = local.length ? local : hydrated;

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Start over in place (used when "New chat" is clicked on an already-fresh page).
  const reset = useCallback(() => {
    abortRef.current?.abort();
    attachmentsRef.current = [];
    setChatId(null);
    setMessages([]);
    setStreaming(false);
    window.history.replaceState(null, "", "/chat");
  }, []);

  const send = useCallback(
    async (text: string, file?: PendingFile | null) => {
      const content = text.trim();
      if ((!content && !file) || streaming) return;

      // First message of a new conversation: mint an id and put it in the URL
      // without a navigation, so the stream keeps running.
      let id = chatId;
      if (!id) {
        id = newChatId();
        setChatId(id);
        window.history.replaceState(null, "", `/chat/${id}`);
      }
      if (file) attachmentsRef.current = [...attachmentsRef.current, { name: file.name, text: file.text }].slice(-6);

      const userMessage: UIMessage = {
        id: uid(),
        role: "user",
        content,
        file: file ? { name: file.name, size: file.size, type: file.type } : null,
        at: Date.now(),
      };
      const assistantId = uid();
      const outgoing = [...messages.filter((m) => !m.error), userMessage];
      setMessages([...messages, userMessage, { id: assistantId, role: "assistant", content: "", at: Date.now(), streaming: true }]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      const patch = (update: Partial<UIMessage>) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, ...update } : m)));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            chatId: id,
            model: chatModel,
            attachments: attachmentsRef.current,
            messages: outgoing.map((m) => ({ role: m.role, content: m.content, file: m.file ?? null, at: m.at })),
          }),
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          const message =
            res.status === 402
              ? "Your free trial has ended — subscribe to keep chatting."
              : res.status === 401
              ? "Please sign in again."
              : body.error || "The assistant hit an error. Please try again.";
          patch({ content: message, error: true, streaming: false });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let reply = "";
        let model: AIModel | undefined;
        const handle = (line: string) => {
          if (!line.trim()) return;
          let event: { type: string; text?: string; model?: AIModel; message?: string };
          try { event = JSON.parse(line); } catch { return; }
          if (event.type === "text" && event.text) {
            reply += event.text;
            patch({ content: reply, model });
          } else if (event.type === "model" && event.model) {
            model = event.model;
            patch({ model });
          } else if (event.type === "error") {
            patch({ content: reply || event.message || "Something went wrong.", error: !reply, streaming: false });
          }
        };
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          lines.forEach(handle);
        }
        if (buffer) handle(buffer);
        patch({ streaming: false });
        if (!reply) patch({ content: "I didn't get a reply. Please try again.", error: true });
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // The user stopped it; keep whatever arrived.
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, streaming: false, content: m.content || "Stopped.", error: !m.content } : m)));
        } else {
          patch({ content: "Lost the connection. Please try again.", error: true, streaming: false });
        }
      } finally {
        abortRef.current = null;
        setStreaming(false);
        // The server persists after the response ends; give it a beat before the sidebar refetches.
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ["chats"] }), 1200);
      }
    },
    [chatId, messages, streaming, chatModel, queryClient]
  );

  return { chatId, messages, streaming, loading: Boolean(initialChatId) && loading && !messages.length, loadFailed, send, stop, reset };
}
