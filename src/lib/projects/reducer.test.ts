import { describe, expect, it } from "vitest";
import { initialWorkspaceState, workspaceReducer } from "./reducer";

const html = "<!doctype html><html><head></head><body><button>Works</button></body></html>";

describe("workspaceReducer", () => {
  it("creates an immutable version only after a successful build", () => {
    const submitted = workspaceReducer(initialWorkspaceState, {
      type: "PROMPT_SUBMITTED",
      prompt: "Build a tracker",
      buildId: "build-1",
      now: "2026-09-22T04:00:00.000Z",
    });

    expect(submitted.workspace.project?.versions).toHaveLength(0);
    expect(submitted.build?.steps.map((step) => step.status)).toEqual([
      "completed",
      "active",
      "pending",
      "pending",
    ]);

    const succeeded = workspaceReducer(submitted, {
      type: "BUILD_SUCCEEDED",
      buildId: "build-1",
      prompt: "Build a tracker",
      projectName: "Tracker",
      summary: "Created a tracker",
      html,
      mode: "demo",
      versionId: "version-1",
      messageId: "message-1",
      now: "2026-09-22T04:00:02.000Z",
    });

    expect(succeeded.workspace.project?.versions).toHaveLength(1);
    expect(succeeded.workspace.project?.currentVersionId).toBe("version-1");
    expect(succeeded.workspace.project?.name).toBe("Tracker");
    expect(succeeded.build?.steps.every((step) => step.status === "completed")).toBe(true);
  });

  it("keeps the last known-good version when a later build fails", () => {
    const first = workspaceReducer(initialWorkspaceState, {
      type: "PROMPT_SUBMITTED",
      prompt: "Build a tracker",
      buildId: "build-1",
      now: "2026-09-22T04:00:00.000Z",
    });
    const good = workspaceReducer(first, {
      type: "BUILD_SUCCEEDED",
      buildId: "build-1",
      prompt: "Build a tracker",
      projectName: "Tracker",
      summary: "Created",
      html,
      mode: "demo",
      versionId: "version-1",
      messageId: "message-1",
      now: "2026-09-22T04:00:02.000Z",
    });
    const editing = workspaceReducer(good, {
      type: "PROMPT_SUBMITTED",
      prompt: "Make it dark",
      buildId: "build-2",
      now: "2026-09-22T04:01:00.000Z",
    });
    const failed = workspaceReducer(editing, {
      type: "BUILD_FAILED",
      error: { code: "PROVIDER_ERROR", message: "Failed" },
    });

    expect(failed.workspace.project?.versions).toHaveLength(1);
    expect(failed.workspace.project?.currentVersionId).toBe("version-1");
    expect(failed.build?.status).toBe("failed");
  });

  it("never builds before the plan is approved", () => {
    const requested = workspaceReducer(initialWorkspaceState, {
      type: "PLAN_REQUESTED",
      prompt: "Build a tracker",
      buildId: "build-1",
      now: "2026-09-22T04:00:00.000Z",
    });

    expect(requested.build).toMatchObject({ phase: "plan", status: "running" });
    expect(requested.workspace.project?.versions).toHaveLength(0);

    const ready = workspaceReducer(requested, {
      type: "PLAN_READY",
      plan: {
        id: "plan-1",
        prompt: "Build a tracker",
        goal: "Track spending",
        coreFeatures: ["Add entries"],
        nonGoals: [],
        assumptions: [],
        openQuestions: [],
        revision: 1,
        createdAt: "2026-09-22T04:00:01.000Z",
      },
    });

    expect(ready.build?.status).toBe("awaiting_approval");
    expect(ready.workspace.project?.pendingPlan?.id).toBe("plan-1");
    expect(ready.workspace.project?.versions).toHaveLength(0);

    const strayBuild = workspaceReducer(ready, {
      type: "BUILD_SUCCEEDED",
      buildId: "build-1",
      prompt: "Build a tracker",
      projectName: "Tracker",
      summary: "Created",
      html,
      mode: "live",
      versionId: "version-1",
      messageId: "message-1",
      now: "2026-09-22T04:00:02.000Z",
    });

    expect(strayBuild.workspace.project?.versions).toHaveLength(0);
    expect(strayBuild.workspace.project?.pendingPlan?.id).toBe("plan-1");
  });

  it("carries the approved plan into the version it produced", () => {
    const requested = workspaceReducer(initialWorkspaceState, {
      type: "PLAN_REQUESTED",
      prompt: "Build a tracker",
      buildId: "build-1",
      now: "2026-09-22T04:00:00.000Z",
    });
    const ready = workspaceReducer(requested, {
      type: "PLAN_READY",
      plan: {
        id: "plan-1",
        prompt: "Build a tracker",
        goal: "Track spending",
        coreFeatures: ["Add entries"],
        nonGoals: [],
        assumptions: [],
        openQuestions: [],
        revision: 1,
        createdAt: "2026-09-22T04:00:01.000Z",
      },
    });
    const approved = workspaceReducer(ready, {
      type: "PLAN_APPROVED",
      buildId: "build-2",
      now: "2026-09-22T04:00:02.000Z",
    });

    expect(approved.workspace.project?.pendingPlan).toBeNull();
    expect(approved.workspace.project?.approvedPlan?.id).toBe("plan-1");
    expect(approved.build).toMatchObject({ id: "build-2", phase: "build", status: "running" });

    const succeeded = workspaceReducer(approved, {
      type: "BUILD_SUCCEEDED",
      buildId: "build-2",
      prompt: "Build a tracker",
      projectName: "Tracker",
      summary: "Created",
      html,
      mode: "live",
      versionId: "version-1",
      messageId: "message-1",
      now: "2026-09-22T04:00:03.000Z",
    });

    expect(succeeded.workspace.project?.versions[0].planId).toBe("plan-1");
    expect(succeeded.workspace.project?.currentVersionId).toBe("version-1");
  });
});
