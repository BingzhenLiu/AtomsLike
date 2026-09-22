import { describe, expect, it } from "vitest";
import { LocalStorageProjectRepository } from "./local-storage";
import { EMPTY_WORKSPACE, WORKSPACE_SCHEMA_VERSION, type PersistedWorkspace } from "./types";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

describe("LocalStorageProjectRepository", () => {
  it("round-trips a versioned workspace", () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageProjectRepository(storage);
    const workspace: PersistedWorkspace = {
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      project: {
        id: "project-1",
        name: "Demo",
        createdAt: "2026-09-22T04:00:00.000Z",
        updatedAt: "2026-09-22T04:00:00.000Z",
        messages: [],
        versions: [],
        currentVersionId: null,
        pendingPlan: null,
        approvedPlan: null,
      },
    };

    expect(repository.save(workspace)).toEqual({ ok: true });
    expect(repository.load().workspace).toEqual(workspace);
  });

  it("falls back safely when storage contains corrupt data", () => {
    const storage = new MemoryStorage();
    storage.setItem("atomforge.workspace.v1", "{not-json");
    const result = new LocalStorageProjectRepository(storage).load();

    expect(result.workspace).toEqual(EMPTY_WORKSPACE);
    expect(result.warning?.code).toBe("STORAGE_CORRUPT");
  });

  it("migrates a workspace written before the approval gate existed", () => {
    const storage = new MemoryStorage();
    storage.setItem("atomforge.workspace.v1", JSON.stringify({
      schemaVersion: 1,
      project: {
        id: "project-1",
        name: "Legacy",
        createdAt: "2026-09-22T04:00:00.000Z",
        updatedAt: "2026-09-22T04:00:00.000Z",
        messages: [],
        versions: [
          {
            id: "version-1",
            buildId: "build-1",
            prompt: "Build a tracker",
            summary: "Created a tracker",
            html: "<!doctype html><html><head></head><body></body></html>",
            createdAt: "2026-09-22T04:00:02.000Z",
            mode: "demo",
          },
        ],
        currentVersionId: "version-1",
      },
    }));

    const result = new LocalStorageProjectRepository(storage).load();

    expect(result.warning).toBeUndefined();
    expect(result.workspace.schemaVersion).toBe(WORKSPACE_SCHEMA_VERSION);
    expect(result.workspace.project?.pendingPlan).toBeNull();
    expect(result.workspace.project?.approvedPlan).toBeNull();
    expect(result.workspace.project?.versions[0].planId).toBeNull();
    expect(result.workspace.project?.currentVersionId).toBe("version-1");
  });
});
