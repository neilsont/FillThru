import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  dedupePendingQuestions,
  expandPendingQuestionIds,
  getSupplementalQuestionKey,
} from "@/lib/flagged-questions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
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

    const { data, error: queryError } = await supabase
      .from("flagged_questions")
      .select("id, question_text, field_key, answer, created_at, updated_at, job_id, resolved, job:jobs(id, title, company)")
      .eq("user_id", user.id)
      .eq("resolved", false)
      .order("created_at", { ascending: false });

    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500, headers: CORS_HEADERS });
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
        return NextResponse.json({ error: supplementalError.message }, { status: 500, headers: CORS_HEADERS });
      }

      supplementalByKey = Object.fromEntries(
        (supplementalRows ?? []).map((row) => [row.question_key, row.answer])
      );
    }

    const dedupedAlerts = dedupePendingQuestions(data ?? [], supplementalByKey);
    const actionableAlerts = dedupedAlerts.filter((alert) => alert.actionable);

    return NextResponse.json(
      {
        alerts: dedupedAlerts,
        count: dedupedAlerts.length,
        actionableCount: actionableAlerts.length,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("Extension alert fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
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

    const { job_url, company, blocker_detail } = await request.json();

    await supabase.from("flagged_questions").insert({
      user_id: user.id,
      question_text: blocker_detail ?? `Manual action required on ${company ?? job_url}`,
      field_key: `extension_alert_${Date.now()}`,
      job_id: null,
      resolved: false,
    });

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("Extension alert error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
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

    const { id, ids, answer, field_key, question_text, saveToSupplemental = true } = await request.json();
    const requestedIds = Array.isArray(ids) && ids.length > 0 ? ids : id ? [id] : [];

    if (requestedIds.length === 0) {
      return NextResponse.json({ error: "Missing alert id" }, { status: 400, headers: CORS_HEADERS });
    }

    const { data: unresolvedRows, error: unresolvedError } = await supabase
      .from("flagged_questions")
      .select("id, question_text, field_key, answer, created_at, updated_at, job_id, resolved, job:jobs(id, title, company)")
      .eq("user_id", user.id)
      .eq("resolved", false)
      .order("created_at", { ascending: false });

    if (unresolvedError) {
      return NextResponse.json({ error: unresolvedError.message }, { status: 500, headers: CORS_HEADERS });
    }

    const idsToResolve = expandPendingQuestionIds(unresolvedRows ?? [], requestedIds);
    if (idsToResolve.length === 0) {
      return NextResponse.json({ error: "Pending alert not found" }, { status: 404, headers: CORS_HEADERS });
    }

    const representative =
      (unresolvedRows ?? []).find((row) => requestedIds.includes(row.id)) ||
      (unresolvedRows ?? []).find((row) => idsToResolve.includes(row.id));

    if (!representative) {
      return NextResponse.json({ error: "Pending alert not found" }, { status: 404, headers: CORS_HEADERS });
    }

    if (saveToSupplemental) {
      const questionKey = field_key || representative.field_key || getSupplementalQuestionKey({
        field_key: representative.field_key,
        question_text: question_text || representative.question_text,
      });

      if (!questionKey || !String(answer || "").trim()) {
        return NextResponse.json({ error: "Answer is required" }, { status: 400, headers: CORS_HEADERS });
      }

      const { error: supplementalError } = await supabase
        .from("supplemental_answers")
        .upsert(
          {
            user_id: user.id,
            question_key: questionKey,
            question_label: question_text || representative.question_text,
            answer: String(answer).trim(),
            source: "manual",
          },
          { onConflict: "user_id,question_key" }
        );

      if (supplementalError) {
        return NextResponse.json({ error: supplementalError.message }, { status: 500, headers: CORS_HEADERS });
      }
    }

    const { data: resolvedRows, error: resolveError } = await supabase
      .from("flagged_questions")
      .update({
        resolved: true,
        answer: String(answer || "").trim() || null,
        updated_at: new Date().toISOString(),
      })
      .in("id", idsToResolve)
      .eq("user_id", user.id)
      .select("id");

    if (resolveError) {
      return NextResponse.json({ error: resolveError.message }, { status: 500, headers: CORS_HEADERS });
    }

    return NextResponse.json(
      {
        ok: true,
        resolvedCount: resolvedRows?.length ?? idsToResolve.length,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("Extension alert resolve error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}
