import { Check, History, RotateCcw } from "lucide-react";
import type { AppVersion } from "@/lib/projects/types";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function VersionHistory({
  versions,
  currentVersionId,
  onSelect,
}: {
  versions: AppVersion[];
  currentVersionId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section aria-labelledby="versions-title" className="border-t border-[var(--line)] px-5 py-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History size={13} className="text-[var(--muted)]" />
          <h2 id="versions-title" className="text-xs font-semibold text-[var(--text-soft)]">版本历史</h2>
        </div>
        <span className="utility-label text-[9px] text-[var(--muted)]">{versions.length} snapshots</span>
      </div>
      {versions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] px-3.5 py-4 text-[11px] leading-4 text-[var(--muted)]">首次成功构建后，会在这里保存不可变版本。</div>
      ) : (
        <ol className="space-y-2">
          {[...versions].reverse().map((version, reverseIndex) => {
            const active = version.id === currentVersionId;
            const number = versions.length - reverseIndex;
            return (
              <li key={version.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelect(version.id)}
                  className={`group w-full rounded-xl border p-3 text-left transition ${active ? "border-[rgba(141,162,255,.5)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--panel-quiet)] hover:border-[var(--line-strong)]"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`utility-label text-[9px] ${active ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}>Version {String(number).padStart(2, "0")}</span>
                    <span className="flex items-center gap-1 text-[9px] text-[var(--muted)]">
                      {active ? <><Check size={10} /> 当前版本</> : <><RotateCcw size={10} /> 切换</>}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-[var(--text-soft)]">{version.summary}</p>
                  <div className="mt-2 flex items-center justify-between text-[9px] text-[var(--muted)]">
                    <span>{formatTime(version.createdAt)}</span>
                    <span>{version.mode === "demo" ? "Demo" : "Live"}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
