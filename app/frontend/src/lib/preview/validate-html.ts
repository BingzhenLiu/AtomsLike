export const MAX_HTML_LENGTH = 220_000;

/** `reason` stays optional on the success branch so callers can read it without extra narrowing. */
export type HtmlValidationResult = { ok: true; reason?: undefined } | { ok: false; reason: string };

const forbiddenPatterns: Array<[RegExp, string]> = [
  [/<script\b[^>]*\bsrc\s*=/i, "不允许外部脚本"],
  [/<link\b[^>]*\brel\s*=\s*["']?stylesheet/i, "不允许外部样式表"],
  [/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/i, "不允许网络请求"],
  [/\bimport\s*(?:\(|[^;]*\bfrom\b)/i, "不允许模块导入"],
  [/<iframe\b/i, "不允许嵌套 iframe"],
  [/<object\b|<embed\b/i, "不允许嵌入对象"],
  [/<meta\b[^>]*http-equiv\s*=\s*["']?refresh/i, "不允许自动跳转"],
];

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0;
}

export function validateGeneratedHtml(html: string): HtmlValidationResult {
  const trimmed = html.trim();
  if (!trimmed) return { ok: false, reason: "HTML 为空" };
  if (trimmed.length > MAX_HTML_LENGTH) return { ok: false, reason: "HTML 超出大小限制" };
  if (!/^<!doctype html>/i.test(trimmed)) return { ok: false, reason: "缺少 <!doctype html>" };
  if (!/<html(?:\s|>)/i.test(trimmed) || !/<\/html>\s*$/i.test(trimmed)) {
    return { ok: false, reason: "必须返回完整 HTML 文档" };
  }
  if (!/<head(?:\s|>)/i.test(trimmed) || !/<body(?:\s|>)/i.test(trimmed)) {
    return { ok: false, reason: "HTML 必须包含 head 和 body" };
  }
  if (countMatches(trimmed, /<script(?:\s|>)/gi) !== countMatches(trimmed, /<\/script>/gi)) {
    return { ok: false, reason: "script 标签未闭合" };
  }
  if (countMatches(trimmed, /<style(?:\s|>)/gi) !== countMatches(trimmed, /<\/style>/gi)) {
    return { ok: false, reason: "style 标签未闭合" };
  }
  for (const [pattern, reason] of forbiddenPatterns) {
    if (pattern.test(trimmed)) return { ok: false, reason };
  }
  return { ok: true };
}
