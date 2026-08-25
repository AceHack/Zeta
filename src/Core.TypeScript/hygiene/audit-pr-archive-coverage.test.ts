// Falsifiers for audit-pr-archive-coverage.ts and archive-eligibility.ts.
//
// THE MEASURED CASE IS REPLAYED VERBATIM (§THE MEASURED BREAK). If the audit
// stops catching the 2026-08-21 collapse — 926 eligible PRs unarchived because
// their merges were performed with GITHUB_TOKEN and therefore fired no
// `pull_request` event — a test here fails.
//
// Every threshold test is written as a PAIR: one case above the floor and one
// below it. A single-sided test on a threshold is the vacuity class, because it
// passes just as happily against a check that always returns ok.

import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { classifyGap, EVENT_LANE_LANDED, isArchiveEligible } from "../forge-host/github/archive-eligibility.ts";
import {
  computeCoverage,
  DEFAULT_GRACE_MINUTES,
  DEFAULT_THRESHOLDS,
  judge,
  readArchivedPrNumbers,
  type MergedPr,
} from "./audit-pr-archive-coverage.ts";

const NOW = new Date("2026-08-25T12:00:00Z");
const GRACE_MS = DEFAULT_GRACE_MINUTES * 60_000;

function pr(number: number, mergedAt: string, headRefName: string): MergedPr {
  return { number, mergedAt, headRefName };
}

describe("isArchiveEligible", () => {
  it("excludes the lane's own bookkeeping branches", () => {
    // These are the two prefixes pr-archive-on-merge.yml's `if:` skips. If this
    // drifts from the workflow, the coverage denominator stops matching what the
    // lane actually promises to do.
    expect(isArchiveEligible({ headRefName: "automation/pr-archive-13010-run-32434744124-attempt-1" })).toBe(false);
    expect(isArchiveEligible({ headRefName: "claim/archive-pr-9059" })).toBe(false);
  });

  it("includes ordinary and heartbeat branches", () => {
    expect(isArchiveEligible({ headRefName: "heartbeat/tick-metrics" })).toBe(true);
    expect(isArchiveEligible({ headRefName: "fix/lane-ref-leak-at-source" })).toBe(true);
    expect(isArchiveEligible({ headRefName: "dependabot/npm_and_yarn/x" })).toBe(true);
  });

  it("does NOT exclude a FORK branch that merely shares the prefix", () => {
    // The workflow's `if:` conjoins the prefix test with
    // `head.repo.full_name == github.repository`. A contributor whose fork
    // happens to use our automation prefix is submitting real work, and dropping
    // it from the denominator would let a whole class of PR go unarchived while
    // coverage still read 100%.
    expect(
      isArchiveEligible({
        headRefName: "automation/pr-archive-1-run-2-attempt-1",
        headRepoIsSameRepo: false,
      }),
    ).toBe(true);
  });
});

describe("classifyGap", () => {
  it("returns null for an archived PR — nothing to classify", () => {
    expect(
      classifyGap({ headRefName: "x", mergedAt: "2026-08-01T00:00:00Z", isArchived: true }, NOW, GRACE_MS),
    ).toBeNull();
  });

  it("separates the three populations the measurement found", () => {
    const un = (mergedAt: string, headRefName: string) => ({ headRefName, mergedAt, isArchived: false });
    // A: excluded by design
    expect(classifyGap(un("2026-08-21T01:00:00Z", "automation/pr-archive-13010-run-1-attempt-1"), NOW, GRACE_MS)).toBe(
      "excluded",
    );
    // B: predates the event lane (workflow landed 2026-05-06)
    expect(classifyGap(un("2026-04-24T10:00:00Z", "feat/whatever"), NOW, GRACE_MS)).toBe("pre-lane");
    // C: the real defect
    expect(classifyGap(un("2026-08-21T01:06:00Z", "heartbeat/society"), NOW, GRACE_MS)).toBe("missing");
  });

  it("puts the boundary exactly at the day the workflow landed, not near it", () => {
    const un = (mergedAt: string) => ({ headRefName: "feat/x", mergedAt, isArchived: false });
    expect(classifyGap(un("2026-05-05T23:59:59Z"), NOW, GRACE_MS)).toBe("pre-lane");
    // Same day the workflow landed: the lane existed, so this is a real gap.
    expect(classifyGap(un(`${EVENT_LANE_LANDED}T00:00:01Z`), NOW, GRACE_MS)).toBe("missing");
  });

  it("holds a fresh merge as in-flight and reports it once the grace expires", () => {
    const un = (mergedAt: string) => ({ headRefName: "heartbeat/society", mergedAt, isArchived: false });
    const justNow = new Date(NOW.getTime() - 5 * 60_000).toISOString();
    const stale = new Date(NOW.getTime() - GRACE_MS - 60_000).toISOString();
    expect(classifyGap(un(justNow), NOW, GRACE_MS)).toBe("in-flight");
    // The grace window bounds how long a defect is invisible, never whether it
    // is eventually seen. If this ever returns "in-flight", the window has
    // become a loophole.
    expect(classifyGap(un(stale), NOW, GRACE_MS)).toBe("missing");
  });

  it("treats an unparseable merge date as MISSING, never as fresh", () => {
    // Fail-closed. A date we cannot read must not park a record in the grace
    // window forever, which is how a lost record would hide permanently.
    expect(classifyGap({ headRefName: "feat/x", mergedAt: "not-a-date", isArchived: false }, NOW, GRACE_MS)).toBe(
      "missing",
    );
  });
});

