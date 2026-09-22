import { useMemo } from "react";
import { AlertTriangle, Bot, Sparkles, User } from "lucide-react";
import { DEMO_RECIPES } from "@/lib/ai/demo-generator";
import type { WorkspaceState } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "agent";
  tone: "normal" | "error";
  text: string;
};

/** Derives the conversation from real workspace state instead of storing a parallel log. */
function buildMessages(state: WorkspaceState): Message[] {
  const out: Message[] = [];
  const hasThread = Boolean(state.prompt) && (state.isPlanning || Boolean(state.plan) || Boolean(state.planError) || state.versions.length > 0);

  if (hasThread) out.push({ id: "user-prompt", role: "user", tone: "normal", text: state.prompt });
  if (state.isPlanning) {
    out.push({ id: "planning", role: "agent", tone: "normal", text: "Planner 正在拆解需求并准备方案…" });
  }
  if (state.planError) {
    out.push({ id: "plan-error", role: "agent", tone: "error", text: state.planError.message });
  }
  if (state.plan) {
    out.push({
      id: "plan-ready",
      role: "agent",
      tone: "normal",
      text: `方案已就绪：${state.plan.title}。确认后我会依次完成设计、实现和检查。`,
    });
  }
  state.versions.forEach((version) => {
    out.push({
      id: `version-${version.id}`,
      role: "agent",
      tone: "normal",
      text: version.revision
        ? `已按「${version.revision.prompt}」生成第 ${version.index} 版：${version.summary}`
        : `第 ${version.index} 版已生成：${version.summary}`,
    });
  });
  if (state.buildError) {
    out.push({ id: "build-error", role: "agent", tone: "error", text: state.buildError.message });
  }
  return out;
}

export function ConversationPanel({
  state,
  onExample,
  disabled,
}: {
  state: WorkspaceState;
  onExample: (prompt: string) => void;
  disabled: boolean;
}) {
  const messages = useMemo(() => buildMessages(state), [state]);

  return (
    <section className="af-panel flex min-h-0 flex-1 flex-col" aria-label="与 AtomForge 的对话">
      <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <span className="af-label">Conversation</span>
        <span className="text-[10px] text-[var(--dim)]">{state.mode === "live" ? "Atoms AIHub" : "内置模板"}</span>
      </header>

      <div className="af-scroll flex-1 space-y-3 px-4 py-4">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-[13px] text-[var(--text-soft)]">
              <Sparkles className="mt-[3px] h-4 w-4 text-[var(--accent)]" aria-hidden />
              <p>
                用一句话描述你想要的小工具，我会先给出方案，经你确认后生成一个可以直接使用的完整应用。
              </p>
            </div>
            <div className="space-y-2">
              <span className="af-label">试试这些</span>
              {DEMO_RECIPES.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onExample(recipe.prompt)}
                  className="af-chip w-full justify-start px-3 py-2 text-left text-[12px] disabled:opacity-40"
                >
                  {recipe.label} · {recipe.prompt.slice(0, 22)}…
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex gap-2", message.role === "user" ? "justify-end" : "justify-start")}
            >
              {message.role === "agent" && (
                <span className="mt-[2px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel-raised)]">
                  {message.tone === "error" ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-[var(--danger)]" aria-hidden />
                  ) : (
                    <Bot className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden />
                  )}
                </span>
              )}
              <p
                className={cn(
                  "max-w-[82%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-6",
                  message.role === "user"
                    ? "rounded-tr-sm bg-[var(--panel-raised)] text-[var(--text)]"
                    : message.tone === "error"
                      ? "rounded-tl-sm border border-[var(--danger)] bg-[rgba(255,123,141,.08)] text-[var(--text)]"
                      : "rounded-tl-sm border border-[var(--line)] bg-[var(--panel-quiet)] text-[var(--text-soft)]",
                )}
              >
                {message.text}
              </p>
              {message.role === "user" && (
                <span className="mt-[2px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] bg-[var(--panel-raised)]">
                  <User className="h-3.5 w-3.5 text-[var(--text-soft)]" aria-hidden />
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
