"use client";

import { useAIStore } from "@/stores/ai-store";
import { AI_MODELS } from "@/lib/ai/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Bot, CheckCircle2, Lock } from "lucide-react";

function ProviderIcon({ provider, className }: { provider: string; className?: string }) {
  if (provider === "google") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    );
  }
  if (provider === "openai") {
    return (
      <svg viewBox="0 0 24 24" className={cn("fill-current", className)} aria-hidden="true">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
      </svg>
    );
  }
  if (provider === "anthropic") {
    return (
      <svg viewBox="0 0 24 24" className={cn("fill-current", className)} aria-hidden="true">
        <path d="M17.304 3.541 13.766 13.5H10.23L6.696 3.541H3L8.196 18h7.608L21 3.541h-3.696z"/>
      </svg>
    );
  }
  if (provider === "groq") {
    return (
      <svg viewBox="0 0 24 24" className={cn("fill-current", className)} aria-hidden="true">
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 4a6 6 0 0 1 6 6 6 6 0 0 1-6 6 6 6 0 0 1-6-6 6 6 0 0 1 6-6zm0 2a4 4 0 0 0-4 4 4 4 0 0 0 4 4 4 4 0 0 0 4-4 4 4 0 0 0-4-4z"/>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={cn("fill-current", className)} aria-hidden="true">
      <path d="M3 12l4-4v3h7.5a4.5 4.5 0 0 1 0 9H12v-2h2.5a2.5 2.5 0 0 0 0-5H7v3L3 12zm18 0l-4 4v-3H9.5a4.5 4.5 0 0 1 0-9H12v2H9.5a2.5 2.5 0 0 0 0 5H17V9l4 3z"/>
    </svg>
  );
}

export function AIModelSelector() {
  const { selectedModel, setModel } = useAIStore();

  return (
    <Card className="mt-4 border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Bot className="h-4 w-4" />
          AI Model
        </CardTitle>
        <CardDescription className="text-xs">
          Choose which AI powers resume parsing, answers, and cover letters. If one is busy, we fall back to the next automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {AI_MODELS.filter((m) => m.free).map((model) => (
          <ModelOption
            key={model.id}
            model={model}
            selected={model.id === selectedModel}
            locked={false}
            onSelect={() => setModel(model.id)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function ModelOption({
  model,
  selected,
  locked,
  onSelect,
}: {
  model: (typeof AI_MODELS)[0];
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={locked}
      className={cn(
        "w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
        locked
          ? "border-border/40 bg-muted/20 opacity-60 cursor-not-allowed"
          : selected
          ? "border-primary/50 bg-primary/5"
          : "border-border/60 hover:border-border hover:bg-muted/40"
      )}
    >
      <div className={cn("flex items-center justify-center h-8 w-8 rounded-md text-white shrink-0", model.color)}>
        <ProviderIcon provider={model.provider} className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-[13px]">{model.name}</span>
          <Badge variant={model.badgeVariant} className="text-[10px] px-1.5 py-0">{model.badge}</Badge>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{model.description}</p>
      </div>
      {locked ? (
        <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
      ) : selected ? (
        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
      ) : null}
    </button>
  );
}
