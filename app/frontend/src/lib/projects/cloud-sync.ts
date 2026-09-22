import { client } from "@/lib/api";
import type { PlanPayload, ProjectVersion, WorkspaceState } from "./types";

export type AuthState = "loading" | "authenticated" | "anonymous";

export type LockState = {
  granted: boolean;
  session_token: string;
  holder_device: string;
  holder_since: string;
  reason: string;
};

export type CloudWorkspace = {
  id: string;
  title: string;
  prompt: string;
  mode: string;
  plan: PlanPayload | null;
  pendingRevision: string | null;
  activeVersionId: string | null;
  versions: ProjectVersion[];
};

function errorMessage(error: unknown, fallback: string): string {
  const shaped = error as { data?: { detail?: string }; response?: { data?: { detail?: string } }; message?: string };
  return shaped?.data?.detail || shaped?.response?.data?.detail || shaped?.message || fallback;
}

/** A stable, human-readable label so the lock conflict names the other device. */
export function describeDevice(): string {
  if (typeof navigator === "undefined") return "未知设备";
  const ua = navigator.userAgent;
  const platform = /iPhone|iPad|Android/i.test(ua) ? "移动设备" : "桌面设备";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua)
        ? "Safari"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : "浏览器";
  return `${platform} · ${browser}`;
}

export async function resolveAuth(): Promise<AuthState> {
  try {
    const response = await client.auth.me();
    return response?.data ? "authenticated" : "anonymous";
  } catch {
    return "anonymous";
  }
}

export async function acquireLock(takeover: boolean): Promise<LockState> {
  const response = await client.apiCall.invoke({
    url: "/api/v1/forge/lock/acquire",
    method: "POST",
    data: { device_label: describeDevice(), takeover },
  });
  return response.data as LockState;
}

export async function heartbeatLock(
  sessionToken: string,
): Promise<{ valid: boolean; holder_device: string }> {
  const response = await client.apiCall.invoke({
    url: "/api/v1/forge/lock/heartbeat",
    method: "POST",
    data: { session_token: sessionToken },
  });
  return response.data as { valid: boolean; holder_device: string };
}

export async function releaseLock(sessionToken: string): Promise<void> {
  try {
    await client.apiCall.invoke({
      url: "/api/v1/forge/lock/release",
      method: "POST",
      data: { session_token: sessionToken },
    });
  } catch {
    /* best-effort release: the server-side TTL reclaims an abandoned lock anyway */
  }
}

export async function loadCloudWorkspace(): Promise<CloudWorkspace | null> {
  const response = await client.apiCall.invoke({
    url: "/api/v1/forge/workspace/load",
    method: "POST",
    data: {},
  });
  return (response.data?.workspace ?? null) as CloudWorkspace | null;
}

export async function saveCloudWorkspace(
  sessionToken: string,
  state: WorkspaceState,
): Promise<CloudWorkspace | null> {
  try {
    const response = await client.apiCall.invoke({
      url: "/api/v1/forge/workspace/save",
      method: "POST",
      data: {
        session_token: sessionToken,
        title: state.plan?.title || state.prompt.slice(0, 60),
        prompt: state.prompt,
        mode: state.mode,
        plan: state.plan,
        pendingRevision: state.pendingRevision,
        versions: state.versions.map((version) => ({
          index: version.index,
          html: version.html,
          summary: version.summary,
          prompt: version.prompt,
          revision: version.revision,
        })),
      },
    });
    return (response.data?.workspace ?? null) as CloudWorkspace | null;
  } catch (error) {
    throw new Error(errorMessage(error, "同步到云端失败"));
  }
}

export async function resetCloudWorkspace(sessionToken: string): Promise<void> {
  try {
    await client.apiCall.invoke({
      url: "/api/v1/forge/workspace/reset",
      method: "POST",
      data: { session_token: sessionToken },
    });
  } catch (error) {
    throw new Error(errorMessage(error, "清空云端历史失败"));
  }
}
