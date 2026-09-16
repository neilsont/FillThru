import { createClient } from "@/lib/supabase/server";
import { deleteGeneration, listGenerations } from "@/lib/generations";
import type { GenerationKind } from "@/types/generation";
import { NextRequest, NextResponse } from "next/server";

const KINDS: GenerationKind[] = ["cover_letter", "question_answer", "field_mapping"];

// GET /api/generations?kind=&before=&limit= — the caller's AI generation history.
// Identity comes from the Supabase session cookie; the userId it yields is the
// only thing that scopes the MongoDB query.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const kindParam = params.get("kind");
  const kind = KINDS.includes(kindParam as GenerationKind) ? (kindParam as GenerationKind) : undefined;
  const beforeParam = params.get("before");
  const before = beforeParam ? new Date(beforeParam) : undefined;
  const limit = Number(params.get("limit")) || 20;

  if (before && Number.isNaN(before.getTime())) {
    return NextResponse.json({ error: "Invalid before cursor" }, { status: 400 });
  }

  try {
    const generations = await listGenerations(user.id, { kind, before, limit });
    return NextResponse.json(generations);
  } catch (error) {
    console.error("List generations error:", error);
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }
}

// DELETE /api/generations?id=
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const deleted = await deleteGeneration(user.id, id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete generation error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
