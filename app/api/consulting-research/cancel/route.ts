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

async function cancelViaProxy(
  taskId: string,
  accessToken: string
): Promise<{ success: boolean }> {
  const proxyUrl = `${VALYU_APP_URL}/api/oauth/proxy`;

  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path: `/v1/deepresearch/tasks/${taskId}/cancel`,
      method: "POST",
    }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Session expired. Please sign in again.");
    }
    throw new Error(`API call failed: ${response.status}`);
  }

  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    // Check for Authorization header (OAuth token)
    const authHeader = request.headers.get("Authorization");
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    // Check mode first
    const selfHosted = isSelfHostedMode();

    // Valyu mode requires authentication
    if (!selfHosted && !accessToken) {
      return NextResponse.json(
        { error: "Authentication required", requiresReauth: true },
        { status: 401 }
      );
    }

    let response;

    // Route based on mode
    if (!selfHosted && accessToken) {
      // Valyu mode: use OAuth proxy
      response = await cancelViaProxy(taskId, accessToken);
    } else {
      // Self-hosted mode: use API key
      const valyu = new Valyu(getValyuApiKey());
      response = await valyu.deepresearch.cancel(taskId);
    }

    return NextResponse.json({
      success: response.success,
      status: "cancelled",
    });
  } catch (error) {
    console.error("Error cancelling research:", error);

    const message =
      error instanceof Error ? error.message : "Failed to cancel research";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
