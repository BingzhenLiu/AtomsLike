import type { AppVersion, WorkspaceState } from "./types";

export function selectCurrentVersion(state: WorkspaceState): AppVersion | null {
  const project = state.workspace.project;
  if (!project?.currentVersionId) return null;
  return project.versions.find((version) => version.id === project.currentVersionId) ?? null;
}

export function selectIsBuilding(state: WorkspaceState): boolean {
  return state.build?.status === "running";
}
