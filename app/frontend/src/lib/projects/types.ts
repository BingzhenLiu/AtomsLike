import type { BuildErrorPayload } from "@/lib/ai/errors";
import type { BuildStage, BuildStageStatus } from "@/lib/ai/stages";

export type WorkspaceMode = "live" | "demo";

export type AgentStageState = {
  stage: BuildStage;
  status: BuildStageStatus;
};

export type Revision = { id: string; prompt: string; createdAt: number };

export type ProjectVersion = {
  id: string;
  index: number;
  html: string;
  summary: string;
  prompt: string;
  revision: Revision | null;
  createdAt: number;
};

export type PlanPayload = {
  title: string;
  goal: string;
  features: string[];
  nonGoals: string[];
  assumptions: string[];
  openQuestions: string[];
};

export type WorkspaceState = {
  id: string;
  mode: WorkspaceMode;
  prompt: string;
  plan: PlanPayload | null;
  isPlanning: boolean;
  isBuilding: boolean;
  isRevising: boolean;
  /** Last revision request, kept so a failed revision can be retried as a revision. */
  pendingRevision: string | null;
  planError: BuildErrorPayload | null;
  buildError: BuildErrorPayload | null;
  stages: AgentStageState[];
  versions: ProjectVersion[];
  activeVersionId: string | null;
  updatedAt: number;
};
