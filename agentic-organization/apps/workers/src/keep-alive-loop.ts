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

const KeepAliveLoopTickStatus = {
  Threw: "threw",
} as const;

export async function runKeepAliveLoop(input: RunKeepAliveLoopInput): Promise<KeepAliveLoopResult> {
  let ticks = 0;
  let degradedTicks = 0;
  let thrownTicks = 0;

  while (!input.isStopRequested() && !hasReachedMaxTicks(ticks, input.maxTicks)) {
    ticks += 1;

    let status: string;
    let failureCount: number;
    try {
      const result = await input.lane.runOnce();
      status = result.status;
      failureCount = result.failures.length;
    } catch {
      // the lane should never throw, but the heartbeat loop survives if it does
      status = KeepAliveLoopTickStatus.Threw;
      failureCount = 1;
      thrownTicks += 1;
    }

    if (failureCount > 0 || status !== "ticked") {
      degradedTicks += 1;
    }

    input.observer?.record({ tick: ticks, status, failureCount });

    if (input.isStopRequested() || hasReachedMaxTicks(ticks, input.maxTicks)) {
      break;
    }

    await input.sleep(input.intervalMs);
  }

  return { ticks, degradedTicks, thrownTicks };
}

function hasReachedMaxTicks(ticks: number, maxTicks: number | undefined): boolean {
  return maxTicks !== undefined && ticks >= maxTicks;
}
