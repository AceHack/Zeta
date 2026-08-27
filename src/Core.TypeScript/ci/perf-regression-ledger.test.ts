#!/usr/bin/env bun
/**
 * perf-regression-ledger.test.ts — the falsifiers.
 *
 * Two families carry the weight, and each is here because the obvious implementation gets it
 * wrong in a way that still looks right:
 *
 * 1. **`regression` and `flaky` must be separately falsifiable.** The tempting fold is a
 *    single miss counter with a rate threshold, and it passes every happy-path test — while
 *    reporting a genuine sustained regression and an unlucky runner as the same number.
 *    §"a streak is not a rate" fixes the count and varies only the ARRANGEMENT.
 *
 * 2. **An empty window must not read as clean.** A ledger over zero observations has no
 *    denominator, and `0 misses / 0 observations` renders as a healthy `0%` in any
 *    implementation that divides first and asks questions later.
 */

import { describe, expect, test } from "bun:test";
import {
  DEFAULT_PERF_THRESHOLDS,
  foldPerfLedger,
  foldPerfTest,
  missMagnitude,
  orderNewestFirst,
  parsePerfObservations,
  PERF_OBS_PREFIX,
  renderPerfLedger,
  type PerfObservation,
} from "./perf-regression-ledger.ts";

const TEST = "ColumnLinearOpsTests.ColumnLinear vectorized filter is measurably faster on unpredictable data";

/** `minutesAgo` before a fixed instant, so ordering is explicit and replay-stable. */
function obs(minutesAgo: number, pass: boolean, measured = pass ? 3.45 : 0.93): PerfObservation {
  const at = new Date(Date.parse("2026-08-27T15:00:00Z") - minutesAgo * 60_000).toISOString();
  return {
    test: TEST,
    metric: "speedup",
    measured,
    gate: 1.5,
    pass,
    config: "Release",
    runner: "ubuntu-24.04",
    at,
    sha: `${String(minutesAgo).padStart(8, "0")}deadbeef`,
  };
}

describe("an empty window is `unknown`, never `clean`", () => {
  test("zero observations report a null rate and refuse a register", () => {
    const r = foldPerfTest(TEST, "Release", []);
    expect(r.register).toBe("unknown");
    expect(r.missRate).toBeNull();
    expect(r.observations).toBe(0);
  });

  test("the report says nothing was measured instead of rendering an empty table", () => {
    const md = renderPerfLedger([]);
    expect(md).toMatch(/NO OBSERVATIONS/);
    expect(md).toMatch(/not a clean bill of health/i);
  });
});

describe("a streak is not a rate — the split this ledger exists for", () => {
  // Identical miss COUNT (2) and identical rate (2/6) in both cases. Only the arrangement
  // differs. A fold built on a rate threshold cannot tell these apart, and that is the
  // failure this ledger is for: a real regression hiding inside a reputation for flakiness.
  const scattered = [obs(1, true), obs(2, false), obs(3, true), obs(4, true), obs(5, false), obs(6, true)];
  const consecutive = [obs(1, true), obs(2, true), obs(3, false), obs(4, false), obs(5, true), obs(6, true)];

  test("same count, same rate, different register", () => {
    const a = foldPerfTest(TEST, "Release", scattered);
    const b = foldPerfTest(TEST, "Release", consecutive);
    expect(a.misses).toBe(b.misses);
    expect(a.missRate).toBe(b.missRate);
    expect(a.register).toBe("flaky");
    expect(b.register).toBe("regression");
  });

  test("`currentMissStreak` distinguishes a LIVE regression from a healed one", () => {
    const healed = foldPerfTest(TEST, "Release", consecutive);
    expect(healed.longestMissStreak).toBe(2);
    expect(healed.currentMissStreak).toBe(0); // newest observation passed

    const live = foldPerfTest(TEST, "Release", [obs(1, false), obs(2, false), obs(3, true)]);
    expect(live.currentMissStreak).toBe(2);
    expect(live.register).toBe("regression");
  });

  test("one miss among passes is a flake, not a regression", () => {
    const r = foldPerfTest(TEST, "Release", [obs(1, true), obs(2, false), obs(3, true)]);
    expect(r.register).toBe("flaky");
    expect(r.longestMissStreak).toBe(1);
  });

  test("all passes is clean, and the streaks are zero", () => {
    const r = foldPerfTest(TEST, "Release", [obs(1, true), obs(2, true)]);
    expect(r.register).toBe("clean");
    expect(r.misses).toBe(0);
    expect(r.longestMissStreak).toBe(0);
  });

  test("the sustained threshold is a parameter, and moving it moves the verdict", () => {
    const two = [obs(1, false), obs(2, false), obs(3, true)];
    expect(foldPerfTest(TEST, "Release", two, { sustainedStreak: 3 }).register).toBe("flaky");
    expect(foldPerfTest(TEST, "Release", two, DEFAULT_PERF_THRESHOLDS).register).toBe("regression");
  });
});

