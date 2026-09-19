import type { AIModel } from "./types";
import { AI_MODELS, DEFAULT_MODEL, getModelConfig, normalizeModel } from "./types";
import type { ParsedResume } from "@/types/resume";
import type { FieldMapping } from "@/types/application";

export type QuestionAnswerType =
  | "short_answer"
  | "essay"
  | "multiple_choice"
  | "multi_select";

export interface QuestionAnswerContext {
  helpText?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number | null;
  minLength?: number | null;
  isCoverLetter?: boolean;
}

export interface GeneratedQuestionAnswer {
  rewrittenQuestion: string;
  answer: string;
  confidence: "high" | "medium" | "low";
}

// ─── Shared prompts ────────────────────────────────────────────────────────────

const RESUME_SYSTEM = `You are a resume parsing assistant. Extract structured data from the provided resume text and return ONLY a valid JSON object — no markdown, no explanation, no code fences.

The JSON must match this exact schema:
{
  "personal": { "name": string, "email": string, "phone": string, "location": string, "linkedin": string, "website": string },
  "summary": string,
  "experience": [{ "title": string, "company": string, "location": string, "start_date": string, "end_date": string | null, "bullets": string[] }],
  "education": [{ "degree": string, "institution": string, "graduation_date": string, "gpa": string }],
  "skills": string[],
  "certifications": string[]
}
Rules: use "" for missing strings, [] for missing arrays, null for current end_date, do not invent data.`;

const COVER_LETTER_SYSTEM = `You are an expert career coach writing a cover letter. Write a compelling, tailored cover letter that highlights the candidate's relevant experience for this specific role. Do not fabricate experience. Keep it to 3-4 paragraphs. Be professional and concise. Do not include placeholders like [Your Name] — use the actual candidate's name from the resume data.`;

const FIELD_MAPPER_SYSTEM = `You are an application field-filling assistant. Given a job description and candidate data, identify common application fields and fill them from the candidate's resume and supplemental data.
For each field provide: field_key (machine-readable), field_label (human-readable), value (best match or ""), confidence (0.0-1.0), source ("resume"|"supplemental"|"ai_inferred").
Common fields: full name, email, phone, location, linkedin, website, years of experience, current title, desired salary, work authorization, willing to relocate, education level, skills summary.
Return ONLY a JSON object with a "mappings" array. No markdown.`;

// ─── Provider helpers ──────────────────────────────────────────────────────────

async function openaiCompatChat(
  apiKey: string,
  baseURL: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1024,
  extra: Record<string, unknown> = {}
): Promise<string> {
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey, baseURL });
  const res = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    ...extra, // provider-specific fields such as OpenRouter's `reasoning`
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

async function anthropicChat(modelName: string, systemPrompt: string, userPrompt: string, maxTokens = 1024): Promise<string> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: modelName,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("No text response from Anthropic");
  return block.text.trim();
}

async function geminiChat(modelName: string, systemPrompt: string, userPrompt: string, maxTokens = 1024): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  // Vercel has this as GEMINI_API_KEY; local .env uses GOOGLE_AI_STUDIO_API_KEY.
  const key = process.env.GOOGLE_AI_STUDIO_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GOOGLE_AI_STUDIO_API_KEY (or GEMINI_API_KEY) is not set");
  const genAI = new GoogleGenerativeAI(key);
  // Gemini 3.5 Flash thinks before answering and its thinking counts toward
  // maxOutputTokens, so give it headroom rather than the caller's text budget.
  const m = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: { maxOutputTokens: Math.max(maxTokens * 4, 8192) },
  });
  const result = await m.generateContent(userPrompt);
  return result.response.text().trim();
}

const OPENAI_COMPAT: Record<string, { baseURL: string; envKey: string }> = {
  groq: { baseURL: "https://api.groq.com/openai/v1", envKey: "GROQ_AI_API_KEY" },
  openrouter: { baseURL: "https://openrouter.ai/api/v1", envKey: "OPEN_ROUTER_API_KEY" },
  openai: { baseURL: "https://api.openai.com/v1", envKey: "OPENAI_API_KEY" },
};

async function chat(model: AIModel, systemPrompt: string, userPrompt: string, maxTokens = 1024): Promise<string> {
  const config = getModelConfig(model);
  switch (config.provider) {
    case "google":
      return geminiChat(config.remoteId, systemPrompt, userPrompt, maxTokens);
    case "anthropic":
      return anthropicChat(config.remoteId, systemPrompt, userPrompt, maxTokens);
    case "groq":
    case "openrouter":
    case "openai": {
      const { baseURL, envKey } = OPENAI_COMPAT[config.provider];
      const key = process.env[envKey];
      if (!key) throw new Error(`${envKey} is not set`);
      return openaiCompatChat(key, baseURL, config.remoteId, systemPrompt, userPrompt, maxTokens, config.requestOptions ?? {});
    }
    default:
      throw new Error(`Unknown provider for model: ${model}`);
  }
}

export function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function uniqueModels(models: AIModel[]): AIModel[] {
  return Array.from(new Set(models));
}

