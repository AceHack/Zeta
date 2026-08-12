import { describe, expect, test } from "bun:test";
import type { DeclarerLedger, Freedom } from "./mutation-freedoms";
import type { TranscriptEntry } from "./mutation-readout";
import {
  MIN_SAMPLE,
  falseAlarmReadout,
  formatReadout,
  resolutionOf,
} from "./mutation-false-alarm-rate";
import { makeFinding, type FindingRecord } from "./mutation-findings";

// The metric that would eventually earn the runner the right to be more than a report. Its whole
// value is in being HONEST about a small, biased sample — a confident percentage here would be the
// same overclaim the runner itself was fixed to stop making.

const room = { source: "a.ts", test: "a.test.ts", mutation: "gte-to-gt" };

const entry = (kind: string, over: Partial<TranscriptEntry> = {}): TranscriptEntry =>
  ({
    room,
    declarer: "otto",
    level: 0,
    chosenIndex: 0,
    action: { kind } as TranscriptEntry["action"],
    offered: [],
    rulesApplied: [],
    address: `addr-${kind}`,
    ...over,
  }) as TranscriptEntry;

const many = (kind: string, n: number): TranscriptEntry[] => Array.from({ length: n }, () => entry(kind));

const freedom = (over: Partial<Freedom> = {}): Freedom => ({
  ...room,
  reason: "free",
  declaredAt: "2026-08-11T00:00:00.000Z",
  ...over,
});
const ledger = (declarer: string, freedoms: Freedom[]): DeclarerLedger => ({ declarer, freedoms });

/** `n` distinct alarms — the recorded population a rate is a fraction of. */
const alarms = (n: number): FindingRecord[] =>
  Array.from({ length: n }, (_, i) =>
    makeFinding({
      source: `s${String(i)}.ts`,
      test: `s${String(i)}.test.ts`,
      mutation: "gte-to-gt",
      agent: "otto",
      tick: 1,
      outcome: "indistinguishable",
    }),
  );

describe("classification — what a cell says about the ALARM, not about the code", () => {
  test("write-test is the only TRUE alarm", () => {
    expect(resolutionOf("write-test")).toBe("real-gap");
  });

  test("declare-free and note-redundant are both false alarms, for different reasons", () => {
    // Genuinely unconstrained vs. masked-so-unobservable. Different readings, same consequence for
    // the metric: the runner flagged something that was not a missing test.
    expect(resolutionOf("declare-free")).toBe("declared-free");
    expect(resolutionOf("note-redundant")).toBe("redundant");
  });

  test("supersede-mine is a REVISION — the '§6 registry converges' falsifier", () => {
    expect(resolutionOf("supersede-mine")).toBe("revision");
  });

  test("escape and undefined-cell are frontier, not resolutions", () => {
    expect(resolutionOf("escape")).toBe("frontier");
    expect(resolutionOf("undefined-cell")).toBe("frontier");
  });

  test("anything unrecognised is non-resolving rather than silently a gap", () => {
    expect(resolutionOf("read-declarer")).toBe("non-resolving");
    expect(resolutionOf("something-invented-later")).toBe("non-resolving");
  });
});

describe("DEFERRED IS EXCLUDED — the load-bearing honesty property", () => {
  test("a deferred finding counts as neither a true nor a false alarm", () => {
    // SLAM's rule, and the same one the runner's `unresolved` follows: running out of what you need
    // is reported as unresolved, never folded into a verdict. Counting defers as true alarms would
    // flatter the runner; counting them as false ones would damn it. Both are lies about a
    // measurement nobody took.
    const withDefers = falseAlarmReadout([...many("write-test", 10), ...many("defer", 90)], []);
    const without = falseAlarmReadout(many("write-test", 10), []);

    expect(withDefers.resolved).toBe(10);
    expect(withDefers.resolved).toBe(without.resolved);
    expect(withDefers.counts.deferred).toBe(90);
    expect(withDefers.falseAlarms).toBe(0);
  });

  test("read-declarer and frontier cells also stay out of the denominator", () => {
    const r = falseAlarmReadout(
      [...many("write-test", 20), ...many("read-declarer", 5), ...many("escape", 5)],
      [],
    );
    expect(r.resolved).toBe(20);
  });
});

describe("the rate is WITHHELD on a small sample, not guessed", () => {
  test(`below ${String(MIN_SAMPLE)} resolutions there is no rate at all`, () => {
    const r = falseAlarmReadout([...many("write-test", 3), ...many("declare-free", 2)], []);
    expect(r.resolved).toBe(5);
    expect(r.falseAlarmRate).toBeNull();
    expect(r.withheld).toContain("insufficient sample");
    // Null, never 0 — a withheld measurement must not read as a perfect score.
    expect(r.falseAlarmRate).not.toBe(0);
  });

  test(`EXACTLY ${String(MIN_SAMPLE)} resolutions is enough — the boundary, not one past it`, () => {
    // `resolved >= MIN_SAMPLE` and `> MIN_SAMPLE` differ at exactly one value, and every other test
    // here sits comfortably on one side of it. This is the case that holds the guard.
    const at = falseAlarmReadout(
      [...many("declare-free", 5), ...many("write-test", MIN_SAMPLE - 5)],
      [],
      alarms(MIN_SAMPLE),
    );
    expect(at.resolved).toBe(MIN_SAMPLE);
    expect(at.falseAlarmRate).toBeCloseTo(5 / MIN_SAMPLE, 10);
    expect(at.withheld).toBeNull();

    const below = falseAlarmReadout(
      [...many("declare-free", 5), ...many("write-test", MIN_SAMPLE - 6)],
      [],
      alarms(MIN_SAMPLE),
    );
    expect(below.resolved).toBe(MIN_SAMPLE - 1);
    expect(below.falseAlarmRate).toBeNull();
  });

  test("both false-alarm kinds land in the numerator", () => {
    const r = falseAlarmReadout(
      [...many("declare-free", 6), ...many("note-redundant", 4), ...many("write-test", 10)],
      [],
      alarms(MIN_SAMPLE),
    );
    expect(r.falseAlarms).toBe(10);
    expect(r.falseAlarmRate).toBeCloseTo(0.5, 10);
  });
});

