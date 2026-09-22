import { Agent, type AgentEvent, type AgentMessage } from "@earendil-works/pi-agent-core";
import { BuildError } from "../build-error";
import { BUILD_STAGES, type BuildStage, type StageReporter } from "../build-stream";
import type { GenerateRequest, GenerateResponse } from "../contract";
import { OutputValidationError, parseModelOutput } from "../parse";
import { BUILD_SYSTEM_PROMPT } from "./prompt";
import { createAgentRuntime, type AgentRuntime } from "./runtime";
import { createBuildTools } from "./tools";

/** Stays inside the 60s function budget most deployment plans allow. */
export const AGENT_TIMEOUT_MS = 55_000;

const STAGE_BY_TOOL: Record<string, BuildStage> = {
  design_app: "designer",
  write_app: "engineer",
};

/** The planner runs in phase one and must never be re-reported by this phase. */
const EXECUTED_STAGES = BUILD_STAGES.filter((stage) => stage !== "planner");

function createUserMessage(request: GenerateRequest): string {
  const sections = [`User request:\n${request.prompt}`];

  if (request.plan) {
    sections.push(
      `Approved specification (authoritative, implement exactly this scope):\n${JSON.stringify(request.plan, null, 2)}`,
    );
  }

  sections.push(
    request.currentHtml
      ? `Current application HTML to revise:\n${request.currentHtml}`
      : "There is no current application. This is the first version.",
  );

  return sections.join("\n\n");
}

function lastAssistantText(messages: readonly AgentMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "assistant") continue;
    const parts: string[] = [];
    for (const part of message.content) {
      if (part.type === "text") parts.push(part.text);
    }
    const text = parts.join("\n").trim();
    if (text) return text;
  }
  return null;
}

/**
 * Phase two: run the pi-agent build for an already approved specification. The
 * agent designs and ships the document through real tool calls, so stage
 * transitions come from the request lifecycle instead of a scripted animation.
 */
export async function runBuildAgent(
  request: GenerateRequest,
  report: StageReporter,
  runtime: AgentRuntime | null = createAgentRuntime(),
): Promise<GenerateResponse> {
  if (!runtime) {
    throw new BuildError("CONFIG_MISSING", "服务端没有配置模型，无法进行真实生成。");
  }

  const build = createBuildTools();
  const completed = new Set<BuildStage>();
  let timedOut = false;

  const agent = new Agent({
    initialState: {
      systemPrompt: BUILD_SYSTEM_PROMPT,
      model: runtime.model,
      tools: build.tools,
    },
    streamFn: runtime.models.streamSimple.bind(runtime.models),
    beforeToolCall: build.beforeToolCall,
  });

  function complete(stage: BuildStage) {
    if (completed.has(stage)) return;
    completed.add(stage);
    report(stage, "completed");
  }

  agent.subscribe((event: AgentEvent) => {
    if (event.type === "agent_start") {
      report("designer", "active");
      return;
    }
    if (event.type !== "tool_execution_end" || event.isError) return;

    const stage = STAGE_BY_TOOL[event.toolName];
    if (!stage) return;
    // A rejected or blocked write never produced an accepted document.
    if (event.toolName === "write_app" && !build.accepted()) return;
    complete(stage);

    const next = BUILD_STAGES[BUILD_STAGES.indexOf(stage) + 1];
    if (next) report(next, "active");
  });

  const timer = setTimeout(() => {
    timedOut = true;
    agent.abort();
  }, AGENT_TIMEOUT_MS);

  try {
    await agent.prompt(createUserMessage(request));
  } catch (error) {
    console.error("Agent run rejected", error instanceof Error ? error.message : "Unknown error");
  } finally {
    clearTimeout(timer);
  }

  const failure = agent.state.errorMessage;
  if (failure) {
    console.error("Agent run failed", failure);
    throw timedOut
      ? new BuildError("PROVIDER_TIMEOUT", "模型请求超过 55 秒。请重试，当前预览不会被替换。")
      : new BuildError("PROVIDER_ERROR", "模型服务没有完成这次构建。请稍后重试，当前预览不会被替换。");
  }

  if (build.capture.draft && build.accepted()) {
    for (const stage of EXECUTED_STAGES) complete(stage);
    return { ...build.capture.draft, mode: "live" };
  }

  const text = lastAssistantText(agent.state.messages);
  if (text) {
    try {
      const parsed = parseModelOutput(text);
      for (const stage of EXECUTED_STAGES) complete(stage);
      return parsed;
    } catch (error) {
      if (error instanceof OutputValidationError) {
        throw new BuildError("OUTPUT_INVALID", `${error.message}，旧版本已保留。`);
      }
      throw error;
    }
  }

  throw new BuildError(
    "OUTPUT_INVALID",
    build.lastRejection() ? `生成结果未通过校验：${build.lastRejection()}。旧版本已保留。` : "模型没有返回可用的应用代码，旧版本已保留。",
  );
}