export function getModelFallbackChain(
  preferredModel: AIModel | string,
  includePaidModels = false
): AIModel[] {
  const fallbackPool = AI_MODELS
    .filter((config) => includePaidModels || config.free)
    .map((config) => config.id);

  return uniqueModels([normalizeModel(preferredModel), ...fallbackPool]);
}

export async function chatWithFallback(
  model: AIModel,
  systemPrompt: string,
  userPrompt: string,
  fallbackModels: AIModel[] = [],
  maxTokens = 1024
): Promise<string> {
  const candidates = uniqueModels([normalizeModel(model), ...fallbackModels]);
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      return await chat(candidate, systemPrompt, userPrompt, maxTokens);
    } catch (error) {
      lastError = error;
      console.error(`AI request failed for model ${candidate}:`, error);
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("No AI models succeeded");
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function parseResumeText(
  rawText: string,
  model: AIModel = DEFAULT_MODEL,
  fallbackModels: AIModel[] = []
): Promise<ParsedResume> {
  const text = await chatWithFallback(
    model,
    RESUME_SYSTEM,
    `Parse the following resume text into the required JSON structure:\n\n${rawText}`,
    fallbackModels
  );
  return JSON.parse(stripCodeFences(text)) as ParsedResume;
}

export async function generateCoverLetter(
  jobDescription: string,
  companyName: string,
  jobTitle: string,
  resume: ParsedResume,
  supplemental: Record<string, string>,
  model: AIModel = DEFAULT_MODEL,
  fallbackModels: AIModel[] = [],
  notes = ""
): Promise<string> {
  return chatWithFallback(
    model,
    COVER_LETTER_SYSTEM,
    `Write a cover letter for the following job application.\n\nJOB TITLE: ${jobTitle}\nCOMPANY: ${companyName}\n\nJOB DESCRIPTION:\n${jobDescription}\n\nCANDIDATE RESUME DATA:\n${JSON.stringify(resume, null, 2)}\n\nADDITIONAL CANDIDATE INFO:\n${JSON.stringify(supplemental, null, 2)}${notes ? `\n\nTHE CANDIDATE ALSO SAID (use this, it overrides the resume where they conflict):\n${notes}` : ""}`,
    fallbackModels
  );
}

export async function mapApplicationFields(
  jobDescription: string,
  resume: ParsedResume,
  supplemental: Record<string, string>,
  model: AIModel = DEFAULT_MODEL,
  fallbackModels: AIModel[] = []
): Promise<FieldMapping[]> {
  const text = await chatWithFallback(
    model,
    FIELD_MAPPER_SYSTEM,
    `JOB DESCRIPTION:\n${jobDescription}\n\nCANDIDATE RESUME:\n${JSON.stringify(resume, null, 2)}\n\nSUPPLEMENTAL ANSWERS:\n${JSON.stringify(supplemental, null, 2)}`,
    fallbackModels
  );
  const jsonStr = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? text;
  const parsed = JSON.parse(stripCodeFences(jsonStr));
  return parsed.mappings as FieldMapping[];
}

const CUSTOM_ANSWER_SYSTEM = `You are an expert AI Career Copilot. You are helping a user fill out a specific job application question.
Use the user's resume and supplemental data to provide the best possible answer to the question.
If the question is multiple choice or a dropdown, return ONLY the exact choice text that applies best.
If the question is an essay or short answer, write a professional, concise response that highlights the user's strengths.
Do not include any prefix like "Here is the answer:". Just return the exact text to enter into the field.

APPLICATION STRATEGY — always act in the candidate's best interest:
- For yes/no or favorable/unfavorable questions (e.g. "Are you willing to relocate?", "Are you authorized to work?"), choose the answer that helps the application unless the candidate has a clear, hard disqualifier.
- For skill or experience questions where the skill is adjacent to the candidate's background, answer positively and confidently.
- Never fabricate hard credentials (specific active licenses, specific degrees not mentioned).
- When in doubt, lean positive. You represent the candidate.`;

const STRUCTURED_CUSTOM_ANSWER_SYSTEM = `You are an expert AI Career Copilot helping a user complete a job application.

Return ONLY valid JSON matching this exact schema:
{
  "rewrittenQuestion": string,
  "answer": string,
  "confidence": "high" | "medium" | "low"
}

Rules:
- "rewrittenQuestion" should be a cleaner, shorter version of the page prompt for display in an extension UI.
- "answer" must be the exact text the user should paste or enter into the field.
- For single-select or multiple-choice questions, use the exact choice text from the provided options.
- For multi-select questions, return the best matching choices separated by commas.
- For essays or cover letters, write a professional response grounded in the candidate resume.
- Do not wrap the JSON in markdown fences.

APPLICATION STRATEGY — always act in the candidate's best interest:
- For yes/no or favorable/unfavorable questions (e.g. "Are you willing to relocate?", "Are you authorized to work?"), choose the answer that helps the application unless the candidate has a clear, hard disqualifier on their resume.
- For skill/experience questions where the skill is plausible given adjacent background, answer yes/positively and set confidence to "medium".
- Never fabricate hard credentials (specific active licenses, certifications, or degrees not on the resume).
- When in doubt, lean positive and set confidence to "medium". You represent the candidate's best interests.`;

function buildQuestionPrompt(
  question: string,
  type: QuestionAnswerType,
  options: string[],
  jobTitle: string,
  companyName: string,
  jobDescription: string,
  resume: ParsedResume,
  supplemental: Record<string, string>,
  context: QuestionAnswerContext = {}
): string {
  const promptParts = [
    `JOB TITLE: ${jobTitle}`,
    `COMPANY: ${companyName}`,
    jobDescription ? `JOB DESCRIPTION:\n${jobDescription.slice(0, 1500)}` : "",
    `CANDIDATE RESUME:\n${JSON.stringify(resume, null, 2)}`,
    `SUPPLEMENTAL DATA:\n${JSON.stringify(supplemental, null, 2)}`,
    "---",
    `QUESTION TO ANSWER: "${question}"`,
    `FIELD TYPE: ${type}`,
    context.helpText ? `HELP TEXT: ${context.helpText}` : "",
    context.placeholder ? `PLACEHOLDER: ${context.placeholder}` : "",
    typeof context.required === "boolean" ? `REQUIRED: ${context.required ? "yes" : "no"}` : "",
    typeof context.maxLength === "number" ? `MAX LENGTH: ${context.maxLength}` : "",
    typeof context.minLength === "number" ? `MIN LENGTH: ${context.minLength}` : "",
    context.isCoverLetter ? "FIELD PURPOSE: cover letter or long-form application response" : "",
    options && options.length > 0
      ? `AVAILABLE OPTIONS (Use exact option text when applicable):\n- ${options.join("\n- ")}`
      : "",
  ];

  return `${promptParts.filter(Boolean).join("\n\n")}\n\nGenerate the exact text to fill into this field:`;
}

function extractJsonObject(text: string): string {
  const cleaned = stripCodeFences(text);
  const match = cleaned.match(/\{[\s\S]*\}/);
  return match ? match[0] : cleaned;
}

function normalizeGeneratedQuestionAnswer(
  parsed: Partial<GeneratedQuestionAnswer> | null | undefined,
  originalQuestion: string
): GeneratedQuestionAnswer {
  const rewrittenQuestion = (parsed?.rewrittenQuestion || originalQuestion).trim();
  const answer = (parsed?.answer || "").trim();
  const confidence = parsed?.confidence === "high" || parsed?.confidence === "low"
    ? parsed.confidence
    : "medium";

  return {
    rewrittenQuestion,
    answer,
    confidence,
  };
}

function getMaxTokensForType(type: QuestionAnswerType, isCoverLetter: boolean): number {
  if (isCoverLetter || type === "essay") return 1024;
  if (type === "short_answer") return 512;
  return 256; // multiple_choice, multi_select
}

export async function generateCustomAnswer(
  question: string,
  type: QuestionAnswerType,
  options: string[],
  jobTitle: string,
  companyName: string,
  jobDescription: string,
  resume: ParsedResume,
  supplemental: Record<string, string>,
  context: QuestionAnswerContext = {},
  model: AIModel = DEFAULT_MODEL,
  fallbackModels: AIModel[] = []
): Promise<string> {
  const maxTokens = getMaxTokensForType(type, Boolean(context.isCoverLetter));
  return chatWithFallback(
    model,
    CUSTOM_ANSWER_SYSTEM,
    buildQuestionPrompt(
      question,
      type,
      options,
      jobTitle,
      companyName,
      jobDescription,
      resume,
      supplemental,
      context
    ),
    fallbackModels,
    maxTokens
  );
}

export async function generateStructuredQuestionAnswer(
  question: string,
  type: QuestionAnswerType,
  options: string[],
  jobTitle: string,
  companyName: string,
  jobDescription: string,
  resume: ParsedResume,
  supplemental: Record<string, string>,
  context: QuestionAnswerContext = {},
  model: AIModel = DEFAULT_MODEL,
  fallbackModels: AIModel[] = []
): Promise<GeneratedQuestionAnswer> {
  const maxTokens = getMaxTokensForType(type, Boolean(context.isCoverLetter));
  try {
    const response = await chatWithFallback(
      model,
      STRUCTURED_CUSTOM_ANSWER_SYSTEM,
      buildQuestionPrompt(
        question,
        type,
        options,
        jobTitle,
        companyName,
        jobDescription,
        resume,
        supplemental,
        context
      ),
      fallbackModels,
      maxTokens
    );

    const parsed = JSON.parse(extractJsonObject(response)) as Partial<GeneratedQuestionAnswer>;
    const normalized = normalizeGeneratedQuestionAnswer(parsed, question);
    if (!normalized.answer) {
      throw new Error("Structured answer was empty");
    }
    return normalized;
  } catch {
    const answer = await generateCustomAnswer(
      question,
      type,
      options,
      jobTitle,
      companyName,
      jobDescription,
      resume,
      supplemental,
      context,
      model,
      fallbackModels
    );

    if (!answer.trim()) {
      throw new Error("AI returned an empty answer");
    }

    return {
      rewrittenQuestion: question.trim(),
      answer: answer.trim(),
      confidence: "medium",
    };
  }
}
