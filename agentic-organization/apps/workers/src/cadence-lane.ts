/**
 * Generic cadence-lane driver (A0) — runs any "lane" (a cycle exposed as
 * `runOnce()`) on its OWN fixed interval, decoupled from the work loop, with the
 * same failure-isolation discipline as the keep-alive loop: a degraded or thrown
 * tick is captured, never propagated — the cadence keeps running.
 *
 * This is the SOLID generalization of runKeepAliveLoop: the Work OS loop, the
 * memory maintenance cycle, and the change-control review each become a CadenceLane
 * driven concurrently, each on its own cadence, joining the keep-alive lane as
 * additional always-on lanes in the worker. Single responsibility: scheduling +
 * failure isolation; the lane owns the actual work.
 */

export type CadenceLaneTickResult = {
  status: string;
  failures: readonly { message: string }[];
};

export type CadenceLane = {
  name: string;
  runOnce: () => Promise<CadenceLaneTickResult>;
};

export type CadenceLaneTickRecord = {
  lane: string;
  tick: number;
  status: string;
  failureCount: number;
};

export type CadenceLaneObserver = {
  record: (record: CadenceLaneTickRecord) => void;
};

export type RunCadenceLaneInput = {
  lane: CadenceLane;
  intervalMs: number;
  isStopRequested: () => boolean;
  sleep: (ms: number) => Promise<void>;
  observer?: CadenceLaneObserver;
  /** bound the loop for tests; unbounded in production */
  maxTicks?: number;
  /** what counts as a degraded tick; defaults to any reported failure */
  degradedWhen?: (status: string, failureCount: number) => boolean;
};

export type CadenceLaneResult = {
  lane: string;
  ticks: number;
  degradedTicks: number;
  thrownTicks: number;
};

const CadenceLaneTickStatus = {
  Threw: "threw",
} as const;

function hasReachedMaxTicks(ticks: number, maxTicks: number | undefined): boolean {
  return maxTicks !== undefined && ticks >= maxTicks;
}

export async function runCadenceLane(input: RunCadenceLaneInput): Promise<CadenceLaneResult> {
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
      const isDegraded = input.degradedWhen ? input.degradedWhen(status, failureCount) : failureCount > 0;
      if (isDegraded) degradedTicks += 1;
    } catch {
      // a lane should never throw, but the cadence loop survives if it does — a
      // throw is the most severe degradation, so it counts as BOTH thrown and degraded
      status = CadenceLaneTickStatus.Threw;
      failureCount = 1;
      thrownTicks += 1;
      degradedTicks += 1;
    }

    input.observer?.record({ lane: input.lane.name, tick: ticks, status, failureCount });

    if (!input.isStopRequested() && !hasReachedMaxTicks(ticks, input.maxTicks)) {
      await input.sleep(input.intervalMs);
    }
  }

  return { lane: input.lane.name, ticks, degradedTicks, thrownTicks };
}
