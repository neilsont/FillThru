"use client";

import Link from "next/link";
import { LayoutDashboard, MessageSquare, PanelLeftClose, Rocket, SquarePen, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useChats, useDeleteChat } from "@/hooks/use-chats";
import type { ChatSummary } from "@/lib/chats";
import { cn } from "@/lib/utils";

interface ChatSidebarProps {
  activeChatId: string | null;
  /** Title for the conversation in progress, so it appears before the server has saved it. */
  activeTitle?: string | null;
  email: string;
  onNewChat: () => void;
  onClose?: () => void;
  className?: string;
}

function bucket(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (d.getTime() >= startOfToday) return "Today";
  if (d.getTime() >= startOfToday - day) return "Yesterday";
  if (d.getTime() >= startOfToday - 7 * day) return "Previous 7 days";
  if (d.getTime() >= startOfToday - 30 * day) return "Previous 30 days";
  return "Older";
}

const ORDER = ["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"];

export function ChatSidebar({ activeChatId, activeTitle, email, onNewChat, onClose, className }: ChatSidebarProps) {
  const { data: chats, isLoading } = useChats();
  const del = useDeleteChat();
  const { toast } = useToast();

  // Show the in-progress conversation at the top until the server list catches up.
  const list: ChatSummary[] = [...(chats ?? [])];
  if (activeChatId && activeTitle && !list.some((c) => c.chatId === activeChatId)) {
    list.unshift({ chatId: activeChatId, host: "fillthru.com", title: activeTitle, preview: "", messageCount: 1, updatedAt: new Date(), createdAt: new Date() });
  }
  const groups = new Map<string, ChatSummary[]>();
  for (const c of list) {
    const key = bucket(c.updatedAt);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }

  const remove = (chatId: string) => {
    del.mutate(chatId, {
      onSuccess: () => { if (chatId === activeChatId) onNewChat(); },
      onError: () => toast({ title: "Couldn't delete that conversation", variant: "destructive" }),
    });
  };

  return (
    <aside className={cn("flex h-full w-72 flex-col bg-[#f4f1eb] border-r border-border/60", className)}>
      <div className="flex h-14 items-center justify-between px-3">
        <Link href="/" className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-black/5 transition-colors">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <Rocket className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-bold tracking-tight text-primary">Fillthru</span>
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-black/5 hover:text-foreground" aria-label="Close sidebar">
            <PanelLeftClose className="h-4 w-4 hidden md:block" />
            <X className="h-4 w-4 md:hidden" />
          </button>
        )}
      </div>

      <div className="px-3 pb-2">
        <Button variant="outline" className="w-full justify-start rounded-xl bg-white/70 border-border/60 hover:bg-white" onClick={onNewChat}>
          <SquarePen className="h-4 w-4" /> New chat
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {isLoading ? (
          <div className="space-y-2 px-1 pt-2">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full rounded-lg bg-black/5" />)}
          </div>
        ) : list.length === 0 ? (
          <div className="px-3 pt-8 text-center">
            <MessageSquare className="mx-auto mb-2 h-5 w-5 text-muted-foreground/50" />
            <p className="text-[12px] leading-snug text-muted-foreground">Your conversations will show up here — from this page and from the extension.</p>
          </div>
        ) : (
          ORDER.filter((k) => groups.has(k)).map((key) => (
            <div key={key} className="mb-3">
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">{key}</p>
              {groups.get(key)!.map((c) => {
                const active = c.chatId === activeChatId;
                return (
                  <div key={c.chatId} className={cn("group relative flex items-center rounded-lg transition-colors", active ? "bg-white shadow-sm" : "hover:bg-black/5")}>
                    <Link href={`/chat/${c.chatId}`} onClick={onClose} className="min-w-0 flex-1 px-3 py-2" title={c.title}>
                      <span className={cn("block truncate text-[13px]", active ? "font-medium text-foreground" : "text-foreground/80")}>{c.title}</span>
                      {c.host && c.host !== "fillthru.com" && <span className="block truncate text-[11px] text-muted-foreground/70">via extension · {c.host}</span>}
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(c.chatId)}
                      disabled={del.isPending}
                      className="mr-1 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-black/5 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </nav>

      <div className="border-t border-border/60 p-3">
        <Link href="/dashboard" className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] font-medium text-foreground/80 hover:bg-black/5 transition-colors">
          <LayoutDashboard className="h-4 w-4 text-primary" /> Dashboard
        </Link>
        <p className="truncate px-2 pt-1 text-[11px] text-muted-foreground/70" title={email}>{email}</p>
      </div>
    </aside>
  );
}
