/**
 * Falsifiers for society-readout.
 *
 * The central one is DISCRIMINATION. A readout that renders the same bytes for a healthy
 * society and a collapsed one is the exact vacuity class this module exists to catch, so
 * "healthy and collapsed differ" is pinned directly rather than assumed. The rest guard
 * the properties that make the rendered artifact non-vacuous over time: the flatline
 * counter must be strictly monotone under repeated identical ticks (else a committed
 * readout goes quiet during a collapse), the output must be ASCII, and the real corpus in
 * docs/observe-events must reproduce the 2026-08-16 collapse rather than a synthetic one.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import {
  DEFAULT_THRESHOLDS,
  SPARK_RAMP,
  computeReadout,
  loadSocietySamples,
  renderReadoutLine,
  renderReadoutMarkdown,
  renderSpark,
  sampleFromEvent,
  type SocietyTickSample,
} from "./society-readout.ts";

const T0 = Date.parse("2026-08-16T00:00:00.000Z");
const HALF_HOUR = 30 * 60 * 1000;

/** A healthy history: 4 agents, diversity moving, fitness climbing. */
function healthy(n = 12): SocietyTickSample[] {
  const out: SocietyTickSample[] = [];
  for (let i = 0; i !== n; i++) {
    out.push({
      at: new Date(T0 + i * HALF_HOUR).toISOString(),
      population: 4,
      geneticDiversity: 100 + i * 7,
      meanFitness: 0.15 + i * 0.001,
      generation: i + 1,
    });
  }
  return out;
}

/** The collapsed history: population 1, everything pinned. The measured 2026-08-16 shape. */
function collapsed(n = 12): SocietyTickSample[] {
  const out: SocietyTickSample[] = [];
  for (let i = 0; i !== n; i++) {
    out.push({
      at: new Date(T0 + i * HALF_HOUR).toISOString(),
      population: 1,
      geneticDiversity: 0,
      meanFitness: 0.6505648066545648,
      generation: 1,
    });
  }
  return out;
}

/** now() pinned just after the newest sample, so STALE does not fire by accident. */
function freshNow(s: readonly SocietyTickSample[]): number {
  return Date.parse(s[s.length - 1]!.at) + 60000;
}

describe("DISCRIMINATION -- the readout must not look the same when the society is dead", () => {
  test("healthy and collapsed render different lines", () => {
    const h = renderReadoutLine(computeReadout(healthy(), freshNow(healthy())));
    const c = renderReadoutLine(computeReadout(collapsed(), freshNow(collapsed())));
    expect(h).not.toBe(c);
  });

  test("healthy carries OK and no alarm token", () => {
    const r = computeReadout(healthy(), freshNow(healthy()));
    expect(r.alarms).toEqual([]);
    expect(renderReadoutLine(r)).toContain("OK");
    expect(renderReadoutLine(r)).not.toContain("POPULATION-COLLAPSE");
  });

  test("collapsed carries the grep-able tokens", () => {
    const r = computeReadout(collapsed(), freshNow(collapsed()));
    const line = renderReadoutLine(r);
    expect(line).toContain("POPULATION-COLLAPSE");
    expect(line).toContain("DIVERSITY-ZERO");
    expect(line).toContain("FLATLINE");
    expect(line).toContain("pop=1");
  });

  test("the collapse is visible on the FIRST tick after it happens, not eventually", () => {
    const before = healthy(8);
    const after = before.concat(collapsed(1).map((s) => ({
      ...s,
      at: new Date(T0 + 8 * HALF_HOUR).toISOString(),
    })));
    const rBefore = computeReadout(before, freshNow(before));
    const rAfter = computeReadout(after, freshNow(after));
    expect(rBefore.alarms).toEqual([]);
    expect(rAfter.alarms).toContain("POPULATION-COLLAPSE");
    expect(rAfter.alarms).toContain("DIVERSITY-ZERO");
  });
});

