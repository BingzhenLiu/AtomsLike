export type BuildErrorCode =
  | "AUTH_REQUIRED"
  | "REQUEST_INVALID"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_ERROR"
  | "OUTPUT_INVALID"
  | "PREVIEW_REJECTED";

export class BuildError extends Error {
  constructor(
    readonly code: BuildErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BuildError";
  }
}

export type BuildErrorPayload = { code: BuildErrorCode; message: string };

/** Normalizes unknown failures into a user-facing payload without leaking provider internals. */
export function toErrorPayload(error: unknown): BuildErrorPayload {
  if (error instanceof BuildError) return { code: error.code, message: error.message };
  return { code: "PROVIDER_ERROR", message: "生成请求失败。请检查登录状态或稍后重试。" };
}

/** Reads the most specific message a web-sdk / axios style error can carry. */
export function describeError(error: unknown): string {
  const candidate = error as {
    message?: unknown;
    data?: { detail?: unknown };
    response?: { data?: { detail?: unknown } };
  } | null;
  const detail = candidate?.data?.detail ?? candidate?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (typeof candidate?.message === "string" && candidate.message.trim()) return candidate.message.trim();
  return "未知错误";
}

export function isAuthFailure(message: string): boolean {
  return /401|403|unauthor|unauthenticated|forbidden|not\s+logged|login|credentials/i.test(message);
}
