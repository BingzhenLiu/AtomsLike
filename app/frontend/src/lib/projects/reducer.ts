import type { BuildErrorPayload } from "@/lib/ai/errors";
import { BUILD_STAGES, type BuildStage, type BuildStageStatus } from "@/lib/ai/stages";
import type { AgentStageState, PlanPayload, ProjectVersion, WorkspaceState } from "./types";

export type WorkspaceAction =
  | { type: "hydrate"; state: WorkspaceState }
  | { type: "set-prompt"; prompt: string }
  | { type: "set-mode"; mode: WorkspaceState["mode"] }
  | { type: "plan-start"; prompt: string }
  | { type: "plan-success"; plan: PlanPayload }
  | { type: "plan-error"; error: BuildErrorPayload }
  | { type: "reset-plan" }
  | { type: "build-start" }
  | { type: "stage"; stage: BuildStage; status: BuildStageStatus }
  | { type: "build-success"; version: ProjectVersion }
  | { type: "build-error"; error: BuildErrorPayload }
  | { type: "revise-start"; changeRequest: string }
  | { type: "select-version"; versionId: string }
  | { type: "reset-workspace" };

const allStages = (status: BuildStageStatus): AgentStageState[] =>
  BUILD_STAGES.map((stage) => ({ stage, status }));

const pendingStages = () => allStages("pending");

/** A build never re-runs the approved planner, so it stays completed while the rest restart. */
const buildStages = (): AgentStageState[] =>
  BUILD_STAGES.map((stage) => ({
    stage,
    status: stage === "planner" ? "completed" : "pending",
  }));

function hasAllStages(stages: AgentStageState[]) {
  return BUILD_STAGES.every((stage) => stages.some((item) => item.stage === stage));
}

function withStage(
  stages: AgentStageState[],
  stage: BuildStage,
  status: BuildStageStatus,
): AgentStageState[] {
  const base = hasAllStages(stages) ? stages : pendingStages();
  return base.map((item) => (item.stage === stage ? { ...item, status } : item));
}

/** A failed build keeps the previous plan so the user can retry without replanning. */
function failBuild(state: WorkspaceState, error: BuildErrorPayload): WorkspaceState {
  const interrupted = state.stages.find((item) => item.status === "active")?.stage ?? null;
  const fallback = state.stages.find((item) => item.status === "pending")?.stage ?? null;
  const failedStage = interrupted ?? fallback;
  return {
    ...state,
    isBuilding: false,
    isRevising: false,
    buildError: error,
    updatedAt: Date.now(),
    stages: state.stages.map((item) =>
      item.stage === failedStage ? { ...item, status: "failed" } : item,
    ),
  };
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "hydrate":
      return action.state;

    case "set-prompt":
      return { ...state, prompt: action.prompt, updatedAt: Date.now() };

    case "set-mode":
      return { ...state, mode: action.mode, updatedAt: Date.now() };

    case "plan-start":
      return {
        ...state,
        prompt: action.prompt,
        isPlanning: true,
        planError: null,
        buildError: null,
        plan: null,
        stages: withStage(state.stages, "planner", "active"),
        updatedAt: Date.now(),
      };

    case "plan-success":
      return {
        ...state,
        isPlanning: false,
        plan: action.plan,
        planError: null,
        stages: withStage(state.stages, "planner", "completed"),
        updatedAt: Date.now(),
      };

    case "plan-error":
      return {
        ...state,
        isPlanning: false,
        planError: action.error,
        stages: withStage(state.stages, "planner", "failed"),
        updatedAt: Date.now(),
      };

    case "reset-plan":
      return {
        ...state,
        plan: null,
        isPlanning: false,
        planError: null,
        buildError: null,
        stages: pendingStages(),
        updatedAt: Date.now(),
      };

    case "build-start":
      return {
        ...state,
        isBuilding: true,
        isRevising: false,
        buildError: null,
        stages: buildStages(),
        updatedAt: Date.now(),
      };

    case "stage":
      return { ...state, stages: withStage(state.stages, action.stage, action.status), updatedAt: Date.now() };

    case "build-success":
      return {
        ...state,
        isBuilding: false,
        isRevising: false,
        buildError: null,
        pendingRevision: null,
        versions: [...state.versions, action.version],
        activeVersionId: action.version.id,
        stages: allStages("completed"),
        updatedAt: Date.now(),
      };

    case "build-error":
      return failBuild(state, action.error);

    case "revise-start":
      return {
        ...state,
        isBuilding: true,
        isRevising: true,
        buildError: null,
        pendingRevision: action.changeRequest,
        stages: buildStages(),
        updatedAt: Date.now(),
      };

    case "select-version":
      return state.versions.some((item) => item.id === action.versionId)
        ? { ...state, activeVersionId: action.versionId, updatedAt: Date.now() }
        : state;

    case "reset-workspace":
      return createWorkspaceState(state.mode);

    default:
      return state;
  }
}

export function createWorkspaceState(mode: WorkspaceState["mode"] = "live"): WorkspaceState {
  return {
    id: `ws_${Date.now().toString(36)}`,
    mode,
    prompt: "",
    plan: null,
    isPlanning: false,
    isBuilding: false,
    isRevising: false,
    pendingRevision: null,
    planError: null,
    buildError: null,
    stages: pendingStages(),
    versions: [],
    activeVersionId: null,
    updatedAt: Date.now(),
  };
}