describe("MONOTONE FLATLINE -- a stuck loop must produce a LOUDER artifact, never a quieter one", () => {
  test("flatlineTicks strictly increases as identical ticks are appended", () => {
    const seen: number[] = [];
    for (let n = 1; n !== 10; n++) {
      const s = collapsed(n);
      seen.push(computeReadout(s, freshNow(s)).flatlineTicks);
    }
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test("the rendered line therefore CHANGES every tick even while nothing else does", () => {
    const a = collapsed(6);
    const b = collapsed(7);
    expect(renderReadoutLine(computeReadout(a, freshNow(a)))).not.toBe(
      renderReadoutLine(computeReadout(b, freshNow(b))),
    );
  });

  test("a resumed society RESETS the counter -- the flatline must not be a ratchet", () => {
    const s = collapsed(6).concat(healthy(1).map((h) => ({
      ...h,
      at: new Date(T0 + 6 * HALF_HOUR).toISOString(),
    })));
    expect(computeReadout(s, freshNow(s)).flatlineTicks).toBe(1);
  });
});

describe("SPARKLINE -- a flat series must LOOK flat", () => {
  test("a constant series renders as all-lowest, never mid-ramp", () => {
    expect(renderSpark([5, 5, 5, 5, 5])).toBe(SPARK_RAMP[0]!.repeat(5));
  });

  test("a varying series does not render like a constant one", () => {
    expect(renderSpark([1, 2, 3, 4, 5])).not.toBe(renderSpark([3, 3, 3, 3, 3]));
  });

  test("the ramp is ASCII -- this string is designed for a commit subject", () => {
    expect(SPARK_RAMP).toMatch(/^[\x20-\x7e]+$/);
  });
});

describe("STALENESS -- the local clock is injected, never ambient", () => {
  test("a stopped lane raises STALE", () => {
    const s = healthy();
    const late = freshNow(s) + DEFAULT_THRESHOLDS.staleAfterMs;
    expect(computeReadout(s, late).alarms).toContain("STALE");
  });

  test("same samples plus same nowMs is byte-identical -- no ambient clock leaked in", () => {
    const s = healthy();
    const n = freshNow(s);
    const a = renderReadoutMarkdown(computeReadout(s, n), "2026-01-01T00:00:00.000Z");
    const b = renderReadoutMarkdown(computeReadout(s, n), "2026-01-01T00:00:00.000Z");
    expect(a).toBe(b);
  });
});

describe("EDGES", () => {
  test("no events is a finding, not silence", () => {
    const none: SocietyTickSample[] = [];
    const r = computeReadout(none, Date.parse("2026-08-20T00:00:00.000Z"));
    expect(r.alarms).toEqual(["NO-EVENTS"]);
    expect(renderReadoutLine(r)).toBe("society: NO-EVENTS");
  });

  test("markdown output is pure ASCII", () => {
    const s = collapsed();
    const r = computeReadout(s, freshNow(s));
    const md = renderReadoutMarkdown(r, "2026-08-20T00:00:00Z");
    expect(md).toMatch(/^[\x09\x0a\x20-\x7e]+$/);
  });

  test("the line is short enough to append to a commit subject", () => {
    const s = collapsed();
    const line = renderReadoutLine(computeReadout(s, freshNow(s)));
    expect(line.length).toBeLessThan(120);
  });

  test("sampleFromEvent projects a real event shape", () => {
    const agents = new Array(3).fill("a");
    const at = "2026-08-20T23:41:40.923Z";
    const raw = { at, agents, geneticDiversity: 7, meanFitness: 0.5, generation: 2 };
    const s = sampleFromEvent(raw);
    expect(s).not.toBeNull();
    expect(s!.population).toBe(3);
    expect(s!.geneticDiversity).toBe(7);
  });

  test("a non-event is rejected rather than counted as population zero", () => {
    expect(sampleFromEvent(null)).toBeNull();
    expect(sampleFromEvent(42)).toBeNull();
    expect(sampleFromEvent({ agents: new Array(2).fill("a") })).toBeNull();
  });
});

describe("REAL CORPUS -- the readout must reproduce the measured collapse, not a synthetic one", () => {
  const EVENT_DIR = "docs/observe-events";
  const present = existsSync(EVENT_DIR);
  // Loaded ONCE. The live log is 3.5k directory entries and 400 JSON parses; doing that
  // per-test made these two the slowest in the file and flaky under parallel load.
  let cached: SocietyTickSample[] | null = null;
  function corpus(): SocietyTickSample[] {
    if (cached === null) cached = loadSocietySamples(EVENT_DIR, 0);
    return cached;
  }

  // REPAIRED 2026-08-21, and the repair is the point. This test used to assert
  // `r.latest!.population === 1` and that the CURRENT alarms contain
  // POPULATION-COLLAPSE. That was true when written and the population fix
  // (the lexicographic-outranking bug in the loader) made it false -- the live
  // corpus now reads pop=3 div=5.61 gen=5 flat=1t OK.
  //
  // It fired correctly: a tripwire that goes red when the thing it describes is
  // repaired is the mechanism working. But asserting a TRANSIENT live value was
  // the defect in the test, not in the fix -- it would have gone red again on
  // any future recovery, and a test that must be edited every time the system
  // gets better trains its reader to edit it without looking.
  //
  // What is asserted now is what stays true forever: the historical collapse is
  // STILL IN THE CORPUS, and the readout can reproduce it from real data. That
  // is the falsifier -- it dies if computeReadout stops detecting a real
  // collapse -- without pinning today's health to a literal.
  test.if(present)("the readout reproduces the historical collapse from the real corpus", () => {
    const samples = corpus();
    expect(samples.length).toBeGreaterThan(300);
    const r = computeReadout(samples, Date.parse(samples[samples.length - 1]!.at) + 1000);

    // The 4-agent era and the 1-agent era are both in this log, permanently.
    expect(r.maxPopulation).toBe(4);
    expect(Math.min(...samples.map((s) => s.population))).toBe(1);

    // And the readout detects the collapse when shown the collapsed window --
    // which is the property, rather than "the newest sample happens to be 1".
    const collapsed = samples.filter((s) => s.population === 1);
    expect(collapsed.length).toBeGreaterThan(100);
    const rc = computeReadout(collapsed, Date.parse(collapsed[collapsed.length - 1]!.at) + 1000);
    expect(rc.latest!.population).toBe(1);
    expect(rc.alarms).toContain("POPULATION-COLLAPSE");
    expect(rc.alarms).toContain("DIVERSITY-ZERO");
    expect(rc.flatlineTicks).toBeGreaterThan(100);
  });

  test.if(present)("the 4-agent era of the same log renders WITHOUT the collapse alarms", () => {
    const all = corpus();
    const era = all.filter((s) => s.population === 4);
    expect(era.length).toBeGreaterThan(50);
    const r = computeReadout(era, Date.parse(era[era.length - 1]!.at) + 1000);
    expect(r.alarms).not.toContain("POPULATION-COLLAPSE");
    expect(r.alarms).not.toContain("DIVERSITY-ZERO");
  });
});
