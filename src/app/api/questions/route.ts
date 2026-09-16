import { createClient } from "@/lib/supabase/server";
import {
  dedupePendingQuestions,
  expandPendingQuestionIds,
  getSupplementalQuestionKey,
} from "@/lib/flagged-questions";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const resolved = searchParams.get("resolved") === "true";

    const { data, error } = await supabase
      .from("flagged_questions")
      .select("id, user_id, job_id, question_text, field_key, resolved, answer, created_at, updated_at, job:jobs(id, title, company)")
      .eq("user_id", user.id)
      .eq("resolved", resolved)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (resolved) {
      return NextResponse.json(data);
    }

    const fieldKeys = Array.from(
      new Set(
        (data ?? [])
          .map((row) => row.field_key)
          .filter((value): value is string => Boolean(value))
      )
    );

    let supplementalByKey: Record<string, string> = {};
    if (fieldKeys.length > 0) {
      const { data: supplementalRows, error: supplementalError } = await supabase
        .from("supplemental_answers")
        .select("question_key, answer")
        .eq("user_id", user.id)
        .in("question_key", fieldKeys);

      if (supplementalError) {
        return NextResponse.json({ error: supplementalError.message }, { status: 500 });
      }

      supplementalByKey = Object.fromEntries(
        (supplementalRows ?? []).map((row) => [row.question_key, row.answer])
      );
    }

    return NextResponse.json(dedupePendingQuestions(data ?? [], supplementalByKey));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { job_id, question_text, field_key } = await request.json();

    const { data, error } = await supabase
      .from("flagged_questions")
      .insert({
        user_id: user.id,
        job_id,
        question_text,
        field_key,
        resolved: false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, answer, saveToSupplemental } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const { data: unresolvedRows, error: unresolvedError } = await supabase
      .from("flagged_questions")
      .select("id, user_id, job_id, question_text, field_key, resolved, answer, created_at, updated_at, job:jobs(id, title, company)")
      .eq("user_id", user.id)
      .eq("resolved", false)
      .order("created_at", { ascending: false });

    if (unresolvedError) {
      return NextResponse.json({ error: unresolvedError.message }, { status: 500 });
    }

    const idsToResolve = expandPendingQuestionIds(unresolvedRows ?? [], [id]);
    if (idsToResolve.length === 0) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const representative =
      (unresolvedRows ?? []).find((row) => row.id === id) ||
      (unresolvedRows ?? []).find((row) => idsToResolve.includes(row.id));

    // Resolve the question (answer is optional — user may just dismiss)
    const { data: question, error } = await supabase
      .from("flagged_questions")
      .update({
        resolved: true,
        ...(answer ? { answer } : {}),
        updated_at: new Date().toISOString(),
      })
      .in("id", idsToResolve)
      .eq("user_id", user.id)
      .select()
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Optionally save to supplemental answers for future use
    if (saveToSupplemental && representative && answer?.trim()) {
      const questionKey = getSupplementalQuestionKey(representative);
      await supabase.from("supplemental_answers").upsert(
        {
          user_id: user.id,
          question_key: questionKey,
          question_label: representative.question_text,
          answer,
          source: "manual",
        },
        { onConflict: "user_id,question_key" }
      );
    }

    return NextResponse.json(question);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    const { data: unresolvedRows, error: unresolvedError } = await supabase
      .from("flagged_questions")
      .select("id, user_id, job_id, question_text, field_key, resolved, answer, created_at, updated_at, job:jobs(id, title, company)")
      .eq("user_id", user.id)
      .eq("resolved", false)
      .order("created_at", { ascending: false });

    if (unresolvedError) {
      return NextResponse.json({ error: unresolvedError.message }, { status: 500 });
    }

    const idsToResolve = expandPendingQuestionIds(unresolvedRows ?? [], ids);
    if (idsToResolve.length === 0) {
      return NextResponse.json([]);
    }

    const { data, error } = await supabase
      .from("flagged_questions")
      .update({
        resolved: true,
        updated_at: new Date().toISOString(),
      })
      .in("id", idsToResolve)
      .eq("user_id", user.id)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
