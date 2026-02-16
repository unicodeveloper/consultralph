import { NextRequest, NextResponse } from "next/server";
import { Valyu } from "valyu-js";
import { isSelfHostedMode } from "@/app/lib/app-mode";

const VALYU_APP_URL = process.env.VALYU_APP_URL || "https://platform.valyu.ai";

const getValyuApiKey = () => {
  const apiKey = process.env.VALYU_API_KEY;
  if (!apiKey) {
    throw new Error("VALYU_API_KEY environment variable is required");
  }
  return apiKey;
};

/**
 * Extract a human-readable title from the full research query prompt.
 * Matches patterns like:
 *   "Conduct comprehensive due diligence research on {subject}."
 *   "Conduct comprehensive market analysis research on the {subject} market."
 *   "Conduct comprehensive competitive landscape analysis for the {subject} space."
 *   "Conduct comprehensive industry overview research on the {subject} industry."
 *   "Conduct comprehensive research on: {subject}"
 */
function extractTitleFromQuery(query: string): string {
  const patterns: [RegExp, string][] = [
    [/Conduct comprehensive due diligence research on (.+?)\./, "Company: "],
    [/Conduct comprehensive market analysis research on the (.+?) market\./, "Market: "],
    [/Conduct comprehensive competitive landscape analysis for the (.+?) space\./, "Competitive: "],
    [/Conduct comprehensive industry overview research on the (.+?) industry\./, "Industry: "],
    [/Conduct comprehensive research on:\s*(.+)/, ""],
  ];

  for (const [pattern, prefix] of patterns) {
    const match = query.match(pattern);
    if (match) return `${prefix}${match[1].trim()}`;
  }

  // Fallback: first line, truncated
  const firstLine = query.trim().split("\n")[0];
  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;
}

async function listViaProxy(
  accessToken: string,
  limit: number
): Promise<{ tasks?: unknown[]; error?: string; status?: number }> {
  const proxyUrl = `${VALYU_APP_URL}/api/oauth/proxy`;

  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path: `/v1/deepresearch/list?limit=${limit}`,
      method: "GET",
    }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return { error: "Session expired. Please sign in again.", status: 401 };
    }
    return { error: `API call failed: ${response.status}`, status: response.status };
  }

  // OAuth proxy returns the raw upstream response (an array of tasks)
  const data = await response.json();
  return { tasks: Array.isArray(data) ? data : (data.data || []) };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accessToken = searchParams.get("accessToken");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const selfHosted = isSelfHostedMode();

    if (!selfHosted && !accessToken) {
      return NextResponse.json(
        { error: "Authentication required", requiresReauth: true },
        { status: 401 }
      );
    }

    let tasks: unknown[] = [];

    if (!selfHosted && accessToken) {
      const result = await listViaProxy(accessToken, limit);
      if (result.error) {
        const status = result.status === 401 ? 401 : 500;
        const body: Record<string, unknown> = { error: result.error };
        if (status === 401) {
          body.requiresReauth = true;
        }
        return NextResponse.json(body, { status });
      }
      tasks = result.tasks || [];
    } else {
      const apiKeyId = process.env.VALYU_API_KEY_ID;
      if (!apiKeyId) {
        return NextResponse.json(
          { error: "VALYU_API_KEY_ID environment variable is required for listing research" },
          { status: 500 }
        );
      }
      const valyu = new Valyu(getValyuApiKey());
      const sdkResponse = await valyu.deepresearch.list({ apiKeyId, limit });
      const data = sdkResponse as unknown as { data?: unknown[] };
      tasks = Array.isArray(sdkResponse) ? sdkResponse as unknown[] : (data.data || []);
    }

    const filteredTasks = (tasks as { query?: string }[])
      .filter((task) => task.query?.includes("Conduct comprehensive"))
      .map((task) => ({
        ...task,
        title: extractTitleFromQuery(task.query || ""),
      }));

    return NextResponse.json({
      success: true,
      tasks: filteredTasks,
    });
  } catch (error) {
    console.error("Error listing research tasks:", error);

    const message =
      error instanceof Error ? error.message : "Failed to list research tasks";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
