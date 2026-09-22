import { Check, Circle, Loader2, X } from "lucide-react";
import { STAGE_LABELS } from "@/lib/projects/selectors";
import type { AgentStageState } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

function StageIcon({ status }: { status: AgentStageState["status"] }) {
  if (status === "active") return <Loader2 className="af-spin h-3.5 w-3.5" aria-hidden />;
  if (status === "completed") return <Check className="h-3.5 w-3.5" aria-hidden />;
  if (status === "failed") return <X className="h-3.5 w-3.5" aria-hidden />;
  return <Circle className="h-2.5 w-2.5" aria-hidden />;
}

const toneClasses: Record<AgentStageState["status"], string> = {
  pending: "border-[var(--line-strong)] bg-[var(--panel-raised)] text-[var(--dim)]",
  active: "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] af-pulse",
  completed: "border-[var(--success)] bg-[rgba(82,214,161,.12)] text-[var(--success)]",
  failed: "border-[var(--danger)] bg-[rgba(255,123,141,.12)] text-[var(--danger)]",
};

const statusLabels: Record<AgentStageState["status"], string> = {
  pending: "等待中",
  active: "进行中",
  completed: "已完成",
  failed: "失败",
};

export function AgentTimeline({
  stages,
  visible,
}: {
  stages: AgentStageState[];
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <section className="af-panel p-4" aria-label="Agent 时间线">
      <header className="flex items-center justify-between">
        <span className="af-label">Agent Timeline</span>
        <span className="text-[10px] text-[var(--dim)]">真实构建阶段</span>
      </header>
      <ol className="mt-3 space-y-3">
        {stages.map((item) => {
          const meta = STAGE_LABELS[item.stage];
          return (
            <li key={item.stage} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-[2px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                  toneClasses[item.status],
                )}
              >
                <StageIcon status={item.status} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[var(--text)]">{meta.label}</span>
                  <span className="text-[10px] text-[var(--dim)]">{statusLabels[item.status]}</span>
                </div>
                <p className="text-[11px] leading-5 text-[var(--dim)]">{meta.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
