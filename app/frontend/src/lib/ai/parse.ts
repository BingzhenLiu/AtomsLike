import type { PlanPayload } from "@/lib/projects/types";
import { BuildError, describeError, isAuthFailure } from "./errors";

/** Pulls the first JSON object out of a model reply, tolerating prose and code fences. */
export function extractJsonBlock(raw: string): string {
  const text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) return candidate.slice(start, end + 1);
  return candidate;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const text = record.title ?? record.name ?? record.label ?? record.description;
        return typeof text === "string" ? text.trim() : "";
      }
      return "";
    })
    .filter(Boolean);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizePlan(value: unknown): PlanPayload | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const goal = asString(record.goal) || asString(record.summary) || asString(record.description);
  const title = asString(record.title) || asString(record.name) || "应用方案";
  const features = asStringArray(record.features ?? record.coreFeatures ?? record.core_features);
  if (!goal && features.length === 0) return null;
  return {
    title,
    goal: goal || features[0],
    features,
    nonGoals: asStringArray(record.nonGoals ?? record.non_goals ?? record.outOfScope),
    assumptions: asStringArray(record.assumptions ?? record.assumption),
    openQuestions: asStringArray(record.openQuestions ?? record.open_questions ?? record.questions),
  };
}

/** Validates the strict JSON contract a planning/build stage must satisfy. */
export function parseStageJson<T>(
  raw: string,
  map: (value: unknown) => T | null,
  invalidMessage: string,
): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonBlock(raw));
  } catch (error) {
    throw new BuildError("OUTPUT_INVALID", `${invalidMessage}（${describeError(error)}）`);
  }
  const mapped = map(parsed);
  if (mapped === null) throw new BuildError("OUTPUT_INVALID", invalidMessage);
  return mapped;
}

export function mapPlan(value: unknown): PlanPayload | null {
  return normalizePlan(value);
}

export function mapHtml(value: unknown): { html: string; summary: string } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const html = asString(record.html) || asString(record.code) || asString(record.document);
  if (!html) return null;
  return {
    html,
    summary: asString(record.summary) || asString(record.description) || "已生成应用",
  };
}

export function mapReview(value: unknown): { approved: boolean; summary: string; issues: string[] } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const issues = asStringArray(record.issues ?? record.problems);
  const rawApproved = record.approved ?? record.ok ?? record.passed;
  const approved =
    typeof rawApproved === "boolean" ? rawApproved : issues.length === 0;
  return {
    approved,
    summary: asString(record.summary) || "已完成可用性与约束检查",
    issues,
  };
}

export { isAuthFailure };
