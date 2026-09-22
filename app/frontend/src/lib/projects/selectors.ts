import { BUILD_STAGES, type BuildStage } from "@/lib/ai/stages";
import type { AgentStageState, ProjectVersion, WorkspaceState } from "./types";

export const STAGE_LABELS: Record<BuildStage, { label: string; detail: string }> = {
  planner: { label: "Planner", detail: "澄清需求并产出方案" },
  designer: { label: "Designer", detail: "定义界面结构与交互" },
  engineer: { label: "Engineer", detail: "实现完整可运行 HTML" },
  reviewer: { label: "Reviewer", detail: "校验可用性与安全约束" },
};

export function selectActiveVersion(state: WorkspaceState): ProjectVersion | null {
  return (
    state.versions.find((version) => version.id === state.activeVersionId) ??
    state.versions[state.versions.length - 1] ??
    null
  );
}

export function selectStages(state: WorkspaceState): AgentStageState[] {
  const known = new Map(state.stages.map((item) => [item.stage, item.status]));
  return BUILD_STAGES.map((stage) => ({
    stage,
    status: known.get(stage) ?? "pending",
  }));
}

export function selectCurrentRevision(state: WorkspaceState) {
  return selectActiveVersion(state)?.revision ?? null;
}

export function selectIsBusy(state: WorkspaceState) {
  return state.isPlanning || state.isBuilding;
}

export function selectStageProgress(state: WorkspaceState) {
  const stages = selectStages(state);
  const completed = stages.filter((item) => item.status === "completed").length;
  return Math.round((completed / stages.length) * 100);
}
