import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getModelFallbackChain } from "@/lib/ai";
import { normalizeModel } from "@/lib/ai/types";
import { extractApplications } from "@/lib/ai/extract-applications";
import { userIsPremium } from "@/lib/subscription";

// Bulk-import the applications listed on an ATS "My Applications" page into
// the tracker. Existing jobs (same title + company) get their stage updated.

export const maxDuration = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function sourceForUrl(url: string): "indeed" | "linkedin" | "other" {
  try {
    const host = new URL(url).hostname;
    if (/(^|\.)indeed\./.test(host)) return "indeed";
    if (/(^|\.)linkedin\./.test(host)) return "linkedin";
  } catch { /* not a URL */ }
  return "other";
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    if (!(await userIsPremium(supabase, user.id, user.email))) {
      return NextResponse.json({ error: "subscription_required" }, { status: 402, headers: CORS_HEADERS });
    }

    const body = await request.json();
    const pageUrl = String(body.url ?? "").slice(0, 500);
    const company = String(body.company ?? "").trim().slice(0, 200);
    const sections = (Array.isArray(body.sections) ? body.sections : [])
      .filter((s: { text?: unknown }) => s && typeof s.text === "string" && s.text.trim())
      .slice(0, 4)
      .map((s: { tab?: unknown; text: string }) => ({ tab: String(s.tab ?? ""), text: s.text }));
    const links: { title: string; href: string }[] = (Array.isArray(body.links) ? body.links : [])
      .filter((l: { title?: unknown; href?: unknown }) => l && typeof l.title === "string" && typeof l.href === "string")
      .slice(0, 100);
    if (!sections.length) {
      return NextResponse.json({ error: "No application list found on this page" }, { status: 400, headers: CORS_HEADERS });
    }

    const model = normalizeModel(body.model);
    const rows = await extractApplications({ company, sections, model, fallbackModels: getModelFallbackChain(model, true) });
    if (!rows.length) {
      return NextResponse.json({ imported: 0, updated: 0, items: [] }, { headers: CORS_HEADERS });
    }

    let imported = 0;
    let updated = 0;
    const items: { title: string; company: string; status: string; action: "imported" | "updated" }[] = [];
    const base = pageUrl.split("#")[0];

    for (const row of rows) {
      const jobCompany = row.company || company || "Unknown Company";
      const link = links.find((l) => l.title.trim().toLowerCase() === row.title.toLowerCase());
      const url = link?.href ? new URL(link.href, base || undefined).toString() : `${base}#app-${slug(`${row.title}-${jobCompany}`)}`;

      const { data: existing } = await supabase
        .from("jobs")
        .select("id, status")
        .eq("user_id", user.id)
        .ilike("title", row.title)
        .ilike("company", jobCompany)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const now = new Date().toISOString();
      let jobId: string;
      if (existing) {
        jobId = existing.id;
        if (existing.status !== row.status) {
          await supabase.from("jobs").update({ status: row.status, updated_at: now }).eq("id", jobId).eq("user_id", user.id);
        }
        updated += 1;
        items.push({ title: row.title, company: jobCompany, status: row.status, action: "updated" });
      } else {
        const { data: created, error: insertError } = await supabase
          .from("jobs")
          .insert({ user_id: user.id, title: row.title, company: jobCompany, location: row.location, url, source: sourceForUrl(url), status: row.status })
          .select("id")
          .single();
        if (insertError || !created) { console.error("import insert failed:", insertError); continue; }
        jobId = created.id;
        imported += 1;
        items.push({ title: row.title, company: jobCompany, status: row.status, action: "imported" });
      }

      // Application record: these were all submitted on the ATS.
      const submittedAt = row.appliedOn ? new Date(row.appliedOn).toISOString() : now;
      const appStatus = row.status === "in_progress" ? "draft" : "submitted";
      await supabase.from("applications").upsert(
        { user_id: user.id, job_id: jobId, status: appStatus, submitted_at: appStatus === "submitted" ? submittedAt : null, notes: row.statusText ? `${jobCompany} status: ${row.statusText}` : null, updated_at: now },
        { onConflict: "user_id,job_id" }
      );
    }

    return NextResponse.json({ imported, updated, items }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("import-applications error:", err);
    return NextResponse.json({ error: "Couldn't import applications" }, { status: 500, headers: CORS_HEADERS });
  }
}
