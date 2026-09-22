import { useMemo } from "react";

export const PREVIEW_WIDTHS = [
  { id: "full", label: "100%", value: "100%" },
  { id: "tablet", label: "768", value: "768px" },
  { id: "phone", label: "390", value: "390px" },
] as const;

export type PreviewWidthId = (typeof PREVIEW_WIDTHS)[number]["id"];

/**
 * Renders generated HTML in a locked-down sandbox. `allow-same-origin` is deliberately
 * absent so the preview can never reach the host page; the stored HTML already carries CSP.
 */
export function PreviewFrame({ html, widthId }: { html: string; widthId: PreviewWidthId }) {
  const width = useMemo(
    () => PREVIEW_WIDTHS.find((item) => item.id === widthId)?.value ?? "100%",
    [widthId],
  );

  return (
    <div className="flex h-full justify-center overflow-hidden p-3">
      <div
        className="h-full overflow-hidden rounded-[14px] border border-[var(--line)] bg-white shadow-[0_22px_70px_rgba(3,8,18,.32)] transition-[max-width] duration-300"
        style={{ width, maxWidth: "100%" }}
      >
        <iframe
          key={html.length}
          title="应用预览"
          srcDoc={html}
          sandbox="allow-scripts allow-forms allow-modals"
          className="h-full w-full border-0 bg-white"
        />
      </div>
    </div>
  );
}
