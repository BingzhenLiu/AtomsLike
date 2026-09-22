import { CheckCircle2, HelpCircle, RefreshCw, ShieldCheck, Target } from "lucide-react";
import type { PlanPayload } from "@/lib/projects/types";

function PlanList({ items, tone }: { items: string[]; tone: "default" | "dim" }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li
          key={item}
          className={
            tone === "default"
              ? "flex gap-2 text-[12px] leading-5 text-[var(--text-soft)]"
              : "flex gap-2 text-[12px] leading-5 text-[var(--dim)]"
          }
        >
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PlanSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <span className="af-label">{label}</span>
      {children}
    </div>
  );
}

export function PlanCard({
  plan,
  busy,
  onApprove,
  onReplan,
}: {
  plan: PlanPayload;
  busy: boolean;
  onApprove: () => void;
  onReplan: () => void;
}) {
  return (
    <section
      className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4"
      aria-label="待确认的方案"
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <span className="af-label">Plan · 待确认</span>
          <h2 className="mt-1 text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]">
            {plan.title}
          </h2>
        </div>
        <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden />
      </header>

      <div className="mt-4 space-y-4">
        <PlanSection label="目标">
          <p className="flex gap-2 text-[12px] leading-5 text-[var(--text-soft)]">
            <Target className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[var(--accent)]" aria-hidden />
            <span>{plan.goal}</span>
          </p>
        </PlanSection>

        <PlanSection label="核心功能">
          <PlanList items={plan.features} tone="default" />
        </PlanSection>

        {plan.nonGoals.length > 0 && (
          <PlanSection label="本版不做">
            <PlanList items={plan.nonGoals} tone="dim" />
          </PlanSection>
        )}

        {plan.assumptions.length > 0 && (
          <PlanSection label="我的假设">
            <PlanList items={plan.assumptions} tone="dim" />
          </PlanSection>
        )}

        {plan.openQuestions.length > 0 && (
          <PlanSection label="待确认">
            <ul className="space-y-1.5">
              {plan.openQuestions.map((item) => (
                <li key={item} className="flex gap-2 text-[12px] leading-5 text-[var(--text-soft)]">
                  <HelpCircle className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[var(--warning)]" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </PlanSection>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="af-btn af-btn-primary" onClick={onApprove} disabled={busy}>
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {busy ? "生成中…" : "批准并生成"}
        </button>
        <button type="button" className="af-btn af-btn-ghost" onClick={onReplan} disabled={busy}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          重新规划
        </button>
      </div>
    </section>
  );
}
