import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CodeView({ html }: { html: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="relative h-full overflow-hidden">
      <button
        type="button"
        onClick={copy}
        aria-label="复制 HTML"
        className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-lg border border-[var(--line-strong)] bg-[rgba(7,16,29,.9)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-soft)] backdrop-blur hover:border-[var(--accent)] hover:text-[var(--text)]"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-[var(--success)]" aria-hidden />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden />
        )}
        {copied ? "已复制" : "复制 HTML"}
      </button>
      <pre className="af-scroll h-full overflow-auto bg-[var(--canvas-soft)] p-4 pt-14">
        <code className="font-mono text-[11.5px] leading-[1.7] text-[var(--text-soft)]">{html}</code>
      </pre>
    </div>
  );
}
