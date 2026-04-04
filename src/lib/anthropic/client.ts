import Anthropic from "@anthropic-ai/sdk";

export function getAnthropicClient(): Anthropic {
  // AI_GATEWAY_API_KEY takes precedence (Vercel AI Gateway vck_ key)
  // Falls back to direct ANTHROPIC_API_KEY
  const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("No Anthropic API key configured. Set ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY.");
  }
  return new Anthropic({
    apiKey,
    baseURL: process.env.ANTHROPIC_GATEWAY_URL ?? undefined,
  });
}
