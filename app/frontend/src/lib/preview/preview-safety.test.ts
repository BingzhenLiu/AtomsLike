import { describe, expect, it } from "vitest";
import { hardenGeneratedHtml } from "./harden-html";
import { MAX_HTML_LENGTH, validateGeneratedHtml } from "./validate-html";

const validDocument = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>记账</title><style>body{margin:0}</style></head>
<body><div id="app"></div><script>document.title = "ok";</script></body></html>`;

describe("validateGeneratedHtml", () => {
  it("accepts a complete inline document", () => {
    expect(validateGeneratedHtml(validDocument)).toEqual({ ok: true });
  });

  it("requires a full html document", () => {
    expect(validateGeneratedHtml("")).toEqual({ ok: false, reason: "HTML 为空" });
    expect(validateGeneratedHtml("<div>片段</div>")).toEqual({
      ok: false,
      reason: "缺少 <!doctype html>",
    });
    expect(
      validateGeneratedHtml("<!doctype html><html><body>缺少 head</body></html>"),
    ).toEqual({ ok: false, reason: "HTML 必须包含 head 和 body" });
  });

  it("rejects external resources, network calls and nested frames", () => {
    const cases: Array<[string, string]> = [
      ['<script src="https://cdn.example.com/x.js"></script>', "不允许外部脚本"],
      ['<link rel="stylesheet" href="https://cdn.example.com/x.css">', "不允许外部样式表"],
      ["<script>fetch('/api/data')</script>", "不允许网络请求"],
      ['<iframe src="https://example.com"></iframe>', "不允许嵌套 iframe"],
      ['<meta http-equiv="refresh" content="0;url=https://example.com">', "不允许自动跳转"],
    ];
    for (const [fragment, reason] of cases) {
      const result = validateGeneratedHtml(
        `<!doctype html><html><head></head><body>${fragment}</body></html>`,
      );
      expect(result).toEqual({ ok: false, reason });
    }
  });

  it("rejects unclosed script tags", () => {
    expect(
      validateGeneratedHtml("<!doctype html><html><head></head><body><script>1</body></html>"),
    ).toEqual({ ok: false, reason: "script 标签未闭合" });
  });

  it("rejects oversized documents", () => {
    const huge = `<!doctype html><html><head></head><body>${"a".repeat(MAX_HTML_LENGTH)}</body></html>`;
    expect(validateGeneratedHtml(huge)).toEqual({ ok: false, reason: "HTML 超出大小限制" });
  });
});

describe("hardenGeneratedHtml", () => {
  it("injects a locked-down CSP as the first head element", () => {
    const hardened = hardenGeneratedHtml(validDocument);
    expect(hardened).toContain("Content-Security-Policy");
    expect(hardened).toContain("connect-src 'none'");
    expect(hardened.indexOf("Content-Security-Policy")).toBeLessThan(
      hardened.indexOf("<title>"),
    );
  });

  it("replaces a model-authored CSP instead of stacking two policies", () => {
    const withCsp = validDocument.replace(
      "<head>",
      '<head><meta http-equiv="Content-Security-Policy" content="default-src *">',
    );
    const hardened = hardenGeneratedHtml(withCsp);
    expect(hardened.match(/Content-Security-Policy/g)).toHaveLength(1);
    expect(hardened).not.toContain("default-src *");
  });
});
