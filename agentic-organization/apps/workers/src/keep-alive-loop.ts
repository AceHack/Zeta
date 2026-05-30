/**
 * Independent keep-alive loop — runs the deterministic keep-alive lane on its
 * OWN fixed cadence, decoupled from the work loop.
 *
 * Why independent: when keep-alive ticks once per work cycle, a single long work
 * cycle (e.g. a slow agent run, or a 30s idle NATS long-poll) delays the org
 * heartbeat. The org's proof of life must not depend on work-cycle timing. This
 * loop ticks the heartbeat on a short fixed interval regardless of what the work
 * loop is doing — that is what makes "drive the organization to stay alive"
 * deterministic.
 *
 * Failure discipline mirrors the lane itself: a degraded tick or a thrown lane is
 * captured, never propagated — the heartbeat loop must keep running.
 */

import { runCadenceLane } from "./cadence-lane.ts";

export type KeepAliveLoopLane = {
  runOnce: () => Promise<{ status: string; failures: readonly { message: string }[] }>;
};

export type KeepAliveLoopTickRecord = {
  tick: number;
  status: string;
  failureCount: number;
};

export type KeepAliveLoopObserver = {
  record: (record: KeepAliveLoopTickRecord) => void;
};

export type RunKeepAliveLoopInput = {
  lane: KeepAliveLoopLane;
  intervalMs: number;
  isStopRequested: () => boolean;
  sleep: (ms: number) => Promise<void>;
  observer?: KeepAliveLoopObserver;
  /** bound the loop for tests; unbounded in production */
  maxTicks?: number;
};

export type KeepAliveLoopResult = {
  ticks: number;
  degradedTicks: number;
  thrownTicks: number;
};

const KeepAliveLoopTickedStatus = "ticked";

/**
 * The keep-alive loop is a thin specialization of the generic `runCadenceLane`
 * driver — one driver, no duplication. It preserves the keep-alive degraded
 * definition (a reported failure OR a status other than "ticked") and maps the
 * cadence record back to the keep-alive record shape.
 */
export async function runKeepAliveLoop(input: RunKeepAliveLoopInput): Promise<KeepAliveLoopResult> {
  const result = await runCadenceLane({
    lane: { name: "keep-alive", runOnce: input.lane.runOnce },
    intervalMs: input.intervalMs,
    isStopRequested: input.isStopRequested,
    sleep: input.sleep,
    degradedWhen: (status, failureCount) => failureCount > 0 || status !== KeepAliveLoopTickedStatus,
    ...(input.maxTicks !== undefined ? { maxTicks: input.maxTicks } : {}),
    ...(input.observer
      ? { observer: { record: (r) => input.observer!.record({ tick: r.tick, status: r.status, failureCount: r.failureCount }) } }
      : {}),
  });
  return { ticks: result.ticks, degradedTicks: result.degradedTicks, thrownTicks: result.thrownTicks };
}
