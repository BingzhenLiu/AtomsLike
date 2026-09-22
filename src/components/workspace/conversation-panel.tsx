import { Bot, Sparkles, UserRound } from "lucide-react";
import type { Message } from "@/lib/projects/types";

export const EXAMPLES = [
  {
    label: "个人记账",
    prompt: "创建一个个人记账应用，支持收支记录、分类筛选和余额统计。",
    note: "表单 · 筛选 · 汇总",
  },
  {
    label: "专注番茄钟",
    prompt: "创建一个番茄钟，支持任务列表、开始暂停和完成次数统计。",
    note: "计时器 · 任务 · 统计",
  },
  {
    label: "习惯打卡",
    prompt: "创建一个习惯打卡应用，支持连续天数和每周进度。",
    note: "打卡 · 连续天数 · 周视图",
  },
] as const;

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <article className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${isUser ? "border-[var(--line)] bg-[var(--panel-raised)] text-[var(--text-soft)]" : "border-[rgba(141,162,255,.25)] bg-[var(--accent-soft)] text-[var(--accent)]"}`}>
        {isUser ? <UserRound size={13} /> : <Bot size={13} />}
      </div>
      <div className={`max-w-[82%] rounded-2xl px-3.5 py-3 text-[13px] leading-5 ${isUser ? "rounded-tr-sm bg-[var(--panel-raised)] text-[var(--text)]" : "rounded-tl-sm border border-[var(--line)] bg-[var(--panel-quiet)] text-[var(--text-soft)]"}`}>
        {message.content}
      </div>
    </article>
  );
}

export function ConversationPanel({
  messages,
  onExample,
  disabled,
}: {
  messages: Message[];
  onExample: (prompt: string) => void;
  disabled: boolean;
}) {
  if (messages.length) {
    return (
      <section aria-label="对话记录" className="space-y-4 px-5 py-5">
        {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
      </section>
    );
  }

  return (
    <section className="px-5 py-6">
      <div className="rounded-2xl border border-[var(--line)] bg-[linear-gradient(145deg,rgba(141,162,255,.12),rgba(13,24,40,.15)_50%)] p-5">
        <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(141,162,255,.35)] bg-[var(--accent-soft)] text-[var(--accent)]">
          <Sparkles size={18} />
        </div>
        <div className="utility-label text-[10px] text-[var(--accent)]">From idea to interface</div>
        <h1 className="mt-2 max-w-[310px] text-[27px] font-semibold leading-[1.08] tracking-[-.04em] text-[var(--text)]">描述一个小工具，直接使用第一版。</h1>
        <p className="mt-3 max-w-[340px] text-xs leading-5 text-[var(--muted)]">团队会规划功能、确定体验、生成代码并检查结果。完成后你可以在右侧操作它，再用一句话继续修改。</p>
      </div>
      <div className="mt-5">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--text-soft)]">从示例开始</span>
          <span className="utility-label text-[9px] text-[var(--muted)]">1 click to build</span>
        </div>
        <div className="grid gap-2.5">
          {EXAMPLES.map((example, index) => (
            <button
              key={example.label}
              type="button"
              disabled={disabled}
              onClick={() => onExample(example.prompt)}
              className="group flex w-full items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel-quiet)] px-3.5 py-3 text-left transition hover:-translate-y-px hover:border-[rgba(141,162,255,.45)] hover:bg-[var(--panel-raised)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="utility-label text-[10px] text-[var(--accent)]">0{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-[var(--text)]">{example.label}</span>
                <span className="mt-0.5 block text-[10px] text-[var(--muted)]">{example.note}</span>
              </span>
              <span aria-hidden className="text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]">→</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
