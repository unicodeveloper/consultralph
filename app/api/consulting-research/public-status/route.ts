import { NextRequest, NextResponse } from "next/server";
import { Valyu } from "valyu-js";

const getValyuApiKey = () => {
  const apiKey = process.env.VALYU_API_KEY;
  if (!apiKey) {
    throw new Error("VALYU_API_KEY environment variable is required");
  }
  return apiKey;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(taskId)) {
      return NextResponse.json(
        { error: "Invalid task ID format" },
        { status: 400 }
      );
    }

    const valyu = new Valyu(getValyuApiKey());
    const statusData = await valyu.deepresearch.status(taskId) as unknown as Record<string, unknown>;

    // Only return data if the task is marked as public
    if (!statusData.public) {
      return NextResponse.json(
        { error: "This report is not publicly accessible" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      status: statusData.status,
      task_id: statusData.deepresearch_id || taskId,
      output: statusData.output,
      sources: statusData.sources,
      usage: statusData.usage,
      pdf_url: statusData.pdf_url,
      deliverables: statusData.deliverables,
      progress: statusData.progress,
      messages: statusData.messages,
      error: statusData.error,
    });
  } catch (error) {
    console.error("Error getting public research status:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get research status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
