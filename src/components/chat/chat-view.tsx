"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, PanelLeftOpen } from "lucide-react";
import { useAIStore } from "@/stores/ai-store";
import { useToast } from "@/components/ui/toast";
import { DRAFT_KEY, useChatSession, type PendingFile } from "@/hooks/use-chat-session";
import { titleFromMessage } from "@/lib/ai/web-assistant";
import { ChatSidebar } from "./chat-sidebar";
import { Composer } from "./composer";
import { MessageList } from "./message-list";
import { cn } from "@/lib/utils";

interface ChatViewProps {
  initialChatId: string | null;
  email: string;
  firstName: string | null;
}

const SUGGESTIONS = [
  "Tailor my résumé summary to a job I'm tracking",
  "Draft a cover letter for my most recent application",
  "Run a mock interview for a role on my board",
  "What should I follow up on this week?",
];

function greeting(name: string | null): string {
  const h = new Date().getHours();
  const time = h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return name ? `${time}, ${name}.` : `${time}.`;
}

export function ChatView({ initialChatId, email, firstName }: ChatViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { chatModel, setChatModel } = useAIStore();
  const session = useChatSession(initialChatId);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<(PendingFile & { uploading?: boolean }) | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const sentDraft = useRef(false);

  // A message typed on the landing page (possibly before signing in) is waiting for us.
  useEffect(() => {
    if (initialChatId || sentDraft.current) return;
    let saved: string | null = null;
    try { saved = sessionStorage.getItem(DRAFT_KEY); sessionStorage.removeItem(DRAFT_KEY); } catch { /* storage blocked */ }
    if (saved?.trim()) {
      sentDraft.current = true;
      void session.send(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChatId]);

  const submit = () => {
    if (!draft.trim() && !pending) return;
    if (pending?.uploading) return;
    const file = pending;
    setDraft("");
    setPending(null);
    void session.send(draft, file);
  };

  const attach = async (file: File) => {
    setPending({ name: file.name, size: file.size, type: file.type, text: "", uploading: true });
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/chat/attachments", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(res.status === 402 ? "Your free trial has ended — subscribe to keep chatting." : body.error || "Couldn't read that file.");
      setPending({ name: file.name, size: file.size, type: file.type, text: body.text });
    } catch (err) {
      setPending(null);
      toast({ title: "Couldn't attach that file", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const newChat = () => {
    setMobileOpen(false);
    if (initialChatId) router.push("/chat");
    else session.reset();
  };

  const firstUser = session.messages.find((m) => m.role === "user");
  const activeTitle = firstUser ? titleFromMessage(firstUser.content || firstUser.file?.name || "") : null;
  const empty = session.messages.length === 0 && !session.loading;

  const composer = (
    <Composer
      value={draft}
      onChange={setDraft}
      onSubmit={submit}
      onStop={session.stop}
      streaming={session.streaming}
      model={chatModel}
      onModelChange={setChatModel}
      onAttach={attach}
      pendingFile={pending}
      onRemoveFile={() => setPending(null)}
      placeholder={empty ? "How can I help you today?" : "Reply…"}
      size={empty ? "lg" : "md"}
      autoFocus
    />
  );

  return (
    <div className="flex h-dvh bg-[#faf9f6] text-foreground">
      {/* Mobile drawer */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />}
      <div className={cn("fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:hidden", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <ChatSidebar activeChatId={session.chatId} activeTitle={activeTitle} email={email} onNewChat={newChat} onClose={() => setMobileOpen(false)} />
      </div>
      {/* Desktop sidebar */}
      {!collapsed && (
        <ChatSidebar activeChatId={session.chatId} activeTitle={activeTitle} email={email} onNewChat={newChat} onClose={() => setCollapsed(true)} className="hidden md:flex shrink-0" />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 px-3 md:px-4">
          <button type="button" onClick={() => setMobileOpen(true)} className="rounded-md p-2 text-muted-foreground hover:bg-black/5 md:hidden" aria-label="Open conversations">
            <Menu className="h-5 w-5" />
          </button>
          {collapsed && (
            <button type="button" onClick={() => setCollapsed(false)} className="hidden rounded-md p-2 text-muted-foreground hover:bg-black/5 md:block" aria-label="Show conversations">
              <PanelLeftOpen className="h-5 w-5" />
            </button>
          )}
          {activeTitle && <h1 className="min-w-0 truncate text-[14px] font-medium text-foreground/80">{activeTitle}</h1>}
        </header>

        {session.loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading conversation…</div>
        ) : session.loadFailed && session.messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-muted-foreground">That conversation couldn&apos;t be found.</p>
            <button type="button" onClick={newChat} className="text-sm font-medium text-primary hover:underline">Start a new chat</button>
          </div>
        ) : empty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
            <div className="w-full max-w-3xl">
              <h1 className="mb-8 text-center text-3xl font-semibold tracking-tight text-primary md:text-4xl">{greeting(firstName)}</h1>
              {composer}
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setDraft(""); void session.send(s); }}
                    className="rounded-full border border-border/70 bg-white/70 px-4 py-2 text-[13px] text-foreground/80 transition-colors hover:border-primary/40 hover:bg-white hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <MessageList messages={session.messages} className="flex-1" />
            <div className="shrink-0 px-3 pb-3 md:px-6 md:pb-5">
              <div className="mx-auto w-full max-w-3xl">
                {composer}
                <p className="mt-2 text-center text-[11px] text-muted-foreground/70">Fillthru can make mistakes. Check important details before you send them to an employer.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
