"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useDeleteGeneration } from "@/hooks/use-generations";
import type { GenerationRecord } from "@/types/generation";
import { ChevronDown, ChevronUp, Copy, Loader2, Trash2 } from "lucide-react";

const KIND_LABEL: Record<GenerationRecord["kind"], string> = {
  cover_letter: "Cover letter",
  question_answer: "Answer",
  field_mapping: "Field mapping",
};

const CONFIDENCE_VARIANT = {
  high: "success",
  medium: "warning",
  low: "destructive",
} as const;

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function copyText(gen: GenerationRecord): string {
  switch (gen.kind) {
    case "cover_letter":
      return gen.output.coverLetter;
    case "question_answer":
      return gen.output.answer;
    case "field_mapping":
      return gen.output.mappings.map((m) => `${m.field_label}: ${m.value}`).join("\n");
  }
}

export function GenerationCard({ generation: gen }: { generation: GenerationRecord }) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const deleteMutation = useDeleteGeneration();

  const jobLabel = gen.job.company
    ? gen.job.title
      ? `${gen.job.title} at ${gen.job.company}`
      : gen.job.company
    : gen.job.title || "Untitled job";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText(gen));
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Couldn't copy", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(gen.id);
      toast({ title: "Deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge variant="secondary">{KIND_LABEL[gen.kind]}</Badge>
              <Badge variant="outline">{gen.source}</Badge>
              {gen.kind === "question_answer" && (
                <Badge variant={CONFIDENCE_VARIANT[gen.output.confidence]}>
                  {gen.output.confidence} confidence
                </Badge>
              )}
              {gen.kind === "field_mapping" && gen.output.lowConfidenceCount > 0 && (
                <Badge variant="warning">{gen.output.lowConfidenceCount} flagged</Badge>
              )}
            </div>
            <p className="text-sm font-medium truncate">{jobLabel}</p>
            <p className="text-xs text-muted-foreground">
              {formatWhen(gen.createdAt)} · {gen.model}
              {typeof gen.durationMs === "number" && ` · ${(gen.durationMs / 1000).toFixed(1)}s`}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={handleCopy} aria-label="Copy">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              aria-label="Delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((e) => !e)}
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {gen.kind === "question_answer" && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
            <span className="font-medium text-foreground">Q:</span> {gen.input.question}
          </p>
        )}

        {expanded && (
          <div className="mt-3 rounded-md bg-muted/50 p-3 text-sm">
            {gen.kind === "cover_letter" && (
              <p className="whitespace-pre-wrap leading-relaxed">{gen.output.coverLetter}</p>
            )}
            {gen.kind === "question_answer" && (
              <p className="whitespace-pre-wrap leading-relaxed">{gen.output.answer}</p>
            )}
            {gen.kind === "field_mapping" && (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                {gen.output.mappings.map((m) => (
                  <div key={m.field_key} className="min-w-0">
                    <dt className="text-xs text-muted-foreground truncate">{m.field_label}</dt>
                    <dd className="truncate">{m.value || <span className="text-muted-foreground italic">—</span>}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
