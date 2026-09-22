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

function planRequest(body: unknown, accept?: string) {
  return POST(new Request("http://localhost/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(accept ? { Accept: accept } : {}) },
    body: JSON.stringify(body),
  }));
}

async function readEvents(response: Response) {
  return (await response.text())
    .split("\n\n")
    .filter(Boolean)
    .map((frame) => JSON.parse(frame.replace(/^data: /, "")));
}

describe("POST /api/plan", () => {
  it("streams the planner stage and a reviewable specification", async () => {
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;

    const response = await planRequest({ prompt: "创建一个个人记账应用" }, "text/event-stream");
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const events = await readEvents(response);
    expect(events.filter((event) => event.type === "stage").map((event) => `${event.stage}:${event.status}`)).toEqual([
      "planner:active",
      "planner:completed",
    ]);
    expect(events.at(-1)).toMatchObject({ type: "plan" });
    expect(events.at(-1).plan.goal.length).toBeGreaterThan(0);
    expect(events.at(-1).plan.coreFeatures.length).toBeGreaterThan(0);
    expect(events.at(-1).plan).not.toHaveProperty("html");
  });

  it("answers non-streaming callers with the plan as JSON", async () => {
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;

    const response = await planRequest({ prompt: "创建一个番茄钟" });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ goal: expect.any(String) });
  });

  it("reports unsupported prompts as a CONFIG_MISSING error", async () => {
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;

    const response = await planRequest({ prompt: "做一个区块链交易所" });

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "CONFIG_MISSING" } });
  });

  it("rejects an empty prompt", async () => {
    const response = await planRequest({ prompt: "" });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "REQUEST_INVALID" } });
  });
});
