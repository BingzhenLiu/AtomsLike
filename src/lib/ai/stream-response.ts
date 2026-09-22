import { NextResponse } from "next/server";
import { statusForErrorCode } from "./build-error";
import { createEventQueue, encodeStreamEvent, type BuildStreamEvent } from "./build-stream";

export type BuildEventSink = (event: BuildStreamEvent) => void;
export type BuildEventRun = (emit: BuildEventSink) => Promise<void>;

export function wantsEventStream(request: Request): boolean {
  return (request.headers.get("accept") ?? "").includes("text/event-stream");
}

function eventStream(run: BuildEventRun): Response {
  const queue = createEventQueue<BuildStreamEvent>();
  const task = run(queue.emit).finally(() => queue.close());
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for await (const event of queue.drain()) {
        controller.enqueue(encoder.encode(encodeStreamEvent(event)));
      }
      controller.close();
      await task;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * Serves one build as an event stream, or buffers it into a single JSON
 * response for non-streaming callers such as curl and the route tests.
 */
export async function respondWithBuildEvents(run: BuildEventRun, wantsStream: boolean): Promise<Response> {
  if (wantsStream) return eventStream(run);

  const events: BuildStreamEvent[] = [];
  await run((event) => events.push(event));

  const failure = events.find((event) => event.type === "error");
  if (failure?.type === "error") {
    return NextResponse.json({ error: failure.error }, { status: statusForErrorCode(failure.error.code) });
  }

  const payload = events.find((event) => event.type === "plan" || event.type === "result");
  if (payload?.type === "plan") return NextResponse.json(payload.plan);
  if (payload?.type === "result") return NextResponse.json(payload.result);

  return NextResponse.json(
    { error: { code: "PROVIDER_ERROR", message: "生成没有返回结果。请重试，当前版本已保留。" } },
    { status: 502 },
  );
}
