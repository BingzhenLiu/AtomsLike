import { client } from "@/lib/api";
import { AI_MODELS, AI_STAGE_TIMEOUT_MS } from "./models";
import { BuildError, describeError, isAuthFailure } from "./errors";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * The SDK does not forward a per-call timeout, so the stage budget is enforced locally.
 * Without it a stalled provider would leave the workbench spinning forever.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new BuildError(
          "PROVIDER_TIMEOUT",
          `生成超时（超过 ${Math.round(timeoutMs / 1000)} 秒），请重试或切换到 Demo 模式。`,
        ),
      );
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function readContent(response: unknown): string {
  const payload = (response as { data?: unknown })?.data;
  if (typeof payload === "string") return payload;
  const content = (payload as { content?: unknown } | undefined)?.content;
  return typeof content === "string" ? content : "";
}

/**
 * Single Atoms AIHub text call shared by every stage. Non-streaming is intentional:
 * each stage validates the complete payload before the next stage consumes it.
 * The provider key never reaches the browser — the call is routed through the Atoms platform.
 */
export async function runStageText(
  messages: ChatMessage[],
  model: string,
  timeoutMs: number,
): Promise<string> {
  try {
    const response = await withTimeout(
      client.ai.gentxt({ messages, model, stream: false }),
      timeoutMs,
    );
    const content = readContent(response);
    if (!content.trim()) {
      throw new BuildError("OUTPUT_INVALID", "模型返回内容为空，请重试。");
    }
    return content;
  } catch (error) {
    if (error instanceof BuildError) throw error;
    const detail = describeError(error);
    if (isAuthFailure(detail)) {
      throw new BuildError("AUTH_REQUIRED", "请先登录 Atoms 账号后再使用实时生成。");
    }
    throw new BuildError("PROVIDER_ERROR", `生成服务暂时不可用：${detail}`);
  }
}

function single(system: string, user: string): ChatMessage[] {
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export const runPlanText = (system: string, user: string) =>
  runStageText(single(system, user), AI_MODELS.plan, AI_STAGE_TIMEOUT_MS.plan);

export const runDesignText = (system: string, user: string) =>
  runStageText(single(system, user), AI_MODELS.design, AI_STAGE_TIMEOUT_MS.design);

export const runEngineerText = (system: string, user: string) =>
  runStageText(single(system, user), AI_MODELS.engineer, AI_STAGE_TIMEOUT_MS.engineer);

export const runReviewText = (system: string, user: string) =>
  runStageText(single(system, user), AI_MODELS.review, AI_STAGE_TIMEOUT_MS.review);

/** One repair attempt for malformed structured output, then a clear error. */
export const repairJson = (raw: string) =>
  runStageText(
    [
      { role: "system", content: "把下面的内容修复为合法 JSON，只输出 JSON，不要解释，也不要新增内容。" },
      { role: "user", content: raw.slice(0, 60_000) },
    ],
    AI_MODELS.repair,
    AI_STAGE_TIMEOUT_MS.design,
  );
