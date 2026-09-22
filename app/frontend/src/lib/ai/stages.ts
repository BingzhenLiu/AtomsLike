export const BUILD_STAGES = ["planner", "designer", "engineer", "reviewer"] as const;

export type BuildStage = (typeof BUILD_STAGES)[number];
/** `pending` is only used before a stage starts; the reporter emits the other three. */
export type BuildStageStatus = "pending" | "active" | "completed" | "failed";

export type StageReporter = (stage: BuildStage, status: BuildStageStatus) => void;

/** The planner belongs to the approval phase and is never re-run by a build. */
export const EXECUTED_STAGES: BuildStage[] = BUILD_STAGES.filter((stage) => stage !== "planner");
