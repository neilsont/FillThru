import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function LoadingSpinner({ className, text }: { className?: string; text?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 gap-3", className)}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}