describe("ordering is total and independent of input order", () => {
  test("shuffled input folds identically — the streak is not an artefact of arrival order", () => {
    const window = [obs(1, true), obs(2, false), obs(3, false), obs(4, true)];
    const a = foldPerfTest(TEST, "Release", window);
    const b = foldPerfTest(TEST, "Release", [...window].reverse());
    expect(b.longestMissStreak).toBe(a.longestMissStreak);
    expect(b.currentMissStreak).toBe(a.currentMissStreak);
    expect(b.register).toBe(a.register);
  });

  test("equal instants are broken by sha so the order is deterministic", () => {
    const same = "2026-08-27T15:00:00Z";
    const x = { ...obs(0, true), at: same, sha: "bbbb" };
    const y = { ...obs(0, true), at: same, sha: "aaaa" };
    expect(orderNewestFirst([x, y]).map((o) => o.sha)).toEqual(["aaaa", "bbbb"]);
    expect(orderNewestFirst([y, x]).map((o) => o.sha)).toEqual(["aaaa", "bbbb"]);
  });
});

describe("worst-miss ranking works in BOTH assertion directions", () => {
  // A lower-bound assertion (speedup >= gate) and an upper-bound one (allocations <= gate)
  // both exist in this repo. Ranking by `measured` alone would call the mildest allocation
  // regression the worst one.
  test("lower bound: the furthest BELOW the gate is worst", () => {
    const mild = { ...obs(1, false), measured: 1.4 };
    const bad = { ...obs(2, false), measured: 0.3 };
    expect(missMagnitude(bad)).toBeGreaterThan(missMagnitude(mild));
    expect(foldPerfTest(TEST, "Release", [mild, bad]).worst?.measured).toBe(0.3);
  });

  test("upper bound: the furthest ABOVE the gate is worst", () => {
    const mild = { ...obs(1, false), metric: "allocations", gate: 100, measured: 110 };
    const bad = { ...obs(2, false), metric: "allocations", gate: 100, measured: 900 };
    expect(foldPerfTest(TEST, "Release", [mild, bad]).worst?.measured).toBe(900);
  });

  test("a zero gate does not divide by zero", () => {
    expect(missMagnitude({ ...obs(1, false), gate: 0 })).toBe(Number.POSITIVE_INFINITY);
    expect(missMagnitude({ ...obs(1, true), gate: 0 })).toBe(0);
  });
});

describe("`pass` is recorded, never re-derived", () => {
  // The direction of the comparison lives in the ASSERTION, not here. An observation that
  // says it passed at `measured < gate` is an upper-bound test, and re-deriving `pass` from
  // `measured >= gate` would invent a miss that never happened.
  test("an upper-bound pass below its gate is not counted as a miss", () => {
    const r = foldPerfTest(TEST, "Release", [
      { ...obs(1, true), metric: "allocations", gate: 100, measured: 12, pass: true },
      { ...obs(2, true), metric: "allocations", gate: 100, measured: 14, pass: true },
    ]);
    expect(r.misses).toBe(0);
    expect(r.register).toBe("clean");
  });
});

describe("(test, config) is the key — a Debug gate is a different assertion", () => {
  test("Debug and Release fold separately rather than averaging two questions", () => {
    const rolls = foldPerfLedger([
      { ...obs(1, false), config: "Debug" },
      { ...obs(2, false), config: "Debug" },
      { ...obs(3, true), config: "Release" },
      { ...obs(4, true), config: "Release" },
    ]);
    expect(rolls).toHaveLength(2);
    const debug = rolls.find((r) => r.config === "Debug");
    const release = rolls.find((r) => r.config === "Release");
    expect(debug?.register).toBe("regression");
    expect(release?.register).toBe("clean");
  });

  test("regressions sort ahead of flakes, flakes ahead of clean", () => {
    const rolls = foldPerfLedger([
      { ...obs(1, true), test: "C" },
      { ...obs(2, false), test: "B" },
      { ...obs(3, true), test: "B" },
      { ...obs(4, false), test: "A" },
      { ...obs(5, false), test: "A" },
    ]);
    expect(rolls.map((r) => r.test)).toEqual(["A", "B", "C"]);
  });
});

