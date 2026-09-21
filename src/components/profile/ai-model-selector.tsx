"use client";

import { useAIStore } from "@/stores/ai-store";
import { AI_MODELS } from "@/lib/ai/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ProviderIcon } from "@/components/shared/provider-icon";
import { Bot, CheckCircle2, Lock } from "lucide-react";

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
