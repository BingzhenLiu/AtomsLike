import { afterEach, describe, expect, it } from "vitest";
import { createAgentRuntime, isAgentConfigured } from "./runtime";

const original = {
  key: process.env.AI_API_KEY,
  baseUrl: process.env.AI_BASE_URL,
  model: process.env.AI_MODEL,
};

afterEach(() => {
  for (const [name, value] of [
    ["AI_API_KEY", original.key],
    ["AI_BASE_URL", original.baseUrl],
    ["AI_MODEL", original.model],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function configure(key?: string, model?: string, baseUrl?: string) {
  if (key === undefined) delete process.env.AI_API_KEY;
  else process.env.AI_API_KEY = key;
  if (model === undefined) delete process.env.AI_MODEL;
  else process.env.AI_MODEL = model;
  if (baseUrl === undefined) delete process.env.AI_BASE_URL;
  else process.env.AI_BASE_URL = baseUrl;
}

describe("agent runtime configuration", () => {
  it("stays unconfigured until both a key and a model id exist", () => {
    configure();
    expect(isAgentConfigured()).toBe(false);
    expect(createAgentRuntime()).toBeNull();

    configure("sk-test");
    expect(isAgentConfigured()).toBe(false);
    expect(createAgentRuntime()).toBeNull();

    configure(undefined, "gpt-test");
    expect(isAgentConfigured()).toBe(false);
    expect(createAgentRuntime()).toBeNull();
  });

  it("reads the environment when it is called, not when the module loads", () => {
    configure();
    expect(isAgentConfigured()).toBe(false);

    configure("sk-late", "gpt-late", "https://example.test/v1");
    expect(isAgentConfigured()).toBe(true);
    expect(createAgentRuntime()?.model).toMatchObject({
      id: "gpt-late",
      provider: "atomforge",
      baseUrl: "https://example.test/v1",
    });
  });

  it("treats blank values as absent and trims what it does read", () => {
    configure("   ", "\n");
    expect(isAgentConfigured()).toBe(false);
    expect(createAgentRuntime()).toBeNull();

    configure("  sk-padded  ", " gpt-padded ", "  https://example.test/v1//  ");
    expect(createAgentRuntime()?.model).toMatchObject({
      id: "gpt-padded",
      baseUrl: "https://example.test/v1",
    });
  });

  it("falls back to the public OpenAI endpoint when no base url is set", () => {
    configure("sk-test", "gpt-test");
    expect(createAgentRuntime()?.model.baseUrl).toBe("https://api.openai.com/v1");
  });
});
