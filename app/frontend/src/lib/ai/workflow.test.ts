import { beforeEach, describe, expect, it, vi } from "vitest";
import { BuildError } from "./errors";
import type { BuildStage, BuildStageStatus } from "./stages";
import type { ProjectVersion } from "@/lib/projects/types";

const runtime = vi.hoisted(() => ({
  runPlanText: vi.fn(),
  runDesignText: vi.fn(),
  runEngineerText: vi.fn(),
  runReviewText: vi.fn(),
  repairJson: vi.fn(),
}));

vi.mock("@/lib/ai/runtime", () => runtime);

const { requestPlan, runBuildPipeline } = await import("./workflow");

const PROMPT = "帮我做一个个人记账小工具，可以记录收入和支出，显示结余。";

/** Records the exact stage/status sequence the UI timeline consumes. */
function createReporter() {
  const events: Array<[BuildStage, BuildStageStatus]> = [];
  return {
    events,
    report: (stage: BuildStage, status: BuildStageStatus) => events.push([stage, status]),
  };
}

beforeEach(() => {
  Object.values(runtime).forEach((fn) => fn.mockReset());
});

describe("runBuildPipeline · demo mode", () => {
  it("walks designer → engineer → reviewer and returns a hardened, preview-safe version", async () => {
    const { events, report } = createReporter();

    const result = await runBuildPipeline({
      prompt: PROMPT,
      plan: null,
      baseVersion: null,
      mode: "demo",
      report,
      demoRecipe: null,
    });

    expect(events).toEqual([
      ["designer", "active"],
      ["designer", "completed"],
      ["engineer", "active"],
      ["engineer", "completed"],
      ["reviewer", "active"],
      ["reviewer", "completed"],
    ]);
    expect(result.version.index).toBe(1);
    expect(result.version.revision).toBeNull();
    expect(result.version.html).toContain("<!doctype html>");
    expect(result.version.html).toContain("Content-Security-Policy");
    expect(result.reviewApproved).toBe(true);
    // Demo mode must never touch the provider.
    expect(runtime.runEngineerText).not.toHaveBeenCalled();
  });

  it("keeps the demo recipe available through the pipeline", async () => {
    const { report } = createReporter();
    const plan = await requestPlan({ prompt: PROMPT, mode: "demo" });

    expect(plan.plan.title).toBeTruthy();
    expect(plan.demoRecipe?.id).toBe("ledger");

    const result = await runBuildPipeline({
      prompt: PROMPT,
      plan: plan.plan,
      baseVersion: null,
      mode: "demo",
      report,
      demoRecipe: plan.demoRecipe,
    });

    expect(result.version.html).toContain("记账小工具");
  });
});

describe("runBuildPipeline · revision", () => {
  const baseVersion: ProjectVersion = {
    id: "v_base",
    index: 1,
    html: "<!doctype html><html><body>base</body></html>",
    summary: "首版",
    prompt: PROMPT,
    revision: null,
    createdAt: Date.now(),
  };

  it("increments the version index and stores the change request", async () => {
    const { report } = createReporter();

    const result = await runBuildPipeline({
      prompt: PROMPT,
      plan: null,
      baseVersion,
      changeRequest: "增加按月份筛选",
      mode: "demo",
      report,
      demoRecipe: null,
    });

    expect(result.version.index).toBe(2);
    expect(result.version.revision?.prompt).toBe("增加按月份筛选");
  });
});

describe("requestPlan · live mode", () => {
  it("parses the planner payload", async () => {
    runtime.runPlanText.mockResolvedValue(
      '```json\n{"title":"记账","goal":"记录收支","features":["新增记录"]}\n```',
    );

    const result = await requestPlan({ prompt: PROMPT, mode: "live" });

    expect(result.plan.title).toBe("记账");
    expect(result.plan.features).toEqual(["新增记录"]);
    expect(result.demoRecipe).toBeNull();
  });

  it("repairs malformed planner JSON once, then succeeds", async () => {
    runtime.runPlanText.mockResolvedValue("方案：{title: 记账, goal: 记录收支}");
    runtime.repairJson.mockResolvedValue('{"title":"记账","goal":"记录收支"}');

    const result = await requestPlan({ prompt: PROMPT, mode: "live" });

    expect(runtime.repairJson).toHaveBeenCalledTimes(1);
    expect(result.plan.title).toBe("记账");
  });

  it("surfaces an unusable planner payload as OUTPUT_INVALID", async () => {
    runtime.runPlanText.mockResolvedValue("抱歉，我无法生成方案。");
    runtime.repairJson.mockResolvedValue("仍然不是 JSON");

    await expect(requestPlan({ prompt: PROMPT, mode: "live" })).rejects.toMatchObject({
      code: "OUTPUT_INVALID",
    });
  });
});

describe("runBuildPipeline · live mode", () => {
  it("chains the four stages and applies the reviewer verdict", async () => {
    runtime.runDesignText.mockResolvedValue("设计：单列布局 + 本地存储");
    runtime.runEngineerText.mockResolvedValue(
      '```json\n{"html":"<!doctype html><html><body><h1>hi</h1><script>console.log(1)</script></body></html>","summary":"首版"}\n```',
    );
    runtime.runReviewText.mockResolvedValue('{"approved":true,"summary":"可用"}');
    const { events, report } = createReporter();

    const result = await runBuildPipeline({
      prompt: PROMPT,
      plan: null,
      baseVersion: null,
      mode: "live",
      report,
      demoRecipe: null,
    });

    expect(events).toContainEqual(["designer", "active"]);
    expect(events).toContainEqual(["reviewer", "completed"]);
    expect(result.reviewApproved).toBe(true);
    expect(result.version.html).toContain("Content-Security-Policy");
  });

  it("rejects generated HTML that fails the preview safety check", async () => {
    runtime.runDesignText.mockResolvedValue("设计");
    runtime.runEngineerText.mockResolvedValue(
      '{"html":"<html><body><iframe src=\\"https://evil.example\\"></iframe></body></html>","summary":"x"}',
    );
    const { report } = createReporter();

    await expect(
      runBuildPipeline({
        prompt: PROMPT,
        plan: null,
        baseVersion: null,
        mode: "live",
        report,
        demoRecipe: null,
      }),
    ).rejects.toMatchObject({ code: "PREVIEW_REJECTED" });
  });

  it("maps an expired session onto AUTH_REQUIRED", async () => {
    runtime.runDesignText.mockRejectedValue(new Error("401 Unauthorized"));
    const { report } = createReporter();

    const failure = await runBuildPipeline({
      prompt: PROMPT,
      plan: null,
      baseVersion: null,
      mode: "live",
      report,
      demoRecipe: null,
    }).catch((error) => error);

    expect(failure).toBeInstanceOf(BuildError);
    expect(failure.code).toBe("AUTH_REQUIRED");
  });

  it("maps a provider outage onto PROVIDER_ERROR", async () => {
    runtime.runDesignText.mockRejectedValue(new Error("upstream model is unavailable"));
    const { report } = createReporter();

    const failure = await runBuildPipeline({
      prompt: PROMPT,
      plan: null,
      baseVersion: null,
      mode: "live",
      report,
      demoRecipe: null,
    }).catch((error) => error);

    expect(failure).toBeInstanceOf(BuildError);
    expect(failure.code).toBe("PROVIDER_ERROR");
  });
});
