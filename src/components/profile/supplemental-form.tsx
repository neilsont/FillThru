"use client";

import { useSupplemental, useSaveSupplemental, useDeleteSupplemental } from "@/hooks/use-supplemental";
import { useToast } from "@/components/ui/toast";
import { SUPPLEMENTAL_QUESTIONS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Plus, Pencil } from "lucide-react";
import { useState, useEffect } from "react";

interface CustomQuestion {
  key: string;
  label: string;
  type: "text" | "select";
  options?: string[];
}

export function SupplementalForm() {
  const { data: answers, isLoading } = useSupplemental();
  const saveMutation = useSaveSupplemental();
  const deleteMutation = useDeleteSupplemental();
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);

  // New question form state
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<"text" | "select">("text");
  const [newOptions, setNewOptions] = useState("");

  // Edit state
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  useEffect(() => {
    if (answers) {
      const map: Record<string, string> = {};
      answers.forEach((a) => { map[a.question_key] = a.answer; });
      setValues(map);
    }
  }, [answers]);

  // Load custom questions from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("cl_custom_questions");
    if (stored) {
      try {
        setCustomQuestions(JSON.parse(stored));
      } catch { /* ignore */ }
    }
  }, []);

  const saveCustomQuestions = (questions: CustomQuestion[]) => {
    setCustomQuestions(questions);
    localStorage.setItem("cl_custom_questions", JSON.stringify(questions));
  };

  const extraQuestions = answers
    ?.filter((a) => a.source === "ai_suggested" && !SUPPLEMENTAL_QUESTIONS.find((q) => q.key === a.question_key) && !customQuestions.find((q) => q.key === a.question_key))
    .map((a) => ({ key: a.question_key, label: a.question_label, type: "text" as const })) ?? [];

  const allQuestions = [...SUPPLEMENTAL_QUESTIONS, ...customQuestions, ...extraQuestions];

  if (isLoading) {
    return (
      <div className="space-y-4 mt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
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

  const handleDelete = (key: string) => {
    setValues((prev) => { const next = { ...prev }; delete next[key]; return next; });
    deleteMutation.mutate(key, {
      onSuccess: () => toast({ title: "Cleared" }),
      onError: () => toast({ title: "Failed to clear", variant: "destructive" }),
    });
  };

  const handleAddCustom = () => {
    if (!newLabel.trim()) return;

    const key = `custom_${newLabel.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}_${Date.now()}`;
    const question: CustomQuestion = {
      key,
      label: newLabel.trim(),
      type: newType,
      ...(newType === "select" && newOptions.trim()
        ? { options: newOptions.split(",").map((o) => o.trim()).filter(Boolean) }
        : {}),
    };

    saveCustomQuestions([...customQuestions, question]);
    setNewLabel("");
    setNewType("text");
    setNewOptions("");
    setShowAddDialog(false);
    toast({ title: "Custom question created" });
  };

  const handleDeleteCustom = (key: string) => {
    saveCustomQuestions(customQuestions.filter((q) => q.key !== key));
    handleDelete(key);
    toast({ title: "Custom question removed" });
  };

  const handleEditCustomLabel = (key: string) => {
    if (!editLabel.trim()) return;
    saveCustomQuestions(customQuestions.map((q) =>
      q.key === key ? { ...q, label: editLabel.trim() } : q
    ));
    setEditingKey(null);
    setEditLabel("");
    toast({ title: "Question updated" });
  };

  const isCustom = (key: string) => customQuestions.some((q) => q.key === key);

  return (
    <Card className="mt-4 border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Supplemental Information</CardTitle>
            <CardDescription className="text-xs">
              Pre-fill common application fields. These answers are reused across all your applications.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddDialog(!showAddDialog)}
            className="shrink-0"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Custom
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* ── Add Custom Question Panel ─────────────────────────────────────── */}
        {showAddDialog && (
          <div className="mb-6 p-4 rounded-xl border border-accent/30 bg-accent/5 space-y-3">
            <h4 className="text-sm font-semibold text-primary">Create Custom Question</h4>

            <div className="space-y-1.5">
              <Label htmlFor="custom-label" className="text-xs">Question Label</Label>
              <Input
                id="custom-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g., Preferred Start Date"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Answer Type</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewType("text")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    newType === "text"
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  Text Input
                </button>
                <button
                  type="button"
                  onClick={() => setNewType("select")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    newType === "select"
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  Dropdown
                </button>
              </div>
            </div>

            {newType === "select" && (
              <div className="space-y-1.5">
                <Label htmlFor="custom-options" className="text-xs">Dropdown Options (comma-separated)</Label>
                <Input
                  id="custom-options"
                  value={newOptions}
                  onChange={(e) => setNewOptions(e.target.value)}
                  placeholder="e.g., Yes, No, Maybe"
                  className="h-9"
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleAddCustom} disabled={!newLabel.trim()}>
                Create Question
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* ── Questions List ─────────────────────────────────────────────────── */}
        <div className="grid gap-4">
          {allQuestions.map((q) => {
            const hasAnswer = !!values[q.key];
            const isFlagged = answers?.some(
              (a) => a.question_key === q.key && a.source === "ai_suggested" && !a.answer
            );
            const custom = isCustom(q.key);

            return (
              <div key={q.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {editingKey === q.key ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="h-7 text-xs w-48"
                          onKeyDown={(e) => { if (e.key === "Enter") handleEditCustomLabel(q.key); }}
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleEditCustomLabel(q.key)}>
                          Save
                        </Button>
                      </div>
                    ) : (
                      <Label htmlFor={q.key} className="text-[13px]">{q.label}</Label>
                    )}
                    {custom && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 text-accent border-accent/30">Custom</Badge>
                    )}
                    {isFlagged && !hasAnswer && (
                      <Badge variant="warning" className="text-[10px] px-1.5 py-0 shrink-0">Needs answer</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5">
                    {custom && editingKey !== q.key && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-primary shrink-0"
                        onClick={() => { setEditingKey(q.key); setEditLabel(q.label); }}
                        title="Edit question"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                    {(hasAnswer || custom) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => custom ? handleDeleteCustom(q.key) : handleDelete(q.key)}
                        title={custom ? "Delete question" : "Clear answer"}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {q.type === "select" && "options" in q && q.options ? (
                  <Select
                    value={values[q.key] || ""}
                    onValueChange={(v) => handleSave(q.key, q.label, v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {q.options.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
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
                    className="h-9"
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
