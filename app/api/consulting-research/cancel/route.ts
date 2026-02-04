import { NextRequest, NextResponse } from "next/server";
import { Valyu } from "valyu-js";

const getValyuApiKey = () => {
  const apiKey = process.env.VALYU_API_KEY;
  if (!apiKey) {
    throw new Error("VALYU_API_KEY environment variable is required");
  }
  return apiKey;
};

export async function POST(request: NextRequest) {
  try {
    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    const valyu = new Valyu(getValyuApiKey());
    const response = await valyu.deepresearch.cancel(taskId);

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
