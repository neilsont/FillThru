import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("resume_data")
      .select("parsed_json")
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "No resume found" }, { status: 404 });
    }

    return NextResponse.json(data.parsed_json);
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

    const updates = await request.json();

    // Fetch existing data and merge
    const { data: existing } = await supabase
      .from("resume_data")
      .select("parsed_json")
      .eq("user_id", user.id)
      .single();

    const merged = { ...(existing?.parsed_json as Record<string, unknown>), ...updates };

    const { error } = await supabase
      .from("resume_data")
      .update({ parsed_json: merged, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(merged);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
