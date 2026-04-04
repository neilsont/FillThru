"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle } from "lucide-react";
import type { FieldMapping } from "@/types/application";

export function FieldMappingForm({ mappings }: { mappings: FieldMapping[] }) {
  if (!mappings.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No fields mapped yet. Click &ldquo;Auto-fill Fields&rdquo; above to let AI fill in your application.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {mappings.map((field) => (
          <div key={field.field_key} className="space-y-1">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                {field.field_label}
              </label>
              <ConfidenceIndicator confidence={field.confidence} />
              <Badge variant="secondary" className="text-[10px]">
                {field.source}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={field.value}
                readOnly
                className={cn(
                  "text-sm",
                  field.confidence < 0.7 && "border-accent"
                )}
              />
              {field.confidence < 0.7 && (
                <AlertTriangle className="h-4 w-4 text-accent shrink-0" />
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const color =
    confidence >= 0.8
      ? "bg-emerald-500"
      : confidence >= 0.7
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="flex items-center gap-1">
      <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full", color)}
          style={{ width: `${confidence * 100}%` }}
        />
      </div>
      {confidence >= 0.8 ? (
        <CheckCircle className="h-3 w-3 text-emerald-500" />
      ) : (
        <span className="text-[10px] text-muted-foreground">
          {Math.round(confidence * 100)}%
        </span>
      )}
    </div>
  );
}
