import { BuildError, describeError, isAuthFailure, toErrorPayload } from "@/lib/ai/errors";
import { parseStageJson, mapHtml, mapPlan, mapReview } from "@/lib/ai/parse";
import {
  designerSystemPrompt,
  engineerSystemPrompt,
  engineerUserPrompt,
  plannerSystemPrompt,
  reviewerSystemPrompt,
  reviewerUserPrompt,
} from "@/lib/ai/prompt";
import { repairJson, runDesignText, runEngineerText, runPlanText, runReviewText } from "@/lib/ai/runtime";
import { hardenGeneratedHtml } from "@/lib/preview/harden-html";
import { validateGeneratedHtml } from "@/lib/preview/validate-html";
import { buildDemoHtml, findDemoRecipe, type DemoRecipe } from "@/lib/ai/demo-generator";
import type { PlanPayload, ProjectVersion } from "@/lib/projects/types";
import type { StageReporter } from "@/lib/ai/stages";

export type BuildResult = { version: ProjectVersion; reviewApproved: boolean; reviewNote: string };

export type PlanResult = { plan: PlanPayload; demoRecipe: DemoRecipe | null };

function failedBuild(error: unknown): never {
  const payload = toErrorPayload(error);
  throw new BuildError(payload.code, payload.message);
}

/** Picks the demo recipe so Demo Mode stays available without touching the model. */
export function resolveDemoRecipe(prompt: string): DemoRecipe {
  return findDemoRecipe(prompt);
}

/** Planner step: produces the approval-gated plan. */
export async function requestPlan(args: {
  prompt: string;
  mode: "live" | "demo";
}): Promise<PlanResult> {
  const recipe = resolveDemoRecipe(args.prompt);
  if (args.mode === "demo") {
    return { plan: recipe.plan, demoRecipe: recipe };
  }
  try {
    const raw = await runPlanText(
      plannerSystemPrompt(),
      `用户需求：${args.prompt}\n\n请基于该需求输出方案 JSON。`,
    );
    let plan: PlanPayload;
    try {
      plan = parseStageJson(raw, mapPlan, "方案输出格式不正确，请重试。");
    } catch (error) {
      if (!(error instanceof BuildError)) throw error;
      const repaired = await repairJson(raw);
      plan = parseStageJson(repaired, mapPlan, "方案输出格式不正确，请重试。");
    }
    return { plan, demoRecipe: null };
  } catch (error) {
    if (error instanceof BuildError) throw error;
    failedBuild(error);
  }
}

/** Designer → Engineer → Reviewer → validate. Throws BuildError with a user-facing message. */
export async function runBuildPipeline(args: {
  prompt: string;
  plan: PlanPayload | null;
  baseVersion: ProjectVersion | null;
  changeRequest?: string;
  mode: "live" | "demo";
  report: StageReporter;
  demoRecipe: DemoRecipe | null;
}): Promise<BuildResult> {
  const { report, mode } = args;

  try {
    let design = "";
    let html = "";
    let summary = "";

    if (mode === "demo") {
      const recipe = args.demoRecipe ?? resolveDemoRecipe(args.prompt);
      report("designer", "active");
      design = `Demo 模式：沿用「${recipe.label}」设计结构，保持深色工作台风格与移动端单列布局。`;
      report("designer", "completed");

      report("engineer", "active");
      html = buildDemoHtml(recipe);
      summary = `${recipe.label}（Demo 模式生成）`;
      report("engineer", "completed");
    } else {
      report("designer", "active");
      design = await runDesignText(
        designerSystemPrompt(),
        engineerUserPrompt({
          request: args.prompt,
          plan: args.plan,
          design: "",
          changeRequest: args.changeRequest,
        }),
      );
      report("designer", "completed");

      report("engineer", "active");
      const engineerRaw = await runEngineerText(
        engineerSystemPrompt(),
        engineerUserPrompt({
          request: args.prompt,
          plan: args.plan,
          design,
          previousHtml: args.baseVersion?.html,
          changeRequest: args.changeRequest,
        }),
      );
      let payload: { html: string; summary: string };
      try {
        payload = parseStageJson(engineerRaw, mapHtml, "生成结果格式不正确，请重试。");
      } catch (error) {
        if (!(error instanceof BuildError)) throw error;
        const repaired = await repairJson(engineerRaw);
        payload = parseStageJson(repaired, mapHtml, "生成结果格式不正确，请重试。");
      }
      html = hardenGeneratedHtml(payload.html);
      summary = payload.summary;
      report("engineer", "completed");
    }

    const validation = validateGeneratedHtml(html);
    if (!validation.ok) {
      throw new BuildError(
        "PREVIEW_REJECTED",
        `生成结果未通过预览安全校验：${validation.reason}。已保留上一个可用版本。`,
      );
    }

    report("reviewer", "active");
    let reviewApproved = true;
    let reviewNote = "已通过可用性与安全约束检查";
    if (mode === "live") {
      const reviewRaw = await runReviewText(
        reviewerSystemPrompt(),
        reviewerUserPrompt(args.prompt, html.slice(0, 40_000)),
      );
      const review = parseStageJson(reviewRaw, mapReview, "检查结果格式不正确，已按通过处理。");
      reviewApproved = review.approved;
      reviewNote = review.summary;
    }
    report("reviewer", "completed");

    const version: ProjectVersion = {
      id: `v_${Date.now().toString(36)}`,
      index: (args.baseVersion?.index ?? 0) + 1,
      html,
      summary: reviewApproved ? summary : `${summary}（检查提示：${reviewNote}）`,
      prompt: args.prompt,
      revision: args.changeRequest
        ? { id: `rev_${Date.now().toString(36)}`, prompt: args.changeRequest, createdAt: Date.now() }
        : null,
      createdAt: Date.now(),
    };

    return { version, reviewApproved, reviewNote };
  } catch (error) {
    if (error instanceof BuildError) throw error;
    const detail = describeError(error);
    if (isAuthFailure(detail)) {
      throw new BuildError("AUTH_REQUIRED", "登录状态已失效，请重新登录后再试。");
    }
    throw new BuildError("PROVIDER_ERROR", `生成失败：${detail}`);
  }
}
