// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceShell } from "./workspace-shell";

const runtime = vi.hoisted(() => ({
  runPlanText: vi.fn(),
  runDesignText: vi.fn(),
  runEngineerText: vi.fn(),
  runReviewText: vi.fn(),
  repairJson: vi.fn(),
}));

vi.mock("@/lib/ai/runtime", () => runtime);

const PLAN_JSON =
  '{"title":"记账小工具","goal":"记录每天的收入与支出","features":["新增记录","显示结余"]}';
const HTML_JSON =
  '{"html":"<!doctype html><html><body><h1>ok</h1><script>void 0;</script></body></html>","summary":"首版"}';

function stageStatusCount(label: string) {
  return screen.queryAllByText(label).length;
}

async function planOnce(user: ReturnType<typeof userEvent.setup>) {
  render(<WorkspaceShell />);
  await user.type(screen.getByLabelText("应用需求"), "帮我做一个记账应用");
  await user.click(screen.getByRole("button", { name: "生成方案" }));
  await waitFor(() => expect(screen.getByRole("button", { name: /批准并生成/ })).toBeTruthy());
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  Object.values(runtime).forEach((fn) => fn.mockReset());
  runtime.runPlanText.mockResolvedValue(PLAN_JSON);
  runtime.runDesignText.mockResolvedValue("设计：单列布局 + 本地存储");
  runtime.runEngineerText.mockResolvedValue(HTML_JSON);
  runtime.runReviewText.mockResolvedValue('{"approved":true,"summary":"可用"}');
});

describe("WorkspaceShell", () => {
  it("advances the agent timeline to a finished version after approving the plan", async () => {
    const user = userEvent.setup();
    await planOnce(user);

    // Only the approved planner is finished before the build starts.
    expect(stageStatusCount("已完成")).toBe(1);

    await user.click(screen.getByRole("button", { name: /批准并生成/ }));

    await waitFor(() => expect(stageStatusCount("已完成")).toBe(4));
    expect(screen.getByText("当前版本")).toBeTruthy();
    expect(screen.getByText("v1")).toBeTruthy();
    expect(screen.queryByText("这里会出现可交互的应用预览")).toBeNull();
  });

  it("drops the pending plan when the user asks for a replan", async () => {
    const user = userEvent.setup();
    await planOnce(user);

    await user.click(screen.getByRole("button", { name: /重新规划/ }));

    await waitFor(() => expect(screen.queryByText("待确认")).toBeNull());
    expect(screen.queryByRole("button", { name: /批准并生成/ })).toBeNull();
  });

  it("creates a follow-up version from a revision request", async () => {
    const user = userEvent.setup();
    await planOnce(user);
    await user.click(screen.getByRole("button", { name: /批准并生成/ }));
    await waitFor(() => expect(stageStatusCount("已完成")).toBe(4));

    await user.click(screen.getByRole("tab", { name: "修改当前版本" }));
    await user.type(screen.getByLabelText("修改要求"), "增加按月份筛选");
    await user.click(screen.getByRole("button", { name: /生成新版本/ }));

    await waitFor(() => expect(screen.getByText("v2")).toBeTruthy());
    expect(screen.getByText(/修改：增加按月份筛选/)).toBeTruthy();
    expect(screen.getByText("2 个版本")).toBeTruthy();
  });

  it("restores a failed build through the retry action", async () => {
    const user = userEvent.setup();
    runtime.runEngineerText.mockRejectedValueOnce(new Error("provider exploded"));
    await planOnce(user);

    await user.click(screen.getByRole("button", { name: /批准并生成/ }));

    await waitFor(() =>
      expect(screen.getAllByText(/生成失败/).length).toBeGreaterThan(0),
    );
    await user.click(screen.getByRole("button", { name: "重试" }));

    await waitFor(() => expect(stageStatusCount("已完成")).toBe(4));
    expect(screen.queryAllByText(/生成失败/)).toHaveLength(0);
  });

  it("completes an end-to-end build in Demo mode without touching the provider", async () => {
    const user = userEvent.setup();
    render(<WorkspaceShell />);

    await user.click(screen.getByRole("button", { name: "Demo" }));
    await user.type(
      screen.getByLabelText("应用需求"),
      "帮我做一个个人记账小工具，可以记录收入和支出，显示结余。",
    );
    await user.click(screen.getByRole("button", { name: "生成方案" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /批准并生成/ })).toBeTruthy());

    await user.click(screen.getByRole("button", { name: /批准并生成/ }));

    await waitFor(() => expect(stageStatusCount("已完成")).toBe(4));
    expect(screen.getByText("v1")).toBeTruthy();
    expect(runtime.runPlanText).not.toHaveBeenCalled();
    expect(runtime.runEngineerText).not.toHaveBeenCalled();
  });

  it("clears the workspace back to its empty state", async () => {
    const user = userEvent.setup();
    await planOnce(user);

    await user.click(screen.getByRole("button", { name: "清空工作区" }));

    await waitFor(() => expect(screen.queryByText("待确认")).toBeNull());
    expect(screen.queryByText("v1")).toBeNull();
  });
});
