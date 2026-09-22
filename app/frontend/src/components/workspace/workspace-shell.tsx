import { useEffect, useState } from "react";
import { AlertTriangle, Hammer, RotateCcw, Sparkles } from "lucide-react";
import { AgentTimeline } from "./agent-timeline";
import { ConversationPanel } from "./conversation-panel";
import { PlanCard } from "./plan-card";
import { PromptComposer } from "./prompt-composer";
import { ResultPanel } from "./result-panel";
import { VersionHistory } from "./version-history";
import { useWorkspace } from "@/hooks/use-workspace";
import { selectStages } from "@/lib/projects/selectors";
import type { WorkspaceMode } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

type Tab = "chat" | "result";

export function WorkspaceShell() {
  const workspace = useWorkspace();
  const { state, hydrated, busy, activeVersion, auth, lockStatus, lockHolder, syncStatus, readOnly } =
    workspace;
  const [tab, setTab] = useState<Tab>("chat");
  const stages = selectStages(state);

  const syncLabel =
    auth !== "authenticated"
      ? "本地存储"
      : syncStatus === "syncing"
        ? "同步中…"
        : syncStatus === "error"
          ? "同步失败"
          : "已同步云端";

  const showAuthHint = Boolean(state.planError) && state.mode === "live";

  useEffect(() => {
    if (state.versions.length > 0 && !busy) setTab("result");
  }, [state.versions.length, busy]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--canvas)] text-[var(--text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[rgba(7,16,29,.9)] backdrop-blur">
        <div className="mx-auto flex h-[52px] max-w-[1600px] items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line-strong)] bg-[var(--accent-soft)]">
              <Hammer className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden />
            </span>
            <div className="leading-tight">
              <h1 className="text-[15px] font-bold tracking-[-0.035em]">AtomForge</h1>
              <p className="hidden text-[10px] text-[var(--dim)] sm:block">
                一句话生成可以直接使用的小工具
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="hidden rounded-md border border-[var(--line-strong)] px-2 py-1 text-[10px] text-[var(--dim)] sm:inline"
              title={auth === "authenticated" ? "历史记录保存在你的账号下" : "未登录时历史仅保存在本机浏览器"}
            >
              {syncLabel}
            </span>
            {auth === "anonymous" && (
              <button type="button" className="af-icon-btn px-2 text-[11px]" onClick={workspace.login}>
                登录同步
              </button>
            )}
            <div
              className="flex overflow-hidden rounded-lg border border-[var(--line-strong)]"
              role="group"
              aria-label="运行模式"
            >
              {(
                [
                  { id: "live", label: "Live" },
                  { id: "demo", label: "Demo" },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={state.mode === item.id}
                  onClick={() => workspace.setMode(item.id as WorkspaceMode)}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    state.mode === item.id
                      ? "bg-[var(--accent)] text-[#08111f]"
                      : "text-[var(--text-soft)] hover:text-[var(--text)]",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="af-icon-btn"
              onClick={workspace.reset}
              aria-label="清空工作区"
              title="清空工作区"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex border-t border-[var(--line)] md:hidden">
          {(
            [
              { id: "chat", label: "对话" },
              { id: "result", label: "结果" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "flex-1 py-2 text-[12px] font-semibold transition-colors",
                tab === item.id
                  ? "border-b-2 border-[var(--accent)] text-[var(--text)]"
                  : "border-b-2 border-transparent text-[var(--dim)]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <main className="af-shell min-h-0 flex-1">
        <div className="mx-auto grid h-full max-w-[1600px] gap-3 p-3 md:grid-cols-[minmax(360px,430px)_minmax(0,1fr)] md:h-[calc(100vh-52px)]">
          <div
            className={cn(
              "min-h-0 flex-col gap-3",
              tab === "chat" ? "flex" : "hidden md:flex",
            )}
          >
            <div className="h-[calc(100vh-52px-104px)] min-h-[320px] md:h-auto md:flex-1">
              <ConversationPanel
                state={state}
                disabled={busy}
                onExample={(prompt) => void workspace.submitPrompt(prompt)}
              />
            </div>

            <div className="af-scroll flex max-h-[46vh] shrink-0 flex-col gap-3 overflow-y-auto pr-1">
              {readOnly && (
                <div className="flex items-start gap-2 rounded-xl border border-[var(--warning)] bg-[rgba(242,190,109,.1)] px-3 py-2.5">
                  <AlertTriangle className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[var(--warning)]" aria-hidden />
                  <div className="flex-1">
                    <p className="text-[11px] leading-5 text-[var(--text-soft)]">
                      {lockStatus === "evicted"
                        ? `该账号已在「${lockHolder || "另一台设备"}」上接管编辑，本窗口已转为只读。`
                        : `该账号正在「${lockHolder || "另一台设备"}」上编辑，同一时间只允许一个会话写入。`}
                      历史记录仍可查看。
                    </p>
                    <button
                      type="button"
                      className="mt-2 rounded-md bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[#08111f]"
                      onClick={() => void workspace.takeOver()}
                    >
                      在本设备接管编辑
                    </button>
                  </div>
                </div>
              )}

              {showAuthHint && (
                <div className="flex items-start gap-2 rounded-xl border border-[var(--warning)] bg-[rgba(242,190,109,.1)] px-3 py-2.5">
                  <AlertTriangle className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[var(--warning)]" aria-hidden />
                  <p className="text-[11px] leading-5 text-[var(--text-soft)]">
                    实时生成需要登录 Atoms 账号；也可以切换到 Demo 模式，用内置模板完整体验流程。
                  </p>
                </div>
              )}

              {state.plan && (
                <PlanCard
                  plan={state.plan}
                  busy={busy}
                  onApprove={() => void workspace.approveAndBuild()}
                  onReplan={workspace.replan}
                />
              )}

              <AgentTimeline
                stages={stages}
                visible={Boolean(state.plan) || busy || state.versions.length > 0 || Boolean(state.buildError)}
              />

              <VersionHistory
                versions={state.versions}
                activeVersionId={state.activeVersionId}
                onSelect={workspace.selectVersion}
              />
            </div>

            {!hydrated && (
              <p className="inline-flex items-center gap-1.5 px-1 text-[10px] text-[var(--dim)]">
                <Sparkles className="h-3 w-3" aria-hidden />
                正在恢复上次的工作区…
              </p>
            )}

            <PromptComposer
              busy={busy}
              hasPlan={Boolean(state.plan)}
              hasVersion={state.versions.length > 0}
              onSubmit={(prompt) => void workspace.submitPrompt(prompt)}
              onRevise={(change) => void workspace.revise(change)}
              onRetry={() => void workspace.retryBuild()}
            />
          </div>

          <div
            className={cn("min-h-0 flex-col", tab === "result" ? "flex" : "hidden md:flex")}
            style={{ minHeight: "60vh" }}
          >
            <ResultPanel
              version={activeVersion}
              busy={busy}
              error={state.buildError}
              onRetry={() => void workspace.retryBuild()}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
