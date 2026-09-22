import { BUILD_STAGES } from "@/lib/ai/stages";
import { createWorkspaceState } from "./reducer";
import type { PlanPayload, ProjectVersion, WorkspaceState } from "./types";

const STORAGE_KEY = "atomforge.workspace.v2";
const LEGACY_KEY = "atomforge.workspace.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parsePlan(value: unknown): PlanPayload | null {
  if (!isRecord(value)) return null;
  const title = typeof value.title === "string" ? value.title : "";
  const goal = typeof value.goal === "string" ? value.goal : "";
  if (!title && !goal) return null;
  return {
    title,
    goal,
    features: toStringArray(value.features),
    nonGoals: toStringArray(value.nonGoals),
    assumptions: toStringArray(value.assumptions),
    openQuestions: toStringArray(value.openQuestions),
  };
}

function parseVersion(value: unknown): ProjectVersion | null {
  if (!isRecord(value)) return null;
  const html = typeof value.html === "string" ? value.html : "";
  if (!html) return null;
  const revision = isRecord(value.revision) && typeof value.revision.prompt === "string"
    ? {
        id: typeof value.revision.id === "string" ? value.revision.id : `rev_${Date.now()}`,
        prompt: value.revision.prompt,
        createdAt:
          typeof value.revision.createdAt === "number" ? value.revision.createdAt : Date.now(),
      }
    : null;
  return {
    id: typeof value.id === "string" ? value.id : `v_${Date.now()}`,
    index: typeof value.index === "number" ? value.index : 1,
    html,
    summary: typeof value.summary === "string" ? value.summary : "",
    prompt: typeof value.prompt === "string" ? value.prompt : "",
    revision,
    createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
  };
}

function parseState(raw: string): WorkspaceState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  const base = createWorkspaceState();
  const versions = Array.isArray(parsed.versions)
    ? parsed.versions
        .map(parseVersion)
        .filter((item): item is ProjectVersion => item !== null)
    : [];
  const activeVersionId =
    typeof parsed.activeVersionId === "string" &&
    versions.some((item) => item.id === parsed.activeVersionId)
      ? parsed.activeVersionId
      : (versions[versions.length - 1]?.id ?? null);

  return {
    ...base,
    id: typeof parsed.id === "string" ? parsed.id : base.id,
    mode: parsed.mode === "demo" ? "demo" : "live",
    prompt: typeof parsed.prompt === "string" ? parsed.prompt : "",
    plan: parsePlan(parsed.plan),
    pendingRevision: typeof parsed.pendingRevision === "string" ? parsed.pendingRevision : null,
    versions,
    activeVersionId,
    updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    stages: BUILD_STAGES.map((stage) => ({ stage, status: "pending" as const })),
  };
}

export function loadWorkspace(): WorkspaceState | null {
  if (typeof window === "undefined") return null;
  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (current) return parseState(current);
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    return legacy ? parseState(legacy) : null;
  } catch {
    return null;
  }
}

export function saveWorkspace(state: WorkspaceState): void {
  if (typeof window === "undefined") return;
  try {
    const persisted = { ...state, isPlanning: false, isBuilding: false, isRevising: false };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* storage full or unavailable: in-memory state stays authoritative */
  }
}