describe("the observation line survives interleaved test output", () => {
  const line = (o: Partial<PerfObservation>): string =>
    `${PERF_OBS_PREFIX}${JSON.stringify({ ...obs(1, true), ...o })}`;

  test("parses a well-formed line even with a log prefix in front of it", () => {
    const text = ["2026-08-27T14:39:08.9Z   Passed Something [1 ms]", `  ${line({})}`, "noise"].join("\n");
    const { observations, malformed } = parsePerfObservations(text);
    expect(observations).toHaveLength(1);
    expect(malformed).toBe(0);
    expect(observations[0]?.measured).toBe(3.45);
  });

  test("MALFORMED LINES ARE COUNTED, not silently dropped", () => {
    const text = [
      `${PERF_OBS_PREFIX}{not json`,
      `${PERF_OBS_PREFIX}{"test":"x"}`,
      line({}),
    ].join("\n");
    const { observations, malformed } = parsePerfObservations(text);
    expect(observations).toHaveLength(1);
    expect(malformed).toBe(2);
    expect(renderPerfLedger(foldPerfLedger(observations), malformed)).toMatch(/2 malformed/);
  });

  test("a number-shaped STRING is refused at the boundary, not cast into the fold", () => {
    const bad = `${PERF_OBS_PREFIX}${JSON.stringify({ ...obs(1, true), measured: "3.45" })}`;
    const { observations, malformed } = parsePerfObservations(bad);
    expect(observations).toHaveLength(0);
    expect(malformed).toBe(1);
  });

  test("NaN / Infinity / an unparseable instant are refused", () => {
    for (const bad of [
      `${PERF_OBS_PREFIX}{"test":"t","metric":"m","measured":null,"gate":1,"pass":true,"config":"c","runner":"r","at":"2026-08-27T15:00:00Z","sha":"s"}`,
      line({ at: "not-a-date" }),
    ]) {
      expect(parsePerfObservations(bad).observations).toHaveLength(0);
    }
  });

  test("a line with no sentinel is not an observation and is not malformed either", () => {
    const { observations, malformed } = parsePerfObservations("Passed Foo [1 ms]\nFailed Bar");
    expect(observations).toHaveLength(0);
    expect(malformed).toBe(0);
  });
});

describe("the live 2026-08-27 case, replayed", () => {
  test("one 0.93x miss on ubuntu-24.04 among passes reads as flaky, and names the runner", () => {
    const rolls = foldPerfLedger([obs(1, true), obs(2, false, 0.93), obs(3, true), obs(4, true)]);
    const r = rolls[0];
    expect(r?.register).toBe("flaky");
    expect(r?.worst?.measured).toBe(0.93);
    expect(r?.missRunners).toEqual(["ubuntu-24.04"]);
    const md = renderPerfLedger(rolls);
    expect(md).toMatch(/flaky/);
    expect(md).toMatch(/25\.0%/);
  });

  test("had it missed twice running, the SAME data would read as a regression", () => {
    const rolls = foldPerfLedger([obs(1, false, 0.93), obs(2, false, 0.95), obs(3, true), obs(4, true)]);
    expect(rolls[0]?.register).toBe("regression");
    expect(rolls[0]?.currentMissStreak).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// THE COLLECTOR. The emitter and the fold were both tested and both green for weeks while nothing
// read the `##perf-obs` lines — two working halves and no pipeline. These pin the seam.
// ---------------------------------------------------------------------------

import { collectPerfLedger } from "./perf-regression-ledger.ts";

describe("the collector folds real test output", () => {
  const obs = (over: Record<string, unknown> = {}): string =>
    PERF_OBS_PREFIX +
    JSON.stringify({
      test: "Zeta.Tests.Storage.ColumnZSet vectorized scan",
      metric: "speedup", measured: 3.45, gate: 1.5, pass: true,
      config: "Release", runner: "Linux",
      at: "2026-08-27T18:04:05.1234567Z", sha: "abc1234", ...over,
    });

  test("observations buried in unrelated log noise are found", () => {
    // Real `dotnet test` output is thousands of lines of MSBuild chatter with the sentinel lines
    // interleaved. A collector that assumed a clean stream would silently find nothing.
    const log = [
      "Determining projects to restore...",
      "  Zeta.Core -> /work/bin/Zeta.Core.dll",
      obs(),
      "Passed!  - Failed: 0, Passed: 812",
      obs({ pass: false, measured: 0.93 }),
      "Test Run Successful.",
    ].join("\n");
    const r = collectPerfLedger(log);
    expect(r.observations).toBe(2);
    expect(r.malformed).toBe(0);
    expect(r.rolls[0]?.misses).toBe(1);
  });

  test("EMPTY output does not render as clean — the whole point of collecting", () => {
    // If this ever renders a green-looking table, a build where the emitter broke would be
    // indistinguishable from one where every assertion passed.
    const r = collectPerfLedger("no observations here at all\n");
    expect(r.observations).toBe(0);
    expect(r.markdown).toMatch(/NO OBSERVATIONS/);
    expect(r.markdown).toMatch(/not a clean bill of health/);
  });

  test("malformed sentinel lines are COUNTED, not dropped", () => {
    // A broken emitter must show up as a number. Silently skipping unparseable lines would make a
    // half-broken emitter look like a quiet one.
    const r = collectPerfLedger([obs(), `${PERF_OBS_PREFIX}{not json`, obs()].join("\n"));
    expect(r.observations).toBe(2);
    expect(r.malformed).toBe(1);
  });

  test("a pass-only run is `clean` and a sustained-miss run is `regression`", () => {
    // The control pair: without it, a collector that always reported one register would satisfy
    // every assertion above.
    expect(collectPerfLedger([obs(), obs(), obs()].join("\n")).rolls[0]?.register).toBe("clean");
    const missed = [obs({ pass: false, measured: 0.9 }), obs({ pass: false, measured: 0.9 }), obs({ pass: false, measured: 0.9 })];
    expect(collectPerfLedger(missed.join("\n")).rolls[0]?.register).toBe("regression");
  });
});
