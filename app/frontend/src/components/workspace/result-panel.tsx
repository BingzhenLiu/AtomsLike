import { useState } from "react";
import { Code2, Eye, Loader2, MonitorSmartphone, TriangleAlert } from "lucide-react";
import { CodeView } from "./code-view";
import { PREVIEW_WIDTHS, PreviewFrame, type PreviewWidthId } from "./preview-frame";
import type { ProjectVersion } from "@/lib/projects/types";
import type { BuildErrorPayload } from "@/lib/ai/errors";
import { cn } from "@/lib/utils";

export function ResultPanel({
  version,
  busy,
  error,
  onRetry,
}: {
  version: ProjectVersion | null;
  busy: boolean;
  error: BuildErrorPayload | null;
  onRetry: () => void;
}) {
  const [view, setView] = useState<"preview" | "code">("preview");
  const [widthId, setWidthId] = useState<PreviewWidthId>("full");

  return (
    <section className="af-panel flex min-h-0 flex-1 flex-col overflow-hidden" aria-label="生成结果">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="af-label">Result</span>
          {version && (
            <span className="text-[10px] text-[var(--dim)]">
              v{version.index} · {version.summary.slice(0, 34)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-[var(--line-strong)]">
            {(
              [
                { id: "preview", label: "预览", icon: Eye },
                { id: "code", label: "代码", icon: Code2 },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={view === item.id}
                onClick={() => setView(item.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold transition-colors",
                  view === item.id
                    ? "bg-[var(--accent)] text-[#08111f]"
                    : "text-[var(--text-soft)] hover:text-[var(--text)]",
                )}
              >
                <item.icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </button>
            ))}
          </div>

          {view === "preview" && version && (
            <div className="hidden items-center gap-1 sm:flex">
              <MonitorSmartphone className="h-3.5 w-3.5 text-[var(--dim)]" aria-hidden />
              {PREVIEW_WIDTHS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={widthId === item.id}
                  onClick={() => setWidthId(item.id)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[10px] font-semibold transition-colors",
                    widthId === item.id
                      ? "bg-[var(--panel-raised)] text-[var(--text)]"
                      : "text-[var(--dim)] hover:text-[var(--text-soft)]",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {busy && (
        <div className="h-[2px] w-full overflow-hidden bg-[var(--panel-raised)]">
          <div className="af-shimmer h-full w-full" />
        </div>
      )}

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--danger)] bg-[rgba(255,123,141,.08)] px-4 py-2.5">
          <span className="inline-flex items-start gap-2 text-[12px] leading-5 text-[var(--text)]">
            <TriangleAlert className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[var(--danger)]" aria-hidden />
            {error.message}
          </span>
          <button type="button" className="af-chip" onClick={onRetry}>
            重试
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col bg-[var(--canvas-soft)] af-grid">
        {version ? (
          view === "preview" ? (
            <PreviewFrame html={version.html} widthId={widthId} />
          ) : (
            <CodeView html={version.html} />
          )
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-sm text-center">
              {busy ? (
                <>
                  <Loader2 className="af-spin mx-auto h-6 w-6 text-[var(--accent)]" aria-hidden />
                  <h2 className="mt-3 text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">
                    正在构建你的应用
                  </h2>
                  <p className="mt-2 text-[12px] leading-5 text-[var(--dim)]">
                    设计结构与交互、实现完整代码、检查可用性与安全约束，完成后会自动出现在这里。
                  </p>
                </>
              ) : (
                <>
                  <Eye className="mx-auto h-6 w-6 text-[var(--dim)]" aria-hidden />
                  <h2 className="mt-3 text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">
                    这里会出现可交互的应用预览
                  </h2>
                  <p className="mt-2 text-[12px] leading-5 text-[var(--dim)]">
                    先在左侧描述需求，确认方案后即可生成。生成的应用是安全的受限预览，不会访问外部网络。
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
