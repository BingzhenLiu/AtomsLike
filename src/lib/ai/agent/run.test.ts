import { describe, expect, it } from "vitest";
import {
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
  type FauxResponseStep,
} from "@earendil-works/pi-ai";
import { BuildError } from "../build-error";
import type { BuildStage, BuildStageStatus } from "../build-stream";
import { runBuildAgent } from "./run";
import type { AgentRuntime } from "./runtime";

const validHtml =
  "<!doctype html><html><head><style>body{color:#111}</style></head><body><button id=go>Go</button><script>document.querySelector('#go').onclick=()=>{document.body.dataset.done='yes'}</script></body></html>";

const invalidHtml = "<html><body><script>fetch('/x')</script></body></html>";

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

function designCall() {
  return fauxAssistantMessage([
    fauxToolCall("design_app", { layout: "Form beside summary", interactions: ["Add entry", "Read balance"] }),
  ]);
}

function writeCall(html: string) {
  return fauxAssistantMessage([
    fauxToolCall("write_app", { projectName: "Ledger", summary: "Created a ledger", html }),
  ]);
}

describe("runBuildAgent", () => {
  it("drives every stage from real tool calls and returns the hardened document", async () => {
    const runtime = createFauxRuntime([designCall(), writeCall(validHtml), fauxAssistantMessage("Done.")]);
    const { seen, report } = recordStages();

    const result = await runBuildAgent(
      { prompt: "Build a ledger", plan: { goal: "Track spending", coreFeatures: ["Add entries"], nonGoals: [], assumptions: [], openQuestions: [] } },
      report,
      runtime,
    );

    expect(seen).toEqual([
      "designer:active",
      "designer:completed",
      "engineer:active",
      "engineer:completed",
      "reviewer:active",
      "reviewer:completed",
    ]);
    expect(result).toMatchObject({ projectName: "Ledger", summary: "Created a ledger", mode: "live" });
    expect(result.html).toContain("Content-Security-Policy");
    expect(result.html).toContain("connect-src 'none'");
  });

  it("reports a rejected document back to the model and accepts the corrected retry", async () => {
    const runtime = createFauxRuntime([
      designCall(),
      writeCall(invalidHtml),
      writeCall(validHtml),
      fauxAssistantMessage("Done."),
    ]);
    const { seen, report } = recordStages();

    const result = await runBuildAgent({ prompt: "Build a ledger" }, report, runtime);

    expect(result.html).toContain("Content-Security-Policy");
    expect(seen).toContain("engineer:completed");
    expect(seen.at(-1)).toBe("reviewer:completed");
    expect(seen.filter((entry) => entry === "engineer:completed")).toHaveLength(1);
  });

  it("fails with a stable code when the model never returns a usable document", async () => {
    const runtime = createFauxRuntime([fauxAssistantMessage("I cannot help with that.")]);

    await expect(runBuildAgent({ prompt: "Build a ledger" }, () => {}, runtime)).rejects.toBeInstanceOf(BuildError);
  });

  it("refuses to run without model configuration", async () => {
    await expect(runBuildAgent({ prompt: "Build a ledger" }, () => {}, null)).rejects.toMatchObject({
      code: "CONFIG_MISSING",
    });
  });
});
