import type { AIModel } from "./types";
import { getModelConfig, normalizeModel } from "./types";

// Multi-turn, token-streaming counterpart to `chat()` in ./index.ts. Same
// providers, same env keys, same model registry — but the conversation is a
// message list and the reply arrives as it's generated.

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export type StreamEvent =
  | { type: "model"; model: AIModel } // which model is actually answering (after fallback)
  | { type: "text"; text: string };

const OPENAI_COMPAT: Record<string, { baseURL: string; envKey: string }> = {
  groq: { baseURL: "https://api.groq.com/openai/v1", envKey: "GROQ_AI_API_KEY" },
  openrouter: { baseURL: "https://openrouter.ai/api/v1", envKey: "OPEN_ROUTER_API_KEY" },
  openai: { baseURL: "https://api.openai.com/v1", envKey: "OPENAI_API_KEY" },
};

async function* openaiCompatStream(
  apiKey: string,
  baseURL: string,
  model: string,
  system: string,
  messages: ConversationMessage[],
  maxTokens: number,
  extra: Record<string, unknown>
): AsyncGenerator<string> {
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey, baseURL });
  const stream = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    stream: true,
    messages: [{ role: "system", content: system }, ...messages],
    ...extra,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

async function* anthropicStream(model: string, system: string, messages: ConversationMessage[], maxTokens: number): AsyncGenerator<string> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic({ apiKey });
  const stream = client.messages.stream({ model, max_tokens: maxTokens, system, messages });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
  }
}

async function* geminiStream(model: string, system: string, messages: ConversationMessage[], maxTokens: number): AsyncGenerator<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const key = process.env.GOOGLE_AI_STUDIO_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GOOGLE_AI_STUDIO_API_KEY (or GEMINI_API_KEY) is not set");
  const genAI = new GoogleGenerativeAI(key);
  const m = genAI.getGenerativeModel({
    model,
    systemInstruction: system,
    // Gemini's thinking counts toward maxOutputTokens — give it headroom (see geminiChat).
    generationConfig: { maxOutputTokens: Math.max(maxTokens * 4, 8192) },
  });
  const result = await m.generateContentStream({
    contents: messages.map((msg) => ({ role: msg.role === "assistant" ? "model" : "user", parts: [{ text: msg.content }] })),
  });
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

function streamOne(model: AIModel, system: string, messages: ConversationMessage[], maxTokens: number): AsyncGenerator<string> {
  const config = getModelConfig(model);
  switch (config.provider) {
    case "google":
      return geminiStream(config.remoteId, system, messages, maxTokens);
    case "anthropic":
      return anthropicStream(config.remoteId, system, messages, maxTokens);
    case "groq":
    case "openrouter":
    case "openai": {
      const { baseURL, envKey } = OPENAI_COMPAT[config.provider];
      const key = process.env[envKey];
      if (!key) throw new Error(`${envKey} is not set`);
      return openaiCompatStream(key, baseURL, config.remoteId, system, messages, maxTokens, config.requestOptions ?? {});
    }
    default:
      throw new Error(`Unknown provider for model: ${model}`);
  }
}

/**
 * Stream a reply, walking the fallback chain like `chatWithFallback`. A model
 * that fails before producing any text is skipped; once text has started
 * flowing we stay with that model (switching mid-answer would duplicate it).
 */
export async function* streamChatWithFallback(
  model: AIModel,
  system: string,
  messages: ConversationMessage[],
  fallbackModels: AIModel[] = [],
  maxTokens = 2048
): AsyncGenerator<StreamEvent> {
  const candidates = Array.from(new Set([normalizeModel(model), ...fallbackModels]));
  let lastError: unknown = null;

  for (const candidate of candidates) {
    let started = false;
    try {
      for await (const text of streamOne(candidate, system, messages, maxTokens)) {
        if (!started) {
          started = true;
          yield { type: "model", model: candidate };
        }
        yield { type: "text", text };
      }
      if (started) return;
      // Streamed nothing at all (empty/blocked response) — treat as a failure and move on.
      lastError = new Error(`${candidate} returned an empty response`);
    } catch (error) {
      if (started) throw error;
      lastError = error;
      console.error(`AI stream failed for model ${candidate}:`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("No AI models succeeded");
}
