"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Paperclip, Rocket } from "lucide-react";
import type { UIMessage } from "@/hooks/use-chat-session";
import { getModelConfig } from "@/lib/ai/types";
import { Markdown } from "./markdown";
import { cn } from "@/lib/utils";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
      }}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
      aria-label="Copy reply"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function AssistantMessage({ message }: { message: UIMessage }) {
  const model = message.model ? getModelConfig(message.model) : null;
  const thinking = message.streaming && !message.content;
  return (
    <div className="group flex gap-3.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm shadow-primary/20">
        <Rocket className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        {thinking ? (
          <div className="flex h-7 items-center gap-1" aria-label="Thinking">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-bounce" />
          </div>
        ) : message.error ? (
          <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-[14px] text-destructive">{message.content}</p>
        ) : (
          <Markdown className={cn(message.streaming && "[&>*:last-child]:after:ml-0.5 [&>*:last-child]:after:inline-block [&>*:last-child]:after:h-[1em] [&>*:last-child]:after:w-[2px] [&>*:last-child]:after:translate-y-[2px] [&>*:last-child]:after:bg-accent [&>*:last-child]:after:content-['']")}>
            {message.content}
          </Markdown>
        )}
        {!message.streaming && !message.error && message.content && (
          <div className="mt-1.5 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <CopyButton text={message.content} />
            {model && <span className="text-[11px] text-muted-foreground/70">{model.name}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function UserMessage({ message }: { message: UIMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-primary px-5 py-3 text-[15px] leading-7 text-white whitespace-pre-wrap break-words shadow-sm shadow-primary/20">
        {message.file && (
          <span className="mb-1 flex items-center gap-1.5 text-[12px] text-white/80">
            <Paperclip className="h-3 w-3" /> {message.file.name}
          </span>
        )}
        {message.content}
      </div>
    </div>
  );
}

export function MessageList({ messages, className }: { messages: UIMessage[]; className?: string }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // Follow the stream unless the reader has scrolled up to re-read something.
  const last = messages[messages.length - 1];
  useEffect(() => {
    if (stickToBottom.current) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [last?.content, messages.length]);

  return (
    <div
      ref={scrollerRef}
      onScroll={() => {
        const el = scrollerRef.current;
        if (!el) return;
        stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      className={cn("overflow-y-auto", className)}
    >
      <div className="mx-auto w-full max-w-3xl space-y-7 px-4 pt-8 pb-6 md:px-6">
        {messages.map((m) => (m.role === "user" ? <UserMessage key={m.id} message={m} /> : <AssistantMessage key={m.id} message={m} />))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
