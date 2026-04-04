import { getAnthropicClient } from "@/lib/anthropic/client";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { query, location } = await request.json();

    // If MCP is configured, use it; otherwise fall back to AI-generated mock results
    const mcpUrl = process.env.INDEED_MCP_SERVER_URL;
    const mcpToken = process.env.INDEED_MCP_AUTH_TOKEN;

    const client = getAnthropicClient();

    if (mcpUrl && mcpToken) {
      // Use Indeed MCP server via Claude API
      const mcpParams = {
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [
          {
            role: "user" as const,
            content: `Search for job listings matching: "${query}"${location ? ` in ${location}` : ""}. Return the top 10 results. For each result, provide: title, company, location, job_type (full-time/part-time/contract), a brief description, and the URL. Return ONLY a JSON array.`,
          },
        ],
        mcp_servers: [
          {
            type: "url" as const,
            url: mcpUrl,
            name: "indeed-jobs",
            authorization_token: mcpToken,
          },
        ],
        tools: [
          {
            type: "mcp" as const,
            server_label: "indeed-jobs",
          },
        ],
        betas: ["mcp-client-2025-04-04" as const],
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (client.messages.create as any)(mcpParams);

      const textBlock = response.content.find((b: { type: string }) => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        let jsonStr = textBlock.text;
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1];
        try {
          return NextResponse.json(JSON.parse(jsonStr.trim()));
        } catch {
          return NextResponse.json([]);
        }
      }
    }

    // Fallback: generate sample job results with AI
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: "You generate realistic job listings for a job search application. Return ONLY a JSON array, no markdown.",
      messages: [
        {
          role: "user",
          content: `Generate 5 realistic job listings for the search query: "${query}"${location ? ` in ${location}` : ""}. For each, include: title, company, location, job_type (Full-time/Part-time/Contract), description (2-3 sentences), url (use a placeholder like https://example.com/job/ID), and match_score (60-95). Return ONLY a JSON array.`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") {
      let jsonStr = textBlock.text;
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1];
      try {
        return NextResponse.json(JSON.parse(jsonStr.trim()));
      } catch {
        return NextResponse.json([]);
      }
    }

    return NextResponse.json([]);
  } catch (error) {
    console.error("Job search error:", error);
    return NextResponse.json({ error: "Failed to search jobs" }, { status: 500 });
  }
}
