import { z } from "zod";
import type { ProjectRepository } from "./repository";
import { EMPTY_WORKSPACE, WORKSPACE_SCHEMA_VERSION, type PersistedWorkspace } from "./types";

const STORAGE_KEY = "atomforge.workspace.v1";
const STORAGE_LIMIT_BYTES = 3_500_000;

const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  createdAt: z.string(),
  buildId: z.string().optional(),
});

const planSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  goal: z.string(),
  coreFeatures: z.array(z.string()),
  nonGoals: z.array(z.string()),
  assumptions: z.array(z.string()),
  openQuestions: z.array(z.string()),
  revision: z.number(),
  createdAt: z.string(),
});

const versionSchema = z.object({
  id: z.string(),
  buildId: z.string(),
  prompt: z.string(),
  summary: z.string(),
  html: z.string(),
  createdAt: z.string(),
  mode: z.enum(["live", "demo"]),
  planId: z.string().nullable(),
});

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messages: z.array(messageSchema),
  versions: z.array(versionSchema),
  currentVersionId: z.string().nullable(),
  pendingPlan: planSchema.nullable(),
  approvedPlan: planSchema.nullable(),
});

const workspaceSchema = z.object({
  schemaVersion: z.literal(WORKSPACE_SCHEMA_VERSION),
  project: projectSchema.nullable(),
});

/** Shape written before the approval gate existed; only read, never written back. */
const versionSchemaV1 = versionSchema.omit({ planId: true });
const workspaceSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  project: z
    .object({
      id: z.string(),
      name: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
      messages: z.array(messageSchema),
      versions: z.array(versionSchemaV1),
      currentVersionId: z.string().nullable(),
    })
    .nullable(),
});

function migrateFromV1(workspace: z.infer<typeof workspaceSchemaV1>): PersistedWorkspace {
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    project: workspace.project
      ? {
          ...workspace.project,
          pendingPlan: null,
          approvedPlan: null,
          versions: workspace.project.versions.map((version) => ({ ...version, planId: null })),
        }
      : null,
  };
}

export class LocalStorageProjectRepository implements ProjectRepository {
  constructor(private readonly storage: Storage) {}

  load() {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return { workspace: EMPTY_WORKSPACE };

      const parsed: unknown = JSON.parse(raw);
      const current = workspaceSchema.safeParse(parsed);
      if (current.success) return { workspace: current.data as PersistedWorkspace };

      const legacy = workspaceSchemaV1.safeParse(parsed);
      if (legacy.success) return { workspace: migrateFromV1(legacy.data) };

      throw new Error("Invalid workspace schema");
    } catch {
      return {
        workspace: EMPTY_WORKSPACE,
        warning: {
          code: "STORAGE_CORRUPT" as const,
          message: "本地项目数据无法读取，已打开一个新的工作区。你可以继续生成，不会反复覆盖损坏数据。",
        },
      };
    }
  }

  save(workspace: PersistedWorkspace) {
    try {
      const serialized = JSON.stringify(workspace);
      if (new Blob([serialized]).size > STORAGE_LIMIT_BYTES) {
        return {
          ok: false as const,
          error: {
            code: "STORAGE_QUOTA" as const,
            message: "版本历史已接近浏览器存储上限。当前页面仍可使用，但新版本可能无法在刷新后恢复。",
          },
        };
      }
      this.storage.setItem(STORAGE_KEY, serialized);
      return { ok: true as const };
    } catch {
      return {
        ok: false as const,
        error: {
          code: "STORAGE_QUOTA" as const,
          message: "浏览器拒绝保存本次更新。请释放站点存储空间后重试。",
        },
      };
    }
  }

  clear() {
    this.storage.removeItem(STORAGE_KEY);
  }
}
