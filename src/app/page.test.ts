import { afterEach, describe, expect, it } from "vitest";
import Home, { dynamic } from "./page";

const originalKey = process.env.AI_API_KEY;
const originalModel = process.env.AI_MODEL;

afterEach(() => {
  if (originalKey === undefined) delete process.env.AI_API_KEY;
  else process.env.AI_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.AI_MODEL;
  else process.env.AI_MODEL = originalModel;
});

function initialMode() {
  return (Home() as { props: { initialMode: string } }).props.initialMode;
}

describe("home page mode", () => {
  it("renders per request so a container can inject configuration at run time", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("resolves the mode from the environment on every render", () => {
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
    expect(initialMode()).toBe("demo");

    process.env.AI_API_KEY = "sk-test";
    process.env.AI_MODEL = "gpt-test";
    expect(initialMode()).toBe("live");
  });
});
