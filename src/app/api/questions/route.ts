import { createClient } from "@/lib/supabase/server";
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
      .select("*, job:jobs(id, title, company)")
      .eq("user_id", user.id)
      .eq("resolved", resolved)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
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

    // Resolve the question (answer is optional — user may just dismiss)
    const { data: question, error } = await supabase
      .from("flagged_questions")
      .update({
        resolved: true,
        ...(answer ? { answer } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Optionally save to supplemental answers for future use
    if (saveToSupplemental && question) {
      await supabase.from("supplemental_answers").upsert(
        {
          user_id: user.id,
          question_key: question.field_key,
          question_label: question.question_text,
          answer,
          source: "ai_suggested",
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

    const { data, error } = await supabase
      .from("flagged_questions")
      .update({
        resolved: true,
        updated_at: new Date().toISOString(),
      })
      .in("id", ids)
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
