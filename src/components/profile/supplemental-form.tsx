"use client";

import { useSupplemental, useSaveSupplemental } from "@/hooks/use-supplemental";
import { useToast } from "@/components/ui/toast";
import { SUPPLEMENTAL_QUESTIONS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";

export function SupplementalForm() {
  const { data: answers, isLoading } = useSupplemental();
  const saveMutation = useSaveSupplemental();
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});

  // Build the answers map
  useEffect(() => {
    if (answers) {
      const map: Record<string, string> = {};
      answers.forEach((a) => {
        map[a.question_key] = a.answer;
      });
      setValues(map);
    }
  }, [answers]);

  // Find AI-flagged questions not in the standard list
  const extraQuestions = answers
    ?.filter((a) => a.source === "ai_suggested" && !SUPPLEMENTAL_QUESTIONS.find((q) => q.key === a.question_key))
    .map((a) => ({ key: a.question_key, label: a.question_label, type: "text" as const })) ?? [];

  const allQuestions = [...SUPPLEMENTAL_QUESTIONS, ...extraQuestions];

  if (isLoading) {
    return (
      <div className="space-y-4 mt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const handleSave = (key: string, label: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    saveMutation.mutate(
      { question_key: key, question_label: label, answer: value },
      { onSuccess: () => toast({ title: "Saved" }) }
    );
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg">Supplemental Information</CardTitle>
        <CardDescription>
          Pre-fill common application fields. These answers are reused across all your applications.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {allQuestions.map((q) => {
            const hasAnswer = !!values[q.key];
            const isFlagged = answers?.some(
              (a) => a.question_key === q.key && a.source === "ai_suggested" && !a.answer
            );

            return (
              <div key={q.key} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label htmlFor={q.key}>{q.label}</Label>
                  {isFlagged && !hasAnswer && (
                    <Badge variant="warning" className="text-xs">Needs answer</Badge>
                  )}
                </div>
                {q.type === "select" && "options" in q ? (
                  <Select
                    value={values[q.key] || ""}
                    onValueChange={(v) => handleSave(q.key, q.label, v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {q.options!.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={q.key}
                    value={values[q.key] || ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [q.key]: e.target.value }))}
                    onBlur={() => {
                      if (values[q.key]) handleSave(q.key, q.label, values[q.key]);
                    }}
                    placeholder={`Enter ${q.label.toLowerCase()}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
