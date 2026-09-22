export type BuildErrorCode =
  | "CONFIG_MISSING"
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

const STATUS_BY_CODE: Record<BuildErrorCode, number> = {
  REQUEST_INVALID: 400,
  OUTPUT_INVALID: 422,
  PREVIEW_REJECTED: 422,
  PROVIDER_ERROR: 502,
  CONFIG_MISSING: 503,
  PROVIDER_TIMEOUT: 504,
};

export function statusForErrorCode(code: string): number {
  return STATUS_BY_CODE[code as BuildErrorCode] ?? 502;
}

export type BuildErrorPayload = { code: string; message: string };

/** Normalizes unknown failures into a user-facing payload without leaking provider internals. */
export function toErrorPayload(error: unknown): BuildErrorPayload {
  if (error instanceof BuildError) return { code: error.code, message: error.message };
  return { code: "PROVIDER_ERROR", message: "生成请求失败。请检查服务配置或稍后重试。" };
}
