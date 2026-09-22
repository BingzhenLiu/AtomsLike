import { useEffect, useState } from "react";
import { CornerDownLeft, RotateCcw, Send, Wand2 } from "lucide-react";

export function PromptComposer({
  busy,
  hasPlan,
  hasVersion,
  onSubmit,
  onRevise,
  onRetry,
}: {
  busy: boolean;
  hasPlan: boolean;
  hasVersion: boolean;
  onSubmit: (prompt: string) => void;
  onRevise: (changeRequest: string) => void;
  onRetry: () => void;
}) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<"plan" | "revise">("plan");

  useEffect(() => {
    if (!hasVersion) setMode("plan");
  }, [hasVersion]);

  const isRevising = mode === "revise";
  const disabled = busy || (isRevising ? !hasVersion : !value.trim());

  const submit = () => {
    const text = value.trim();
    if (!text || busy) return;
    if (isRevising) onRevise(text);
    else onSubmit(text);
    setValue("");
  };

  return (
    <form
      className="border-t border-[var(--line)] bg-[rgba(7,16,29,.82)] px-4 py-3 backdrop-blur"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {hasVersion && (
        <div className="mb-2 flex gap-1.5" role="tablist" aria-label="输入模式">
          {(
            [
              { id: "plan", label: "新的应用" },
              { id: "revise", label: "修改当前版本" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              onClick={() => setMode(item.id)}
              className={
                mode === item.id
                  ? "rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]"
                  : "rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--dim)] hover:text-[var(--text-soft)]"
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <textarea
        className="af-input min-h-[76px]"
        placeholder={
          isRevising
            ? "描述要修改的地方，例如：增加按月份筛选，并把结余放到最上方"
            : "描述你想要的小工具，例如：帮我做一个记账应用"
        }
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            submit();
          }
        }}
        disabled={busy}
        aria-label={isRevising ? "修改要求" : "应用需求"}
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[10px] text-[var(--dim)]">
          <CornerDownLeft className="h-3 w-3" aria-hidden />
          Ctrl / ⌘ + Enter 发送
        </span>
        <div className="flex items-center gap-2">
          {hasPlan && !busy && (
            <button type="button" className="af-btn af-btn-ghost" onClick={onRetry}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              重试生成
            </button>
          )}
          <button type="submit" className="af-btn af-btn-primary" disabled={disabled}>
            {isRevising ? (
              <Wand2 className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Send className="h-3.5 w-3.5" aria-hidden />
            )}
            {busy ? "处理中…" : isRevising ? "生成新版本" : "生成方案"}
          </button>
        </div>
      </div>
    </form>
  );
}
