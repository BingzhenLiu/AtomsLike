"use client";

import { AlertTriangle, Boxes, MessageSquareText, PanelRight, X } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef } from "react";
import { createStreamParser } from "@/lib/ai/build-stream";
import { generateResponseSchema, planResponseSchema } from "@/lib/ai/contract";
import { LocalStorageProjectRepository } from "@/lib/projects/local-storage";
import { workspaceReducer, initialWorkspaceState } from "@/lib/projects/reducer";
import { selectCurrentVersion, selectIsBuilding } from "@/lib/projects/selectors";
import type { AppError, AppErrorCode, BuildPlan } from "@/lib/projects/types";
import { validateGeneratedHtml } from "@/lib/preview/validate-html";
import { AgentTimeline } from "./agent-timeline";
import { ConversationPanel } from "./conversation-panel";
import { PlanCard } from "./plan-card";
import { PromptComposer } from "./prompt-composer";
import { ResultPanel } from "./result-panel";
import { VersionHistory } from "./version-history";

const ERROR_CODES = new Set<AppErrorCode>([
  "CONFIG_MISSING",
  "REQUEST_INVALID",
  "PROVIDER_TIMEOUT",
  "PROVIDER_ERROR",
  "OUTPUT_INVALID",
  "STORAGE_CORRUPT",
  "STORAGE_QUOTA",
  "PREVIEW_REJECTED",
]);

function parseError(payload: unknown): AppError {
  const candidate = payload as { error?: { code?: unknown; message?: unknown } };
  const code = typeof candidate.error?.code === "string" && ERROR_CODES.has(candidate.error.code as AppErrorCode)
    ? (candidate.error.code as AppErrorCode)
    : "PROVIDER_ERROR";
  const message = typeof candidate.error?.message === "string"
    ? candidate.error.message
    : "生成请求没有完成。请重试，当前可用版本已保留。";
  return { code, message };
}

type StreamOutcome = { plan: unknown; result: unknown; failure: AppError | null };

/** The five fields the model is allowed to see; ids and bookkeeping stay local. */
type PlanSpec = {
  goal: string;
  coreFeatures: string[];
  nonGoals: string[];
  assumptions: string[];
  openQuestions: string[];
};

function planSpec(plan: BuildPlan): PlanSpec {
  return {
    goal: plan.goal,
    coreFeatures: plan.coreFeatures,
    nonGoals: plan.nonGoals,
    assumptions: plan.assumptions,
    openQuestions: plan.openQuestions,
  };
}

function toAppError(error: unknown): AppError {
  return typeof error === "object" && error !== null && "code" in error && "message" in error
    ? (error as AppError)
    : { code: "PROVIDER_ERROR", message: "生成请求失败。请检查网络后重试，当前版本已保留。" };
}

