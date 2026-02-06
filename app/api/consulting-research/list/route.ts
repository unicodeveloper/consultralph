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

async function listViaProxy(
  accessToken: string,
  limit: number
): Promise<{ success: boolean; data?: unknown[]; error?: string }> {
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
      return { success: false, error: "Session expired. Please sign in again." };
    }
    return { success: false, error: `API call failed: ${response.status}` };
  }

  return response.json();
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

    let listData: { success?: boolean; data?: unknown[]; error?: string };

    if (!selfHosted && accessToken) {
      listData = await listViaProxy(accessToken, limit);
      if (listData.error) {
        return NextResponse.json({ error: listData.error }, { status: 500 });
      }
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
      listData = sdkResponse as unknown as { success: boolean; data?: unknown[] };
    }

    return NextResponse.json({
      success: true,
      tasks: listData.data || [],
    });
  } catch (error) {
    console.error("Error listing research tasks:", error);

    const message =
      error instanceof Error ? error.message : "Failed to list research tasks";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
