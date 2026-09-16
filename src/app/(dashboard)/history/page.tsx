"use client";

import { useState } from "react";
import { useGenerations, useGenerationUsage } from "@/hooks/use-generations";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { GenerationCard } from "@/components/history/generation-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GenerationKind } from "@/types/generation";
import { History, Sparkles } from "lucide-react";

type Filter = "all" | GenerationKind;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "cover_letter", label: "Cover letters" },
  { value: "question_answer", label: "Answers" },
  { value: "field_mapping", label: "Field mappings" },
];

function StatTile({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        {value === undefined ? (
          <Skeleton className="h-7 w-12 mt-1" />
        ) : (
          <p className="text-2xl font-semibold tracking-tight mt-0.5">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function HistoryPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data: usage } = useGenerationUsage();
  const { data: generations, isLoading } = useGenerations(filter === "all" ? undefined : filter);

  return (
    <div>
      <PageHeader
        title="AI History"
        description="Everything CareerLaunch has generated for you in the last 30 days"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatTile label="Total generations" value={usage?.total} />
        <StatTile label="Cover letters" value={usage?.byKind.cover_letter} />
        <StatTile label="Answers" value={usage?.byKind.question_answer} />
        <StatTile label="Field mappings" value={usage?.byKind.field_mapping} />
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mb-4">
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : !generations?.length ? (
        <EmptyState
          icon={filter === "all" ? Sparkles : History}
          title="Nothing here yet"
          description="Cover letters, answers, and field mappings you generate — from the dashboard or the Chrome extension — will show up here."
          actionLabel="Go to dashboard"
          actionHref="/dashboard"
        />
      ) : (
        <div className="space-y-3">
          {generations.map((gen) => (
            <GenerationCard key={gen.id} generation={gen} />
          ))}
        </div>
      )}
    </div>
  );
}
