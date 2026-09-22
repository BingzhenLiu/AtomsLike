import { CornerDownLeft, RotateCcw } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";

export function PromptComposer({
  isBuilding,
  awaitsApproval,
  hasVersion,
  initialValue = "",
  onSubmit,
  onRetry,
  canRetry,
}: {
  isBuilding: boolean;
  awaitsApproval: boolean;
  hasVersion: boolean;
  initialValue?: string;
  onSubmit: (prompt: string) => void;
  onRetry: () => void;
  canRetry: boolean;
}) {
  const [value, setValue] = useState(initialValue);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const prompt = value.trim();
    if (!prompt || isBuilding) return;
    onSubmit(prompt);
    setValue("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-[var(--line)] bg-[rgba(7,16,29,.82)] p-4 backdrop-blur-xl">
      {canRetry && !isBuilding && (
        <button type="button" onClick={onRetry} className="mb-2.5 inline-flex items-center gap-1.5 rounded-lg border border-[rgba(255,123,141,.3)] bg-[rgba(255,123,141,.08)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--danger)] hover:bg-[rgba(255,123,141,.13)]">
          <RotateCcw size={12} /> 重试上次请求
        </button>
      )}
      <div className="rounded-2xl border border-[var(--line-strong)] bg-[var(--panel)] p-2 shadow-[0_14px_40px_rgba(0,0,0,.22)] focus-within:border-[rgba(141,162,255,.65)]">
        <label htmlFor="prompt" className="sr-only">{hasVersion ? "描述要修改的内容" : "描述想创建的应用"}</label>
        <textarea
          id="prompt"
          rows={3}
          value={value}
          maxLength={4000}
          disabled={isBuilding}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={hasVersion ? "例如：改成深色并增加分类统计…" : "描述你想创建的应用…"}
          className="block w-full resize-none bg-transparent px-2 py-1.5 text-[13px] leading-5 text-[var(--text)] outline-none placeholder:text-[#62738e] disabled:cursor-not-allowed"
        />
        <div className="flex items-center justify-between gap-3 px-1 pt-1">
          <span className="text-[10px] text-[var(--muted)]">Enter 生成 · Shift + Enter 换行</span>
          <button
            type="submit"
            disabled={isBuilding || !value.trim()}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--accent)] px-3.5 text-xs font-bold text-[#07101d] transition hover:bg-[#a7b6ff] disabled:cursor-not-allowed disabled:opacity-35"
          >
            {awaitsApproval ? "等待确认" : isBuilding ? "构建中" : hasVersion ? "应用修改" : "开始构建"}
            <CornerDownLeft size={13} />
          </button>
        </div>
      </div>
    </form>
  );
}
