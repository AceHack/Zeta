/**
 * Falsifiers for the cadence planner.
 *
 * Every test here is written so it CAN fail, and the four that carry the design
 * are: REAL-DATA (the measured livelock is reproduced from the numbers actually
 * observed on 2026-08-18), COMMUTATIVITY (arrival order cannot change the plan),
 * UNIT-COHERENCE (two clocks never produce a ratio), and NO-CLOCK (the DST claim
 * is checked mechanically against the source, not asserted in a comment).
 *
 * `.claude/rules/toy-is-free-metered-must-be-earned.md`: a model with no
 * falsifier is a toy. These are this module's falsifiers.
 */

import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  at,
  EMPTY_STATE,
  MEASURED_THRESHOLDS,
  PLANNED_CLASS,
  compareLanes,
  fairShareOrder,
  laneHealth,
  laneKey,
  median,
  observeAll,
  observeRun,
  plan,
  type Admission,
  type PlannerState,
  type RunObservation,
} from "./cadence-planner.ts";
import { isAllocatable } from "./resource-class.ts";

// ── fixtures ────────────────────────────────────────────────────────────────

const TICKS = "gate-minutes";

/**
 * Build a lane of evenly-spaced runs. `interval` is the gap between successive
 * starts, `duration` the run length — both in the same tick source, which is the
 * precondition the ratio depends on.
 */
function lane(
  ref: string,
  n: number,
  interval: number,
  duration: number,
  outcome: RunObservation["outcome"] = { kind: "preempted" },
  repo = "Lucent-Financial-Group/Zeta",
): RunObservation[] {
  const out: RunObservation[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      lane: { repo, ref },
      runId: `${ref}-${String(i)}`,
      tickSource: TICKS,
      startedAtPhase: i * interval,
      endedAtPhase: i * interval + duration,
      outcome,
    });
  }
  return out;
}

const only = (s: PlannerState) => at(s.lanes, 0);

// ── the measured instance ───────────────────────────────────────────────────

describe("reproduces the 2026-08-18 measurement", () => {
  // shadow/second-e8-tower-uncoded-spinor-construction: 8 gate runs, median push
  // interval 7.2 min, median duration 9.1 min, 7 of 8 cancelled, 0 concluded.
  it("calls a ratio-0.78 lane with a preemption streak LIVELOCKED", () => {
    const st = observeAll(EMPTY_STATE, lane("shadow/second-e8-tower", 7, 7, 9));
    const h = laneHealth(only(st));
    expect(h.kind).toBe("livelocked");
    if (h.kind !== "livelocked") throw new Error("unreachable");
    expect(h.ratio).toBeLessThan(1);
    expect(h.ratio).toBeCloseTo(7 / 9, 5);
    expect(h.consecutivePreemptions).toBe(7);
  });

  // heartbeat/tick-metrics: 11 runs, interval 15.3, duration 15.6 => 0.98.
  // Sitting just below 1 is still structurally fatal, and the test pins that the
  // criterion is the ratio and not a comfortable-looking margin.
  it("calls a ratio-0.98 lane LIVELOCKED — 'nearly enough' is not enough", () => {
    const st = observeAll(EMPTY_STATE, lane("heartbeat/tick-metrics", 11, 153, 156));
    const h = laneHealth(only(st));
    expect(h.kind).toBe("livelocked");
  });

  // heartbeat/society: 4 runs, interval 31.2, duration 20.3 => 1.54.
  it("calls a ratio-1.54 lane VIABLE", () => {
    const st = observeAll(EMPTY_STATE, lane("heartbeat/society", 4, 312, 203));
    const h = laneHealth(only(st));
    expect(h.kind).toBe("viable");
    if (h.kind !== "viable") throw new Error("unreachable");
    expect(h.ratio).toBeCloseTo(312 / 203, 5);
  });

  it("a sub-1 ratio with NO preemption streak is not livelocked", () => {
    // Same rate signal, opposite outcome signal. The two must agree, so this
    // reports the weaker verdict rather than convicting on one signal.
    const st = observeAll(
      EMPTY_STATE,
      lane("busy/but-concluding", 7, 7, 9, { kind: "concluded", passed: true }),
    );
    expect(laneHealth(only(st)).kind).not.toBe("livelocked");
  });

  it("a preemption streak with a healthy ratio is not livelocked", () => {
    const st = observeAll(EMPTY_STATE, lane("slow/but-spaced", 7, 100, 9));
    expect(laneHealth(only(st)).kind).toBe("viable");
  });
});

// ── DST: the plan is a pure function of the evidence SET ────────────────────

