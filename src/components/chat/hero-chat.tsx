"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAIStore } from "@/stores/ai-store";
import { DRAFT_KEY } from "@/hooks/use-chat-session";
import { Composer } from "./composer";

// The chat bar on the landing page. It doesn't talk to the model itself: the
// message is parked in sessionStorage and /chat sends it on arrival — straight
// away for signed-in users, after sign-up/sign-in for everyone else.

const PROMPTS = [
  "Rewrite my résumé summary for a product role",
  "What questions should I expect in a design interview?",
  "Draft a follow-up email after a recruiter screen",
];

export function HeroChat({ isAuthed }: { isAuthed: boolean }) {
  const router = useRouter();
  const { chatModel, setChatModel } = useAIStore();
  const [draft, setDraft] = useState("");
  const [leaving, setLeaving] = useState(false);

  const destination = isAuthed ? "/chat" : `/signup?next=${encodeURIComponent("/chat")}`;

  const go = (text: string) => {
    if (leaving) return;
    setLeaving(true);
    try { if (text.trim()) sessionStorage.setItem(DRAFT_KEY, text.trim()); } catch { /* storage blocked — they can retype */ }
    router.push(destination);
  };

  return (
    <div id="chat" className="mx-auto w-full max-w-3xl scroll-mt-24 text-left">
      <Composer
        value={draft}
        onChange={setDraft}
        onSubmit={() => go(draft)}
        model={chatModel}
        onModelChange={setChatModel}
        pickerDirection="down"
        onPlusClick={() => go(draft)}
        placeholder="Ask anything about your job search…"
        size="lg"
        disabled={leaving}
      />
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            disabled={leaving}
            className="rounded-full border border-border/60 bg-white/60 px-3.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-white hover:text-foreground"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
