import {
  AGENT_STEPS,
  EMPTY_WORKSPACE,
  type AgentStepId,
  type AppError,
  type AppVersion,
  type BuildPlan,
  type PersistedWorkspace,
  type Project,
  type WorkspaceState,
} from "./types";

export type WorkspaceAction =
  | { type: "WORKSPACE_HYDRATED"; workspace: PersistedWorkspace; warning?: AppError }
  | { type: "PROMPT_SUBMITTED"; prompt: string; buildId: string; now: string }
  | { type: "PLAN_REQUESTED"; prompt: string; note?: string; buildId: string; now: string }
  | { type: "PLAN_READY"; plan: BuildPlan }
  | { type: "PLAN_APPROVED"; buildId: string; now: string }
  | { type: "PLAN_DISCARDED" }
  | { type: "BUILD_RETRIED"; buildId: string; now: string }
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
    pendingPlan: null,
    approvedPlan: null,
  };
}

function appendUserMessage(project: Project, prompt: string, buildId: string, now: string): Project {
  return {
    ...project,
    updatedAt: now,
    messages: [
      ...project.messages,
      { id: crypto.randomUUID(), role: "user", content: prompt, createdAt: now, buildId },
    ],
  };
}

function stepsFrom(activeStep: AgentStepId) {
  const activeIndex = AGENT_STEPS.findIndex((step) => step.id === activeStep);
  return AGENT_STEPS.map((step, index) => ({
    ...step,
    status: index < activeIndex ? ("completed" as const) : index === activeIndex ? ("active" as const) : ("pending" as const),
  }));
}

function createSession(input: {
  buildId: string;
  prompt: string;
  phase: "plan" | "build";
  now: string;
  activeStep: AgentStepId;
}) {
  return {
    id: input.buildId,
    prompt: input.prompt,
    phase: input.phase,
    status: "running" as const,
    startedAt: input.now,
    steps: stepsFrom(input.activeStep),
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
        ? appendUserMessage(state.workspace.project, action.prompt, action.buildId, action.now)
        : createProject(action.prompt, action.buildId, action.now);

      return {
        ...state,
        workspace: { ...state.workspace, project },
        build: createSession({
          buildId: action.buildId,
          prompt: action.prompt,
          phase: "build",
          now: action.now,
          activeStep: "designer",
        }),
        lastPrompt: action.prompt,
        error: null,
      };
    }

    case "PLAN_REQUESTED": {
      const content = action.note?.trim() ? action.note.trim() : action.prompt;
      const project = state.workspace.project
        ? appendUserMessage(state.workspace.project, content, action.buildId, action.now)
        : createProject(action.prompt, action.buildId, action.now);

      return {
        ...state,
        workspace: {
          ...state.workspace,
          project: { ...project, pendingPlan: null },
        },
        build: createSession({
          buildId: action.buildId,
          prompt: action.prompt,
          phase: "plan",
          now: action.now,
          activeStep: "planner",
        }),
        lastPrompt: action.prompt,
        error: null,
      };
    }

    case "PLAN_READY": {
      if (!state.workspace.project || state.build?.phase !== "plan") return state;
      return {
        ...state,
        workspace: {
          ...state.workspace,
          project: { ...state.workspace.project, pendingPlan: action.plan },
        },
        build: {
          ...state.build,
          status: "awaiting_approval",
          steps: AGENT_STEPS.map((step) =>
            step.id === "planner" ? { ...step, status: "completed" as const } : { ...step, status: "pending" as const },
          ),
        },
        error: null,
      };
    }

    case "PLAN_APPROVED": {
      const project = state.workspace.project;
      if (!project?.pendingPlan) return state;
      return {
        ...state,
        workspace: {
          ...state.workspace,
          project: { ...project, approvedPlan: project.pendingPlan, pendingPlan: null, updatedAt: action.now },
        },
        build: createSession({
          buildId: action.buildId,
          prompt: project.pendingPlan.prompt,
          phase: "build",
          now: action.now,
          activeStep: "designer",
        }),
        error: null,
      };
    }

    case "PLAN_DISCARDED": {
      if (!state.workspace.project) return { ...state, build: null };
      return {
        ...state,
        workspace: {
          ...state.workspace,
          project: { ...state.workspace.project, pendingPlan: null },
        },
        build: null,
        error: null,
      };
    }

    case "BUILD_RETRIED": {
      if (!state.build || state.build.status !== "failed") return state;
      const phase = state.build.phase;
      return {
        ...state,
        build: createSession({
          buildId: action.buildId,
          prompt: state.build.prompt,
          phase,
          now: action.now,
          activeStep: phase === "plan" ? "planner" : "designer",
        }),
        error: null,
      };
    }

    case "BUILD_STEP_CHANGED":
      return withStepActive(state, action.step);

    case "BUILD_SUCCEEDED": {
      const session = state.build;
      if (
        !state.workspace.project ||
        session?.id !== action.buildId ||
        session.status !== "running" ||
        session.phase !== "build"
      ) {
        return state;
      }
      const version: AppVersion = {
        id: action.versionId,
        buildId: action.buildId,
        prompt: action.prompt,
        summary: action.summary,
        html: action.html,
        createdAt: action.now,
        mode: action.mode,
        planId: state.workspace.project.approvedPlan?.id ?? null,
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
