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

import {
  NoopTelemetry,
  TelemetryMetricKind,
  TelemetrySpanStatusCode,
  type TelemetryPort,
} from "../../../packages/observability/src/index.ts";

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
  /** optional telemetry port; defaults to no-op so tests and pure callers stay hermetic */
  telemetry?: TelemetryPort;
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
  const telemetry = input.telemetry ?? new NoopTelemetry();

  while (!input.isStopRequested() && !hasReachedMaxTicks(ticks, input.maxTicks)) {
    ticks += 1;
    const span = telemetry.startSpan("org.lane.tick", {
      attributes: {
        "agentic.lane": input.lane.name,
        "agentic.tick": ticks,
      },
    });

    let status: string;
    let failureCount: number;
    let isDegraded = false;
    try {
      const result = await input.lane.runOnce();
      status = result.status;
      failureCount = result.failures.length;
      isDegraded = input.degradedWhen ? input.degradedWhen(status, failureCount) : failureCount > 0;
      if (isDegraded) degradedTicks += 1;
    } catch {
      // a lane should never throw, but the cadence loop survives if it does — a
      // throw is the most severe degradation, so it counts as BOTH thrown and degraded
      status = CadenceLaneTickStatus.Threw;
      failureCount = 1;
      thrownTicks += 1;
      degradedTicks += 1;
      isDegraded = true;
    }

    recordCadenceTickTelemetry({
      telemetry,
      span,
      lane: input.lane.name,
      tick: ticks,
      status,
      failureCount,
      isDegraded,
    });
    input.observer?.record({ lane: input.lane.name, tick: ticks, status, failureCount });

    if (!input.isStopRequested() && !hasReachedMaxTicks(ticks, input.maxTicks)) {
      await input.sleep(input.intervalMs);
    }
  }

  return { lane: input.lane.name, ticks, degradedTicks, thrownTicks };
}

type RecordCadenceTickTelemetryInput = {
  telemetry: TelemetryPort;
  span: ReturnType<TelemetryPort["startSpan"]>;
  lane: string;
  tick: number;
  status: string;
  failureCount: number;
  isDegraded: boolean;
};

function recordCadenceTickTelemetry(input: RecordCadenceTickTelemetryInput): void {
  input.span.setAttribute("result.status", input.status);
  input.span.setAttribute("agentic.failure_count", input.failureCount);
  input.span.setStatus(
    input.isDegraded
      ? { code: TelemetrySpanStatusCode.Error, message: "degraded cadence tick" }
      : { code: TelemetrySpanStatusCode.Ok },
  );
  input.span.end();
  input.telemetry.recordMetric({
    kind: TelemetryMetricKind.Counter,
    name: "org_lane_ticks_total",
    value: 1,
    attributes: {
      "agentic.lane": input.lane,
      "agentic.tick": input.tick,
      "result.status": input.status,
      "agentic.failure_count": input.failureCount,
    },
  });
}
