import { Agent, type AgentEvent } from "@earendil-works/pi-agent-core";
import { BuildError } from "../build-error";
import type { StageReporter } from "../build-stream";
import type { PlanRequest, PlanResponse } from "../contract";
import { PLANNER_SYSTEM_PROMPT } from "./prompt";
import { createAgentRuntime, type AgentRuntime } from "./runtime";
import { createPlanTools } from "./tools";

export const PLAN_TIMEOUT_MS = 20_000;

function createPlanMessage(request: PlanRequest): string {
  const feedback = request.feedback?.trim();
  return feedback
    ? `User request:\n${request.prompt}\n\nThe user reviewed the previous plan and asked for this change:\n${feedback}\n\nSend the revised plan.`
    : `User request:\n${request.prompt}\n\nSend the plan.`;
}

/**
 * Phase one: produce the specification the user approves. No application code
 * is generated here, which keeps the approval loop cheap and fast.
 */
export async function runPlanAgent(
  request: PlanRequest,
  report: StageReporter,
  runtime: AgentRuntime | null = createAgentRuntime(),
): Promise<PlanResponse> {
  if (!runtime) {
    throw new BuildError("CONFIG_MISSING", "服务端没有配置模型，无法生成可确认的方案。");
  }

  const planTools = createPlanTools();
  let timedOut = false;
  let completed = false;

  const agent = new Agent({
    initialState: {
      systemPrompt: PLANNER_SYSTEM_PROMPT,
      model: runtime.model,
      tools: planTools.tools,
    },
    streamFn: runtime.models.streamSimple.bind(runtime.models),
    // The plan is a single artifact: once it exists, further calls would only
    // burn the budget, so the run is terminated instead.
    beforeToolCall: async () =>
      planTools.capture.plan ? { block: true, reason: "Plan already recorded.", terminate: true } : undefined,
  });

  agent.subscribe((event: AgentEvent) => {
    if (event.type === "agent_start") {
      report("planner", "active");
      return;
    }
    if (event.type === "tool_execution_end" && !event.isError && event.toolName === "propose_plan" && !completed) {
      completed = true;
      report("planner", "completed");
    }
  });

  const timer = setTimeout(() => {
    timedOut = true;
    agent.abort();
  }, PLAN_TIMEOUT_MS);

  try {
    await agent.prompt(createPlanMessage(request));
  } catch (error) {
    console.error("Plan run rejected", error instanceof Error ? error.message : "Unknown error");
  } finally {
    clearTimeout(timer);
  }

  const failure = agent.state.errorMessage;
  if (failure) {
    console.error("Plan run failed", failure);
    throw timedOut
      ? new BuildError("PROVIDER_TIMEOUT", "生成方案超过 20 秒。请重试。")
      : new BuildError("PROVIDER_ERROR", "模型服务没有返回方案。请稍后重试。");
  }

  if (!planTools.capture.plan) {
    report("planner", "failed");
    throw new BuildError("OUTPUT_INVALID", "模型没有返回可确认的方案，请重试。");
  }

  return planTools.capture.plan;
}
