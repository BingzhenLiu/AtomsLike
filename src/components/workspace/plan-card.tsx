"use client";

import { Ban, Check, CircleHelp, ClipboardList, ListChecks, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import type { BuildPlan } from "@/lib/projects/types";

function Section({
  title,
  items,
  tone,
  icon: Icon,
}: {
  title: string;
  items: string[];
  tone: "accent" | "muted" | "warning";
  icon: typeof ListChecks;
}) {
  if (!items.length) return null;
  const color =
    tone === "accent" ? "text-[var(--accent)]" : tone === "warning" ? "text-[var(--warning)]" : "text-[var(--muted)]";

  return (
    <div className="mt-4">
      <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.1em] ${color}`}>
        <Icon size={11} />
        {title}
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-[11px] leading-4 text-[var(--text-soft)]">
            <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${tone === "accent" ? "bg-[var(--accent)]" : "bg-[var(--muted)]"}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlanCard({
  plan,
  canRevise,
  busy,
  onApprove,
  onRevise,
  onDiscard,
}: {
  plan: BuildPlan;
  canRevise: boolean;
  busy: boolean;
  onApprove: () => void;
  onRevise: (feedback: string) => void;
  onDiscard: () => void;
}) {
  const [feedback, setFeedback] = useState("");

  return (
    <section
      aria-labelledby="plan-title"
      className="border-b border-[rgba(141,162,255,.25)] bg-[linear-gradient(160deg,rgba(141,162,255,.1),rgba(13,24,40,.2))] px-5 py-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgba(141,162,255,.35)] bg-[var(--accent-soft)] text-[var(--accent)]">
            <ClipboardList size={14} />
          </span>
          <div>
            <h2 id="plan-title" className="text-sm font-semibold text-[var(--text)]">待确认方案</h2>
            <div className="utility-label mt-0.5 text-[9px] text-[var(--muted)]">Revision {plan.revision}</div>
          </div>
        </div>
        <button
          type="button"
          aria-label="放弃本次方案"
          onClick={onDiscard}
          disabled={busy}
          className="text-[var(--muted)] transition hover:text-[var(--text)] disabled:opacity-40"
        >
          <X size={14} />
        </button>
      </div>

      <p className="mt-4 text-[13px] leading-5 text-[var(--text)]">{plan.goal}</p>
      <Section title="核心功能" items={plan.coreFeatures} tone="accent" icon={ListChecks} />
      <Section title="本版不做" items={plan.nonGoals} tone="muted" icon={Ban} />
      <Section title="我的假设" items={plan.assumptions} tone="muted" icon={ClipboardList} />
      <Section title="待你确认" items={plan.openQuestions} tone="warning" icon={CircleHelp} />

      {canRevise ? (
        <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5">
          <label htmlFor="plan-feedback" className="sr-only">方案调整说明</label>
          <textarea
            id="plan-feedback"
            rows={2}
            value={feedback}
            maxLength={1000}
            disabled={busy}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder="要改什么？例如：不要分类筛选，改成每月预算提醒"
            className="block w-full resize-none bg-transparent px-1.5 py-1 text-[12px] leading-5 text-[var(--text)] outline-none placeholder:text-[#62738e] disabled:cursor-not-allowed"
          />
          <div className="flex justify-end px-1 pt-1">
            <button
              type="button"
              disabled={busy || !feedback.trim()}
              onClick={() => {
                onRevise(feedback.trim());
                setFeedback("");
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line-strong)] bg-[var(--panel-raised)] px-3 text-[11px] font-semibold text-[var(--text-soft)] transition hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw size={12} /> 重新规划
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-[rgba(242,190,109,.22)] bg-[rgba(242,190,109,.06)] px-3 py-2.5 text-[10px] leading-4 text-[#d8b577]">
          Demo Mode 只展示内置方案。配置服务端模型后，可以在这里反复调整需求再生成。
        </p>
      )}

      <button
        type="button"
        onClick={onApprove}
        disabled={busy}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-xs font-bold text-[#07101d] transition hover:bg-[#a7b6ff] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Check size={14} />
        {busy ? "处理中" : "批准并生成"}
      </button>
    </section>
  );
}
