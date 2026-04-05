export type AIModel = "gemini-2.0-flash" | "gpt-4o-mini";

export interface AIModelConfig {
  id: AIModel;
  name: string;
  provider: "google" | "openai";
  providerLabel: string;
  description: string;
  badge: string;
  badgeVariant: "default" | "secondary" | "outline";
  color: string;
}

export const AI_MODELS: AIModelConfig[] = [
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    providerLabel: "Google",
    description: "Google's latest flash model. Free tier available with high throughput and low latency.",
    badge: "Free",
    badgeVariant: "default",
    color: "bg-blue-500",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    providerLabel: "OpenAI",
    description: "OpenAI's efficient model. Fast, capable, and available on the free tier.",
    badge: "Free",
    badgeVariant: "secondary",
    color: "bg-emerald-500",
  },
];

export const DEFAULT_MODEL: AIModel = "gemini-2.0-flash";
