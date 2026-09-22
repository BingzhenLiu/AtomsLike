import { modelOutputSchema, type GenerateResponse } from "./contract";
import { hardenGeneratedHtml } from "@/lib/preview/harden-html";
import { validateGeneratedHtml } from "@/lib/preview/validate-html";

export class OutputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutputValidationError";
  }
}

function stripOuterFence(value: string): string {
  const match = value.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1] ?? value.trim();
}

export function parseModelOutput(raw: string): GenerateResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      parsed = JSON.parse(stripOuterFence(raw));
    } catch {
      throw new OutputValidationError("模型没有返回可解析的 JSON");
    }
  }

  const result = modelOutputSchema.safeParse(parsed);
  if (!result.success) throw new OutputValidationError("模型返回缺少必要字段或字段过长");

  const validation = validateGeneratedHtml(result.data.html);
  if (!validation.ok) throw new OutputValidationError(validation.reason);

  return {
    ...result.data,
    html: hardenGeneratedHtml(result.data.html),
    mode: "live",
  };
}
