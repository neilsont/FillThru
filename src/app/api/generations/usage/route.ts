import { createClient } from "@/lib/supabase/server";
import { getGenerationUsage } from "@/lib/generations";
import { NextResponse } from "next/server";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// GET /api/generations/usage — rolling 30-day counts by kind and model.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const usage = await getGenerationUsage(user.id, new Date(Date.now() - THIRTY_DAYS_MS));
    return NextResponse.json(usage);
  } catch (error) {
    console.error("Generation usage error:", error);
    return NextResponse.json({ error: "Failed to load usage" }, { status: 500 });
  }
}
