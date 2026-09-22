import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CodeView({ html }: { html: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(html);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="code-scroll relative min-h-0 flex-1 overflow-auto bg-[#07101b]">
      <button type="button" onClick={copy} className="sticky left-full top-3 z-10 mr-3 flex h-8 w-fit items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[rgba(13,24,40,.92)] px-2.5 text-[10px] text-[var(--text-soft)] backdrop-blur hover:border-[var(--line-strong)]">
        {copied ? <Check size={12} className="text-[var(--success)]" /> : <Copy size={12} />}
        {copied ? "已复制" : "复制 HTML"}
      </button>
      <pre className="-mt-8 min-w-full p-5 pt-14 font-mono text-[11px] leading-5 text-[#b8c6dc]"><code>{html}</code></pre>
    </div>
  );
}
