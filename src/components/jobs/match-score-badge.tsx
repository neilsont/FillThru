import { cn } from "@/lib/utils";

export function MatchScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "text-emerald-700 bg-emerald-50 ring-emerald-200"
      : score >= 60
        ? "text-amber-700 bg-amber-50 ring-amber-200"
        : "text-red-700 bg-red-50 ring-red-200";

  return (
    <div
      className={cn(
        "flex items-center justify-center h-8 w-8 rounded-full text-[11px] font-bold shrink-0 ring-1",
        color
      )}
    >
      {score}
    </div>
  );
}
