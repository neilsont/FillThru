import { cn } from "@/lib/utils";

export function MatchScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "text-emerald-700 bg-emerald-100"
      : score >= 60
        ? "text-amber-700 bg-amber-100"
        : "text-red-700 bg-red-100";

  return (
    <div
      className={cn(
        "flex items-center justify-center h-9 w-9 rounded-full text-xs font-bold shrink-0",
        color
      )}
    >
      {score}%
    </div>
  );
}
