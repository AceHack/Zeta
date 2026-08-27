/**
 * audit-artifact-freshness.test.ts — the falsifiers.
 *
 * `.claude/rules/toy-is-free-metered-must-be-earned.md`: a guard nobody has watched
 * fail is not a guard. Every state this checker can report is produced here from a
 * synthetic document and a fixed clock, so the red is observable and not asserted.
 *
 * The pair that matters is the first two: SAME subject, SAME clock, one timestamp
 * either side of the threshold. That is the before/after the whole file exists for.
 */

import { describe, expect, test } from "bun:test";

import { DEFAULT_FOLD_CONFIG } from "../drift-dashboard/fold.ts";
import {
  auditFreshness,
  classifyFreshness,
  FRESHNESS_ROSTER,
  staleAfterSeconds,
  type FreshnessSubject,
} from "./audit-artifact-freshness.ts";

const NOW = Date.parse("2026-08-27T02:00:00.000Z");
const HOUR = 3_600_000;

const subject: FreshnessSubject = {
  id: "red-state",
  path: "demo/red/red-state.json",
  field: "generatedAtIso",
  cadenceSeconds: 6 * 3600,
  cadenceDeclaredIn: "test",
  why: "the dashboard renders it",
};

function doc(at: string | number | null | undefined): string {
  return JSON.stringify(at === undefined ? { version: 1 } : { version: 1, generatedAtIso: at });
}

describe("the threshold descends from the declared cadence", () => {
  test("staleAfterSeconds is stalenessFactor × cadence, with the factor IMPORTED not redeclared", () => {
    expect(staleAfterSeconds(6 * 3600)).toBe(DEFAULT_FOLD_CONFIG.stalenessFactor * 6 * 3600);
    // 6h cadence × 3 missed ticks = 18h. Named here so a silent change to either input
    // shows up as a failing test rather than as a quietly different window.
    expect(staleAfterSeconds(6 * 3600)).toBe(18 * 3600);
  });

  test("every rostered subject records where its cadence was read from", () => {
    expect(FRESHNESS_ROSTER.length).toBeGreaterThan(1);
    for (const s of FRESHNESS_ROSTER) {
      expect(s.cadenceSeconds).toBeGreaterThan(0);
      expect(s.cadenceDeclaredIn).toContain("cron");
      expect(s.why.length).toBeGreaterThan(20);
    }
  });
});

describe("IT CAN FAIL — the same subject, the same clock, either side of the line", () => {
  test("GREEN: a timestamp inside the window", () => {
    const v = classifyFreshness(subject, doc(new Date(NOW - 5 * HOUR).toISOString()), NOW);
    expect(v.state).toBe("fresh");
    expect(v.ok).toBe(true);
  });

  test("RED: the SAME document with the timestamp the live incident actually had", () => {
    // demo/red/red-state.json really did sit at this instant while the lane failed ten
    // consecutive runs. Nothing reported it.
    const v = classifyFreshness(subject, doc("2026-08-23T18:35:32.125Z"), NOW);
    expect(v.state).toBe("stale");
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("3.3d old");
  });

  test("the boundary is a boundary: 18h-1s passes, 18h+1s does not", () => {
    const limitMs = staleAfterSeconds(subject.cadenceSeconds) * 1000;
    expect(classifyFreshness(subject, doc(new Date(NOW - limitMs + 1000).toISOString()), NOW).ok).toBe(true);
    expect(classifyFreshness(subject, doc(new Date(NOW - limitMs - 1000).toISOString()), NOW).ok).toBe(false);
  });
});

describe("STALE and ABSENT are different answers, and neither is fresh", () => {
  test("a missing file does not read as fresh", () => {
    const v = classifyFreshness(subject, null, NOW);
    expect(v.state).toBe("missing-file");
    expect(v.ok).toBe(false);
    expect(v.ageSeconds).toBeNull();
  });

  test("a document with no timestamp field does not read as fresh", () => {
    const v = classifyFreshness(subject, doc(undefined), NOW);
    expect(v.state).toBe("no-field");
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("not a fresh document");
  });

  test("a non-string / unparseable timestamp does not read as fresh", () => {
    expect(classifyFreshness(subject, doc(1234), NOW).state).toBe("no-field");
    expect(classifyFreshness(subject, doc(""), NOW).state).toBe("no-field");
    expect(classifyFreshness(subject, doc("last tuesday"), NOW).state).toBe("unparseable-timestamp");
    expect(classifyFreshness(subject, "{ not json", NOW).state).toBe("unparseable");
    expect(classifyFreshness(subject, "[]", NOW).state).toBe("unparseable");
  });

  test("every not-fresh state is reported as not ok", () => {
    const bodies = [null, "{ not json", "[]", doc(undefined), doc(1234), doc("last tuesday")];
    for (const b of bodies) expect(classifyFreshness(subject, b, NOW).ok).toBe(false);
  });
});

describe("a timestamp from the future is not the freshest thing on the board", () => {
  test("it is called out rather than rewarded for having the smallest age", () => {
    const v = classifyFreshness(subject, doc(new Date(NOW + 2 * HOUR).toISOString()), NOW);
    expect(v.state).toBe("from-the-future");
    expect(v.ok).toBe(false);
    // The trap this closes: age is NEGATIVE here, i.e. smaller than any honest value.
    expect(v.ageSeconds).toBeLessThan(0);
  });
});

describe("auditFreshness folds the roster", () => {
  test("one stale subject makes the audit not ok, and the fresh ones stay green", () => {
    // Each subject is served a document carrying ITS OWN declared field. The
    // previous version handed every non-red-state subject an `{ at: ... }`
    // document, which happened to suit the two-entry roster and reported
    // `no-field` the moment a third subject named a different key — a fixture
    // failure reading as a subject failure.
    const fresh = new Date(NOW - HOUR).toISOString();
    const read = (p: string): string | null => {
      if (p === "demo/red/red-state.json") return doc("2026-08-23T18:35:32.125Z");
      const s = FRESHNESS_ROSTER.find((x) => x.path === p);
      return s ? JSON.stringify({ [s.field]: fresh }) : null;
    };
    const verdicts = auditFreshness(FRESHNESS_ROSTER, read, NOW);
    expect(verdicts).toHaveLength(FRESHNESS_ROSTER.length);
    expect(verdicts.filter((v) => !v.ok).map((v) => v.id)).toEqual(["red-state"]);
  });

  test("a subject is never silently dropped — every roster entry yields a verdict", () => {
    const verdicts = auditFreshness(FRESHNESS_ROSTER, () => null, NOW);
    expect(verdicts.map((v) => v.id)).toEqual(FRESHNESS_ROSTER.map((s) => s.id));
    expect(verdicts.every((v) => !v.ok)).toBe(true);
  });
});
