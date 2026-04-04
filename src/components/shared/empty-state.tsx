import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="relative mb-5">
        <div className="rounded-2xl bg-muted/80 p-5">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-primary/20" />
        <div className="absolute -top-1 -left-1 h-3 w-3 rounded-full bg-accent/20" />
      </div>
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-5 leading-relaxed">{description}</p>
      {actionLabel && actionHref && (
        <Button size="sm" asChild>
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
      {actionLabel && onAction && !actionHref && (
        <Button size="sm" onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}
