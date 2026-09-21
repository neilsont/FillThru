export type AIModel =
  | "gemini-3.5-flash-lite"
  | "openrouter/nemotron-3-super"
  | "openrouter/nemotron-3-ultra"
  | "gemini-3.5-flash"
  | "gpt-4o-mini"
  | "claude-haiku-4-5-20251001";

export type AIProvider = "groq" | "openrouter" | "google" | "openai" | "anthropic";

export interface AIModelConfig {
  id: AIModel;
  name: string;
  provider: AIProvider;
  /** The model id the provider's API expects. */
  remoteId: string;
  providerLabel: string;
  description: string;
  badge: string;
  badgeVariant: "default" | "secondary" | "outline";
  color: string;
  free: boolean;
  /** Extra request-body fields for OpenAI-compatible providers (e.g. OpenRouter's reasoning controls). */
  requestOptions?: Record<string, unknown>;
}

// Order matters: the free fallback chain runs top-to-bottom.
// Adding an OpenRouter model = one entry here. Probe it first with a strict-JSON
// prompt; reasoning models need requestOptions.reasoning.enabled=false or their
// hidden thinking eats the max_tokens budget and the JSON gets cut off.
// Verified live 2026-09-20 — see git history for retired entries (Groq llama-3.3,
// Qwen 3.6 Plus free, DeepSeek V4.1 Flash free, DeepSeek V4 Flash free).
export const AI_MODELS: AIModelConfig[] = [
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash-Lite",
    provider: "google",
    remoteId: "gemini-3.5-flash-lite",
    providerLabel: "Google AI Studio",
    description: "Google's fastest model on the AI Studio free tier. Great for resume parsing, answers, and cover letters.",
    badge: "Free",
    badgeVariant: "default",
    color: "bg-blue-500",
    free: true,
  },
  {
    id: "openrouter/nemotron-3-ultra",
    name: "Nemotron 3 Ultra",
    provider: "openrouter",
    remoteId: "nvidia/nemotron-3-ultra-550b-a55b:free",
    providerLabel: "OpenRouter",
    description: "NVIDIA's largest open model, free on OpenRouter (rate-limited). Strong writing.",
    badge: "Free",
    badgeVariant: "default",
    color: "bg-lime-700",
    free: true,
    requestOptions: { reasoning: { enabled: false } },
  },
  {
    id: "openrouter/nemotron-3-super",
    name: "Nemotron 3 Super",
    provider: "openrouter",
    remoteId: "nvidia/nemotron-3-super-120b-a12b:free",
    providerLabel: "OpenRouter",
    description: "NVIDIA's 120B model, fast and free on OpenRouter (rate-limited).",
    badge: "Free",
    badgeVariant: "default",
    color: "bg-lime-600",
    free: true,
    requestOptions: { reasoning: { enabled: false } },
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "google",
    remoteId: "gemini-3.5-flash",
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
    remoteId: "gpt-4o-mini",
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
    remoteId: "claude-haiku-4-5-20251001",
    providerLabel: "Anthropic",
    description: "Anthropic's fastest model. Requires Anthropic API credits.",
    badge: "Billing req.",
    badgeVariant: "secondary",
    color: "bg-amber-500",
    free: false,
  },
];

export const DEFAULT_MODEL: AIModel = "gemini-3.5-flash-lite";

// The website chat optimises for time-to-first-token rather than strict JSON,
// and Gemini's free tier can queue requests for tens of seconds; Nemotron on
// OpenRouter answers in well under a second. Measured 2026-09-20.
export const CHAT_DEFAULT_MODEL: AIModel = "openrouter/nemotron-3-ultra";
export const CHAT_FALLBACK_ORDER: AIModel[] = [
  "openrouter/nemotron-3-ultra",
  "openrouter/nemotron-3-super",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
];

// IDs that used to exist. Browsers persist the user's pick in localStorage, so a
// retired ID can keep arriving for a long time — map it to the closest live model.
const LEGACY_MODEL_ALIASES: Record<string, AIModel> = {
  "groq/llama-3.3-70b-versatile": DEFAULT_MODEL,
  "openrouter/qwen3.6-plus": "openrouter/nemotron-3-super",
  "openrouter/deepseek-v4-flash": "openrouter/nemotron-3-super",
  "gemini-2.0-flash": "gemini-3.5-flash-lite",
  "gemini-2.5-flash": "gemini-3.5-flash",
  "gemini-2.5-flash-lite": "gemini-3.5-flash-lite",
};

export function getModelConfig(model: AIModel): AIModelConfig {
  const config = AI_MODELS.find((m) => m.id === model);
  if (!config) throw new Error(`Unknown model: ${model}`);
  return config;
}

export function isKnownModel(model: unknown): model is AIModel {
  return typeof model === "string" && AI_MODELS.some((m) => m.id === model);
}

export function normalizeModel(model: unknown): AIModel {
  if (isKnownModel(model)) return model;
  if (typeof model === "string" && model in LEGACY_MODEL_ALIASES) return LEGACY_MODEL_ALIASES[model];
  return DEFAULT_MODEL;
}