describe("computeCoverage", () => {
  it("excludes bookkeeping PRs from BOTH denominators", () => {
    const merged = [
      pr(1, "2026-08-20T00:00:00Z", "feat/a"),
      pr(2, "2026-08-20T00:00:00Z", "automation/pr-archive-1-run-1-attempt-1"),
    ];
    const r = computeCoverage(merged, new Set([1]), NOW);
    // One eligible PR, archived. The unarchived bookkeeping PR must not drag
    // coverage to 50% — it was never in scope.
    expect(r.lifetime).toEqual({ eligible: 1, archived: 1, coverage: 1 });
    expect(r.counts.excluded).toBe(1);
    expect(r.missing).toEqual([]);
  });

  it("counts pre-lane PRs as unarchived in LIFETIME but keeps them out of the WINDOW", () => {
    const merged = [
      pr(1, "2026-04-24T00:00:00Z", "feat/old"), // pre-lane, unarchived
      pr(2, "2026-08-20T00:00:00Z", "feat/new"), // in window, archived
    ];
    const r = computeCoverage(merged, new Set([2]), NOW);
    // Lifetime tells the truth about the corpus: we do NOT have PR 1.
    expect(r.lifetime).toEqual({ eligible: 2, archived: 1, coverage: 0.5 });
    // The window answers "is the lane working now", and the lane cannot be
    // blamed for a PR that merged before it existed.
    expect(r.window).toEqual({ eligible: 1, archived: 1, coverage: 1 });
    expect(r.counts["pre-lane"]).toBe(1);
  });

  it("keeps in-flight records out of the window denominator entirely", () => {
    const fresh = new Date(NOW.getTime() - 10 * 60_000).toISOString();
    const r = computeCoverage(
      [pr(1, "2026-08-20T00:00:00Z", "feat/a"), pr(2, fresh, "heartbeat/society")],
      new Set([1]),
      NOW,
    );
    // Counting the in-flight one as a failure would make the audit flap on
    // healthy operation at the busiest moments.
    expect(r.window).toEqual({ eligible: 1, archived: 1, coverage: 1 });
    expect(r.counts["in-flight"]).toBe(1);
  });

  it("reports coverage as null rather than 1.0 when nothing is eligible", () => {
    // 0/0 is not perfect coverage. This is the distinction the liveness check
    // depends on, so it is pinned here rather than only at the judge layer.
    const r = computeCoverage([], new Set(), NOW);
    expect(r.lifetime.coverage).toBeNull();
    expect(r.window.coverage).toBeNull();
  });
});

