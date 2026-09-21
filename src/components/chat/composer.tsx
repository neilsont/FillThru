"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, Loader2, Mic, MicOff, Paperclip, Plus, Square, X } from "lucide-react";
import type { AIModel } from "@/lib/ai/types";
import { ModelPicker } from "./model-picker";
import { cn } from "@/lib/utils";

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  streaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  model: AIModel;
  onModelChange: (model: AIModel) => void;
  pickerDirection?: "up" | "down";
  /** Called with the chosen file when the user picks one via "+". */
  onAttach?: (file: File) => void;
  /** Overrides the "+" button entirely (e.g. the landing page sends you to /chat). */
  onPlusClick?: () => void;
  pendingFile?: { name: string; uploading?: boolean } | null;
  onRemoveFile?: () => void;
  size?: "lg" | "md";
  className?: string;
}

// Minimal typing for the (webkit-prefixed) Web Speech API.
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function Composer({
  value, onChange, onSubmit, onStop, streaming, disabled, placeholder = "Ask Fillthru anything…", autoFocus,
  model, onModelChange, pickerDirection = "up", onAttach, onPlusClick, pendingFile, onRemoveFile, size = "md", className,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  // Client-only capability check that renders as "no" on the server.
  const canDictate = useSyncExternalStore(() => () => {}, () => Boolean(getSpeechRecognition()), () => false);

  // Grow with the text, up to ~8 lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, [value]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const canSend = !disabled && !pendingFile?.uploading && (value.trim().length > 0 || Boolean(pendingFile));

  const toggleDictation = useCallback(() => {
    if (listening) { recognitionRef.current?.stop(); return; }
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    const base = value ? value.replace(/\s*$/, " ") : "";
    let finals = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finals += r[0].transcript + " ";
        else interim += r[0].transcript;
      }
      onChange((base + finals + interim).replace(/\s+$/, ""));
    };
    rec.onend = () => { setListening(false); recognitionRef.current = null; textareaRef.current?.focus(); };
    rec.onerror = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }, [listening, onChange, value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (streaming) return;
      if (canSend) onSubmit();
    }
  };

  const hasPlus = Boolean(onPlusClick || onAttach);
  const handlePlus = () => {
    if (onPlusClick) onPlusClick();
    else fileRef.current?.click();
  };
  const lg = size === "lg";

  return (
    <div
      className={cn(
        "relative rounded-[28px] border border-border/70 bg-white shadow-[0_8px_40px_-12px_rgba(26,58,92,0.18)] transition-shadow focus-within:border-primary/40 focus-within:shadow-[0_12px_48px_-12px_rgba(26,58,92,0.28)]",
        className
      )}
      onClick={() => textareaRef.current?.focus()}
    >
      {pendingFile && (
        <div className="flex items-center gap-2 px-4 pt-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[12px] font-medium text-foreground">
            {pendingFile.uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
            <span className="max-w-[240px] truncate">{pendingFile.name}</span>
            {onRemoveFile && !pendingFile.uploading && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onRemoveFile(); }} className="ml-0.5 rounded-full p-0.5 hover:bg-black/10" aria-label="Remove file">
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        rows={1}
        aria-label="Message"
        className={cn(
          "block w-full resize-none bg-transparent px-5 text-foreground placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-60",
          lg ? "pt-5 pb-2 text-[17px] leading-7 min-h-[60px]" : "pt-4 pb-2 text-[15px] leading-6 min-h-[48px]"
        )}
      />

      <div className="flex items-center gap-1 px-3 pb-3 pt-1">
        {hasPlus && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handlePlus(); }}
            disabled={disabled}
            title="Attach a file"
            aria-label="Attach a file"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
        {onAttach && (
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.doc,.txt,.md,.csv,.json,image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onAttach(f); e.target.value = ""; }}
          />
        )}

        <div className="ml-auto flex items-center gap-1">
          {canDictate && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleDictation(); }}
              disabled={disabled}
              title={listening ? "Stop dictating" : "Dictate"}
              aria-label={listening ? "Stop dictating" : "Dictate"}
              aria-pressed={listening}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                listening ? "bg-destructive/10 text-destructive animate-pulse" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {listening ? <MicOff className="h-[18px] w-[18px]" /> : <Mic className="h-[18px] w-[18px]" />}
            </button>
          )}
          <ModelPicker value={model} onChange={onModelChange} direction={pickerDirection} />
          {streaming ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onStop?.(); }}
              title="Stop"
              aria-label="Stop generating"
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (canSend) onSubmit(); }}
              disabled={!canSend}
              title="Send"
              aria-label="Send message"
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white shadow-md shadow-accent/30 transition-all hover:bg-accent/90 disabled:bg-secondary disabled:text-muted-foreground/60 disabled:shadow-none"
            >
              <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
