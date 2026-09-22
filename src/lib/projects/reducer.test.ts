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
    expect(submitted.build?.steps[0].status).toBe("active");

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
});
