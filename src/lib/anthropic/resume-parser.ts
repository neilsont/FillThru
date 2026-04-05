import { getGeminiClient, GEMINI_MODEL } from "@/lib/google/client";
import type { ParsedResume } from "@/types/resume";

const SYSTEM_PROMPT = `You are a resume parsing assistant. Extract structured data from the provided resume text and return ONLY a valid JSON object — no markdown, no explanation, no code fences.

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
- Do not invent data not present in the resume`;

export async function parseResumeText(rawText: string): Promise<ParsedResume> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: SYSTEM_PROMPT,
  });

  const result = await model.generateContent(
    `Parse the following resume text into the required JSON structure:\n\n${rawText}`
  );

  const text = result.response.text().trim();

  // Strip markdown code fences if the model wraps in them despite instructions
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  return JSON.parse(cleaned) as ParsedResume;
}
