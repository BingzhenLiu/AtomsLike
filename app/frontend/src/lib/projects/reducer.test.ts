import { describe, expect, it } from "vitest";
import { createWorkspaceState, workspaceReducer } from "./reducer";
import { selectIsBusy, selectStageProgress, selectStages } from "./selectors";
import type { ProjectVersion } from "./types";

function version(id: string, index: number): ProjectVersion {
  return {
    id,
    index,
    html: "<!doctype html><html><head></head><body>ok</body></html>",
    summary: `v${index}`,
    prompt: "记账应用",
    revision: index > 1 ? { id: `rev_${id}`, prompt: "加上月份筛选", createdAt: 1 } : null,
    createdAt: index,
  };
}

describe("workspaceReducer", () => {
  it("starts planning and activates the planner stage", () => {
    const next = workspaceReducer(createWorkspaceState(), {
      type: "plan-start",
      prompt: "帮我做一个记账应用",
    });
    expect(next.isPlanning).toBe(true);
    expect(next.prompt).toBe("帮我做一个记账应用");
    expect(selectStages(next)[0]).toEqual({ stage: "planner", status: "active" });
  });

  it("clears the previous plan when replanning so stale approvals cannot be built", () => {
    const planned = workspaceReducer(createWorkspaceState(), {
      type: "plan-success",
      plan: {
        title: "记账",
        goal: "记录收支",
        features: ["新增"],
        nonGoals: [],
        assumptions: [],
        openQuestions: [],
      },
    });
    const replanned = workspaceReducer(planned, { type: "plan-start", prompt: "做个番茄钟" });
    expect(replanned.plan).toBeNull();
    expect(replanned.isPlanning).toBe(true);
  });

  it("keeps building state out of the busy selector once a build finishes", () => {
    const built = workspaceReducer(
      workspaceReducer(createWorkspaceState(), { type: "build-start" }),
      { type: "build-success", version: version("v1", 1) },
    );
    expect(selectIsBusy(built)).toBe(false);
    expect(built.activeVersionId).toBe("v1");
    expect(selectStageProgress(built)).toBe(100);
  });

  it("activates the newest version after a revision instead of keeping the old one selected", () => {
    const first = workspaceReducer(
      workspaceReducer(createWorkspaceState(), { type: "build-start" }),
      { type: "build-success", version: version("v1", 1) },
    );
    const second = workspaceReducer(
      workspaceReducer(first, { type: "revise-start", changeRequest: "加上月份筛选" }),
      { type: "build-success", version: version("v2", 2) },
    );
    expect(second.versions).toHaveLength(2);
    expect(second.activeVersionId).toBe("v2");
    expect(second.isRevising).toBe(false);
  });

  it("remembers a failed revision so retry repeats the revision rather than the first build", () => {
    const first = workspaceReducer(
      workspaceReducer(createWorkspaceState(), { type: "build-start" }),
      { type: "build-success", version: version("v1", 1) },
    );
    const revising = workspaceReducer(first, {
      type: "revise-start",
      changeRequest: "把结余放到最上方",
    });
    const failed = workspaceReducer(revising, {
      type: "build-error",
      error: { code: "PROVIDER_TIMEOUT", message: "生成超时" },
    });

    expect(failed.pendingRevision).toBe("把结余放到最上方");
    expect(failed.isRevising).toBe(false);
    expect(failed.buildError?.code).toBe("PROVIDER_TIMEOUT");
    expect(selectStages(failed).some((item) => item.status === "failed")).toBe(true);

    const retried = workspaceReducer(failed, {
      type: "revise-start",
      changeRequest: failed.pendingRevision as string,
    });
    expect(retried.isRevising).toBe(true);
    expect(retried.buildError).toBeNull();
  });

  it("clears the pending revision once the revision succeeds", () => {
    const revising = workspaceReducer(
      workspaceReducer(createWorkspaceState(), { type: "build-start" }),
      { type: "revise-start", changeRequest: "换个配色" },
    );
    const done = workspaceReducer(revising, { type: "build-success", version: version("v1", 1) });
    expect(done.pendingRevision).toBeNull();
  });

  it("ignores selection of an unknown version", () => {
    const state = workspaceReducer(createWorkspaceState(), { type: "build-start" });
    expect(workspaceReducer(state, { type: "select-version", versionId: "missing" })).toBe(state);
  });

  it("resets the workspace but keeps the chosen mode", () => {
    const demo = workspaceReducer(createWorkspaceState(), { type: "set-mode", mode: "demo" });
    const cleared = workspaceReducer(demo, { type: "reset-workspace" });
    expect(cleared.mode).toBe("demo");
    expect(cleared.versions).toHaveLength(0);
    expect(cleared.plan).toBeNull();
    expect(cleared.prompt).toBe("");
  });
});
