import { describe, expect, it } from "vitest";
import { OutputValidationError, parseModelOutput } from "./parse";

const html = "<!doctype html><html><head><style>body{color:red}</style></head><body><button id=go>Go</button><script>document.querySelector('#go').onclick=()=>{document.body.dataset.done='yes'}</script></body></html>";

describe("parseModelOutput", () => {
  it("parses strict JSON and hardens the HTML", () => {
    const result = parseModelOutput(JSON.stringify({ projectName: "Demo", summary: "Created", html }));
    expect(result.mode).toBe("live");
    expect(result.html).toContain("Content-Security-Policy");
    expect(result.html).toContain("connect-src 'none'");
  });

  it("recovers JSON wrapped in a single markdown fence", () => {
    const raw = `\`\`\`json\n${JSON.stringify({ projectName: "Demo", summary: "Created", html })}\n\`\`\``;
    expect(parseModelOutput(raw).projectName).toBe("Demo");
  });

  it("rejects partial or network-enabled documents", () => {
    expect(() => parseModelOutput(JSON.stringify({ projectName: "Demo", summary: "Bad", html: "<div>no</div>" }))).toThrow(OutputValidationError);
    const networkHtml = "<!doctype html><html><head></head><body><script>fetch('/secret')</script></body></html>";
    expect(() => parseModelOutput(JSON.stringify({ projectName: "Demo", summary: "Bad", html: networkHtml }))).toThrow("不允许网络请求");
  });
});
