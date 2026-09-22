import type { AppVersion } from "@/lib/projects/types";

const widths = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
} as const;

export function PreviewFrame({
  version,
  viewport,
}: {
  version: AppVersion;
  viewport: keyof typeof widths;
}) {
  return (
    <div className="preview-checker flex min-h-0 flex-1 justify-center overflow-auto p-3 sm:p-5">
      <div
        className="h-full min-h-[520px] max-w-full overflow-hidden rounded-[14px] bg-white shadow-[0_22px_70px_rgba(3,8,18,.32)] transition-[width] duration-300"
        style={{ width: widths[viewport] }}
      >
        <iframe
          key={version.id}
          title={`Generated application preview: ${version.summary}`}
          sandbox="allow-scripts allow-forms allow-modals"
          srcDoc={version.html}
          className="h-full min-h-[520px] w-full border-0 bg-white"
        />
      </div>
    </div>
  );
}
