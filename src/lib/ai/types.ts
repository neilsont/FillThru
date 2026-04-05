export type AIModel =
  | "groq/llama-3.3-70b-versatile"
  | "openrouter/qwen3.6-plus"
  | "gemini-2.0-flash"
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

export const AI_MODELS: AIModelConfig[] = [
  {
    id: "groq/llama-3.3-70b-versatile",
    name: "Llama 3.3 70B",
    provider: "groq",
    providerLabel: "Groq",
    description: "Fast open-source model via Groq's free tier. Excellent for resume parsing and cover letters.",
    badge: "Free",
    badgeVariant: "default",
    color: "bg-orange-500",
    free: true,
  },
  {
    id: "openrouter/qwen3.6-plus",
    name: "Qwen 3.6 Plus",
    provider: "openrouter",
    providerLabel: "OpenRouter",
    description: "Alibaba's powerful model available free via OpenRouter.",
    badge: "Free",
    badgeVariant: "default",
    color: "bg-purple-500",
    free: true,
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    providerLabel: "Google AI Studio",
    description: "Google's fast flash model. Requires billing enabled on Google Cloud.",
    badge: "Billing req.",
    badgeVariant: "secondary",
    color: "bg-blue-500",
    free: false,
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

export const DEFAULT_MODEL: AIModel = "groq/llama-3.3-70b-versatile";