describe("§THE MEASURED BREAK — 2026-08-21, GITHUB_TOKEN merges fire no event", () => {
  // Reconstructed at the ratio actually measured over 2026-08-21..25:
  // 765 eligible PRs unarchived against 539 archived = 42.9% coverage.
  function window(coveredFrac: number, n = 200): { merged: MergedPr[]; archived: Set<number> } {
    const merged: MergedPr[] = [];
    const archived = new Set<number>();
    const mergedAt = new Date(NOW.getTime() - 2 * 86_400_000).toISOString();
    for (let i = 1; i <= n; i += 1) {
      merged.push(pr(i, mergedAt, i % 2 === 0 ? "heartbeat/society" : "feat/work"));
      if (i <= Math.round(n * coveredFrac)) archived.add(i);
    }
    return { merged, archived };
  }

  it("FAILS at the coverage the break actually ran at", () => {
    const { merged, archived } = window(0.429);
    const v = judge(computeCoverage(merged, archived, NOW), DEFAULT_THRESHOLDS);
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error("unreachable");
    expect(v.code).toBe(1);
    // The message must point at the mechanism, not just at the number — the
    // whole cost of this incident was four days of nobody knowing where to look.
    expect(v.lines.join("\n")).toContain("GITHUB_TOKEN");
  });

  it("PASSES on a healthy lane — the check discriminates, it does not just fail", () => {
    const { merged, archived } = window(0.99);
    expect(judge(computeCoverage(merged, archived, NOW), DEFAULT_THRESHOLDS).ok).toBe(true);
  });

  it("brackets the window floor from both sides", () => {
    expect(
      judge(computeCoverage(...(Object.values(window(0.96)) as [MergedPr[], Set<number>]), NOW), DEFAULT_THRESHOLDS).ok,
    ).toBe(true);
    expect(
      judge(computeCoverage(...(Object.values(window(0.9)) as [MergedPr[], Set<number>]), NOW), DEFAULT_THRESHOLDS).ok,
    ).toBe(false);
  });
});

describe("judge — liveness", () => {
  it("exits 2, NOT 0, when nothing was inspected", () => {
    // "checked 0 PRs" must never read as success. An empty shard index or a
    // broken listing is a check that did not run, and a check that did not run
    // reading as green is the failure this subsystem keeps re-producing.
    const v = judge(computeCoverage([], new Set(), NOW), DEFAULT_THRESHOLDS);
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error("unreachable");
    expect(v.code).toBe(2);
    expect(v.lines.join("\n")).toContain("LIVENESS FAILURE");
  });

  it("fails on lifetime alone even when the window is perfect", () => {
    // The two thresholds answer different questions and must be independently
    // able to fail; otherwise one of them is decorative.
    const merged: MergedPr[] = [];
    const archived = new Set<number>();
    for (let i = 1; i <= 100; i += 1) {
      merged.push(pr(i, "2026-04-20T00:00:00Z", "feat/old")); // all pre-lane, none archived
    }
    merged.push(pr(999, "2026-08-20T00:00:00Z", "feat/new"));
    archived.add(999);
    const v = judge(computeCoverage(merged, archived, NOW), DEFAULT_THRESHOLDS);
    expect(v.ok).toBe(false);
    expect(v.lines.join("\n")).toContain("LIFETIME");
    // ...and the window really is clean, so this is not just "everything fails".
    expect(computeCoverage(merged, archived, NOW).window.coverage).toBe(1);
  });
});

describe("readArchivedPrNumbers", () => {
  it("reads pr_number out of the shard store and ignores non-shards", () => {
    const root = mkdtempSync(join(tmpdir(), "shards-"));
    mkdirSync(join(root, "013"));
    writeFileSync(join(root, "013", "aaaa.json"), JSON.stringify({ pr_number: 13010 }));
    writeFileSync(join(root, "013", "README.md"), "not a shard");
    expect([...readArchivedPrNumbers(root)]).toEqual([13010]);
  });

  it("does NOT count a corrupt shard as archived", () => {
    // Fail-closed: a record we cannot read is a record we do not have. Counting
    // it would let corruption RAISE the coverage number, which is the worst
    // possible direction for a data-ownership metric to be wrong in.
    const root = mkdtempSync(join(tmpdir(), "shards-"));
    mkdirSync(join(root, "013"));
    writeFileSync(join(root, "013", "bad.json"), "{ this is not json");
    writeFileSync(join(root, "013", "nonum.json"), JSON.stringify({ pr_number: "13010" }));
    expect(readArchivedPrNumbers(root).size).toBe(0);
  });

  it("returns empty rather than throwing when the store is absent", () => {
    // The liveness check in `judge` is what turns this into a failure. Throwing
    // here would produce an unhandled crash instead of the diagnosable exit 2.
    expect(readArchivedPrNumbers(join(tmpdir(), "definitely-not-a-shard-root-xyz")).size).toBe(0);
  });
});
