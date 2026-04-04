"use client";

import { useQuestions, useResolveQuestion } from "@/hooks/use-questions";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, MessageCircleQuestion, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function QuestionsPage() {
  const { data: questions, isLoading } = useQuestions(false);
  const resolveMutation = useResolveQuestion();
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const handleResolve = async (id: string, saveToSupplemental: boolean) => {
    const answer = answers[id];
    if (!answer?.trim()) {
      toast({ title: "Please enter an answer", variant: "destructive" });
      return;
    }

    setSaving((s) => ({ ...s, [id]: true }));
    try {
      await resolveMutation.mutateAsync({ id, answer, saveToSupplemental });
      toast({ title: "Question resolved!" });
    } catch {
      toast({ title: "Failed to resolve", variant: "destructive" });
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
    }
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Pending Questions" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Pending Questions" description="Questions that need your input to complete applications">
        {questions && questions.length > 0 && (
          <Badge variant="warning">{questions.length} pending</Badge>
        )}
      </PageHeader>

      {!questions?.length ? (
        <EmptyState
          icon={CheckCircle2}
          title="All caught up!"
          description="No pending questions. Questions appear here when AI needs more info to fill application fields."
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(
            questions.reduce(
              (acc, q) => {
                const key = q.job?.company
                  ? `${q.job.title} at ${q.job.company}`
                  : "General";
                if (!acc[key]) acc[key] = [];
                acc[key].push(q);
                return acc;
              },
              {} as Record<string, typeof questions>
            )
          ).map(([jobLabel, qs]) => (
            <div key={jobLabel}>
              <div className="flex items-center gap-2 mb-2">
                <MessageCircleQuestion className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">{jobLabel}</h3>
                {qs[0]?.job && (
                  <Link
                    href={`/dashboard/jobs/${qs[0].job_id}`}
                    className="text-primary text-xs hover:underline"
                  >
                    View job
                  </Link>
                )}
              </div>
              <div className="space-y-2">
                {qs.map((q) => (
                  <Card key={q.id} className="border-border/60">
                    <CardContent className="p-4">
                      <p className="font-medium text-sm mb-3">{q.question_text}</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Your answer..."
                          value={answers[q.id] || ""}
                          onChange={(e) =>
                            setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                          }
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleResolve(q.id, true)}
                          disabled={saving[q.id]}
                        >
                          {saving[q.id] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Save & Resolve"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolve(q.id, false)}
                          disabled={saving[q.id]}
                        >
                          Resolve only
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2">
                        &ldquo;Save & Resolve&rdquo; also saves this answer for future applications.
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
