import type { AppError, PersistedWorkspace } from "./types";

export type LoadResult = { workspace: PersistedWorkspace; warning?: AppError };
export type SaveResult = { ok: true } | { ok: false; error: AppError };

export interface ProjectRepository {
  load(): LoadResult;
  save(workspace: PersistedWorkspace): SaveResult;
  clear(): void;
}
