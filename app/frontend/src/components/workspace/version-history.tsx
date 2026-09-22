import { History } from "lucide-react";
import type { ProjectVersion } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export function VersionHistory({
  versions,
  activeVersionId,
  onSelect,
}: {
  versions: ProjectVersion[];
  activeVersionId: string | null;
  onSelect: (versionId: string) => void;
}) {
  if (versions.length === 0) return null;

  return (
    <section className="af-panel p-4" aria-label="版本历史">
      <header className="flex items-center justify-between">
        <span className="af-label">Versions</span>
        <span className="inline-flex items-center gap-1 text-[10px] text-[var(--dim)]">
          <History className="h-3 w-3" aria-hidden />
          {versions.length} 个版本
        </span>
      </header>
      <ul className="mt-3 space-y-2">
        {[...versions].reverse().map((version) => {
          const active = version.id === activeVersionId;
          return (
            <li key={version.id}>
              <div
                className={cn(
                  "rounded-xl border p-3",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--line)] bg-[var(--panel-quiet)]",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-[var(--text)]">
                        v{version.index}
                      </span>
                      {active && (
                        <span className="rounded-full bg-[var(--accent)] px-2 py-[1px] text-[9px] font-bold text-[#08111f]">
                          当前版本
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[var(--dim)]">
                      {version.summary || version.prompt}
                    </p>
                    <span className="mt-1 block text-[10px] text-[var(--dim)]">
                      {formatTime(version.createdAt)}
                      {version.revision ? ` · 修改：${version.revision.prompt.slice(0, 18)}` : ""}
                    </span>
                  </div>
                  {!active && (
                    <button
                      type="button"
                      className="af-chip shrink-0"
                      onClick={() => onSelect(version.id)}
                      aria-label={`切换到版本 v${version.index}`}
                    >
                      切换
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
