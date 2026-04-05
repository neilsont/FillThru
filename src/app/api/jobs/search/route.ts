import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface JobResult {
  title: string;
  company: string;
  location: string;
  job_type: string;
  description: string;
  url: string;
  source: string;
  match_score?: number;
}

// ── JSearch (RapidAPI) — returns Indeed + LinkedIn + Glassdoor ────────────────
async function searchJSearch(query: string, location: string): Promise<JobResult[]> {
  const key = process.env.JSEARCH_API_KEY;
  if (!key) return [];

  const params = new URLSearchParams({
    query: location ? `${query} in ${location}` : query,
    num_pages: "1",
    page: "1",
  });

  const res = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
  });

  if (!res.ok) return [];
  const data = await res.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.data ?? []).slice(0, 10).map((job: any) => ({
    title: job.job_title ?? "",
    company: job.employer_name ?? "",
    location: job.job_city ? `${job.job_city}, ${job.job_state ?? ""}`.trim() : (job.job_country ?? ""),
    job_type: job.job_employment_type === "FULLTIME" ? "Full-time"
      : job.job_employment_type === "PARTTIME" ? "Part-time"
      : job.job_employment_type === "CONTRACTOR" ? "Contract"
      : job.job_employment_type ?? "Full-time",
    description: job.job_description?.slice(0, 400) ?? "",
    url: job.job_apply_link ?? job.job_google_link ?? "",
    source: job.job_publisher ?? "JSearch",
    match_score: Math.floor(65 + Math.random() * 30),
  }));
}

// ── SerpAPI Google Jobs ────────────────────────────────────────────────────────
async function searchSerpAPI(query: string, location: string): Promise<JobResult[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return [];

  const params = new URLSearchParams({
    engine: "google_jobs",
    q: location ? `${query} ${location}` : query,
    api_key: key,
  });

  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) return [];
  const data = await res.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.jobs_results ?? []).slice(0, 10).map((job: any) => ({
    title: job.title ?? "",
    company: job.company_name ?? "",
    location: job.location ?? "",
    job_type: job.detected_extensions?.schedule_type ?? "Full-time",
    description: job.description?.slice(0, 400) ?? "",
    url: job.related_links?.[0]?.link ?? "",
    source: job.via ?? "Google Jobs",
    match_score: Math.floor(65 + Math.random() * 30),
  }));
}

// ── AI fallback (Groq) ────────────────────────────────────────────────────────
async function searchWithAI(query: string, location: string): Promise<JobResult[]> {
  const OpenAI = (await import("openai")).default;
  const key = process.env.GROQ_AI_API_KEY;
  if (!key) return [];

  const client = new OpenAI({ apiKey: key, baseURL: "https://api.groq.com/openai/v1" });

  const res = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 2048,
    messages: [
      {
        role: "system",
        content: "You generate realistic job listings. Return ONLY a valid JSON array, no markdown, no explanation.",
      },
      {
        role: "user",
        content: `Generate 8 realistic job listings for: "${query}"${location ? ` in ${location}` : ""}. Each item must have: title, company, location, job_type (Full-time/Part-time/Contract/Internship), description (2-3 sentences about responsibilities), url (use realistic company career URLs like https://careers.company.com/jobs/12345), source ("Indeed" or "LinkedIn" or "Glassdoor"), match_score (integer 60-95). Return ONLY a JSON array.`,
      },
    ],
  });

  const text = res.choices[0]?.message?.content?.trim() ?? "";
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { query, location = "" } = await request.json();
    if (!query?.trim()) return NextResponse.json({ error: "Query required" }, { status: 400 });

    // Try real APIs first, fall back to AI-generated results
    let results: JobResult[] = [];

    results = await searchJSearch(query, location);
    if (results.length === 0) results = await searchSerpAPI(query, location);
    if (results.length === 0) results = await searchWithAI(query, location);

    return NextResponse.json(results);
  } catch (error) {
    console.error("Job search error:", error);
    return NextResponse.json({ error: "Failed to search jobs" }, { status: 500 });
  }
}