describe("COVERAGE — recording the population does not make the resolved subset fair", () => {
  test("a big sample over a much bigger alarm population is still withheld", () => {
    // The trap this guards: once findings are recorded it is tempting to treat the rate as earned.
    // But an unresolved alarm is still an alarm nobody classified, so 25 resolutions out of 500
    // alarms describes the 25 — and whoever resolved them chose which.
    const r = falseAlarmReadout([...many("write-test", 20), ...many("declare-free", 5)], [], alarms(500));
    expect(r.resolved).toBe(25);
    expect(r.alarmsReported).toBe(500);
    expect(r.falseAlarmRate).toBeNull();
    expect(r.withheld).toContain("insufficient coverage");
    expect(r.slamComparable).toBe(false);
  });

  test("both withholding reasons are reported SEPARATELY — different problems, different fixes", () => {
    // "too few" is fixed by resolving more; "too unrepresentative" by resolving a fairer slice.
    // One merged message would hide which is biting.
    const r = falseAlarmReadout(many("write-test", 2), [], alarms(500));
    expect(r.withheld).toContain("insufficient sample");
    expect(r.withheld).toContain("insufficient coverage");
  });

  test("enough sample AND enough coverage makes it SLAM-comparable", () => {
    const r = falseAlarmReadout([...many("write-test", 18), ...many("declare-free", 2)], [], alarms(20));
    expect(r.resolutionCoverage).toBeCloseTo(1, 10);
    expect(r.falseAlarmRate).toBeCloseTo(0.1, 10);
    expect(r.slamComparable).toBe(true);
    expect(r.coverage).toBe("reports-recorded");
  });

  test("with no findings recorded the readout says so rather than implying full coverage", () => {
    const r = falseAlarmReadout(many("write-test", 50), [], []);
    expect(r.alarmsReported).toBe(0);
    expect(r.resolutionCoverage).toBeNull();
    expect(r.coverage).toBe("resolutions-only");
    expect(r.slamComparable).toBe(false);
    expect(r.withheld).toContain("no alarms recorded");
  });
});

describe("revision rate — measured against its OWN denominator", () => {
  test("superseded freedoms over declared freedoms, withheld while small", () => {
    const small = falseAlarmReadout([], [ledger("otto", [freedom({ supersededAt: "2026-08-12T00:00:00.000Z" })])]);
    expect(small.declaredTotal).toBe(1);
    expect(small.declaredSuperseded).toBe(1);
    expect(small.revisionRate).toBeNull(); // 1-of-1 is not "100% churn", it is one data point

    const big = falseAlarmReadout(
      [],
      [
        ledger(
          "otto",
          Array.from({ length: MIN_SAMPLE }, (_, i) =>
            freedom(i < 4 ? { source: `s${String(i)}.ts`, supersededAt: "2026-08-12T00:00:00.000Z" } : { source: `s${String(i)}.ts` }),
          ),
        ),
      ],
    );
    expect(big.revisionRate).toBeCloseTo(4 / MIN_SAMPLE, 10);
  });

  test("freedoms are pooled across declarers", () => {
    const r = falseAlarmReadout([], [ledger("otto", [freedom()]), ledger("vera", [freedom()])]);
    expect(r.declaredTotal).toBe(2);
  });
});

describe("the caveat travels WITH the number", () => {
  test("the readout marks itself not-SLAM-comparable, structurally", () => {
    // A caveat that lives only in a docstring gets separated from the number the first time someone
    // quotes it. This one is a field.
    const r = falseAlarmReadout(many("write-test", 100), []);
    expect(r.slamComparable).toBe(false);
    expect(r.coverage).toBe("resolutions-only");
  });

  test("the human readout says WITHHELD rather than printing a bare 0", () => {
    const text = formatReadout(falseAlarmReadout(many("declare-free", 2), []));
    expect(text).toContain("WITHHELD");
    expect(text).toContain("NOT SLAM-COMPARABLE");
    expect(text).not.toContain("false-alarm rate: 0.0%");
  });

  test("an empty history is a coherent readout, not a crash or a 0% score", () => {
    const r = falseAlarmReadout([], []);
    expect(r.resolved).toBe(0);
    expect(r.falseAlarmRate).toBeNull();
    expect(r.frontier).toEqual({ intoDefined: 0, intoUndefined: 0 });
  });
});
