import type { AgentTool, BeforeToolCallContext, BeforeToolCallResult } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import type { PlanResponse } from "../contract";
import { hardenGeneratedHtml } from "@/lib/preview/harden-html";
import { validateGeneratedHtml } from "@/lib/preview/validate-html";

export type AppDesign = { layout: string; interactions: string[] };
export type AppDraft = { projectName: string; summary: string; html: string };

const proposePlanParameters = Type.Object({
  goal: Type.String({ description: "One sentence describing what the user will get" }),
  coreFeatures: Type.Array(Type.String(), {
    minItems: 1,
    maxItems: 8,
    description: "Concrete behaviours the application will implement",
  }),
  nonGoals: Type.Array(Type.String(), {
    maxItems: 8,
    description: "Things this version deliberately will not do",
  }),
  assumptions: Type.Array(Type.String(), {
    maxItems: 8,
    description: "Defaults you chose that the user may want to change",
  }),
  openQuestions: Type.Array(Type.String(), {
    maxItems: 8,
    description: "Unresolved questions, or an empty list when the request is unambiguous",
  }),
});

const designParameters = Type.Object({
  layout: Type.String({ description: "How the screen is arranged and why" }),
  interactions: Type.Array(Type.String(), {
    minItems: 2,
    maxItems: 6,
    description: "What the user can actually do in the interface",
  }),
});

const writeParameters = Type.Object({
  projectName: Type.String({ description: "Short product name, at most 80 characters" }),
  summary: Type.String({ description: "One sentence describing the result for the user, in their language" }),
  html: Type.String({ description: "The complete single-file HTML document" }),
});

export type PlanTool = AgentTool<typeof proposePlanParameters>;
export type BuildTool = AgentTool<typeof designParameters> | AgentTool<typeof writeParameters>;

export type PlanTools = {
  tools: PlanTool[];
  capture: { plan: PlanResponse | null };
};

export type BuildTools = {
  tools: BuildTool[];
  beforeToolCall: (context: BeforeToolCallContext) => Promise<BeforeToolCallResult | undefined>;
  capture: { design: AppDesign | null; draft: AppDraft | null };
  accepted: () => boolean;
  lastRejection: () => string | null;
};

export type BuildCapture = BuildTools["capture"];

const MAX_WRITE_ATTEMPTS = 3;
const MAX_BUILD_TOOL_CALLS = 8;

/** Phase one: the only thing the planning agent is allowed to produce. */
export function createPlanTools(): PlanTools {
  const capture: { plan: PlanResponse | null } = { plan: null };

  const proposePlanTool: PlanTool = {
    name: "propose_plan",
    label: "Planner",
    description: "Send the specification the user will approve or ask to change.",
    parameters: proposePlanParameters,
    execute: async (_toolCallId, params) => {
      capture.plan = {
        goal: params.goal,
        coreFeatures: params.coreFeatures,
        nonGoals: params.nonGoals,
        assumptions: params.assumptions,
        openQuestions: params.openQuestions,
      };
      return { content: [{ type: "text", text: "plan recorded" }], details: {} };
    },
  };

  return { tools: [proposePlanTool], capture };
}

/**
 * Phase two: design and ship the approved specification. `write_app` validates
 * the document before accepting it, so a rejected attempt is reported back to
 * the model as a tool error instead of replacing the current preview.
 */
export function createBuildTools(): BuildTools {
  const capture: BuildCapture = { design: null, draft: null };
  let writeAttempts = 0;
  let toolCalls = 0;
  let rejection: string | null = null;

  const designTool: AgentTool<typeof designParameters> = {
    name: "design_app",
    label: "Designer",
    description: "Record the layout and the interactions the user will perform. Call this first.",
    parameters: designParameters,
    execute: async (_toolCallId, params) => {
      capture.design = { layout: params.layout, interactions: params.interactions };
      return { content: [{ type: "text", text: "design recorded" }], details: {} };
    },
  };

  const writeTool: AgentTool<typeof writeParameters> = {
    name: "write_app",
    label: "Engineer",
    description: "Send the complete application document. Call this last, once, per revision.",
    parameters: writeParameters,
    execute: async (_toolCallId, params) => {
      const validation = validateGeneratedHtml(params.html);
      if (!validation.ok) {
        rejection = validation.reason;
        throw new Error(`write_app rejected: ${validation.reason}. Fix the document and call write_app again.`);
      }

      capture.draft = {
        projectName: params.projectName.trim().slice(0, 80),
        summary: params.summary.trim().slice(0, 500),
        html: hardenGeneratedHtml(params.html),
      };
      rejection = null;
      return { content: [{ type: "text", text: "accepted: the application passed validation" }], details: {} };
    },
  };

  return {
    tools: [designTool, writeTool],
    capture,
    accepted: () => capture.draft !== null,
    lastRejection: () => rejection,
    beforeToolCall: async (context) => {
      toolCalls += 1;
      if (toolCalls > MAX_BUILD_TOOL_CALLS) {
        return { block: true, reason: "Tool budget exhausted.", terminate: true };
      }
      if (context.toolCall.name !== "write_app") return undefined;
      writeAttempts += 1;
      if (writeAttempts > MAX_WRITE_ATTEMPTS) {
        return { block: true, reason: "write_app attempt limit reached.", terminate: true };
      }
      return undefined;
    },
  };
}
