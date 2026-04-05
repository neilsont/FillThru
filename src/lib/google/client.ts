import { GoogleGenerativeAI } from "@google/generative-ai";

export function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }
  return new GoogleGenerativeAI(apiKey);
}

export const GEMINI_MODEL = "gemini-2.0-flash";
