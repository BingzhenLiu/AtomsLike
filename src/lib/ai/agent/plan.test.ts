import { describe, expect, it } from "vitest";
import { createModels, fauxAssistantMessage, fauxProvider, fauxToolCall, type FauxResponseStep } from "@earendil-works/pi-ai";
import { BuildError } from "../build-error";
import type { BuildStage, BuildStageStatus } from "../build-stream";
import { runPlanAgent } from "./plan";
import type { AgentRuntime } from "./runtime";

function createFauxRuntime(steps: FauxResponseStep[]): AgentRuntime {
  const faux = fauxProvider({ models: [{ id: "faux-model" }] });
  const models = createModels();
  models.setProvider(faux.provider);
  faux.setResponses(steps);
  return { models, model: faux.getModel() };
}

function recordStages() {
  const seen: Array<`${BuildStage}:${BuildStageStatus}`> = [];
  return {
    seen,
    report: (stage: BuildStage, status: BuildStageStatus) => {
      seen.push(`${stage}:${status}`);
    },
  };
}

const planCall = fauxAssistantMessage([
  fauxToolCall("propose_plan", {
    goal: "记录每笔收支并随时看到余额",
    coreFeatures: ["添加记录", "计算余额"],
    nonGoals: ["不接入银行接口"],
    assumptions: ["使用人民币"],
    openQuestions: ["是否需要导出 CSV"],
  }),
]);

describe("runPlanAgent", () => {
  it("returns a reviewable specification and reports the planner stage", async () => {
    const runtime = createFauxRuntime([planCall, fauxAssistantMessage("Ready for review.")]);
    const { seen, report } = recordStages();

    const plan = await runPlanAgent({ prompt: "做一个记账应用" }, report, runtime);

    expect(seen).toEqual(["planner:active", "planner:completed"]);
    expect(plan).toEqual({
      goal: "记录每笔收支并随时看到余额",
      coreFeatures: ["添加记录", "计算余额"],
      nonGoals: ["不接入银行接口"],
      assumptions: ["使用人民币"],
      openQuestions: ["是否需要导出 CSV"],
    });
  });

  it("fails with a stable code when the model never proposes a plan", async () => {
    const runtime = createFauxRuntime([fauxAssistantMessage("I would rather chat.")]);
    const { seen, report } = recordStages();

    await expect(runPlanAgent({ prompt: "做一个记账应用" }, report, runtime)).rejects.toBeInstanceOf(BuildError);
    expect(seen).toEqual(["planner:active", "planner:failed"]);
  });

  it("stops instead of looping when the model keeps proposing the same plan", async () => {
    const runtime = createFauxRuntime([planCall, planCall, planCall, planCall]);
    const { seen, report } = recordStages();

    const plan = await runPlanAgent({ prompt: "做一个记账应用" }, report, runtime);

    expect(plan.goal).toBe("记录每笔收支并随时看到余额");
    expect(seen).toEqual(["planner:active", "planner:completed"]);
  });

  it("refuses to plan without model configuration", async () => {
    await expect(runPlanAgent({ prompt: "做一个记账应用" }, () => {}, null)).rejects.toMatchObject({
      code: "CONFIG_MISSING",
    });
  });
});
