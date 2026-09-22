import { Check, Circle, LoaderCircle, X } from "lucide-react";
import { AGENT_STEPS, type BuildSession } from "@/lib/projects/types";

const statusIcon = {
  pending: Circle,
  active: LoaderCircle,
  completed: Check,
  failed: X,
};

export function AgentTimeline({ build }: { build: BuildSession | null }) {
  const steps = build?.steps ?? AGENT_STEPS;
  return (
    <section aria-labelledby="timeline-title" className="border-t border-[var(--line)] px-5 py-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="utility-label text-[10px] text-[var(--muted)]">Build signal</div>
          <h2 id="timeline-title" className="mt-1 text-sm font-semibold text-[var(--text)]">Agent 构建进度</h2>
        </div>
        {build?.status === "running" && (
          <span className="rounded-full border border-[rgba(141,162,255,.3)] bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--accent)]">处理中</span>
        )}
        {build?.status === "awaiting_approval" && (
          <span className="rounded-full border border-[rgba(242,190,109,.35)] bg-[rgba(242,190,109,.1)] px-2.5 py-1 text-[10px] font-bold text-[var(--warning)]">等待确认</span>
        )}
      </div>
      <ol className="relative space-y-0 before:absolute before:bottom-4 before:left-[13px] before:top-4 before:w-px before:bg-[var(--line)]">
        {steps.map((step) => {
          const Icon = statusIcon[step.status];
          return (
            <li key={step.id} className="relative flex gap-3 py-2.5">
              <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-[var(--panel)] ${
                step.status === "active" ? "signal-active border-[var(--accent)] text-[var(--accent)]" :
                step.status === "completed" ? "border-[rgba(82,214,161,.45)] text-[var(--success)]" :
                step.status === "failed" ? "border-[rgba(255,123,141,.55)] text-[var(--danger)]" :
                "border-[var(--line)] text-[var(--muted)]"
              }`}>
                <Icon size={13} className={step.status === "active" ? "animate-spin" : ""} />
              </span>
              <div className="min-w-0 pt-0.5">
                <div className={`text-xs font-semibold ${step.status === "active" ? "text-[var(--accent)]" : "text-[var(--text-soft)]"}`}>{step.label}</div>
                <p className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[10px] leading-4 text-[var(--muted)]">阶段根据真实请求生命周期推进，不展示或模拟隐藏思维过程。</p>
    </section>
  );
}