export function WorkspaceShell({ initialMode }: { initialMode: "live" | "demo" }) {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  const repositoryRef = useRef<LocalStorageProjectRepository | null>(null);
  const currentVersion = useMemo(() => selectCurrentVersion(state), [state]);
  const isBuilding = selectIsBuilding(state);
  const busy = state.build?.status === "running";
  const pendingPlan = state.workspace.project?.pendingPlan ?? null;
  const approvedPlan = state.workspace.project?.approvedPlan ?? null;

  useEffect(() => {
    const repository = new LocalStorageProjectRepository(window.localStorage);
    repositoryRef.current = repository;
    const result = repository.load();
    dispatch({ type: "WORKSPACE_HYDRATED", workspace: result.workspace, warning: result.warning });
  }, []);

  useEffect(() => {
    if (state.hydration !== "ready" || !repositoryRef.current) return;
    const timeout = window.setTimeout(() => {
      const result = repositoryRef.current?.save(state.workspace);
      if (result && !result.ok) dispatch({ type: "STORAGE_WARNING", warning: result.error });
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [state.hydration, state.workspace]);

  async function postStream(url: string, payload: unknown): Promise<StreamOutcome> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      let body: unknown = null;
      try {
        body = JSON.parse(await response.text());
      } catch {
        body = null;
      }
      throw parseError(body);
    }

    const parse = createStreamParser();
    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    const outcome: StreamOutcome = { plan: null, result: null, failure: null };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const event of parse(decoder.decode(value, { stream: true }))) {
        if (event.type === "stage") {
          dispatch({ type: "BUILD_STEP_CHANGED", step: event.stage });
        } else if (event.type === "plan") {
          outcome.plan = event.plan;
        } else if (event.type === "result") {
          outcome.result = event.result;
        } else {
          outcome.failure = parseError({ error: event.error });
        }
      }
    }

    if (outcome.failure) throw outcome.failure;
    return outcome;
  }

  function nextRevision() {
    const project = state.workspace.project;
    return (project?.pendingPlan?.revision ?? project?.approvedPlan?.revision ?? 0) + 1;
  }

  /** Phase one: ask for a specification instead of building straight away. */
  async function runPlanRequest(prompt: string, note: string | undefined, revision: number) {
    try {
      const outcome = await postStream("/api/plan", { prompt, feedback: note, revision });
      const parsed = planResponseSchema.safeParse(outcome.plan);
      if (!parsed.success) {
        throw { code: "OUTPUT_INVALID", message: "方案字段不完整，请重试。" } satisfies AppError;
      }
      dispatch({
        type: "PLAN_READY",
        plan: {
          id: crypto.randomUUID(),
          prompt,
          revision,
          createdAt: new Date().toISOString(),
          ...parsed.data,
        },
      });
    } catch (error) {
      dispatch({ type: "BUILD_FAILED", error: toAppError(error) });
    }
  }

  async function requestPlan(prompt: string, note?: string) {
    if (busy) return;
    dispatch({
      type: "PLAN_REQUESTED",
      prompt,
      note,
      buildId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
    await runPlanRequest(prompt, note, nextRevision());
  }

  /** Phase two: build the approved specification. */
  async function runBuild(prompt: string, plan: PlanSpec | undefined, buildId: string) {
    try {
      const outcome = await postStream("/api/generate", {
        prompt,
        currentHtml: currentVersion?.html,
        plan,
      });
      const parsed = generateResponseSchema.safeParse(outcome.result);
      if (!parsed.success) {
        throw { code: "OUTPUT_INVALID", message: "生成结果字段不完整，旧版本已保留。" } satisfies AppError;
      }
      const validation = validateGeneratedHtml(parsed.data.html);
      if (!validation.ok) {
        throw { code: "PREVIEW_REJECTED", message: `预览被安全检查拒绝：${validation.reason}。旧版本已保留。` } satisfies AppError;
      }
      dispatch({
        type: "BUILD_SUCCEEDED",
        buildId,
        prompt,
        projectName: parsed.data.projectName,
        summary: parsed.data.summary,
        html: parsed.data.html,
        mode: parsed.data.mode,
        versionId: crypto.randomUUID(),
        messageId: crypto.randomUUID(),
        now: new Date().toISOString(),
      });
    } catch (error) {
      dispatch({ type: "BUILD_FAILED", error: toAppError(error) });
    }
  }

  async function submitPrompt(prompt: string) {
    if (busy) return;
    if (currentVersion) {
      const buildId = crypto.randomUUID();
      dispatch({ type: "PROMPT_SUBMITTED", prompt, buildId, now: new Date().toISOString() });
      await runBuild(prompt, approvedPlan ? planSpec(approvedPlan) : undefined, buildId);
      return;
    }
    await requestPlan(prompt);
  }

  async function approvePlan() {
    if (!pendingPlan || busy) return;
    const buildId = crypto.randomUUID();
    dispatch({ type: "PLAN_APPROVED", buildId, now: new Date().toISOString() });
    await runBuild(pendingPlan.prompt, planSpec(pendingPlan), buildId);
  }

  async function retryLastRequest() {
    const failed = state.build;
    if (!failed || failed.status !== "failed" || busy) return;
    const buildId = crypto.randomUUID();
    dispatch({ type: "BUILD_RETRIED", buildId, now: new Date().toISOString() });

    if (failed.phase === "plan") {
      await runPlanRequest(failed.prompt, undefined, nextRevision());
      return;
    }
    await runBuild(failed.prompt, approvedPlan ? planSpec(approvedPlan) : undefined, buildId);
  }

  if (state.hydration === "loading") {
    return (
      <main className="signal-grid flex min-h-screen items-center justify-center bg-[var(--canvas)]">
        <div className="text-center">
          <div className="signal-active mx-auto h-3 w-3 rounded-full bg-[var(--accent)]" />
          <p className="utility-label mt-4 text-[10px] text-[var(--muted)]">Restoring workspace</p>
        </div>
      </main>
    );
  }

  const project = state.workspace.project;
  const mode = currentVersion?.mode ?? initialMode;
  const visibleWarning = state.error ?? state.storageWarning;

  return (
    <main className="min-h-screen bg-[var(--canvas)]">
      <nav aria-label="移动端工作区视图" className="hidden h-[52px] items-center border-b border-[var(--line)] bg-[var(--canvas)] p-1.5 max-[900px]:flex">
        <button type="button" onClick={() => dispatch({ type: "MOBILE_PANE_CHANGED", pane: "chat" })} className={`flex h-full flex-1 items-center justify-center gap-2 rounded-lg text-xs font-semibold ${state.mobilePane === "chat" ? "bg-[var(--panel-raised)] text-[var(--text)]" : "text-[var(--muted)]"}`}><MessageSquareText size={14} /> Chat</button>
        <button type="button" onClick={() => dispatch({ type: "MOBILE_PANE_CHANGED", pane: "result" })} className={`flex h-full flex-1 items-center justify-center gap-2 rounded-lg text-xs font-semibold ${state.mobilePane === "result" ? "bg-[var(--panel-raised)] text-[var(--text)]" : "text-[var(--muted)]"}`}><PanelRight size={14} /> Result</button>
      </nav>

      <div className="workspace-grid">
        <aside className={`flex h-screen min-h-[620px] flex-col border-r border-[var(--line)] bg-[rgba(7,16,29,.9)] max-[900px]:h-[calc(100vh-52px)] ${state.mobilePane !== "chat" ? "desktop-pane-hidden" : ""}`}>
          <header className="flex min-h-14 items-center justify-between border-b border-[var(--line)] px-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[rgba(141,162,255,.38)] bg-[var(--accent-soft)] text-[var(--accent)]"><Boxes size={16} /></span>
              <div>
                <div className="text-[12px] font-bold tracking-[.02em] text-[var(--text)]">AtomForge</div>
                <div className="utility-label mt-0.5 text-[8px] text-[var(--muted)]">AI product team</div>
              </div>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.11em] ${mode === "demo" ? "border-[rgba(242,190,109,.3)] bg-[rgba(242,190,109,.08)] text-[var(--warning)]" : "border-[rgba(82,214,161,.3)] bg-[rgba(82,214,161,.08)] text-[var(--success)]"}`}>{mode} mode</span>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {mode === "demo" && (
              <div className="border-b border-[rgba(242,190,109,.2)] bg-[rgba(242,190,109,.055)] px-5 py-2.5 text-[10px] leading-4 text-[#d8b577]">未配置模型密钥。内置示例使用确定性模板；任意需求需要在服务端配置 AI。</div>
            )}
            {visibleWarning && (
              <div className="m-4 flex gap-2.5 rounded-xl border border-[rgba(255,123,141,.3)] bg-[rgba(255,123,141,.08)] p-3 text-[11px] leading-4 text-[#ffacb7]" role="alert">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1"><b className="block text-[10px] uppercase tracking-[.1em]">{visibleWarning.code}</b><span>{visibleWarning.message}</span></div>
                <button type="button" aria-label="关闭提示" onClick={() => dispatch({ type: "ERROR_DISMISSED" })} className="h-fit text-[#d98c98] hover:text-white"><X size={14} /></button>
              </div>
            )}
            {project && (
              <div className="border-b border-[var(--line)] px-5 py-4">
                <div className="utility-label text-[9px] text-[var(--muted)]">Active project</div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <h1 className="truncate text-sm font-semibold text-[var(--text)]">{project.name}</h1>
                  <span className="shrink-0 text-[10px] text-[var(--muted)]">{project.versions.length} 个版本</span>
                </div>
              </div>
            )}
            <ConversationPanel messages={project?.messages ?? []} onExample={submitPrompt} disabled={isBuilding} />
            {pendingPlan && (
              <PlanCard
                plan={pendingPlan}
                canRevise={mode === "live"}
                busy={busy}
                onApprove={approvePlan}
                onRevise={(feedback) => requestPlan(pendingPlan.prompt, feedback)}
                onDiscard={() => dispatch({ type: "PLAN_DISCARDED" })}
              />
            )}
            <AgentTimeline build={state.build} />
            <VersionHistory versions={project?.versions ?? []} currentVersionId={project?.currentVersionId ?? null} onSelect={(versionId) => {
              dispatch({ type: "VERSION_SELECTED", versionId, now: new Date().toISOString() });
            }} />
          </div>

          <PromptComposer
            isBuilding={isBuilding}
            awaitsApproval={state.build?.status === "awaiting_approval"}
            hasVersion={Boolean(currentVersion)}
            onSubmit={submitPrompt}
            onRetry={retryLastRequest}
            canRetry={state.build?.status === "failed" && Boolean(state.lastPrompt)}
          />
        </aside>

        <div className={state.mobilePane !== "result" ? "desktop-pane-hidden" : ""}>
          <ResultPanel
            version={currentVersion}
            state={state}
            mode={mode}
            onTab={(tab) => dispatch({ type: "RESULT_TAB_CHANGED", tab })}
            onViewport={(viewport) => dispatch({ type: "VIEWPORT_CHANGED", viewport })}
          />
        </div>
      </div>
    </main>
  );
}
