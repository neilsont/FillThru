import type { AIModel } from "./types";
import { DEFAULT_MODEL } from "./types";
import type { ParsedResume } from "@/types/resume";
import type { FieldMapping } from "@/types/application";

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

// ─── Gemini helpers ────────────────────────────────────────────────────────────

async function geminiChat(systemPrompt: string, userPrompt: string): Promise<string> {
  const { getGeminiClient, GEMINI_MODEL } = await import("@/lib/google/client");
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction: systemPrompt });
  const result = await model.generateContent(userPrompt);
  return result.response.text().trim();
}

// ─── OpenAI helpers ────────────────────────────────────────────────────────────

async function openaiChat(model: "gpt-4o-mini", systemPrompt: string, userPrompt: string): Promise<string> {
  const { getOpenAIClient } = await import("@/lib/openai/client");
  const client = getOpenAIClient();
  const res = await client.chat.completions.create({
    model,
    max_tokens: 4096,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

// ─── Dispatcher ────────────────────────────────────────────────────────────────

async function chat(model: AIModel, systemPrompt: string, userPrompt: string): Promise<string> {
  if (model === "gemini-2.0-flash") {
    return geminiChat(systemPrompt, userPrompt);
  }
  return openaiChat(model, systemPrompt, userPrompt);
}

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function parseResumeText(rawText: string, model: AIModel = DEFAULT_MODEL): Promise<ParsedResume> {
  const text = await chat(
    model,
    RESUME_SYSTEM,
    `Parse the following resume text into the required JSON structure:\n\n${rawText}`
  );
  return JSON.parse(stripCodeFences(text)) as ParsedResume;
}

export async function generateCoverLetter(
  jobDescription: string,
  companyName: string,
  jobTitle: string,
  resume: ParsedResume,
  supplemental: Record<string, string>,
  model: AIModel = DEFAULT_MODEL
): Promise<string> {
  return chat(
    model,
    COVER_LETTER_SYSTEM,
    `Write a cover letter for the following job application.\n\nJOB TITLE: ${jobTitle}\nCOMPANY: ${companyName}\n\nJOB DESCRIPTION:\n${jobDescription}\n\nCANDIDATE RESUME DATA:\n${JSON.stringify(resume, null, 2)}\n\nADDITIONAL CANDIDATE INFO:\n${JSON.stringify(supplemental, null, 2)}`
  );
}

export async function mapApplicationFields(
  jobDescription: string,
  resume: ParsedResume,
  supplemental: Record<string, string>,
  model: AIModel = DEFAULT_MODEL
): Promise<FieldMapping[]> {
  const text = await chat(
    model,
    FIELD_MAPPER_SYSTEM,
    `JOB DESCRIPTION:\n${jobDescription}\n\nCANDIDATE RESUME:\n${JSON.stringify(resume, null, 2)}\n\nSUPPLEMENTAL ANSWERS:\n${JSON.stringify(supplemental, null, 2)}`
  );
  const jsonStr = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? text;
  const parsed = JSON.parse(jsonStr.trim());
  return parsed.mappings as FieldMapping[];
}
