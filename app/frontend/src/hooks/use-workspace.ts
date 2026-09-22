import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { client } from "@/lib/api";
import { toErrorPayload } from "@/lib/ai/errors";
import { runBuildPipeline, requestPlan, resolveDemoRecipe } from "@/lib/ai/workflow";
import type { DemoRecipe } from "@/lib/ai/demo-generator";
import { createWorkspaceState, workspaceReducer } from "@/lib/projects/reducer";
import { loadWorkspace, saveWorkspace } from "@/lib/projects/local-storage";
import {
  acquireLock,
  heartbeatLock,
  loadCloudWorkspace,
  releaseLock,
  resetCloudWorkspace,
  resolveAuth,
  saveCloudWorkspace,
  type AuthState,
  type CloudWorkspace,
} from "@/lib/projects/cloud-sync";
import { selectActiveVersion, selectIsBusy } from "@/lib/projects/selectors";
import type { WorkspaceMode, WorkspaceState } from "@/lib/projects/types";

const HEARTBEAT_MS = 30_000;

export type LockStatus = "idle" | "owner" | "conflict" | "evicted";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

function mergeCloudState(base: WorkspaceState, cloud: CloudWorkspace): WorkspaceState {
  const versions = cloud.versions.map((version, order) => ({
    ...version,
    index: version.index || order + 1,
    revision: version.revision ?? null,
  }));
  return {
    ...base,
    prompt: cloud.prompt || base.prompt,
    mode: cloud.mode === "demo" ? "demo" : "live",
    plan: cloud.plan ?? null,
    pendingRevision: cloud.pendingRevision ?? null,
    versions,
    activeVersionId: versions.length ? versions[versions.length - 1].id : null,
    updatedAt: Date.now(),
  };
}

