"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { AI_MODELS, getModelConfig, type AIModel } from "@/lib/ai/types";
import { ProviderIcon } from "@/components/shared/provider-icon";
import { cn } from "@/lib/utils";

interface ModelPickerProps {
  value: AIModel;
  onChange: (model: AIModel) => void;
  /** Open the menu above the trigger (for a composer pinned to the bottom). */
  direction?: "up" | "down";
  className?: string;
}

export function ModelPicker({ value, onChange, direction = "up", className }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = getModelConfig(value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
      >
        <span className={cn("flex h-4 w-4 items-center justify-center rounded text-white", current.color)}>
          <ProviderIcon provider={current.provider} className="h-2.5 w-2.5" />
        </span>
        <span className="max-w-[140px] truncate">{current.name}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 opacity-60 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="listbox"
          className={cn(
            "absolute right-0 z-50 w-80 overflow-hidden rounded-2xl border border-border/60 bg-white p-1.5 shadow-xl shadow-primary/10",
            direction === "up" ? "bottom-full mb-2" : "top-full mt-2"
          )}
        >
          <p className="px-3 pt-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Model</p>
          {AI_MODELS.map((m) => {
            const selected = m.id === value;
            return (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => { onChange(m.id); setOpen(false); }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  selected ? "bg-primary/5" : "hover:bg-secondary/70"
                )}
              >
                <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white", m.color)}>
                  <ProviderIcon provider={m.provider} className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-foreground">{m.name}</span>
                    <span className={cn("rounded-full px-1.5 py-px text-[10px] font-semibold", m.free ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground")}>
                      {m.badge}
                    </span>
                  </span>
                  <span className="block text-[12px] leading-snug text-muted-foreground">{m.providerLabel} · {m.description}</span>
                </span>
                {selected && <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />}
              </button>
            );
          })}
          <p className="px-3 pt-2 pb-1.5 text-[11px] leading-snug text-muted-foreground/70">If a model is busy or unavailable, the next free one answers.</p>
        </div>
      )}
    </div>
  );
}
