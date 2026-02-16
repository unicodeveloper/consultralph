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

async function createFollowUpWithOAuth(
  accessToken: string,
  query: string,
  previousTaskId: string,
  alertEmail?: string
) {
  const proxyUrl = `${VALYU_APP_URL}/api/oauth/proxy`;

  const taskBody: Record<string, unknown> = {
    query,
    mode: "fast",
    output_formats: ["markdown", "pdf"],
    previous_reports: [previousTaskId],
  };

  if (alertEmail) {
    taskBody.alert_email = alertEmail;
  }

  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path: "/v1/deepresearch/tasks",
      method: "POST",
      body: taskBody,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Follow-up] Proxy error:", response.status, errorText);

    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }

    if (response.status === 402) {
      throw new Error("Insufficient credits. Please top up your Valyu account.");
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error("Session expired. Please sign in again.");
    }

    throw new Error(errorData.message || errorData.error || "Failed to create follow-up research");
  }

  return response.json();
}

async function createFollowUpWithApiKey(
  query: string,
  previousTaskId: string,
  alertEmail?: string
) {
  const valyu = new Valyu(getValyuApiKey());

  const options: Record<string, unknown> = {
    query,
    mode: "fast",
    previousReports: [previousTaskId],
  };

  if (alertEmail) {
    options.alertEmail = alertEmail;
  }

  return valyu.deepresearch.create(options);
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

    const { taskId, instruction, alertEmail } = await request.json();

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    if (!instruction || !instruction.trim()) {
      return NextResponse.json(
        { error: "Follow-up question is required" },
        { status: 400 }
      );
    }

    const selfHosted = isSelfHostedMode();

    if (!selfHosted && !accessToken) {
      return NextResponse.json(
        { error: "Authentication required", requiresReauth: true },
        { status: 401 }
      );
    }

    let response;

    if (!selfHosted && accessToken) {
      response = await createFollowUpWithOAuth(accessToken, instruction.trim(), taskId, alertEmail);
    } else {
      response = await createFollowUpWithApiKey(instruction.trim(), taskId, alertEmail);
    }

    return NextResponse.json({
      deepresearch_id: response.deepresearch_id,
      status: "queued",
    });
  } catch (error) {
    console.error("Error creating follow-up research:", error);

    let message = "Failed to create follow-up research";
    let statusCode = 500;

    if (error instanceof Error) {
      message = error.message;
      if (message.includes("Insufficient credits")) {
        statusCode = 402;
      } else if (message.includes("Session expired") || message.includes("sign in")) {
        statusCode = 401;
      }
    }

    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
