"use client";

import { AlertTriangle, Boxes, MessageSquareText, PanelRight, X } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef } from "react";
import { generateResponseSchema } from "@/lib/ai/contract";
import { LocalStorageProjectRepository } from "@/lib/projects/local-storage";
import { workspaceReducer, initialWorkspaceState } from "@/lib/projects/reducer";
import { selectCurrentVersion, selectIsBuilding } from "@/lib/projects/selectors";
import type { AppError, AppErrorCode } from "@/lib/projects/types";
import { validateGeneratedHtml } from "@/lib/preview/validate-html";
import { AgentTimeline } from "./agent-timeline";
import { ConversationPanel } from "./conversation-panel";
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

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

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

export function WorkspaceShell({ initialMode }: { initialMode: "live" | "demo" }) {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  const repositoryRef = useRef<LocalStorageProjectRepository | null>(null);
  const currentVersion = useMemo(() => selectCurrentVersion(state), [state]);
  const isBuilding = selectIsBuilding(state);

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

  async function submitPrompt(prompt: string) {
    if (isBuilding) return;
    const buildId = crypto.randomUUID();
    const now = new Date().toISOString();
    const htmlAtSubmission = currentVersion?.html;
    dispatch({ type: "PROMPT_SUBMITTED", prompt, buildId, now });

    try {
      await delay(180);
      dispatch({ type: "BUILD_STEP_CHANGED", step: "designer" });

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          currentHtml: htmlAtSubmission,
          projectName: state.workspace.project?.name,
        }),
      });

      dispatch({ type: "BUILD_STEP_CHANGED", step: "engineer" });
      const raw = await response.text();
      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        throw { code: "PROVIDER_ERROR", message: "服务返回了无法读取的内容。请重试，当前版本已保留。" } satisfies AppError;
      }

      if (!response.ok) throw parseError(payload);
      await delay(160);
      dispatch({ type: "BUILD_STEP_CHANGED", step: "reviewer" });

      const parsed = generateResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw { code: "OUTPUT_INVALID", message: "生成结果字段不完整，旧版本已保留。" } satisfies AppError;
      }
      const validation = validateGeneratedHtml(parsed.data.html);
      if (!validation.ok) {
        throw { code: "PREVIEW_REJECTED", message: `预览被安全检查拒绝：${validation.reason}。旧版本已保留。` } satisfies AppError;
      }

      await delay(180);
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
      const appError: AppError =
        typeof error === "object" && error !== null && "code" in error && "message" in error
          ? error as AppError
          : { code: "PROVIDER_ERROR", message: "生成请求失败。请检查网络后重试，当前版本已保留。" };
      dispatch({ type: "BUILD_FAILED", error: appError });
    }
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
            <AgentTimeline build={state.build} />
            <VersionHistory versions={project?.versions ?? []} currentVersionId={project?.currentVersionId ?? null} onSelect={(versionId) => {
              dispatch({ type: "VERSION_SELECTED", versionId, now: new Date().toISOString() });
            }} />
          </div>

          <PromptComposer
            isBuilding={isBuilding}
            hasVersion={Boolean(currentVersion)}
            onSubmit={submitPrompt}
            onRetry={() => state.lastPrompt && submitPrompt(state.lastPrompt)}
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
