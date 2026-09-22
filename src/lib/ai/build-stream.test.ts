import { describe, expect, it } from "vitest";
import { createStreamParser, encodeStreamEvent, type BuildStreamEvent } from "./build-stream";

describe("createStreamParser", () => {
  it("decodes frames that arrive split across transport chunks", () => {
    const events: BuildStreamEvent[] = [
      { type: "stage", stage: "planner", status: "active" },
      { type: "stage", stage: "engineer", status: "completed" },
      { type: "error", error: { code: "PROVIDER_ERROR", message: "nope" } },
    ];
    const payload = events.map(encodeStreamEvent).join("");
    const parse = createStreamParser();
    const received: BuildStreamEvent[] = [];

    for (let offset = 0; offset < payload.length; offset += 7) {
      received.push(...parse(payload.slice(offset, offset + 7)));
    }

    expect(received).toEqual(events);
  });

  it("ignores malformed frames", () => {
    const parse = createStreamParser();
    expect(parse("data: {not json}\n\n")).toEqual([]);
  });
});
