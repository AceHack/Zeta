/**
 * drift-dashboard/fold.test.ts — the falsifiers.
 *
 * `.claude/rules/toy-is-free-metered-must-be-earned.md`: this ships `unmetered` unless
 * a test can FAIL when the dashboard is wrong. Each `describe` below names the way it
 * would be wrong, and the first one is the design constraint made executable rather
 * than a property of the code.
 */

import { describe, expect, it } from "bun:test";

import type { CheckDefinition, CheckObservation } from "../forge-host/types.ts";
import {
  DEFAULT_FOLD_CONFIG,
  foldDashboard,
  headline,
  latestPerCheck,
  firstOpportunityPassed,
  triggerMatchesExpectation,
  verdictForAbsence,
  describeWindow,
  rateWindow,
  verdictForDarkLane,
  verdictForFlapping,
  verdictForNeverFiredTrigger,
} from "./fold.ts";
import { emptyRoster, mergeDefinitions, recordObservations, type Roster } from "./roster.ts";

const NOW = "2026-08-22T18:00:00.000Z";
const DAY = 86_400;

function def(
  checkId: string,
  expectation: CheckDefinition["expectation"],
  source = "test-source",
): CheckDefinition {
  return { checkId, displayName: checkId, expectation, source };
}

function obs(
  checkId: string,
  verdict: CheckObservation["verdict"],
  observedAt: string,
  source = "test-source",
): CheckObservation {
  return { checkId, verdict, observedAt, source };
}

function rosterOf(defs: readonly CheckDefinition[], at = "2026-08-01T00:00:00.000Z"): Roster {
  return mergeDefinitions(emptyRoster("main", at), defs, at);
}

function rowFor(report: ReturnType<typeof foldDashboard>, checkId: string) {
  const row = report.rows.find((r) => r.checkId === checkId);
  if (row === undefined) throw new Error(`no row for ${checkId} — every roster entry must yield a row`);
  return row;
}

// ───────────────────────────────────────────────────────────────────────────
// FALSIFIER 4 (written first, on purpose): substrate independence.
//
// If the core cannot be exercised without a forge host, the model is still
// forge-shaped and sovereign mode — no centralized forge host at all — is not
// reachable. Nothing in this block mentions a workflow, a run, or GitHub.
// ───────────────────────────────────────────────────────────────────────────

