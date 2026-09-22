import { Code2, Eye, Monitor, PanelTop, Smartphone, Tablet } from "lucide-react";
import type { AppVersion, WorkspaceState } from "@/lib/projects/types";
import { IconButton } from "@/components/ui/icon-button";
import { CodeView } from "./code-view";
import { PreviewFrame } from "./preview-frame";

export function ResultPanel({
  version,
  state,
  mode,
  onTab,
  onViewport,
}: {
  version: AppVersion | null;
  state: WorkspaceState;
  mode: "live" | "demo";
  onTab: (tab: "preview" | "code") => void;
  onViewport: (viewport: "desktop" | "tablet" | "mobile") => void;
}) {
  const isBuilding = state.build?.status === "running";
  const versionNumber = version && state.workspace.project
    ? state.workspace.project.versions.findIndex((item) => item.id === version.id) + 1
    : 0;
  return (
    <section className="flex h-screen min-h-[620px] min-w-0 flex-col bg-[var(--canvas-soft)] max-[900px]:h-[calc(100vh-52px)]" aria-label="生成结果">
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[var(--line)] px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--panel-quiet)] p-1">
          <button type="button" onClick={() => onTab("preview")} className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition ${state.resultTab === "preview" ? "bg-[var(--panel-raised)] text-[var(--text)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--text-soft)]"}`}><Eye size={13} /> Preview</button>
          <button type="button" onClick={() => onTab("code")} disabled={!version} className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${state.resultTab === "code" ? "bg-[var(--panel-raised)] text-[var(--text)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--text-soft)]"}`}><Code2 size={13} /> Code</button>
        </div>
        <div className="flex items-center gap-2">
          {version && state.resultTab === "preview" && (
            <div className="hidden items-center gap-1 sm:flex">
              <IconButton label="桌面宽度" onClick={() => onViewport("desktop")} className={state.viewport === "desktop" ? "border-[rgba(141,162,255,.5)] text-[var(--accent)]" : ""}><Monitor size={14} /></IconButton>
              <IconButton label="平板宽度" onClick={() => onViewport("tablet")} className={state.viewport === "tablet" ? "border-[rgba(141,162,255,.5)] text-[var(--accent)]" : ""}><Tablet size={14} /></IconButton>
              <IconButton label="手机宽度" onClick={() => onViewport("mobile")} className={state.viewport === "mobile" ? "border-[rgba(141,162,255,.5)] text-[var(--accent)]" : ""}><Smartphone size={14} /></IconButton>
            </div>
          )}
          <span className={`hidden rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.12em] sm:inline-flex ${mode === "demo" ? "border-[rgba(242,190,109,.3)] bg-[rgba(242,190,109,.08)] text-[var(--warning)]" : "border-[rgba(82,214,161,.3)] bg-[rgba(82,214,161,.08)] text-[var(--success)]"}`}>{mode} mode</span>
        </div>
      </header>

      {isBuilding && (
        <div className="relative h-1 shrink-0 overflow-hidden bg-[rgba(141,162,255,.12)] build-shimmer"><div className="h-full w-1/3 bg-[var(--accent)]" /></div>
      )}

      {!version ? (
        <div className="signal-grid flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="max-w-[390px] text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] shadow-[0_18px_60px_rgba(0,0,0,.18)]"><PanelTop size={24} /></div>
            <div className="utility-label mt-5 text-[10px] text-[var(--accent)]">Result surface</div>
            <h2 className="mt-2 text-xl font-semibold tracking-[-.025em] text-[var(--text)]">可运行的应用会出现在这里</h2>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">从左侧输入需求或选择示例。生成完成前，这里不会用半成品替换可用版本。</p>
            <div className="mx-auto mt-6 grid max-w-[330px] grid-cols-3 gap-2 text-[9px] text-[var(--muted)]">
              <span className="rounded-lg border border-[var(--line)] bg-[var(--panel-quiet)] py-2">完整 HTML</span>
              <span className="rounded-lg border border-[var(--line)] bg-[var(--panel-quiet)] py-2">沙箱运行</span>
              <span className="rounded-lg border border-[var(--line)] bg-[var(--panel-quiet)] py-2">版本可恢复</span>
            </div>
          </div>
        </div>
      ) : state.resultTab === "preview" ? (
        <PreviewFrame version={version} viewport={state.viewport} />
      ) : (
        <CodeView html={version.html} />
      )}

      <footer className="flex min-h-9 items-center justify-between border-t border-[var(--line)] px-4 text-[9px] text-[var(--muted)]">
        <span>{version ? `版本 ${versionNumber} · ${version.summary}` : "等待首次构建"}</span>
        <span className="hidden sm:inline">sandbox: scripts · forms · modals</span>
      </footer>
    </section>
  );
}
