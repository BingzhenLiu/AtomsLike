import type { GenerateResponse, PlanResponse } from "./contract";

export const BUILD_STAGES = ["planner", "designer", "engineer", "reviewer"] as const;
export type BuildStage = (typeof BUILD_STAGES)[number];
export type BuildStageStatus = "active" | "completed" | "failed";

export type StageReporter = (stage: BuildStage, status: BuildStageStatus) => void;

export type BuildStreamEvent =
  | { type: "stage"; stage: BuildStage; status: BuildStageStatus }
  | { type: "plan"; plan: PlanResponse }
  | { type: "result"; result: GenerateResponse }
  | { type: "error"; error: { code: string; message: string } };

export function encodeStreamEvent(event: BuildStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Parses incrementally delivered `text/event-stream` chunks into events. */
export function createStreamParser() {
  let buffer = "";

  return function parse(chunk: string): BuildStreamEvent[] {
    buffer += chunk;
    const events: BuildStreamEvent[] = [];
    let boundary = buffer.indexOf("\n\n");

    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
      if (!frame.startsWith("data:")) continue;
      try {
        events.push(JSON.parse(frame.slice(5).trim()) as BuildStreamEvent);
      } catch {
        continue;
      }
    }

    return events;
  };
}

export type EventQueue<T> = {
  emit: (event: T) => void;
  close: () => void;
  drain: () => AsyncGenerator<T>;
};

/** Ordered async queue so a generator can stream events produced by a running task. */
export function createEventQueue<T>(): EventQueue<T> {
  const pending: T[] = [];
  let closed = false;
  let wake: (() => void) | null = null;

  function signal() {
    const resolve = wake;
    wake = null;
    resolve?.();
  }

  return {
    emit(event) {
      if (closed) return;
      pending.push(event);
      signal();
    },
    close() {
      closed = true;
      signal();
    },
    async *drain() {
      while (true) {
        while (pending.length) yield pending.shift() as T;
        if (closed) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    },
  };
}
