import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse, after } from "next/server";
import { recordGenerations } from "@/lib/generations";
import type { NewGeneration } from "@/types/generation";
import {
  getModelFallbackChain,
  generateStructuredQuestionAnswer,
  type QuestionAnswerContext,
  type QuestionAnswerType,
} from "@/lib/ai";
import { DEFAULT_MODEL, type AIModel } from "@/lib/ai/types";
import { ParsedResume } from "@/types/resume";
import { isPaidModel, userIsPremium } from "@/lib/subscription";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface ExtensionQuestionRequest extends QuestionAnswerContext {
  id: string;
  label: string;
  type: QuestionAnswerType;
  options?: string[];
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    const {
      questions,
      jobTitle,
      companyName,
      jobDescription,
      model = DEFAULT_MODEL,
    } = await request.json();

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "Missing questions" }, { status: 400, headers: CORS_HEADERS });
    }

    if (questions.length > 25) {
      return NextResponse.json({ error: "Too many questions in one batch" }, { status: 400, headers: CORS_HEADERS });
    }

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    const requestedModel = model as AIModel;
    const isPremium = await userIsPremium(supabase, user.id, user.email);

    if (isPaidModel(requestedModel) && !isPremium) {
      return NextResponse.json({ error: "premium_required" }, { status: 402, headers: CORS_HEADERS });
    }

    const fallbackModels = getModelFallbackChain(requestedModel, isPremium);

    const { data: resumeRow } = await supabase
      .from("resume_data")
      .select("parsed_json")
      .eq("user_id", user.id)
      .single();

    if (!resumeRow?.parsed_json) {
      return NextResponse.json({ error: "No resume found. Please upload a resume first." }, { status: 404, headers: CORS_HEADERS });
    }

    const { data: supplementalRows } = await supabase
      .from("supplemental_answers")
      .select("question_key, answer")
      .eq("user_id", user.id);

    const supplemental: Record<string, string> = {};
    supplementalRows?.forEach((row) => {
      supplemental[row.question_key] = row.answer;
    });

    const answers = [];
    const generations: NewGeneration[] = [];
    for (const question of questions as ExtensionQuestionRequest[]) {
      try {
        const startedAt = Date.now();
        const result = await generateStructuredQuestionAnswer(
          question.label,
          question.type,
          question.options || [],
          jobTitle || "",
          companyName || "",
          jobDescription || "",
          resumeRow.parsed_json as ParsedResume,
          supplemental,
          {
            helpText: question.helpText || "",
            placeholder: question.placeholder || "",
            required: typeof question.required === "boolean" ? question.required : undefined,
            maxLength: typeof question.maxLength === "number" ? question.maxLength : null,
            minLength: typeof question.minLength === "number" ? question.minLength : null,
            isCoverLetter: Boolean(question.isCoverLetter),
          },
          requestedModel,
          fallbackModels
        );

        answers.push({ id: question.id, ...result });
        generations.push({
          userId: user.id,
          kind: "question_answer",
          source: "extension",
          model: requestedModel,
          job: { title: jobTitle, company: companyName },
          durationMs: Date.now() - startedAt,
          input: {
            question: question.label,
            type: question.type,
            options: question.options,
            maxLength: typeof question.maxLength === "number" ? question.maxLength : null,
            minLength: typeof question.minLength === "number" ? question.minLength : null,
            required: typeof question.required === "boolean" ? question.required : undefined,
            isCoverLetter: Boolean(question.isCoverLetter),
          },
          output: result,
        });
      } catch (questionError: unknown) {
        answers.push({
          id: question.id,
          rewrittenQuestion: question.label,
          answer: "",
          confidence: "low",
          error: questionError instanceof Error ? questionError.message : "Failed to generate answer",
        });
      }
    }

    // One insertMany after the response is sent — never adds latency to the batch.
    after(() => recordGenerations(generations));

    return NextResponse.json({ answers }, { headers: CORS_HEADERS });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Answer questions error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
