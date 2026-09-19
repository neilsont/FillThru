export type AIModel =
  | "gemini-3.5-flash-lite"
  | "openrouter/deepseek-v4-flash"
  | "gemini-3.5-flash"
  | "gpt-4o-mini"
  | "claude-haiku-4-5-20251001";

export interface AIModelConfig {
  id: AIModel;
  name: string;
  provider: "groq" | "openrouter" | "google" | "openai" | "anthropic";
  providerLabel: string;
  description: string;
  badge: string;
  badgeVariant: "default" | "secondary" | "outline";
  color: string;
  free: boolean;
}

// Order matters: the free fallback chain runs top-to-bottom.
// Verified live 2026-09-18 — see git history for the retired Groq/Qwen entries.
export const AI_MODELS: AIModelConfig[] = [
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash-Lite",
    provider: "google",
    providerLabel: "Google AI Studio",
    description: "Google's fastest model on the AI Studio free tier. Great for resume parsing, answers, and cover letters.",
    badge: "Free",
    badgeVariant: "default",
    color: "bg-blue-500",
    free: true,
  },
  {
    id: "openrouter/deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    provider: "openrouter",
    providerLabel: "OpenRouter",
    description: "DeepSeek's flash model on OpenRouter's free community tier (rate-limited).",
    badge: "Free",
    badgeVariant: "default",
    color: "bg-purple-500",
    free: true,
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "google",
    providerLabel: "Google AI Studio",
    description: "Higher quality than Flash-Lite, a few seconds slower. Same free tier.",
    badge: "Free",
    badgeVariant: "default",
    color: "bg-blue-600",
    free: true,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    providerLabel: "OpenAI",
    description: "OpenAI's efficient model. Requires OpenAI billing/credits.",
    badge: "Billing req.",
    badgeVariant: "secondary",
    color: "bg-emerald-500",
    free: false,
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku",
    provider: "anthropic",
    providerLabel: "Anthropic",
    description: "Anthropic's fastest model. Requires Anthropic API credits.",
    badge: "Billing req.",
    badgeVariant: "secondary",
    color: "bg-amber-500",
    free: false,
  },
];

export const DEFAULT_MODEL: AIModel = "gemini-3.5-flash-lite";

// IDs that used to exist. Browsers persist the user's pick in localStorage, so a
// retired ID can keep arriving for a long time — map it to the closest live model.
const LEGACY_MODEL_ALIASES: Record<string, AIModel> = {
  "groq/llama-3.3-70b-versatile": DEFAULT_MODEL,
  "openrouter/qwen3.6-plus": "openrouter/deepseek-v4-flash",
  "gemini-2.0-flash": "gemini-3.5-flash-lite",
  "gemini-2.5-flash": "gemini-3.5-flash",
  "gemini-2.5-flash-lite": "gemini-3.5-flash-lite",
};

export function isKnownModel(model: unknown): model is AIModel {
  return typeof model === "string" && AI_MODELS.some((m) => m.id === model);
}

export function normalizeModel(model: unknown): AIModel {
  if (isKnownModel(model)) return model;
  if (typeof model === "string" && model in LEGACY_MODEL_ALIASES) return LEGACY_MODEL_ALIASES[model];
  return DEFAULT_MODEL;
}
