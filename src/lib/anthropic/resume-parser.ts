import { getAnthropicClient } from "./client";
import type { ParsedResume } from "@/types/resume";

export async function parseResumeText(rawText: string): Promise<ParsedResume> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20251001",
    max_tokens: 4096,
    system: `You are a resume parsing assistant. Extract structured data from the provided resume text and return ONLY a valid JSON object — no markdown, no explanation, no code fences.

The JSON must match this exact schema:
{
  "personal": {
    "name": string,
    "email": string,
    "phone": string,
    "location": string,
    "linkedin": string,
    "website": string
  },
  "summary": string,
  "experience": [
    {
      "title": string,
      "company": string,
      "location": string,
      "start_date": string,
      "end_date": string | null,
      "bullets": string[]
    }
  ],
  "education": [
    {
      "degree": string,
      "institution": string,
      "graduation_date": string,
      "gpa": string
    }
  ],
  "skills": string[],
  "certifications": string[]
}

Rules:
- Use empty string "" for missing string fields (never omit required keys)
- Use empty array [] for missing array fields
- Use null for end_date when the position is current
- Do not invent data not present in the resume`,
    messages: [
      {
        role: "user",
        content: `Parse the following resume text into the required JSON structure:\n\n${rawText}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from AI");
  }

  return JSON.parse(textBlock.text.trim()) as ParsedResume;
}
