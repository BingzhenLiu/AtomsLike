import { NextResponse } from "next/server";
import { generateRequestSchema } from "@/lib/ai/contract";
import { generateDemo } from "@/lib/ai/demo-generator";
import { OutputValidationError, parseModelOutput } from "@/lib/ai/parse";
import { createModelMessages } from "@/lib/ai/prompt";

export const runtime = "nodejs";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("REQUEST_INVALID", "请求内容不是有效 JSON。", 400);
  }

  const parsed = generateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("REQUEST_INVALID", "请输入 1–4000 字的需求；当前应用代码也必须在大小限制内。", 400);
  }

  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) {
    const demo = generateDemo(parsed.data);
    if (!demo) {
      return errorResponse(
        "CONFIG_MISSING",
        "当前为 Demo Mode，仅支持记账、番茄钟和习惯打卡示例。选择一个示例，或配置服务端 AI_API_KEY 后生成任意应用。",
        503,
      );
    }
    return NextResponse.json(demo);
  }

  const model = process.env.AI_MODEL?.trim();
  if (!model) {
    return errorResponse("CONFIG_MISSING", "已配置 AI_API_KEY，但缺少服务端 AI_MODEL。", 503);
  }

  const baseUrl = (process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const providerResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: createModelMessages(parsed.data),
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!providerResponse.ok) {
      console.error("Model provider error", providerResponse.status);
      return errorResponse("PROVIDER_ERROR", "模型服务暂时没有完成请求。请稍后重试，当前预览不会被替换。", 502);
    }

    let providerPayload: unknown;
    try {
      providerPayload = await providerResponse.json();
    } catch {
      return errorResponse("PROVIDER_ERROR", "模型服务返回了非 JSON 响应。请重试。", 502);
    }

    const content = (providerPayload as { choices?: Array<{ message?: { content?: unknown } }> })
      .choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return errorResponse("OUTPUT_INVALID", "模型响应缺少可用内容，旧版本已保留。", 422);
    }

    return NextResponse.json(parseModelOutput(content));
  } catch (error) {
    if (error instanceof OutputValidationError) {
      return errorResponse("OUTPUT_INVALID", `${error.message}，旧版本已保留。`, 422);
    }
    if (error instanceof Error && error.name === "AbortError") {
      return errorResponse("PROVIDER_TIMEOUT", "模型请求超过 45 秒。请重试，当前预览不会被替换。", 504);
    }
    console.error("Generation route failed", error instanceof Error ? error.message : "Unknown error");
    return errorResponse("PROVIDER_ERROR", "生成请求失败。请检查服务配置或稍后重试。", 502);
  } finally {
    clearTimeout(timeout);
  }
}
