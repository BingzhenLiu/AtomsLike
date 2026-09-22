import type { GenerateRequest } from "./contract";

const SYSTEM_PROMPT = `You are the implementation engine inside AtomForge. Return strict JSON only with keys projectName, summary, and html.

The html value must be a complete document beginning with <!doctype html>. Build a polished, genuinely interactive small web application that satisfies the user's main workflow. Use only inline CSS and inline JavaScript. Do not use imports, module scripts, packages, CDNs, network requests, external fonts, iframes, object/embed tags, downloads, popups, credential collection, or parent-page navigation. It must work in a sandboxed iframe at desktop and mobile widths. Use accessible labels and visible focus states. Persisting data inside the generated app is not required.

For an edit request, return the full revised document rather than a patch. Keep useful existing behavior unless the user asks to remove it. The summary should be a concise user-facing description of what changed. Do not include Markdown fences or any text outside the JSON object.`;

export function createModelMessages(request: GenerateRequest) {
  const context = request.currentHtml
    ? `Current complete HTML to revise:\n${request.currentHtml}`
    : "There is no current application. Create the first version.";

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `User request:\n${request.prompt}\n\n${context}`,
    },
  ];
}
