import {
  AGENT_STEPS,
  EMPTY_WORKSPACE,
  type AgentStepId,
  type AppError,
  type AppVersion,
  type PersistedWorkspace,
  type Project,
  type WorkspaceState,
} from "./types";

export type WorkspaceAction =
  | { type: "WORKSPACE_HYDRATED"; workspace: PersistedWorkspace; warning?: AppError }
  | { type: "PROMPT_SUBMITTED"; prompt: string; buildId: string; now: string }
  | { type: "BUILD_STEP_CHANGED"; step: AgentStepId }
  | {
      type: "BUILD_SUCCEEDED";
      buildId: string;
      prompt: string;
      projectName: string;
      summary: string;
      html: string;
      mode: "live" | "demo";
      versionId: string;
      messageId: string;
      now: string;
    }
  | { type: "BUILD_FAILED"; error: AppError }
  | { type: "VERSION_SELECTED"; versionId: string; now: string }
  | { type: "STORAGE_WARNING"; warning: AppError }
  | { type: "ERROR_DISMISSED" }
  | { type: "RESULT_TAB_CHANGED"; tab: "preview" | "code" }
  | { type: "VIEWPORT_CHANGED"; viewport: "desktop" | "tablet" | "mobile" }
  | { type: "MOBILE_PANE_CHANGED"; pane: "chat" | "result" };

export const initialWorkspaceState: WorkspaceState = {
  workspace: EMPTY_WORKSPACE,
  hydration: "loading",
  build: null,
  error: null,
  storageWarning: null,
  lastPrompt: "",
  resultTab: "preview",
  viewport: "desktop",
  mobilePane: "chat",
};

function withStepActive(state: WorkspaceState, activeStep: AgentStepId): WorkspaceState {
  if (!state.build || state.build.status !== "running") return state;
  const activeIndex = state.build.steps.findIndex((step) => step.id === activeStep);
  return {
    ...state,
    build: {
      ...state.build,
      steps: state.build.steps.map((step, index) => ({
        ...step,
        status: index < activeIndex ? "completed" : index === activeIndex ? "active" : "pending",
      })),
    },
  };
}

function createProject(prompt: string, buildId: string, now: string): Project {
  return {
    id: crypto.randomUUID(),
    name: "Untitled build",
    createdAt: now,
    updatedAt: now,
    messages: [
      { id: crypto.randomUUID(), role: "user", content: prompt, createdAt: now, buildId },
    ],
    versions: [],
    currentVersionId: null,
  };
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "WORKSPACE_HYDRATED":
      return {
        ...state,
        workspace: action.workspace,
        hydration: "ready",
        storageWarning: action.warning ?? null,
      };

    case "PROMPT_SUBMITTED": {
      const project = state.workspace.project
        ? {
            ...state.workspace.project,
            updatedAt: action.now,
            messages: [
              ...state.workspace.project.messages,
              {
                id: crypto.randomUUID(),
                role: "user" as const,
                content: action.prompt,
                createdAt: action.now,
                buildId: action.buildId,
              },
            ],
          }
        : createProject(action.prompt, action.buildId, action.now);

      return {
        ...state,
        workspace: { ...state.workspace, project },
        build: {
          id: action.buildId,
          prompt: action.prompt,
          status: "running",
          startedAt: action.now,
          steps: AGENT_STEPS.map((step, index) => ({
            ...step,
            status: index === 0 ? "active" : "pending",
          })),
        },
        lastPrompt: action.prompt,
        error: null,
      };
    }

    case "BUILD_STEP_CHANGED":
      return withStepActive(state, action.step);

    case "BUILD_SUCCEEDED": {
      if (!state.workspace.project || state.build?.id !== action.buildId) return state;
      const version: AppVersion = {
        id: action.versionId,
        buildId: action.buildId,
        prompt: action.prompt,
        summary: action.summary,
        html: action.html,
        createdAt: action.now,
        mode: action.mode,
      };
      return {
        ...state,
        workspace: {
          ...state.workspace,
          project: {
            ...state.workspace.project,
            name: state.workspace.project.versions.length === 0 ? action.projectName : state.workspace.project.name,
            updatedAt: action.now,
            currentVersionId: version.id,
            versions: [...state.workspace.project.versions, version],
            messages: [
              ...state.workspace.project.messages,
              {
                id: action.messageId,
                role: "assistant",
                content: action.summary,
                createdAt: action.now,
                buildId: action.buildId,
              },
            ],
          },
        },
        build: state.build
          ? {
              ...state.build,
              status: "succeeded",
              steps: state.build.steps.map((step) => ({ ...step, status: "completed" })),
            }
          : null,
        error: null,
        resultTab: "preview",
        mobilePane: "result",
      };
    }

    case "BUILD_FAILED": {
      if (!state.build) return { ...state, error: action.error };
      const activeIndex = state.build.steps.findIndex((step) => step.status === "active");
      return {
        ...state,
        build: {
          ...state.build,
          status: "failed",
          error: action.error,
          steps: state.build.steps.map((step, index) =>
            index === activeIndex ? { ...step, status: "failed" } : step,
          ),
        },
        error: action.error,
      };
    }

    case "VERSION_SELECTED":
      if (!state.workspace.project?.versions.some((version) => version.id === action.versionId)) return state;
      return {
        ...state,
        workspace: {
          ...state.workspace,
          project: {
            ...state.workspace.project,
            currentVersionId: action.versionId,
            updatedAt: action.now,
          },
        },
        resultTab: "preview",
        mobilePane: "result",
      };

    case "STORAGE_WARNING":
      return { ...state, storageWarning: action.warning };
    case "ERROR_DISMISSED":
      return { ...state, error: null, storageWarning: null };
    case "RESULT_TAB_CHANGED":
      return { ...state, resultTab: action.tab };
    case "VIEWPORT_CHANGED":
      return { ...state, viewport: action.viewport };
    case "MOBILE_PANE_CHANGED":
      return { ...state, mobilePane: action.pane };
    default:
      return state;
  }
}
