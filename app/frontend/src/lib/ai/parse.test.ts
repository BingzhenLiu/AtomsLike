import { describe, expect, it } from "vitest";
import { BuildError, isAuthFailure } from "./errors";
import { extractJsonBlock, mapHtml, mapReview, normalizePlan, parseStageJson } from "./parse";

describe("extractJsonBlock", () => {
  it("unwraps a fenced json block surrounded by prose", () => {
    const raw = '下面是方案：\n```json\n{"title":"记账","goal":"记录收支"}\n```\n希望有帮助。';
    expect(JSON.parse(extractJsonBlock(raw))).toEqual({ title: "记账", goal: "记录收支" });
  });

  it("trims a bare object out of surrounding text", () => {
    expect(extractJsonBlock('结果 {"a":1} 结束')).toBe('{"a":1}');
  });
});

describe("normalizePlan", () => {
  it("maps snake_case and object-shaped feature lists", () => {
    const plan = normalizePlan({
      name: "番茄钟",
      description: "专注计时",
      core_features: [{ title: "25 分钟专注" }, "休息提醒"],
      non_goals: ["多人协作"],
      assumptions: "浏览器支持通知",
    });
    expect(plan?.title).toBe("番茄钟");
    expect(plan?.goal).toBe("专注计时");
    expect(plan?.features).toEqual(["25 分钟专注", "休息提醒"]);
    expect(plan?.nonGoals).toEqual(["多人协作"]);
  });

  it("rejects an empty payload", () => {
    expect(normalizePlan({})).toBeNull();
    expect(normalizePlan(null)).toBeNull();
  });
});

describe("parseStageJson", () => {
  it("reports invalid model output as an OUTPUT_INVALID build error", () => {
    expect(() => parseStageJson("不是 JSON", mapHtml, "生成结果格式错误")).toThrowError(BuildError);
    try {
      parseStageJson("不是 JSON", mapHtml, "生成结果格式错误");
    } catch (error) {
      expect((error as BuildError).code).toBe("OUTPUT_INVALID");
    }
  });

  it("accepts a document delivered under an alias field", () => {
    const parsed = parseStageJson(
      '```json\n{"code":"<!doctype html><html></html>","description":"首版"}\n```',
      mapHtml,
      "生成结果格式错误",
    );
    expect(parsed.summary).toBe("首版");
  });
});

describe("mapReview", () => {
  it("infers approval from an empty issue list", () => {
    expect(mapReview({ issues: [] })?.approved).toBe(true);
    expect(mapReview({ problems: ["缺少空状态"] })?.approved).toBe(false);
  });
});

describe("isAuthFailure", () => {
  it("detects authentication and quota style messages", () => {
    expect(isAuthFailure("401 Unauthorized")).toBe(true);
    expect(isAuthFailure("Not logged in")).toBe(true);
    expect(isAuthFailure("模型内部错误")).toBe(false);
  });
});