describe("DST — arrival order cannot reach the plan", () => {
  const obs = [
    ...lane("a/one", 5, 7, 9),
    ...lane("b/two", 4, 312, 203),
    ...lane("c/three", 6, 15, 15),
  ];

  /** Deterministic shuffle — a fixed permutation, so the test itself replays. */
  function rotate<T>(xs: readonly T[], by: number): T[] {
    return [...xs.slice(by), ...xs.slice(0, by)];
  }

  it("every rotation of the same observations yields an identical plan", () => {
    const base = JSON.stringify(plan(observeAll(EMPTY_STATE, obs)));
    for (let by = 1; by < obs.length; by++) {
      const p = JSON.stringify(plan(observeAll(EMPTY_STATE, rotate(obs, by))));
      expect(p).toBe(base);
    }
  });

  it("reversal yields an identical plan", () => {
    const fwd = JSON.stringify(plan(observeAll(EMPTY_STATE, obs)));
    const rev = JSON.stringify(plan(observeAll(EMPTY_STATE, [...obs].reverse())));
    expect(rev).toBe(fwd);
  });

  it("is idempotent — folding the same run twice is a no-op (§12)", () => {
    const once = observeAll(EMPTY_STATE, obs);
    const twice = observeAll(once, obs);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });

  it("folding a duplicate runId does not inflate the sample count", () => {
    const one = lane("d/dup", 3, 7, 9);
    const st = observeAll(EMPTY_STATE, [...one, ...one, ...one]);
    expect(only(st).runs).toHaveLength(3);
  });

  /**
   * The mechanical half of the DST claim. A comment saying "no wall clock" is
   * not a check; this reads the shipped source and fails if a clock or an
   * entropy source appears in it.
   */
  it("the planner source reads no clock and no randomness", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    for (const f of ["cadence-planner.ts", "resource-class.ts"]) {
      const src = readFileSync(join(here, f), "utf8");
      // Drop comment lines so prose ABOUT clocks does not trip this. Regex-free
      // on purpose: this file's comment style puts a leading marker on every
      // line, so a line filter is both sufficient and not backtrackable.
      const code = src
        .split("\n")
        .filter((line) => {
          const t = line.trimStart();
          return !(t.startsWith("*") || t.startsWith("/*") || t.startsWith("//"));
        })
        .join("\n");
      for (const banned of ["Date.now", "new Date", "Math.random", "performance.now"]) {
        expect(code.includes(banned)).toBe(false);
      }
    }
  });
});

// ── unit coherence: the Mars Climate Orbiter guard ──────────────────────────

describe("unit coherence", () => {
  it("refuses a ratio when a lane mixes tick sources", () => {
    const a = lane("mixed/lane", 3, 7, 9);
    const b: RunObservation = {
      ...at(a, 0),
      runId: "other-clock",
      tickSource: "wall-seconds",
      startedAtPhase: 40,
      endedAtPhase: 49,
    };
    const st = observeAll(EMPTY_STATE, [...a, b]);
    const h = laneHealth(only(st));
    expect(h.kind).toBe("incoherent");
    // The point of the guard: no number is produced at all.
    expect(JSON.stringify(h)).not.toContain("ratio");
  });

  it("an incoherent lane is HELD, never admitted or paced on a bad number", () => {
    const a = lane("mixed/lane", 3, 7, 9);
    const b: RunObservation = { ...at(a, 0), runId: "x", tickSource: "other", startedAtPhase: 40, endedAtPhase: 49 };
    const p = plan(observeAll(EMPTY_STATE, [...a, b]));
    expect(at(p.admissions, 0).kind).toBe("hold");
  });
});

// ── unknown stays unknown ───────────────────────────────────────────────────

describe("the four-register discipline", () => {
  it("too few samples is UNKNOWN, not viable-by-default", () => {
    const st = observeAll(EMPTY_STATE, lane("new/lane", 2, 7, 9));
    const h = laneHealth(only(st));
    expect(h.kind).toBe("unknown");
    if (h.kind !== "unknown") throw new Error("unreachable");
    expect(h.needed).toBe(MEASURED_THRESHOLDS.minSamples);
  });

  it("a zero-duration lane yields UNKNOWN, not an infinite ratio", () => {
    const st = observeAll(EMPTY_STATE, lane("instant/lane", 5, 7, 0));
    const h = laneHealth(only(st));
    expect(h.kind).toBe("unknown");
  });

  it("an unknown lane is HELD", () => {
    const p = plan(observeAll(EMPTY_STATE, lane("new/lane", 2, 7, 9)));
    expect(at(p.admissions, 0).kind).toBe("hold");
  });
});

