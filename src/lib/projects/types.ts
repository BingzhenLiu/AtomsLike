export const WORKSPACE_SCHEMA_VERSION = 2 as const;

export type MessageRole = "user" | "assistant" | "system";

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  buildId?: string;
};

export type AppVersion = {
  id: string;
  buildId: string;
  prompt: string;
  summary: string;
  html: string;
  createdAt: string;
  mode: "live" | "demo";
  planId: string | null;
};

/** A reviewable specification the user approves before anything is built. */
export type BuildPlan = {
  id: string;
  prompt: string;
  goal: string;
  coreFeatures: string[];
  nonGoals: string[];
  assumptions: string[];
  openQuestions: string[];
  revision: number;
  createdAt: string;
};

export type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  versions: AppVersion[];
  currentVersionId: string | null;
  /** Awaiting the user's approval; survives a refresh so the gate can be resumed. */
  pendingPlan: BuildPlan | null;
  /** The approved specification the current build or latest version was built from. */
  approvedPlan: BuildPlan | null;
};

export type PersistedWorkspace = {
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION;
  project: Project | null;
};

export type AgentStepId = "planner" | "designer" | "engineer" | "reviewer";
export type AgentStepStatus = "pending" | "active" | "completed" | "failed";

export type AgentStep = {
  id: AgentStepId;
  label: string;
  description: string;
  status: AgentStepStatus;
};

export type BuildSession = {
  id: string;
  prompt: string;
  /** Which half of the two-phase flow this session belongs to. */
  phase: "plan" | "build";
  status: "running" | "awaiting_approval" | "succeeded" | "failed";
  steps: AgentStep[];
  startedAt: string;
  error?: AppError;
};

export type AppErrorCode =
  | "CONFIG_MISSING"
  | "REQUEST_INVALID"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_ERROR"
  | "OUTPUT_INVALID"
  | "STORAGE_CORRUPT"
  | "STORAGE_QUOTA"
  | "PREVIEW_REJECTED";

export type AppError = {
  code: AppErrorCode;
  message: string;
};

export type WorkspaceState = {
  workspace: PersistedWorkspace;
  hydration: "loading" | "ready";
  build: BuildSession | null;
  error: AppError | null;
  storageWarning: AppError | null;
  lastPrompt: string;
  resultTab: "preview" | "code";
  viewport: "desktop" | "tablet" | "mobile";
  mobilePane: "chat" | "result";
};

export const EMPTY_WORKSPACE: PersistedWorkspace = {
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  project: null,
};

export const AGENT_STEPS: AgentStep[] = [
  { id: "planner", label: "Planner", description: "整理目标与必要功能", status: "pending" },
  { id: "designer", label: "Designer", description: "确定布局与交互表达", status: "pending" },
  { id: "engineer", label: "Engineer", description: "生成完整可运行代码", status: "pending" },
  { id: "reviewer", label: "Reviewer", description: "校验并安全装载预览", status: "pending" },
];
