import { getAnthropicClient } from "./client";
import type { ParsedResume } from "@/types/resume";
import type { FieldMapping } from "@/types/application";

export async function mapApplicationFields(
  jobDescription: string,
  resume: ParsedResume,
  supplemental: Record<string, string>
): Promise<FieldMapping[]> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20251001",
    max_tokens: 4096,
    system: `You are an application field-filling assistant. Given a job description and candidate data, identify common application fields and fill them from the candidate's resume and supplemental data.

For each field, provide:
- field_key: machine-readable key (e.g., "full_name", "email", "years_experience")
- field_label: human-readable label
- value: the best matching value from candidate data (empty string if not found)
- confidence: 0.0 to 1.0 indicating how confident you are the value is correct
- source: "resume" if from resume, "supplemental" if from supplemental data, "ai_inferred" if you derived it

Common fields to map: full name, email, phone, location/address, linkedin, website/portfolio, years of experience, current title, desired salary, work authorization, willing to relocate, education level, skills summary.

Return ONLY a JSON object with a "mappings" array. No markdown formatting.`,
    messages: [
      {
        role: "user",
        content: `JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME:
${JSON.stringify(resume, null, 2)}

SUPPLEMENTAL ANSWERS:
${JSON.stringify(supplemental, null, 2)}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from AI");
  }

  let jsonStr = textBlock.text;
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  const parsed = JSON.parse(jsonStr.trim());
  return parsed.mappings as FieldMapping[];
}
