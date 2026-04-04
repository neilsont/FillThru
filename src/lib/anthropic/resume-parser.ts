import { getAnthropicClient } from "./client";
import type { ParsedResume } from "@/types/resume";

export async function parseResumeText(rawText: string): Promise<ParsedResume> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system:
      "You are a resume parsing assistant. Extract structured data from the provided resume text. Be thorough and accurate. If a field is not present in the resume, use an empty string or empty array as appropriate. For end_date, use null if the position is current.",
    messages: [{ role: "user", content: rawText }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from AI");
  }

  // Extract JSON from the response (handle markdown code blocks)
  let jsonStr = textBlock.text;
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  return JSON.parse(jsonStr.trim()) as ParsedResume;
}