// ── the plan's safety property ──────────────────────────────────────────────

describe("plan disjointness and safety", () => {
  it("a livelocked lane is NEVER admitted", () => {
    const p = plan(observeAll(EMPTY_STATE, lane("shadow/second-e8-tower", 7, 7, 9)));
    const a = at(p.admissions, 0);
    expect(a.kind).toBe("pace");
    expect(a.kind).not.toBe("admit");
  });

  it("the paced interval clears the job duration with margin", () => {
    const p = plan(observeAll(EMPTY_STATE, lane("shadow/second-e8-tower", 7, 7, 9)));
    const a = at(p.admissions, 0);
    if (a.kind !== "pace") throw new Error("expected pace");
    // duration 9, marginalRatio 1.25 => ceil(11.25) = 12
    expect(a.minPushIntervalTicks).toBe(12);
    // The whole point: following the plan makes the ratio exceed 1.
    expect(a.minPushIntervalTicks / 9).toBeGreaterThan(1);
  });

  it("every lane receives exactly one admission", () => {
    const st = observeAll(EMPTY_STATE, [
      ...lane("a/one", 5, 7, 9),
      ...lane("b/two", 4, 312, 203),
    ]);
    const p = plan(st);
    expect(p.admissions).toHaveLength(st.lanes.length);
    const keys = p.admissions.map((a: Admission) => laneKey(a.lane));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("plans over the window class, which is not allocatable", () => {
    // Pins the design claim: this is a pacer because the resource cannot be
    // granted. If someone flips `window` to allocatable, this fails.
    expect(PLANNED_CLASS).toBe("window");
    expect(isAllocatable(PLANNED_CLASS)).toBe(false);
  });
});

// ── fairness, and its stated limit ──────────────────────────────────────────

describe("fair share over mutex-class turns", () => {
  it("orders the least-served lane first", () => {
    const st = observeAll(EMPTY_STATE, [
      ...lane("z/served-often", 5, 300, 10, { kind: "concluded", passed: true }),
      ...lane("a/served-once", 3, 300, 10, { kind: "preempted" }),
    ]);
    const order = fairShareOrder(st);
    expect(at(order, 0).ref).toBe("a/served-once");
  });

  it("breaks ties by canonical code-point order, not by insertion", () => {
    const st = observeAll(EMPTY_STATE, [
      ...lane("m/mid", 3, 300, 10),
      ...lane("a/first", 3, 300, 10),
      ...lane("z/last", 3, 300, 10),
    ]);
    expect(fairShareOrder(st).map((l) => l.ref)).toEqual(["a/first", "m/mid", "z/last"]);
    expect(compareLanes({ repo: "r", ref: "a" }, { repo: "r", ref: "b" })).toBeLessThan(0);
  });

  /**
   * The honest limitation, made executable. Fair share is SELECTION fairness;
   * it does not rescue a lane that destroys its own work. If someone later
   * "fixes" starvation by promoting livelocked lanes in the order, this test is
   * what tells them it does not help.
   */
  it("selection fairness does NOT rescue a livelocked lane", () => {
    const st = observeAll(EMPTY_STATE, lane("starved/lane", 7, 7, 9));
    // It sorts first — it has served zero turns.
    expect(at(fairShareOrder(st), 0).ref).toBe("starved/lane");
    // And it is still livelocked, because the cause is self-preemption.
    expect(laneHealth(only(st)).kind).toBe("livelocked");
    // So the plan paces it rather than giving it more turns.
    expect(at(plan(st).admissions, 0).kind).toBe("pace");
  });
});

// ── helper correctness ──────────────────────────────────────────────────────

describe("median", () => {
  it("is numeric, not lexicographic", () => {
    // The classic JS default-sort bug: ["10","9","8"].sort() puts 10 first.
    expect(median([9, 10, 8])).toBe(9);
    expect(median([2, 10])).toBe(6);
  });
  it("is empty-safe", () => {
    expect(median([])).toBe(0);
  });
});

describe("observeRun", () => {
  it("creates a lane it has not seen", () => {
    const st = observeRun(EMPTY_STATE, at(lane("fresh/lane", 1, 1, 1), 0));
    expect(st.lanes).toHaveLength(1);
  });
  it("does not mutate the input state", () => {
    const before = JSON.stringify(EMPTY_STATE);
    observeRun(EMPTY_STATE, at(lane("fresh/lane", 1, 1, 1), 0));
    expect(JSON.stringify(EMPTY_STATE)).toBe(before);
  });
});
