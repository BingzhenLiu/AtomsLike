import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { toErrorPayload } from "@/lib/ai/errors";
import { runBuildPipeline, requestPlan, resolveDemoRecipe } from "@/lib/ai/workflow";
import type { DemoRecipe } from "@/lib/ai/demo-generator";
import { createWorkspaceState, workspaceReducer } from "@/lib/projects/reducer";
import { loadWorkspace, saveWorkspace } from "@/lib/projects/local-storage";
import { selectActiveVersion, selectIsBusy } from "@/lib/projects/selectors";
import type { WorkspaceMode } from "@/lib/projects/types";

export function useWorkspace() {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, createWorkspaceState);
  const [hydrated, setHydrated] = useState(false);
  const demoRecipeRef = useRef<DemoRecipe | null>(null);

  useEffect(() => {
    const stored = loadWorkspace();
    if (stored) {
      dispatch({ type: "hydrate", state: stored });
      demoRecipeRef.current = resolveDemoRecipe(stored.prompt);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveWorkspace(state);
  }, [hydrated, state]);

  const activeVersion = useMemo(() => selectActiveVersion(state), [state]);
  const busy = selectIsBusy(state);

  const submitPrompt = useCallback(
    async (prompt: string) => {
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
    [state.mode],
  );

  const approveAndBuild = useCallback(async () => {
    if (!state.plan) return;
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
  }, [state.mode, state.plan, state.prompt]);

  const revise = useCallback(
    async (changeRequest: string) => {
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
    [state],
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
  const reset = useCallback(() => {
    demoRecipeRef.current = null;
    dispatch({ type: "reset-workspace" });
  }, []);

  return {
    state,
    hydrated,
    busy,
    activeVersion,
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
