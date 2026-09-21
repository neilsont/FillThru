"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useChat, useChats, useDeleteChat } from "@/hooks/use-chats";
import { useToast } from "@/components/ui/toast";
import { ChevronLeft, MessageSquare, MessagesSquare, Paperclip, Trash2 } from "lucide-react";

function timeAgo(value: string | Date) {
  const diff = Date.now() - new Date(value).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(value).toLocaleDateString();
}

function ConversationView({ chatId, onBack }: { chatId: string; onBack: () => void }) {
  const { data: chat, isLoading } = useChat(chatId);
  if (isLoading || !chat) {
    return <Skeleton className="h-64 w-full rounded-lg" />;
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> All conversations
        </Button>
        {chat.host === "fillthru.com" && (
          <Button size="sm" asChild>
            <Link href={`/chat/${chat.chatId}`}><MessagesSquare className="h-3.5 w-3.5 mr-1.5" /> Continue in chat</Link>
          </Button>
        )}
      </div>
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="mb-4">
            <h2 className="font-semibold">{chat.title}</h2>
            <p className="text-xs text-muted-foreground">
              {chat.host ? `On ${chat.host} · ` : ""}{chat.messageCount} messages · {timeAgo(chat.updatedAt)}
            </p>
          </div>
          <div className="space-y-3">
            {chat.messages.map((m, i) => (
              <div key={i} className={`flex ${m.kind === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.kind === "user" ? "bg-primary text-primary-foreground rounded-br-md" : m.error ? "bg-destructive/10 text-destructive rounded-bl-md" : "bg-secondary rounded-bl-md"
                }`}>
                  {m.file && (
                    <div className="flex items-center gap-1.5 text-xs opacity-80 mb-1">
                      <Paperclip className="h-3 w-3" /> {m.file.name}
                    </div>
                  )}
                  {m.text}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function HistoryPage() {
  const { data: chats, isLoading } = useChats();
  const del = useDeleteChat();
  const { toast } = useToast();
  const [open, setOpen] = useState<string | null>(null);

  const remove = (chatId: string | "all") => {
    const ok = chatId === "all" ? window.confirm("Delete every conversation? This can't be undone.") : true;
    if (!ok) return;
    del.mutate(chatId, {
      onSuccess: () => { if (open === chatId || chatId === "all") setOpen(null); toast({ title: chatId === "all" ? "Chat history cleared" : "Conversation deleted" }); },
      onError: () => toast({ title: "Couldn't delete", variant: "destructive" }),
    });
  };

  return (
    <div>
      <PageHeader title="Chat history" description="Every conversation with the Fillthru assistant, from any tab or device">
        {chats && chats.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => remove("all")} disabled={del.isPending}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear history
          </Button>
        )}
      </PageHeader>

      {open ? (
        <ConversationView chatId={open} onBack={() => setOpen(null)} />
      ) : isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : !chats?.length ? (
        <EmptyState
          icon={MessageSquare}
          title="No conversations yet"
          description="Start a chat here on the website, or open Fillthru on any page (⌥F) and ask something. Conversations show up here so you can find them later or clear them."
          actionLabel="Start a chat"
          actionHref="/chat"
        />
      ) : (
        <div className="rounded-lg border border-border/60 bg-white divide-y divide-border/60">
          {chats.map((c) => (
            <div key={c.chatId} className="group flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors">
              <button type="button" className="flex-1 min-w-0 text-left" onClick={() => setOpen(c.chatId)}>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{c.title}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{c.host ? `${c.host} · ` : ""}{timeAgo(c.updatedAt)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{c.preview || `${c.messageCount} messages`}</p>
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                onClick={() => remove(c.chatId)}
                disabled={del.isPending}
                aria-label="Delete conversation"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
