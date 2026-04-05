import { getGeminiClient, GEMINI_MODEL } from "@/lib/google/client";
import type { ParsedResume } from "@/types/resume";

export async function generateCoverLetter(
  jobDescription: string,
  companyName: string,
  jobTitle: string,
  resume: ParsedResume,
  supplemental: Record<string, string>
): Promise<string> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction:
      "You are an expert career coach writing a cover letter. Write a compelling, tailored cover letter that highlights the candidate's relevant experience for this specific role. Do not fabricate experience. Keep it to 3-4 paragraphs. Be professional and concise. Do not include placeholders like [Your Name] — use the actual candidate's name from the resume data.",
  });

  const result = await model.generateContent(`Write a cover letter for the following job application.

JOB TITLE: ${jobTitle}
COMPANY: ${companyName}

JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME DATA:
${JSON.stringify(resume, null, 2)}

ADDITIONAL CANDIDATE INFO:
${JSON.stringify(supplemental, null, 2)}`);

  return result.response.text();
}