describe("substrate independence — the core renders with NO forge host present", () => {
  it("folds observations that carry no forge fields at all", () => {
    // Author/verifier attestations, the stated destination. No run id, no workflow,
    // no conclusion string — only the hub half of the model.
    const defs = [
      def("consensus-safety-proof", { kind: "periodic", periodSeconds: DAY, detail: "attested daily" }, "verifier:ilyana"),
      def("byte-lock-parity", { kind: "on-change", detail: "attested per merge" }, "verifier:soraya"),
      def("release-signoff", { kind: "on-demand", detail: "attested on request" }, "verifier:aaron"),
    ];
    const report = foldDashboard({
      roster: rosterOf(defs),
      observations: [
        { checkId: "consensus-safety-proof", verdict: { kind: "green" }, observedAt: "2026-08-22T17:00:00.000Z", source: "verifier:ilyana", trigger: "periodic" },
        { checkId: "byte-lock-parity", verdict: { kind: "red", detail: "oracle disagreement on ZetaId layout" }, observedAt: "2026-08-22T17:30:00.000Z", source: "verifier:soraya", trigger: "on-change" },
      ],
      now: NOW,
    });

    expect(report.counts.red).toBe(1);
    expect(report.counts.green).toBe(1);
    expect(rowFor(report, "byte-lock-parity").verdict.kind).toBe("red");
    // The on-demand attestation is correctly silent, and that is NOT green.
    expect(rowFor(report, "release-signoff").verdict.kind).toBe("not-applicable");
    expect(report.coverage.expected).toBe(2);
    expect(report.coverage.observed).toBe(2);
    expect(report.sources).toEqual(["verifier:aaron", "verifier:ilyana", "verifier:soraya"]);
    expect(report.ok).toBe(false); // a red is a red, whoever produced it
  });

  it("shows the SAME red for the same check under a different producer — the migration property", () => {
    // Aaron 2026-08-22: "the Zeta drift dashboard will show the same red even once we
    // end the github workflows." Same CheckId, same verdict, different substrate.
    const expectation = { kind: "on-change", detail: "runs when the ref changes" } as const;
    const viaForge = foldDashboard({
      roster: rosterOf([def("pr-manifest-integrity", expectation, "github")]),
      observations: [obs("pr-manifest-integrity", { kind: "red", detail: "manifest shard mismatch" }, "2026-08-22T12:00:00.000Z", "github")],
      now: NOW,
    });
    const viaAttestation = foldDashboard({
      roster: rosterOf([def("pr-manifest-integrity", expectation, "verifier:kestrel")]),
      observations: [obs("pr-manifest-integrity", { kind: "red", detail: "manifest shard mismatch" }, "2026-08-22T12:00:00.000Z", "verifier:kestrel")],
      now: NOW,
    });

    const strip = (r: ReturnType<typeof foldDashboard>) =>
      r.rows.map(({ source, ...rest }) => rest);
    expect(strip(viaAttestation)).toEqual(strip(viaForge));
    expect(viaForge.counts.red).toBe(1);
    expect(viaAttestation.counts.red).toBe(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// FALSIFIER 1: today's exact bug.
// ───────────────────────────────────────────────────────────────────────────

describe("a check absent from the observation set renders Unknown, never green", () => {
  it("never-observed on-change check is unknown/never-observed, not green", () => {
    const report = foldDashboard({
      roster: rosterOf([
        def("seen", { kind: "on-change", detail: "push" }),
        def("unseen", { kind: "on-change", detail: "push" }),
      ]),
      observations: [obs("seen", { kind: "green" }, "2026-08-22T17:00:00.000Z")],
      now: NOW,
    });

    const row = rowFor(report, "unseen");
    expect(row.verdict.kind).toBe("unknown");
    expect(row.verdict.kind === "unknown" && row.verdict.reason).toBe("never-observed");
    expect(report.counts.green).toBe(1); // ONLY the observed one
    expect(report.ok).toBe(false);
  });

  it("distinguishes never-observed from not-observed-this-pass — collapsing them IS the bug", () => {
    // The window-sampling failure wears "never observed"'s clothes: the check has run,
    // and has a verdict, and this pass simply could not see it.
    let roster = rosterOf([def("known", { kind: "on-change", detail: "push" })]);
    roster = recordObservations(
      roster,
      new Map([["known", { observedAt: "2026-08-16T00:00:00.000Z", kind: "green" as const }]]),
    );

    const report = foldDashboard({ roster, observations: [], now: NOW });
    const row = rowFor(report, "known");
    expect(row.verdict.kind === "unknown" && row.verdict.reason).toBe("not-observed-this-pass");
    expect(row.silenceSeconds).toBe(6 * DAY + 18 * 3600);
  });

  it("a whole pass that observes nothing produces zero greens, not a clean board", () => {
    const defs = Array.from({ length: 20 }, (_, i) =>
      def(`check-${String(i).padStart(2, "0")}`, { kind: "on-change", detail: "push" }),
    );
    const report = foldDashboard({ roster: rosterOf(defs), observations: [], now: NOW });
    expect(report.counts.green).toBe(0);
    expect(report.counts.unknown).toBe(20);
    expect(report.ok).toBe(false);
    expect(headline(report)).toContain("NOT OK");
  });

  it("a source that ERRORED is an absence, never an all-clear", () => {
    const report = foldDashboard({
      roster: rosterOf([def("only", { kind: "on-change", detail: "push" })]),
      observations: [obs("only", { kind: "green" }, "2026-08-22T17:59:00.000Z")],
      now: NOW,
      sourceErrors: ["github: rate-limited while enumerating check definitions"],
    });
    expect(report.counts.green).toBe(1);
    expect(report.ok).toBe(false); // green everywhere and still not ok
    expect(headline(report)).toContain("SOURCE ERRORS 1");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// FALSIFIER 2: latest-per-check.
// ───────────────────────────────────────────────────────────────────────────

describe("latest-per-check aggregation — an older green never masks a newer red", () => {
  it("newest verdict wins regardless of input order", () => {
    const older = obs("c", { kind: "green" }, "2026-08-20T00:00:00.000Z");
    const newer = obs("c", { kind: "red", detail: "boom" }, "2026-08-22T00:00:00.000Z");

    for (const order of [[older, newer], [newer, older]]) {
      const picked = latestPerCheck(order).get("c");
      expect(picked?.verdict.kind).toBe("red");
    }
  });

  it("a green arriving AFTER a red in the array does not overwrite it if it is older", () => {
    const report = foldDashboard({
      roster: rosterOf([def("c", { kind: "on-change", detail: "push" })]),
      observations: [
        obs("c", { kind: "red", detail: "newest, and failing" }, "2026-08-22T17:00:00.000Z"),
        obs("c", { kind: "green" }, "2026-08-21T17:00:00.000Z"),
      ],
      now: NOW,
    });
    expect(report.counts.red).toBe(1);
    expect(report.counts.green).toBe(0);
  });

  it("the roster's remembered lastObservedAt is monotone — a replayed old pass cannot rewind it", () => {
    let roster = rosterOf([def("c", { kind: "on-change", detail: "push" })]);
    roster = recordObservations(roster, new Map([["c", { observedAt: "2026-08-22T00:00:00.000Z", kind: "red" as const }]]));
    roster = recordObservations(roster, new Map([["c", { observedAt: "2026-08-01T00:00:00.000Z", kind: "green" as const }]]));
    expect(roster.checks[0]?.lastObservedAt).toBe("2026-08-22T00:00:00.000Z");
    expect(roster.checks[0]?.lastVerdictKind).toBe("red");
  });

  it("ties on observedAt break deterministically, so the fold is a function of the SET", () => {
    const a = obs("c", { kind: "green" }, NOW, "source-a");
    const b = obs("c", { kind: "red", detail: "x" }, NOW, "source-b");
    expect(latestPerCheck([a, b]).get("c")?.source).toBe("source-b");
    expect(latestPerCheck([b, a]).get("c")?.source).toBe("source-b");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// FALSIFIER 3: coverage shortfall is red.
// ───────────────────────────────────────────────────────────────────────────

describe("coverage shortfall is surfaced as red, not as a passing run with a smaller denominator", () => {
  it("the live shape: 81 known, 22 observed — not a clean board", () => {
    const defs = Array.from({ length: 81 }, (_, i) =>
      def(`w-${String(i).padStart(2, "0")}`, { kind: "on-change", detail: "push" }),
    );
    const observations = defs.slice(0, 22).map((d) => obs(d.checkId, { kind: "green" }, "2026-08-22T17:00:00.000Z"));
    const report = foldDashboard({ roster: rosterOf(defs), observations, now: NOW });

    expect(report.coverage.expected).toBe(81);
    expect(report.coverage.observed).toBe(22);
    expect(report.coverage.shortfall).toBe(59);
    expect(report.ok).toBe(false);
    expect(headline(report)).toContain("SHORTFALL 59");
    // and the shortfall is not just a number — every missing check has a row
    expect(report.counts.unknown).toBe(59);
  });

  it("a vanished check does NOT shrink the denominator", () => {
    const before = rosterOf([
      def("stays", { kind: "on-change", detail: "push" }),
      def("vanishes", { kind: "on-change", detail: "push" }),
    ]);
    const after = mergeDefinitions(before, [def("stays", { kind: "on-change", detail: "push" })], NOW);

    expect(after.checks).toHaveLength(2);
    const gone = after.checks.find((c) => c.checkId === "vanishes");
    expect(gone?.declaredNow).toBe(false);

    const report = foldDashboard({
      roster: after,
      observations: [obs("stays", { kind: "green" }, "2026-08-22T17:00:00.000Z")],
      now: NOW,
    });
    expect(report.coverage.expected).toBe(2); // NOT 1
    expect(report.coverage.shortfall).toBe(1);
    expect(rowFor(report, "vanishes").undeclared).toBe(true);
    expect(report.ok).toBe(false);
  });

  it("on-demand checks do not pin coverage permanently below 100% — a permanent red is a red nobody reads", () => {
    const report = foldDashboard({
      roster: rosterOf([
        def("push-check", { kind: "on-change", detail: "push" }),
        def("pr-only-a", { kind: "on-demand", detail: "pull_request" }),
        def("pr-only-b", { kind: "on-demand", detail: "workflow_dispatch" }),
      ]),
      observations: [obs("push-check", { kind: "green" }, "2026-08-22T17:00:00.000Z")],
      now: NOW,
    });
    expect(report.coverage.expected).toBe(1);
    expect(report.coverage.shortfall).toBe(0);
    expect(report.coverage.onDemand).toBe(2);
    expect(report.coverage.known).toBe(3);
    expect(report.ok).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// "The more mechanical the better" — expected-absent vs unexpectedly-absent,
// ageing, and the ranking that stops unknowns becoming a grey wall.
// ───────────────────────────────────────────────────────────────────────────

describe("expected-absent vs unexpectedly-absent — collapsing them is what makes the grey wall", () => {
  it("a scheduled check with no runs is RED, not unknown (chart-version-refresh's shape)", () => {
    const v = verdictForAbsence({ kind: "periodic", periodSeconds: 7 * DAY, detail: "cron weekly" }, null, NOW, DEFAULT_FOLD_CONFIG, "2026-06-01T00:00:00.000Z");
    expect(v.kind).toBe("red");
    expect(v.kind === "red" && v.detail).toContain("NEVER");
  });

  it("a PR-only check with no runs on a branch ref is not-applicable, not unknown", () => {
    const v = verdictForAbsence({ kind: "on-demand", detail: "pull_request" }, null, NOW, DEFAULT_FOLD_CONFIG);
    expect(v.kind).toBe("not-applicable");
  });

  it("an UNDERIVABLE expectation stays loudly unknown — never defaulted to the convenient case", () => {
    const v = verdictForAbsence({ kind: "unknown", reason: "underivable", detail: "triggers could not be parsed" }, null, NOW, DEFAULT_FOLD_CONFIG);
    expect(v.kind).toBe("unknown");
    expect(v.kind === "unknown" && v.reason).toBe("expectation-unknown");
  });

  it("a periodic check whose newest verdict is GREEN but ancient is RED — a check that did not run", () => {
    // budget-snapshot-cadence's shape: weekly, and silent for six days is not yet
    // stale, but silent for a month is a lane that stopped.
    const report = foldDashboard({
      roster: rosterOf([def("weekly", { kind: "periodic", periodSeconds: 7 * DAY, detail: "cron weekly" })]),
      observations: [
        { checkId: "weekly", verdict: { kind: "green" }, observedAt: "2026-07-01T00:00:00.000Z", source: "s", trigger: "periodic" },
      ],
      now: NOW,
    });
    const row = rowFor(report, "weekly");
    expect(row.verdict.kind).toBe("red");
    expect(row.verdict.kind === "red" && row.verdict.detail).toContain("STALE");
    expect(row.observedThisPass).toBe(true); // observed, and still red
  });

  it("a periodic check inside its window stays green", () => {
    const report = foldDashboard({
      roster: rosterOf([def("daily", { kind: "periodic", periodSeconds: DAY, detail: "cron daily" })]),
      observations: [
        { checkId: "daily", verdict: { kind: "green" }, observedAt: "2026-08-22T06:00:00.000Z", source: "s", trigger: "periodic" },
      ],
      now: NOW,
    });
    expect(rowFor(report, "daily").verdict.kind).toBe("green");
  });
});

describe("unknowns are ranked by age — a displayed-but-undistinguished unknown has not been surfaced", () => {
  it("never-observed sorts above long silence, which sorts above short silence", () => {
    let roster = rosterOf([
      def("silent-6d", { kind: "on-change", detail: "push" }),
      def("silent-1h", { kind: "on-change", detail: "push" }),
      def("never", { kind: "on-change", detail: "push" }),
    ]);
    roster = recordObservations(
      roster,
      new Map([
        ["silent-6d", { observedAt: "2026-08-16T18:00:00.000Z", kind: "green" as const }],
        ["silent-1h", { observedAt: "2026-08-22T17:00:00.000Z", kind: "green" as const }],
      ]),
    );
    const report = foldDashboard({ roster, observations: [], now: NOW });
    expect(report.rows.map((r) => r.checkId)).toEqual(["never", "silent-6d", "silent-1h"]);
    expect(report.hasNeverObserved).toBe(true);
  });

  it("red outranks every unknown, and the OLDEST red is first", () => {
    const report = foldDashboard({
      roster: rosterOf([
        def("red-fresh", { kind: "on-change", detail: "push" }),
        def("red-since-the-16th", { kind: "on-change", detail: "push" }),
        def("unknown-one", { kind: "on-change", detail: "push" }),
        def("green-one", { kind: "on-change", detail: "push" }),
      ]),
      observations: [
        obs("red-fresh", { kind: "red", detail: "just now" }, "2026-08-22T17:55:00.000Z"),
        obs("red-since-the-16th", { kind: "red", detail: "six days" }, "2026-08-16T00:00:00.000Z"),
        obs("green-one", { kind: "green" }, "2026-08-22T17:00:00.000Z"),
      ],
      now: NOW,
    });
    expect(report.rows.map((r) => r.checkId)).toEqual([
      "red-since-the-16th", "red-fresh", "unknown-one", "green-one",
    ]);
  });

  it("the headline carries the oldest silence, so ageing is visible without opening a row", () => {
    let roster = rosterOf([def("quiet", { kind: "on-change", detail: "push" })]);
    roster = recordObservations(roster, new Map([["quiet", { observedAt: "2026-08-16T18:00:00.000Z", kind: "green" as const }]]));
    expect(headline(foldDashboard({ roster, observations: [], now: NOW }))).toContain("oldest silence 6d");
  });
});

describe("determinism (DST) — the fold is a function of its inputs", () => {
  it("shuffling the observation array does not change the report", () => {
    const defs = Array.from({ length: 12 }, (_, i) => def(`c${i}`, { kind: "on-change", detail: "push" }));
    const observations = defs.map((d, i) =>
      obs(d.checkId, i % 3 === 0 ? { kind: "red", detail: "x" } : { kind: "green" }, `2026-08-2${i % 3}T0${i % 9}:00:00.000Z`),
    );
    const forward = foldDashboard({ roster: rosterOf(defs), observations, now: NOW });
    const reversed = foldDashboard({ roster: rosterOf(defs), observations: [...observations].reverse(), now: NOW });
    expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward));
  });

  it("every non-retired roster entry yields exactly one row — the fold is total", () => {
    const defs = Array.from({ length: 30 }, (_, i) => def(`c${i}`, { kind: "on-change", detail: "push" }));
    const report = foldDashboard({ roster: rosterOf(defs), observations: [], now: NOW });
    expect(report.rows).toHaveLength(30);
    expect(new Set(report.rows.map((r) => r.checkId)).size).toBe(30);
  });

  it("retirement is honoured but is never set automatically by any code path here", () => {
    const base = rosterOf([def("a", { kind: "on-change", detail: "push" }), def("b", { kind: "on-change", detail: "push" })]);
    const withRetired: Roster = {
      ...base,
      checks: base.checks.map((c) => (c.checkId === "b" ? { ...c, retired: true, retiredReason: "workflow deleted 2026-08-01, by hand" } : c)),
    };
    // A later merge must not resurrect or silently un-retire it.
    const merged = mergeDefinitions(withRetired, [def("a", { kind: "on-change", detail: "push" })], NOW);
    expect(merged.checks.find((c) => c.checkId === "b")?.retired).toBe(true);

    const report = foldDashboard({ roster: merged, observations: [obs("a", { kind: "green" }, "2026-08-22T17:00:00.000Z")], now: NOW });
    expect(report.coverage.retired).toBe(1);
    expect(report.coverage.expected).toBe(1);
    expect(report.rows).toHaveLength(1);
    expect(report.ok).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Producer failures: "I could not ask" must never render as "nothing was wrong".
// ───────────────────────────────────────────────────────────────────────────

describe("per-check producer failures", () => {
  it("a check the producer could not answer for is unknown/source-error, and outranks its expectation", () => {
    const report = foldDashboard({
      roster: rosterOf([
        def("asked-ok", { kind: "on-change", detail: "push" }),
        // on-demand: absence alone would have been the CORRECT not-applicable. A
        // failure to ask is not the same as a correct silence, and must win.
        def("ask-failed", { kind: "on-demand", detail: "pull_request" }),
      ]),
      observations: [obs("asked-ok", { kind: "green" }, "2026-08-22T17:00:00.000Z")],
      failures: [{ checkId: "ask-failed", detail: "rate-limited" }],
      now: NOW,
    });
    const row = rowFor(report, "ask-failed");
    expect(row.verdict.kind).toBe("unknown");
    expect(row.verdict.kind === "unknown" && row.verdict.reason).toBe("source-error");
    expect(report.ok).toBe(false);
  });

  it("an unknown NEVER counts toward coverage, whatever produced it", () => {
    const report = foldDashboard({
      roster: rosterOf([
        def("a", { kind: "on-change", detail: "push" }),
        def("b", { kind: "on-change", detail: "push" }),
        def("c", { kind: "on-change", detail: "push" }),
      ]),
      observations: [
        obs("a", { kind: "green" }, "2026-08-22T17:00:00.000Z"),
        // A cancelled run: the producer answered, and the answer was "nothing ran".
        obs("b", { kind: "unknown", reason: "not-observed-this-pass", detail: "run cancelled" }, "2026-08-22T17:00:00.000Z"),
      ],
      failures: [{ checkId: "c", detail: "network" }],
      now: NOW,
    });
    expect(report.coverage.observed).toBe(1);
    expect(report.coverage.shortfall).toBe(2);
    expect(report.counts.unknown).toBe(2);
    // shortfall and the unknown count agree BY CONSTRUCTION, not by convention
    expect(report.coverage.shortfall).toBe(report.counts.unknown);
  });
});

describe("roster persistence — the memory that makes absence nameable", () => {
  it("round-trips through JSON unchanged (text, diffable, no lossy fields)", () => {
    let roster = rosterOf([def("a", { kind: "periodic", periodSeconds: DAY, detail: "cron daily" })]);
    roster = recordObservations(roster, new Map([["a", { observedAt: "2026-08-22T00:00:00.000Z", kind: "green" as const }]]));
    expect(JSON.parse(JSON.stringify(roster))).toEqual(roster);
  });

  it("is sorted ordinally, so a diff shows the change and never the platform's collation", () => {
    const merged = mergeDefinitions(
      emptyRoster("main", NOW),
      [def("Zebra", { kind: "on-change", detail: "d" }), def("apple", { kind: "on-change", detail: "d" }), def("Apple", { kind: "on-change", detail: "d" })],
      NOW,
    );
    expect(merged.checks.map((c) => c.checkId)).toEqual(["Apple", "Zebra", "apple"]);
  });

  it("firstSeenAt is preserved across merges — the roster remembers when a check appeared", () => {
    const first = mergeDefinitions(emptyRoster("main", "2026-08-01T00:00:00.000Z"), [def("a", { kind: "on-change", detail: "d" })], "2026-08-01T00:00:00.000Z");
    const second = mergeDefinitions(first, [def("a", { kind: "on-change", detail: "d" })], NOW);
    expect(second.checks[0]?.firstSeenAt).toBe("2026-08-01T00:00:00.000Z");
    expect(second.checks[0]?.lastDeclaredAt).toBe(NOW);
  });

  it("a re-declared check that had vanished flips back to declaredNow without losing its history", () => {
    const a = rosterOf([def("a", { kind: "on-change", detail: "d" })]);
    const gone = mergeDefinitions(a, [], NOW);
    const back = mergeDefinitions(gone, [def("a", { kind: "on-change", detail: "d" })], NOW);
    expect(gone.checks[0]?.declaredNow).toBe(false);
    expect(back.checks[0]?.declaredNow).toBe(true);
    expect(back.checks[0]?.firstSeenAt).toBe("2026-08-01T00:00:00.000Z");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// The fourth unknown class, and the sharpest red. Both from live findings.
// ───────────────────────────────────────────────────────────────────────────

describe("registered-but-absent — roster-versus-repository drift gets its own name", () => {
  it("a check the producer declares whose DEFINITION is missing is its own unknown class", () => {
    const v = verdictForAbsence(
      { kind: "unknown", reason: "definition-absent", detail: "workflow 'substrate-claim-checker.yml' active on the forge host, absent from the repository" },
      null, NOW, DEFAULT_FOLD_CONFIG,
    );
    expect(v.kind).toBe("unknown");
    expect(v.kind === "unknown" && v.reason).toBe("registered-but-absent");
  });

  it("does not collapse into expectation-unknown, which is a different fact", () => {
    const absent = verdictForAbsence({ kind: "unknown", reason: "definition-absent", detail: "d" }, null, NOW, DEFAULT_FOLD_CONFIG);
    const underivable = verdictForAbsence({ kind: "unknown", reason: "underivable", detail: "d" }, null, NOW, DEFAULT_FOLD_CONFIG);
    expect(absent.kind === "unknown" && absent.reason).not.toBe(underivable.kind === "unknown" ? underivable.reason : "");
  });

  it("stays registered-but-absent even after the check HAS been observed before", () => {
    const v = verdictForAbsence({ kind: "unknown", reason: "definition-absent", detail: "d" }, "2026-08-20T00:00:00.000Z", NOW, DEFAULT_FOLD_CONFIG);
    expect(v.kind === "unknown" && v.reason).toBe("registered-but-absent");
  });
});

describe("a declared trigger that has NEVER fired is red, however green its other runs are", () => {
  it("chart-version-refresh's exact shape: weekly cron, every run from pull_request", () => {
    const report = foldDashboard({
      roster: rosterOf([{ ...def("chart-version-refresh", { kind: "periodic", periodSeconds: 7 * DAY, detail: "schedule: '7 17 * * 0'" }), definitionSince: "2026-06-01T00:00:00.000Z" }]),
      observations: [
        { checkId: "chart-version-refresh", verdict: { kind: "green" }, observedAt: "2026-08-22T17:00:00.000Z", source: "s", trigger: "on-request" },
      ],
      now: NOW,
    });
    const row = rowFor(report, "chart-version-refresh");
    expect(row.verdict.kind).toBe("red");
    expect(row.verdict.kind === "red" && row.verdict.detail).toContain("NEVER FIRED");
    expect(report.ok).toBe(false);
  });

  it("a periodic check whose schedule DID fire is not red for this reason", () => {
    const report = foldDashboard({
      roster: rosterOf([def("weekly", { kind: "periodic", periodSeconds: 7 * DAY, detail: "cron" })]),
      observations: [
        { checkId: "weekly", verdict: { kind: "green" }, observedAt: "2026-08-22T17:00:00.000Z", source: "s", trigger: "periodic" },
      ],
      now: NOW,
    });
    expect(rowFor(report, "weekly").verdict.kind).toBe("green");
  });

  it("once the roster remembers a schedule firing, a later non-schedule run is not re-reported as never-fired", () => {
    let roster = rosterOf([def("weekly", { kind: "periodic", periodSeconds: 7 * DAY, detail: "cron" })]);
    roster = recordObservations(roster, new Map([["weekly", { observedAt: "2026-08-20T00:00:00.000Z", kind: "green" as const, viaDeclaredTrigger: true }]]));
    expect(roster.checks[0]?.lastDeclaredTriggerAt).toBe("2026-08-20T00:00:00.000Z");

    const report = foldDashboard({
      roster,
      observations: [{ checkId: "weekly", verdict: { kind: "green" }, observedAt: "2026-08-22T17:00:00.000Z", source: "s", trigger: "on-request" }],
      now: NOW,
    });
    expect(rowFor(report, "weekly").verdict.kind).toBe("green");
  });

  it("an observation with NO trigger information never counts as the declared trigger firing", () => {
    // Absent and "unknown" both mean: do not conclude the schedule fired.
    const report = foldDashboard({
      roster: rosterOf([{ ...def("weekly", { kind: "periodic", periodSeconds: 7 * DAY, detail: "cron" }), definitionSince: "2026-06-01T00:00:00.000Z" }]),
      observations: [obs("weekly", { kind: "green" }, "2026-08-22T17:00:00.000Z")],
      now: NOW,
    });
    expect(rowFor(report, "weekly").verdict.kind).toBe("red");
  });

  it("triggerMatchesExpectation maps the classes and refuses the unknown ones", () => {
    const periodic = { kind: "periodic", periodSeconds: DAY, detail: "d" } as const;
    expect(triggerMatchesExpectation("periodic", periodic)).toBe(true);
    expect(triggerMatchesExpectation("on-request", periodic)).toBe(false);
    expect(triggerMatchesExpectation("unknown", periodic)).toBe(false);
    expect(triggerMatchesExpectation(undefined, periodic)).toBe(false);
    expect(triggerMatchesExpectation("on-change", { kind: "on-change", detail: "d" })).toBe(true);
    expect(triggerMatchesExpectation("on-request", { kind: "on-demand", detail: "d" })).toBe(true);
  });

  it("the never-fired red does not fire for on-change or on-demand checks", () => {
    for (const expectation of [{ kind: "on-change", detail: "d" }, { kind: "on-demand", detail: "d" }] as const) {
      expect(verdictForNeverFiredTrigger(expectation, null, false, true, "2020-01-01T00:00:00.000Z", NOW)).toBeNull();
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// "Not yet due" — the direction I was wrong in, and it costs credibility not
// safety, which is why it needs its own state rather than a threshold tweak.
// ───────────────────────────────────────────────────────────────────────────

describe("a never-fired trigger is only a finding once the trigger COULD have fired", () => {
  it("chart-version-refresh's real story: landed Friday, cron is Sunday, checked Saturday", () => {
    const weekly = { kind: "periodic", periodSeconds: 7 * DAY, detail: "schedule: '7 17 * * 0'" } as const;
    const v = verdictForAbsence(weekly, null, "2026-08-22T18:00:00.000Z", DEFAULT_FOLD_CONFIG, "2026-08-21T20:18:00.000Z");
    expect(v.kind).toBe("not-yet-due");
    expect(v.kind === "not-yet-due" && v.detail).toContain("less than one full period");
  });

  it("not-yet-due is NOT green and NOT unknown — both alternatives are wrong in different directions", () => {
    const weekly = { kind: "periodic", periodSeconds: 7 * DAY, detail: "cron" } as const;
    const v = verdictForAbsence(weekly, null, NOW, DEFAULT_FOLD_CONFIG, "2026-08-21T20:18:00.000Z");
    expect(v.kind).not.toBe("green");
    expect(v.kind).not.toBe("unknown");
    expect(v.kind).not.toBe("red");
  });

  it("once a full period has elapsed it becomes red again", () => {
    const weekly = { kind: "periodic", periodSeconds: 7 * DAY, detail: "cron" } as const;
    expect(verdictForAbsence(weekly, null, NOW, DEFAULT_FOLD_CONFIG, "2026-08-01T00:00:00.000Z").kind).toBe("red");
  });

  it("an UNKNOWN definition age declines to alarm — an unknown rendered red mutes the alarm", () => {
    const weekly = { kind: "periodic", periodSeconds: 7 * DAY, detail: "cron" } as const;
    const v = verdictForAbsence(weekly, null, NOW, DEFAULT_FOLD_CONFIG, undefined);
    expect(v.kind).toBe("not-yet-due");
    expect(v.kind === "not-yet-due" && v.detail).toContain("age is unknown");
  });

  it("the same gate applies to the never-fired-trigger red", () => {
    const weekly = { kind: "periodic", periodSeconds: 7 * DAY, detail: "cron" } as const;
    expect(verdictForNeverFiredTrigger(weekly, null, false, true, "2026-08-21T20:18:00.000Z", NOW)?.kind).toBe("not-yet-due");
    expect(verdictForNeverFiredTrigger(weekly, null, false, true, "2026-06-01T00:00:00.000Z", NOW)?.kind).toBe("red");
  });

  it("not-yet-due is excluded from the coverage DENOMINATOR — it is not a gap in our watching", () => {
    const report = foldDashboard({
      roster: rosterOf([
        { ...def("brand-new", { kind: "periodic", periodSeconds: 7 * DAY, detail: "cron" }), definitionSince: "2026-08-21T20:18:00.000Z" },
        def("established", { kind: "on-change", detail: "push" }),
      ]),
      observations: [obs("established", { kind: "green" }, "2026-08-22T17:00:00.000Z")],
      now: NOW,
    });
    expect(report.counts["not-yet-due"]).toBe(1);
    expect(report.coverage.expected).toBe(1);
    expect(report.coverage.shortfall).toBe(0);
    expect(report.ok).toBe(true);
  });

  it("firstOpportunityPassed is a stated over-approximation: one full period, not a cron instant", () => {
    const weekly = { kind: "periodic", periodSeconds: 7 * DAY, detail: "cron" } as const;
    expect(firstOpportunityPassed(weekly, "2026-08-15T00:00:00.000Z", NOW).passed).toBe(true);
    expect(firstOpportunityPassed(weekly, "2026-08-17T00:00:00.000Z", NOW).passed).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// In-progress masking, and the dark lane.
// ───────────────────────────────────────────────────────────────────────────

describe("a running check ANNOTATES the last concluded verdict — it never overwrites it", () => {
  const inFlight = {
    inspected: 5, withoutVerdict: 4, newerThanVerdict: 4, newerSpanSeconds: 447, recheckInFlight: true, concluded: concluded([true]),
  } as const;

  it("gate's exact shape: RUNNING, cancelled, cancelled, RUNNING, failure — the row is RED", () => {
    const report = foldDashboard({
      roster: rosterOf([def("gate", { kind: "on-change", detail: "push to main" })]),
      observations: [{
        checkId: "gate",
        verdict: { kind: "red", detail: "run 4de7a4ee2 concluded 'failure'" },
        observedAt: "2026-08-22T17:31:02.000Z",
        source: "github-actions",
        trigger: "on-change",
        attempts: inFlight,
      }],
      now: NOW,
    });
    const row = rowFor(report, "gate");
    expect(row.verdict.kind).toBe("red");
    expect(row.recheckInFlight).toBe(true);
  });

  it("the annotation reaches the rendered row rather than staying in the data", async () => {
    const { renderMarkdown } = await import("./render.ts");
    const report = foldDashboard({
      roster: rosterOf([def("gate", { kind: "on-change", detail: "push" })]),
      observations: [{
        checkId: "gate", verdict: { kind: "red", detail: "failure" },
        observedAt: "2026-08-22T17:31:02.000Z", source: "s", trigger: "on-change", attempts: inFlight,
      }],
      now: NOW,
    });
    expect(renderMarkdown(report)).toContain("recheck in flight");
  });
});

describe("a dark lane is red — a check that keeps being killed is not passing", () => {
  it("tlaps-proof's shape: attempts pile up over weeks with nothing concluding", () => {
    const v = verdictForDarkLane(
      { inspected: 40, withoutVerdict: 33, newerThanVerdict: 12, newerSpanSeconds: 40 * DAY, recheckInFlight: false, concluded: concluded([true]) },
      DEFAULT_FOLD_CONFIG,
    );
    expect(v?.kind).toBe("red");
    expect(v?.kind === "red" && v.detail).toContain("DARK LANE");
  });

  it("gate's churn is NOT dark — the discriminator is SPAN, not count", () => {
    // gate is cancelled by its own concurrency group on ~88% of pushes (265/300
    // measured) and still concludes every few minutes. A count threshold would call it
    // dark and be muted inside a day.
    expect(verdictForDarkLane(
      { inspected: 20, withoutVerdict: 17, newerThanVerdict: 4, newerSpanSeconds: 447, recheckInFlight: true, concluded: concluded([true]) },
      DEFAULT_FOLD_CONFIG,
    )).toBeNull();
  });

  it("one inconclusive attempt is never dark, however old", () => {
    expect(verdictForDarkLane(
      { inspected: 20, withoutVerdict: 1, newerThanVerdict: 1, newerSpanSeconds: 30 * DAY, recheckInFlight: false, concluded: concluded([true]) },
      DEFAULT_FOLD_CONFIG,
    )).toBeNull();
  });

  it("no attempt information means no dark claim — absence of data is not evidence", () => {
    expect(verdictForDarkLane(undefined, DEFAULT_FOLD_CONFIG)).toBeNull();
  });

  it("dark outranks a stale green: 'nothing has concluded for weeks' beats whatever the old verdict said", () => {
    const report = foldDashboard({
      roster: rosterOf([{ ...def("tlaps-proof", { kind: "on-change", detail: "push" }), definitionSince: "2026-01-01T00:00:00.000Z" }]),
      observations: [{
        checkId: "tlaps-proof", verdict: { kind: "green" }, observedAt: "2026-07-01T00:00:00.000Z",
        source: "s", trigger: "on-change",
        attempts: { inspected: 40, withoutVerdict: 33, newerThanVerdict: 33, newerSpanSeconds: 52 * DAY, recheckInFlight: false, concluded: concluded([true]) },
      }],
      now: NOW,
    });
    expect(rowFor(report, "tlaps-proof").verdict.kind).toBe("red");
    expect(report.counts.green).toBe(0);
  });
});

describe("an empty roster is never OK — 0 of 0 must not render green", () => {
  it("no checks known and no producer is NOT a pass", () => {
    // Found 2026-08-22 while measuring the offline path on a fresh checkout: the
    // report read `OK — RED 0 · UNKNOWN 0 · coverage 0/0 · green 0`. That is the exact
    // vacuity this whole surface refuses, and the reason GitLabAdapter returns
    // `not-supported` rather than an empty roster.
    const report = foldDashboard({ roster: emptyRoster("main", NOW), observations: [], now: NOW });
    expect(report.coverage.known).toBe(0);
    expect(report.ok).toBe(false);
    expect(headline(report)).toContain("uninitialised, not clean");
  });

  it("says the roster is empty rather than reporting zeroes that look like health", () => {
    const h = headline(foldDashboard({ roster: emptyRoster("main", NOW), observations: [], now: NOW }));
    expect(h).toContain("NOT OK");
    expect(h).not.toContain("green 0");
  });

  it("one known and satisfied check IS ok — the guard is emptiness, not pessimism", () => {
    const report = foldDashboard({
      roster: rosterOf([def("only", { kind: "on-change", detail: "push" })]),
      observations: [obs("only", { kind: "green" }, "2026-08-22T17:00:00.000Z")],
      now: NOW,
    });
    expect(report.ok).toBe(true);
  });

  it("offline against a POPULATED roster is all-unknown and not ok — the correct offline answer", () => {
    const defs = Array.from({ length: 66 }, (_, i) => def(`c${i}`, { kind: "on-change", detail: "push" }));
    const report = foldDashboard({ roster: rosterOf(defs), observations: [], now: NOW });
    expect(report.counts.unknown).toBe(66);
    expect(report.counts.green).toBe(0);
    expect(report.coverage.shortfall).toBe(66);
    expect(report.ok).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Two instruments disagreed about the same repo on 2026-08-22 and BOTH were
// right. These are the falsifiers for the two mechanisms that caused it.
// ───────────────────────────────────────────────────────────────────────────

/** Concluded outcomes spaced one hour apart ending `agoSeconds` before NOW, newest first. */
function concluded(pattern: readonly boolean[], agoSeconds = 3600): readonly { at: string; passed: boolean }[] {
  const end = Date.parse(NOW) - agoSeconds * 1000;
  return pattern.map((passed, i) => ({ at: new Date(end - i * 3600_000).toISOString(), passed }));
}

function attempts(over: Partial<import("../forge-host/types.ts").AttemptSummary> = {}) {
  return {
    inspected: 20, withoutVerdict: 0, newerThanVerdict: 0, newerSpanSeconds: 0,
    recheckInFlight: false, concluded: concluded([true, true, true, true, true, true]), ...over,
  };
}

describe("FLAPPING — a lane whose next verdict is a coin flip has no colour", () => {
  it("build-ai-cluster-iso's exact shape: newest concluded passed, two of the last eight failed", () => {
    const report = foldDashboard({
      roster: rosterOf([def("build-ai-cluster-iso", { kind: "on-change", detail: "push to main" })]),
      observations: [{
        checkId: "build-ai-cluster-iso", verdict: { kind: "green" },
        observedAt: "2026-08-22T21:53:34.000Z", source: "github-actions", trigger: "on-change",
        attempts: attempts({ concluded: concluded([true, false, true, true, false, true, true, true]) }),
      }],
      now: NOW,
    });
    const row = rowFor(report, "build-ai-cluster-iso");
    expect(row.verdict.kind).toBe("flapping");
    expect(row.band).toBe("flapping");
    expect(report.counts.green).toBe(0);
    expect(report.ok).toBe(false);
  });

  it("says the MIX out loud — the number is the finding, not the colour", () => {
    const v = verdictForFlapping({ kind: "green" }, attempts({ concluded: concluded([true, false, true, true, false, true, true, true]) }), DEFAULT_FOLD_CONFIG, NOW);
    expect(v?.kind === "flapping" && v.detail).toContain("2 of 8 concluded runs failed");
  });

  it("one failure in twenty is a flake, not a flap — promoting every flake would bury the real ones", () => {
    expect(verdictForFlapping({ kind: "green" }, attempts({ concluded: concluded([true, false, ...Array<boolean>(18).fill(true)]) }), DEFAULT_FOLD_CONFIG, NOW)).toBeNull();
  });

  it("a clean history is not flapping", () => {
    expect(verdictForFlapping({ kind: "green" }, attempts({ concluded: concluded([true, true, true, true, true, true]) }), DEFAULT_FOLD_CONFIG, NOW)).toBeNull();
  });

  it("only applies when the newest verdict is GREEN — a red row is already actionable", () => {
    expect(verdictForFlapping({ kind: "red", detail: "x" }, attempts({ concluded: concluded([false, true, false, true, false, true, false, true, false]) }), DEFAULT_FOLD_CONFIG, NOW)).toBeNull();
  });

  it("no attempt data means no flapping claim — absence of evidence is not evidence", () => {
    expect(verdictForFlapping({ kind: "green" }, undefined, DEFAULT_FOLD_CONFIG, NOW)).toBeNull();
  });

  it("flapping ranks under red and above unknown, so it cannot hide among the greys", () => {
    const report = foldDashboard({
      roster: rosterOf([
        def("a-red", { kind: "on-change", detail: "push" }),
        def("b-flap", { kind: "on-change", detail: "push" }),
        def("c-unknown", { kind: "on-change", detail: "push" }),
        def("d-green", { kind: "on-change", detail: "push" }),
      ]),
      observations: [
        obs("a-red", { kind: "red", detail: "x" }, "2026-08-22T17:00:00.000Z"),
        { checkId: "b-flap", verdict: { kind: "green" }, observedAt: "2026-08-22T17:00:00.000Z", source: "s", trigger: "on-change", attempts: attempts({ concluded: concluded([true, false, true, false, true, false, true, true]) }) },
        obs("d-green", { kind: "green" }, "2026-08-22T17:00:00.000Z"),
      ],
      now: NOW,
    });
    expect(report.rows.map((r) => r.checkId)).toEqual(["a-red", "b-flap", "c-unknown", "d-green"]);
  });
});

describe("SUPERSEDING EVIDENCE — the scheduled verdict stands, and the dispatch is shown", () => {
  const weekly = { kind: "periodic", periodSeconds: 7 * DAY, detail: "schedule: '0 9 * * 0'" } as const;

  function cadenceRow() {
    return foldDashboard({
      roster: rosterOf([{ ...def("budget-snapshot-cadence", weekly), definitionSince: "2026-05-01T00:00:00.000Z" }]),
      observations: [{
        checkId: "budget-snapshot-cadence",
        verdict: { kind: "red", detail: "run 31959534906 concluded 'failure'" },
        observedAt: "2026-08-16T09:00:00.000Z",
        source: "github-actions",
        trigger: "periodic",
        supersededBy: {
          verdict: { kind: "green" },
          observedAt: "2026-08-22T17:32:00.000Z",
          trigger: "on-request",
          detail: "a later workflow_dispatch run concluded 'green'",
        },
      }],
      now: NOW,
    });
  }

  it("a manual dispatch does NOT clear a scheduled lane's red — that would be a snooze button", () => {
    // Anyone could clear any red by dispatching manually. The scheduled path is what
    // the check DECLARES, and a hand-run proves the code, not the cadence.
    expect(rowFor(cadenceRow(), "budget-snapshot-cadence").verdict.kind).toBe("red");
  });

  it("but the dispatch IS carried, so the other instrument's answer is visible in the same row", () => {
    const row = rowFor(cadenceRow(), "budget-snapshot-cadence");
    expect(row.supersededBy?.verdict.kind).toBe("green");
    expect(row.supersededBy?.observedAt).toBe("2026-08-22T17:32:00.000Z");
  });

  it("and the rendered row SAYS the verdict is about the scheduled path, not the current one", async () => {
    const { renderMarkdown } = await import("./render.ts");
    const md = renderMarkdown(cadenceRow());
    expect(md).toContain("awaiting scheduled confirmation");
    expect(md).toContain("DECLARED (scheduled) path");
    expect(md).toContain("clears when the next scheduled run passes");
  });

  it("a check with no superseding evidence renders no such claim", async () => {
    const { renderMarkdown } = await import("./render.ts");
    const md = renderMarkdown(foldDashboard({
      roster: rosterOf([def("plain", { kind: "on-change", detail: "push" })]),
      observations: [obs("plain", { kind: "red", detail: "failure" }, "2026-08-22T17:00:00.000Z")],
      now: NOW,
    }));
    expect(md).not.toContain("awaiting scheduled confirmation");
  });
});

describe("a MAJORITY of failures is red, not flapping — the split the first live pass forced", () => {
  it("pr-manifest-integrity's shape (15 of 20 failed) is RED — the newest pass is the outlier", () => {
    const v = verdictForFlapping({ kind: "green" }, attempts({ concluded: concluded([true, false, false, false, false, true, false, false, false, false, true, false, false, false, false, true, false, false, false, true]) }), DEFAULT_FOLD_CONFIG, NOW);
    expect(v?.kind).toBe("red");
    expect(v?.kind === "red" && v.detail).toContain("MOSTLY FAILING");
    expect(v?.kind === "red" && v.detail).toContain("15 of 20 concluded runs failed");
  });

  it("agencysignature-enforcement's shape (2 of 20 failed) stays FLAPPING", () => {
    const v = verdictForFlapping({ kind: "green" }, attempts({ concluded: concluded([true, false, true, true, false, ...Array<boolean>(15).fill(true)]) }), DEFAULT_FOLD_CONFIG, NOW);
    expect(v?.kind).toBe("flapping");
  });

  it("an exact tie is flapping, not red — a majority means MORE, and a coin flip is what flapping is", () => {
    expect(verdictForFlapping({ kind: "green" }, attempts({ concluded: concluded([true, false, true, false, true, false, true, false, true, false]) }), DEFAULT_FOLD_CONFIG, NOW)?.kind).toBe("flapping");
  });

  it("the two bands stay separable, so one cannot bury the other", () => {
    const report = foldDashboard({
      roster: rosterOf([
        def("mostly-broken", { kind: "on-change", detail: "push" }),
        def("occasionally-flaky", { kind: "on-change", detail: "push" }),
      ]),
      observations: [
        { checkId: "mostly-broken", verdict: { kind: "green" }, observedAt: "2026-08-22T17:00:00.000Z", source: "s", trigger: "on-change", attempts: attempts({ concluded: concluded([true, false, false, false, false, true, false, false, false, false, true, false, false, false, false, true, false, false, false, true]) }) },
        { checkId: "occasionally-flaky", verdict: { kind: "green" }, observedAt: "2026-08-22T17:00:00.000Z", source: "s", trigger: "on-change", attempts: attempts({ concluded: concluded([true, false, true, true, false, ...Array<boolean>(15).fill(true)]) }) },
      ],
      now: NOW,
    });
    expect(report.counts.red).toBe(1);
    expect(report.counts.flapping).toBe(1);
    expect(report.rows[0]?.checkId).toBe("mostly-broken");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// The rate rule shipped TIME-BLIND and produced two false positives on its
// first day. Both are fixtures now, by name, with their real timestamps.
// ───────────────────────────────────────────────────────────────────────────

/** Concluded outcomes at explicit ISO times, newest first. */
function at(entries: readonly (readonly [string, boolean])[]) {
  return entries.map(([iso, passed]) => ({ at: iso, passed }));
}

describe("a failure rate is only a finding over a window that describes the PRESENT", () => {
  it("vocab-hygiene: 12 of 20 failed, every failure from JUNE, passing since 2026-06-10 — NOT red", () => {
    // The lane broke, was fixed, and has passed every run since. A 20-run window on a
    // rarely-run workflow still reached back two months, and the old incident dominated
    // the verdict permanently: passing runs arrive too slowly to dilute it.
    const june = Array.from({ length: 12 }, (_, i) => [`2026-06-09T${String(9 + (i % 12)).padStart(2, "0")}:05:46.000Z`, false] as const);
    const since = [
      ["2026-08-11T02:39:23.000Z", true], ["2026-07-20T02:39:23.000Z", true],
      ["2026-07-01T02:39:23.000Z", true], ["2026-06-20T02:39:23.000Z", true],
    ] as const;
    const v = verdictForFlapping(
      { kind: "green" },
      attempts({ concluded: at([...since, ...june]) }),
      DEFAULT_FOLD_CONFIG,
      NOW,
    );
    expect(v).toBeNull();
  });

  it("agent-proposal-gated-commit: 2 of 3 failed, all three runs within an hour on 08-17 — NOT red", () => {
    // Its entire history is failure, failure, success inside about an hour. That is a
    // fix landing. It was still reported RED five days later.
    const v = verdictForFlapping(
      { kind: "green" },
      attempts({ concluded: at([
        ["2026-08-17T14:41:00.000Z", true],
        ["2026-08-17T14:02:00.000Z", false],
        ["2026-08-17T13:38:00.000Z", false],
      ]) }),
      DEFAULT_FOLD_CONFIG,
      NOW,
    );
    expect(v).toBeNull();
  });

  it("gate SURVIVES the bound: 7 of 11 failed, all within hours — still RED", () => {
    // The thing the rule was built for, and the check that it did not get bounded into
    // uselessness. Every one of these is from the same evening.
    const v = verdictForFlapping(
      { kind: "green" },
      attempts({ concluded: concluded([true, false, false, true, false, false, true, false, false, true, false], 60) }),
      DEFAULT_FOLD_CONFIG,
      NOW,
    );
    expect(v?.kind).toBe("red");
    expect(v?.kind === "red" && v.detail).toContain("MOSTLY FAILING");
  });

  it("build-ai-cluster-iso SURVIVES the bound: interleaved today — still FLAPPING", () => {
    const v = verdictForFlapping(
      { kind: "green" },
      attempts({ concluded: concluded([true, false, true, true, false, true, true, true], 60) }),
      DEFAULT_FOLD_CONFIG,
      NOW,
    );
    expect(v?.kind).toBe("flapping");
  });

  it("too few concluded runs inside the window is insufficient data, never a verdict", () => {
    const w = rateWindow(attempts({ concluded: concluded([true, false, false], 60) }), NOW, DEFAULT_FOLD_CONFIG);
    expect(w?.sufficient).toBe(false);
    expect(verdictForFlapping({ kind: "green" }, attempts({ concluded: concluded([true, false, false], 60) }), DEFAULT_FOLD_CONFIG, NOW)).toBeNull();
  });

  it("and insufficient data does NOT become green — the row keeps its own latest verdict", () => {
    const report = foldDashboard({
      roster: rosterOf([def("thin", { kind: "on-change", detail: "push" })]),
      observations: [{
        checkId: "thin", verdict: { kind: "red", detail: "newest run failed" },
        observedAt: "2026-08-22T17:00:00.000Z", source: "s", trigger: "on-change",
        attempts: attempts({ concluded: concluded([false, true], 60) }),
      }],
      now: NOW,
    });
    expect(rowFor(report, "thin").verdict.kind).toBe("red");
  });
});

describe("recency can clear a rate finding — a streak, not merely 'the newest run passed'", () => {
  it("a sustained pass streak since the last failure clears it", () => {
    const v = verdictForFlapping(
      { kind: "green" },
      attempts({ concluded: concluded([true, true, true, true, true, false, false, false, false], 60) }),
      DEFAULT_FOLD_CONFIG,
      NOW,
    );
    expect(v).toBeNull();
  });

  it("ONE pass after four failures is not a streak and does NOT clear it", () => {
    // The first version of this rule defined recovery as "every failure predates the
    // newest pass" — true of ANY lane whose most recent run passed, and since the rate
    // rules only run when the newest verdict is green, that nullified the entire rule.
    // Four of its own tests went red and caught it.
    const v = verdictForFlapping(
      { kind: "green" },
      attempts({ concluded: concluded([true, false, false, false, false, true, true], 60) }),
      DEFAULT_FOLD_CONFIG,
      NOW,
    );
    expect(v?.kind).toBe("red");
  });

  it("the streak is counted from the newest end, and stops at the first failure", () => {
    const w = rateWindow(attempts({ concluded: concluded([true, true, false, true, true, true, true], 60) }), NOW, DEFAULT_FOLD_CONFIG);
    expect(w?.passStreak).toBe(2);
  });
});

describe("the window is PRINTED, so a reader can judge without re-deriving it", () => {
  it("names the counts, the span, and the streak", () => {
    const w = rateWindow(attempts({ concluded: concluded([true, false, false, true, true, false], 60) }), NOW, DEFAULT_FOLD_CONFIG);
    const text = describeWindow(w!);
    expect(text).toContain("3 of 6 concluded runs failed");
    expect(text).toContain("consecutive pass(es) since the last failure");
    expect(text).toMatch(/2026-08-\d\dT/);
  });

  it("the rendered RED row carries the window — this is what would have stopped a false relay", async () => {
    const { renderMarkdown } = await import("./render.ts");
    const md = renderMarkdown(foldDashboard({
      roster: rosterOf([def("gate", { kind: "on-change", detail: "push" })]),
      observations: [{
        checkId: "gate", verdict: { kind: "green" }, observedAt: "2026-08-22T17:55:00.000Z",
        source: "s", trigger: "on-change",
        attempts: attempts({ concluded: concluded([true, false, false, true, false, false, true, false, false, true, false], 60) }),
      }],
      now: NOW,
    }));
    expect(md).toContain("MOSTLY FAILING over 7d");
    expect(md).toContain("concluded runs failed");
  });

  it("an empty window says so rather than reporting a rate of nothing", () => {
    const w = rateWindow(attempts({ concluded: at([["2026-01-01T00:00:00.000Z", false]]) }), NOW, DEFAULT_FOLD_CONFIG);
    expect(w?.considered).toHaveLength(0);
    expect(describeWindow(w!)).toContain("no concluded runs inside the rate window");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// FALSIFIER: A BLIND PASS MUST NOT RENDER ITS OWN BLINDNESS AS RED.
//
// The inverted vacuity class. A check that cannot fail is the familiar defect; a check
// that reports THE WORLD IS BROKEN when only its own credential is, is the dangerous
// one — it is believed, then distrusted, then ignored.
//
// Reproduced from the live incident (2026-08-27, drift-dashboard run 17): the producer
// could not authenticate, zero observations came back, and every row fell through to
// `verdictForAbsence`. Twelve lanes were published RED / "STALE: newest verdict is 9h
// old" while four sampled lanes had each run successfully within the hour.
//
// The pass must still FAIL — it learned nothing, and `unknown` is not OK. What it must
// not do is convert its own silence into an accusation against the lanes.
// ───────────────────────────────────────────────────────────────────────────

function detailOf(v: { readonly kind: string } & { detail?: string }): string {
  return v.detail ?? "";
}

describe("a source that could not be asked", () => {
  const stale = rosterOf([def("nightly", { kind: "periodic", periodSeconds: 900, detail: "*/15 * * * *" })]);
  const seen = recordObservations(stale, new Map([
    ["nightly", { observedAt: "2026-08-22T09:00:00.000Z", kind: "green" as const, viaDeclaredTrigger: true }],
  ]));

  it("renders RED when the silence is genuinely the LANE's", () => {
    const report = foldDashboard({ roster: seen, observations: [], now: NOW });
    expect(rowFor(report, "nightly").band).toBe("red");
    expect(detailOf(rowFor(report, "nightly").verdict)).toContain("STALE");
  });

  it("renders UNKNOWN when the silence is OURS — same roster, same clock", () => {
    const report = foldDashboard({
      roster: seen,
      observations: [],
      sourceErrors: ["test-source: could not enumerate check definitions: auth-failure: …"],
      blindSources: ["test-source"],
      now: NOW,
    });
    const row = rowFor(report, "nightly");
    expect(row.band).toBe("unknown");
    expect(detailOf(row.verdict)).toContain("the silence is OURS");
    // Not softened into a pass: nothing was learned, so the report is not OK.
    expect(report.ok).toBe(false);
    expect(report.counts.red).toBe(0);
  });

  it("only blinds the sources that actually failed", () => {
    const two = rosterOf([
      def("a", { kind: "periodic", periodSeconds: 900, detail: "*/15 * * * *" }, "source-a"),
      def("b", { kind: "periodic", periodSeconds: 900, detail: "*/15 * * * *" }, "source-b"),
    ]);
    const withHistory = recordObservations(two, new Map([
      ["a", { observedAt: "2026-08-22T09:00:00.000Z", kind: "green" as const, viaDeclaredTrigger: true }],
      ["b", { observedAt: "2026-08-22T09:00:00.000Z", kind: "green" as const, viaDeclaredTrigger: true }],
    ]));
    const report = foldDashboard({
      roster: withHistory, observations: [], blindSources: ["source-a"], now: NOW,
    });
    expect(rowFor(report, "a").band).toBe("unknown");
    expect(rowFor(report, "b").band).toBe("red");
  });
});