export function useWorkspace() {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, createWorkspaceState);
  const [hydrated, setHydrated] = useState(false);
  const [auth, setAuth] = useState<AuthState>("loading");
  const [lockStatus, setLockStatus] = useState<LockStatus>("idle");
  const [lockHolder, setLockHolder] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const demoRecipeRef = useRef<DemoRecipe | null>(null);
  const tokenRef = useRef<string>("");
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readOnly = auth === "authenticated" && (lockStatus === "conflict" || lockStatus === "evicted");

  /** Cloud history is account-scoped; local storage only backs the anonymous flow. */
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const authState = await resolveAuth();
      if (cancelled) return;
      setAuth(authState);

      if (authState !== "authenticated") {
        const stored = loadWorkspace();
        if (stored) {
          dispatch({ type: "hydrate", state: stored });
          demoRecipeRef.current = resolveDemoRecipe(stored.prompt);
        }
        setHydrated(true);
        return;
      }

      try {
        const lock = await acquireLock(false);
        if (cancelled) return;
        if (lock.granted) {
          tokenRef.current = lock.session_token;
          setLockStatus("owner");
        } else {
          setLockStatus("conflict");
          setLockHolder(lock.holder_device);
        }
      } catch {
        if (!cancelled) setLockStatus("idle");
      }

      try {
        const cloud = await loadCloudWorkspace();
        if (cancelled) return;
        if (cloud) {
          dispatch({ type: "hydrate", state: mergeCloudState(createWorkspaceState(), cloud) });
          demoRecipeRef.current = resolveDemoRecipe(cloud.prompt);
        }
      } catch {
        if (!cancelled) toast.error("云端历史加载失败，本次为本地状态");
      }
      if (!cancelled) setHydrated(true);
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Keep the lock alive and detect takeover by another session of the same account. */
  useEffect(() => {
    if (lockStatus !== "owner" || !tokenRef.current) return;
    const timer = setInterval(async () => {
      try {
        const result = await heartbeatLock(tokenRef.current);
        if (!result.valid) {
          setLockStatus("evicted");
          setLockHolder(result.holder_device);
          toast.error("该账号已在其他设备上接管编辑，当前窗口转为只读");
        }
      } catch {
        /* transient network failure: the next heartbeat retries */
      }
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [lockStatus]);

  useEffect(() => {
    const token = tokenRef.current;
    if (!token) return;
    const handleUnload = () => void releaseLock(token);
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [lockStatus]);

  /** Anonymous sessions persist locally; lock owners push a debounced cloud snapshot. */
  useEffect(() => {
    if (!hydrated) return;
    if (auth !== "authenticated") {
      saveWorkspace(state);
      return;
    }
    if (lockStatus !== "owner" || !tokenRef.current) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      setSyncStatus("syncing");
      try {
        await saveCloudWorkspace(tokenRef.current, state);
        setSyncStatus("synced");
      } catch (error) {
        setSyncStatus("error");
        toast.error(error instanceof Error ? error.message : "同步到云端失败");
      }
    }, 800);
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [auth, hydrated, lockStatus, state]);

  const activeVersion = useMemo(() => selectActiveVersion(state), [state]);
  const busy = selectIsBusy(state);

  const guardWrite = useCallback(() => {
    if (readOnly) {
      toast.error(`当前账号已在「${lockHolder || "另一台设备"}」上编辑，本窗口为只读`);
      return false;
    }
    return true;
  }, [lockHolder, readOnly]);

  const takeOver = useCallback(async () => {
    try {
      const lock = await acquireLock(true);
      if (!lock.granted) {
        toast.error("接管失败，请稍后重试");
        return;
      }
      tokenRef.current = lock.session_token;
      setLockStatus("owner");
      const cloud = await loadCloudWorkspace();
      if (cloud) {
        dispatch({ type: "hydrate", state: mergeCloudState(createWorkspaceState(), cloud) });
        demoRecipeRef.current = resolveDemoRecipe(cloud.prompt);
      }
      toast.success("已接管编辑权限");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "接管失败");
    }
  }, []);

  const login = useCallback(() => client.auth.toLogin(), []);

  const submitPrompt = useCallback(
    async (prompt: string) => {
      if (!guardWrite()) return;
      if (!prompt.trim()) {
        toast.error("请先描述你想要的应用");
        return;
      }
      dispatch({ type: "plan-start", prompt: prompt.trim() });
      demoRecipeRef.current = resolveDemoRecipe(prompt);
      try {
        const { plan } = await requestPlan({ prompt: prompt.trim(), mode: state.mode });
        dispatch({ type: "plan-success", plan });
      } catch (error) {
        const payload = toErrorPayload(error);
        dispatch({ type: "plan-error", error: payload });
        toast.error(payload.message);
      }
    },
    [guardWrite, state.mode],
  );

  const approveAndBuild = useCallback(async () => {
    if (!guardWrite() || !state.plan) return;
    dispatch({ type: "build-start" });
    try {
      const result = await runBuildPipeline({
        prompt: state.prompt,
        plan: state.plan,
        baseVersion: null,
        mode: state.mode,
        report: (stage, status) => dispatch({ type: "stage", stage, status }),
        demoRecipe: demoRecipeRef.current,
      });
      dispatch({ type: "build-success", version: result.version });
      toast.success("应用已生成，可以在右侧直接体验");
    } catch (error) {
      const payload = toErrorPayload(error);
      dispatch({ type: "build-error", error: payload });
      toast.error(payload.message);
    }
  }, [guardWrite, state.mode, state.plan, state.prompt]);

  const revise = useCallback(
    async (changeRequest: string) => {
      if (!guardWrite()) return;
      if (!activeVersion) {
        toast.error("还没有可修改的版本，请先生成应用");
        return;
      }
      dispatch({ type: "revise-start", changeRequest });
      try {
        const result = await runBuildPipeline({
          prompt: state.prompt,
          plan: state.plan,
          baseVersion: activeVersion,
          changeRequest,
          mode: state.mode,
          report: (stage, status) => dispatch({ type: "stage", stage, status }),
          demoRecipe: demoRecipeRef.current,
        });
        dispatch({ type: "build-success", version: result.version });
        toast.success("修改已生成新版本");
      } catch (error) {
        const payload = toErrorPayload(error);
        dispatch({ type: "build-error", error: payload });
        toast.error(payload.message);
      }
    },
    [activeVersion, guardWrite, state],
  );

  const retryBuild = useCallback(async () => {
    if (state.pendingRevision && activeVersion) {
      await revise(state.pendingRevision);
      return;
    }
    if (state.plan) await approveAndBuild();
    else await submitPrompt(state.prompt);
  }, [
    activeVersion,
    approveAndBuild,
    revise,
    state.pendingRevision,
    state.plan,
    state.prompt,
    submitPrompt,
  ]);

  const setMode = useCallback((mode: WorkspaceMode) => dispatch({ type: "set-mode", mode }), []);
  const selectVersion = useCallback(
    (versionId: string) => dispatch({ type: "select-version", versionId }),
    [],
  );
  const replan = useCallback(() => dispatch({ type: "reset-plan" }), []);
  const reset = useCallback(async () => {
    if (!guardWrite()) return;
    demoRecipeRef.current = null;
    dispatch({ type: "reset-workspace" });
    if (auth === "authenticated" && tokenRef.current) {
      try {
        await resetCloudWorkspace(tokenRef.current);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "清空云端历史失败");
      }
    }
  }, [auth, guardWrite]);

  return {
    state,
    hydrated,
    busy,
    activeVersion,
    auth,
    lockStatus,
    lockHolder,
    syncStatus,
    readOnly,
    login,
    takeOver,
    submitPrompt,
    approveAndBuild,
    revise,
    retryBuild,
    setMode,
    selectVersion,
    replan,
    reset,
  };
}
