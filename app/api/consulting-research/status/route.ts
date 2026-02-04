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

    const valyu = new Valyu(getValyuApiKey());
    const response = await valyu.deepresearch.status(taskId);

    return NextResponse.json({
      status: response.status,
      task_id: response.deepresearch_id || taskId,
      output: response.output,
      sources: response.sources,
      usage: response.usage,
      pdf_url: response.pdf_url,
      deliverables: response.deliverables,
      progress: response.progress,
      error: response.error,
    });
  } catch (error) {
    console.error("Error getting research status:", error);

    const message =
      error instanceof Error ? error.message : "Failed to get research status";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
