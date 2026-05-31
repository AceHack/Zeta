import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  RecordingTelemetry,
  TelemetryMetricKind,
  TelemetrySpanStatusCode,
} from "../../../packages/observability/src/index.ts";
import { runCadenceLane, type CadenceLane, type CadenceLaneTickResult } from "../src/cadence-lane.ts";

const noSleep = async (): Promise<void> => {};

function lane(name: string, run: (tick: number) => CadenceLaneTickResult | Promise<CadenceLaneTickResult>): CadenceLane {
  let tick = 0;
  return { name, runOnce: async () => run(++tick) };
}

test("runs the lane maxTicks times then stops (bounded for tests)", async () => {
  let calls = 0;
  const result = await runCadenceLane({
    lane: lane("work", () => { calls += 1; return { status: "ok", failures: [] }; }),
    intervalMs: 0, isStopRequested: () => false, sleep: noSleep, maxTicks: 3,
  });
  equal(calls, 3);
  equal(result.ticks, 3);
  equal(result.lane, "work");
});

test("stops promptly when stop is requested", async () => {
  let stop = false;
  const result = await runCadenceLane({
    lane: lane("work", (t) => { if (t >= 2) stop = true; return { status: "ok", failures: [] }; }),
    intervalMs: 0, isStopRequested: () => stop, sleep: noSleep,
  });
  equal(result.ticks, 2);
});

test("counts degraded ticks (lane reported failures) without stopping", async () => {
  const result = await runCadenceLane({
    lane: lane("mem", (t) => (t === 2 ? { status: "degraded", failures: [{ message: "x" }] } : { status: "ok", failures: [] })),
    intervalMs: 0, isStopRequested: () => false, sleep: noSleep, maxTicks: 3,
  });
  equal(result.ticks, 3);
  equal(result.degradedTicks, 1);
  equal(result.thrownTicks, 0);
});

test("ISOLATES a thrown lane — the cadence loop survives and keeps ticking", async () => {
  const result = await runCadenceLane({
    lane: lane("cc", (t) => { if (t === 2) throw new Error("boom"); return { status: "ok", failures: [] }; }),
    intervalMs: 0, isStopRequested: () => false, sleep: noSleep, maxTicks: 3,
  });
  equal(result.ticks, 3, "loop kept going after the throw");
  equal(result.thrownTicks, 1);
});

test("emits one observer record per tick with the lane name", async () => {
  const records: { lane: string; tick: number; status: string; failureCount: number }[] = [];
  await runCadenceLane({
    lane: lane("work", () => ({ status: "ok", failures: [] })),
    intervalMs: 0, isStopRequested: () => false, sleep: noSleep, maxTicks: 2,
    observer: { record: (r) => records.push(r) },
  });
  equal(records.length, 2);
  deepEqual(records.map((r) => r.tick), [1, 2]);
  ok(records.every((r) => r.lane === "work"));
});

test("emits a span and RED metric for every cadence tick", async () => {
  const telemetry = new RecordingTelemetry();
  await runCadenceLane({
    lane: lane("work-os", (t) =>
      t === 2 ? { status: "degraded", failures: [{ message: "slow gate" }] } : { status: "ok", failures: [] },
    ),
    intervalMs: 0,
    isStopRequested: () => false,
    sleep: noSleep,
    maxTicks: 2,
    telemetry,
  });

  equal(telemetry.spans.length, 2);
  deepEqual(
    telemetry.spans.map((span) => ({
      name: span.name,
      status: span.status,
      ended: span.ended,
      lane: span.attributes["agentic.lane"],
      tick: span.attributes["agentic.tick"],
      result: span.attributes["result.status"],
      failures: span.attributes["agentic.failure_count"],
    })),
    [
      {
        name: "org.lane.tick",
        status: { code: TelemetrySpanStatusCode.Ok },
        ended: true,
        lane: "work-os",
        tick: 1,
        result: "ok",
        failures: 0,
      },
      {
        name: "org.lane.tick",
        status: { code: TelemetrySpanStatusCode.Error, message: "degraded cadence tick" },
        ended: true,
        lane: "work-os",
        tick: 2,
        result: "degraded",
        failures: 1,
      },
    ],
  );
  deepEqual(
    telemetry.metrics.map((metric) => ({
      kind: metric.kind,
      name: metric.name,
      value: metric.value,
      lane: metric.attributes?.["agentic.lane"],
      status: metric.attributes?.["result.status"],
    })),
    [
      {
        kind: TelemetryMetricKind.Counter,
        name: "org_lane_ticks_total",
        value: 1,
        lane: "work-os",
        status: "ok",
      },
      {
        kind: TelemetryMetricKind.Counter,
        name: "org_lane_ticks_total",
        value: 1,
        lane: "work-os",
        status: "degraded",
      },
    ],
  );
});

test("sleeps between ticks (cadence interval honored)", async () => {
  const sleeps: number[] = [];
  await runCadenceLane({
    lane: lane("work", () => ({ status: "ok", failures: [] })),
    intervalMs: 500, isStopRequested: () => false, sleep: async (ms) => { sleeps.push(ms); }, maxTicks: 2,
  });
  ok(sleeps.every((s) => s === 500));
});
