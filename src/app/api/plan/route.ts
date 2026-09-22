import { NextResponse } from "next/server";
import { runPlanAgent } from "@/lib/ai/agent/plan";
import { isAgentConfigured } from "@/lib/ai/agent/runtime";
import { toErrorPayload } from "@/lib/ai/build-error";
import type { StageReporter } from "@/lib/ai/build-stream";
import { planRequestSchema } from "@/lib/ai/contract";
import { runDemoPlan } from "@/lib/ai/demo-generator";
import { respondWithBuildEvents, wantsEventStream } from "@/lib/ai/stream-response";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "REQUEST_INVALID", message: "请求内容不是有效 JSON。" } },
      { status: 400 },
    );
  }

  const parsed = planRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "REQUEST_INVALID", message: "请输入 1–4000 字的需求；补充说明最多 1000 字。" } },
      { status: 400 },
    );
  }

  return respondWithBuildEvents(async (emit) => {
    const report: StageReporter = (stage, status) => emit({ type: "stage", stage, status });
    try {
      const plan = isAgentConfigured()
        ? await runPlanAgent(parsed.data, report)
        : await runDemoPlan(parsed.data, report);
      emit({ type: "plan", plan });
    } catch (error) {
      emit({ type: "error", error: toErrorPayload(error) });
    }
  }, wantsEventStream(request));
}
