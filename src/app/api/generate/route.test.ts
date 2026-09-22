import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";

const originalKey = process.env.AI_API_KEY;
const originalModel = process.env.AI_MODEL;

afterEach(() => {
  if (originalKey === undefined) delete process.env.AI_API_KEY;
  else process.env.AI_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.AI_MODEL;
  else process.env.AI_MODEL = originalModel;
});

describe("POST /api/generate", () => {
  it("rejects empty prompts with a stable code", async () => {
    const response = await POST(new Request("http://localhost/api/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: "" }),
      headers: { "Content-Type": "application/json" },
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "REQUEST_INVALID" } });
  });

  it("runs a curated flow honestly when no model key is configured", async () => {
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
    const response = await POST(new Request("http://localhost/api/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: "创建一个个人记账应用" }),
      headers: { "Content-Type": "application/json" },
    }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.mode).toBe("demo");
    expect(payload.html).toContain("Content-Security-Policy");
  });
  it("rejects unsupported demo edits instead of pretending they were generated", async () => {
    delete process.env.AI_API_KEY;
    const first = await POST(new Request("http://localhost/api/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: "创建一个个人记账应用" }),
      headers: { "Content-Type": "application/json" },
    }));
    const current = await first.json();
    const response = await POST(new Request("http://localhost/api/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: "创建一个天气应用并联网查询", currentHtml: current.html }),
      headers: { "Content-Type": "application/json" },
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "CONFIG_MISSING" } });
  });

  it("streams stage events before the result when the client accepts an event stream", async () => {
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
    const response = await POST(new Request("http://localhost/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ prompt: "创建一个个人记账应用" }),
    }));

    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const frames = (await response.text()).split("\n\n").filter(Boolean);
    const events = frames.map((frame) => JSON.parse(frame.replace(/^data: /, "")));

    expect(events.filter((event) => event.type === "stage").map((event) => `${event.stage}:${event.status}`)).toEqual([
      "designer:active",
      "designer:completed",
      "engineer:active",
      "engineer:completed",
      "reviewer:active",
      "reviewer:completed",
    ]);
    expect(events.at(-1)).toMatchObject({ type: "result", result: { mode: "demo" } });
  });

  it("reports unsupported requests as an error event inside the stream", async () => {
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
    const response = await POST(new Request("http://localhost/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ prompt: "做一个区块链交易所" }),
    }));

    const events = (await response.text())
      .split("\n\n")
      .filter(Boolean)
      .map((frame) => JSON.parse(frame.replace(/^data: /, "")));

    expect(events.at(-1)).toMatchObject({ type: "error", error: { code: "CONFIG_MISSING" } });
  });

});
