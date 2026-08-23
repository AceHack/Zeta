// Falsifiers for audit-archive-pr-lane.ts.
//
// The case that generated this file is REPLAYED verbatim below (§THE MEASURED
// CASE): PR #13843 archiving source #12059, whose record landed on main from a
// competing writer while #13843 was open. If the audit stops catching that, a
// test fails.

import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ARCHIVE_BRANCH_PREFIX,
  auditArchiveLane,
  classifyArchivePr,
  DEFAULT_GRACE_MINUTES,
  indexArchivedPrs,
  parseSourcePr,
  type OpenArchivePr,
} from "./audit-archive-pr-lane.ts";

const NOW = new Date("2026-08-22T21:00:00Z");

function pr(number: number, headRef: string, createdAt: string): OpenArchivePr {
  return { number, headRef, createdAt };
}

describe("parseSourcePr", () => {
  it("extracts the source PR from a real archive branch", () => {
    expect(parseSourcePr("automation/pr-archive-12059-run-32589658743-attempt-1")).toBe(12059);
  });

  it("declines non-archive branches rather than guessing", () => {
    // Fail-closed: an unparseable branch is OUT OF SCOPE, never a silent 0.
    // A 0 here would classify unrelated PRs against source-PR 0 and could
    // report someone's feature branch as a stranded archive.
    expect(parseSourcePr("heartbeat/tick-metrics")).toBeNull();
    expect(parseSourcePr("feat/some-real-work")).toBeNull();
    expect(parseSourcePr("claim/archive-pr-999")).toBeNull();
  });

  it("declines an archive-prefixed branch with no parseable run segment", () => {
    expect(parseSourcePr(`${ARCHIVE_BRANCH_PREFIX}notanumber-run-1`)).toBeNull();
    expect(parseSourcePr(`${ARCHIVE_BRANCH_PREFIX}12059`)).toBeNull();
  });
});

describe("indexArchivedPrs", () => {
  it("indexes PR-NNNN-*.md and strips leading zeros", () => {
    const dir = mkdtempSync(join(tmpdir(), "arch-idx-"));
    writeFileSync(join(dir, "PR-12059-feat-core-ihara-zeta.md"), "x");
    writeFileSync(join(dir, "PR-0999-some-older-pr.md"), "x");
    writeFileSync(join(dir, "README.md"), "x");

    const idx = indexArchivedPrs(dir);
    expect(idx.has(12059)).toBe(true);
    // Padded and unpadded filenames must index to the SAME number, so a record
    // is never read as absent because of zero-padding. (parseInt does this work,
    // not the `0*` in the regex — verified by mutation: dropping `0*` keeps this
    // green. The assertion pins the BEHAVIOUR, which is what matters, rather
    // than a mechanism that turned out to be redundant.)
    expect(idx.has(999)).toBe(true);
    // README.md and anything else non-matching must not enter the index; an
    // over-broad index would mark real pending PRs as already-archived and
    // recommend closing records that were never preserved.
    expect(idx.size).toBe(2);
    expect(idx.has(0)).toBe(false);
  });
});

describe("classifyArchivePr", () => {
  it("reports pending when the record is NOT yet on main", () => {
    const f = classifyArchivePr(
      pr(13937, "automation/pr-archive-13836-run-1-attempt-1", "2026-08-22T20:59:39Z"),
      new Set<number>([12059]),
      NOW,
    );
    expect(f?.verdict).toBe("pending");
    expect(f?.sourcePr).toBe(13836);
  });

  it("returns null for a branch outside the lane", () => {
    expect(classifyArchivePr(pr(1, "heartbeat/society", "2026-08-22T20:00:00Z"), new Set(), NOW)).toBeNull();
  });

  it("calls a fresh duplicate RACING, not stranded", () => {
    // 10 minutes old: the two writers legitimately overlap here. Failing on
    // this would make the audit flap during healthy operation.
    const f = classifyArchivePr(
      pr(1, "automation/pr-archive-12059-run-1-attempt-1", "2026-08-22T20:50:00Z"),
      new Set<number>([12059]),
      NOW,
    );
    expect(f?.verdict).toBe("redundant-racing");
  });

  it("calls an old duplicate STRANDED", () => {
    const f = classifyArchivePr(
      pr(1, "automation/pr-archive-12059-run-1-attempt-1", "2026-08-22T18:05:23Z"),
      new Set<number>([12059]),
      NOW,
    );
    expect(f?.verdict).toBe("redundant-stranded");
  });

  it("is a pure function of injected time — no ambient clock", () => {
    const p = pr(1, "automation/pr-archive-12059-run-1-attempt-1", "2026-08-22T18:05:23Z");
    const set = new Set<number>([12059]);
    // Same evidence, earlier phase -> still inside the grace window.
    expect(classifyArchivePr(p, set, new Date("2026-08-22T18:30:00Z"))?.verdict).toBe("redundant-racing");
    // Same evidence, later phase -> stranded. The verdict moves ONLY with the
    // injected clock, so two runs against one tree never disagree.
    expect(classifyArchivePr(p, set, new Date("2026-08-22T21:00:00Z"))?.verdict).toBe("redundant-stranded");
  });

  it("respects the grace window boundary exactly", () => {
    const p = pr(1, "automation/pr-archive-12059-run-1-attempt-1", "2026-08-22T20:00:00Z");
    const set = new Set<number>([12059]);
    // Exactly DEFAULT_GRACE_MINUTES old is NOT past the window (strict >).
    expect(DEFAULT_GRACE_MINUTES).toBe(60);
    expect(classifyArchivePr(p, set, NOW)?.verdict).toBe("redundant-racing");
    expect(classifyArchivePr(p, set, new Date("2026-08-22T21:00:01Z"))?.verdict).toBe("redundant-stranded");
  });
});

describe("auditArchiveLane — liveness floor", () => {
  it("refuses to pass on an empty index even with zero open PRs", () => {
    // "Checked 0 records" must never read as success. An empty index means
    // the lookup is broken; a clean lane and a broken lookup produce the same
    // empty finding list, and only this flag separates them.
    const r = auditArchiveLane([], new Set<number>(), NOW);
    expect(r.live).toBe(false);
  });

  it("passes live with a real index and a caught-up lane", () => {
    const r = auditArchiveLane([], new Set<number>([12059]), NOW);
    expect(r.live).toBe(true);
    expect(r.stranded).toHaveLength(0);
  });
});

describe("THE MEASURED CASE — PR #13843 / source #12059, 2026-08-22", () => {
  // Replayed from the live incident. #13843 was opened by the event lane at
  // 18:05:23Z from a base without the record; the backfill lane's copy of the
  // SAME record landed on main at 18:25:04Z. From then on #13843 could only
  // ever merge a duplicate — its markdown was byte-identical to main's and its
  // shard was strictly staler (fetched_at 18:05:19Z vs main's 18:08:40Z).
  //
  // Nothing detected it. It was armed, so the heartbeat's arming step skipped
  // it (auto_merge != null); --auto cannot merge a CONFLICTING PR; no reaper
  // existed. It sat open for ~3 hours until a human looked.
  const openPrs: OpenArchivePr[] = [
    pr(13843, "automation/pr-archive-12059-run-32589658743-attempt-1", "2026-08-22T18:05:23Z"),
    pr(13937, "automation/pr-archive-13836-run-32598254450-attempt-1", "2026-08-22T20:59:39Z"),
    pr(13915, "heartbeat/tick-metrics", "2026-08-22T20:24:15Z"),
  ];
  // main already holds #12059's record; it does NOT yet hold #13836's.
  const archivedOnMain = new Set<number>([12059]);

  it("catches #13843 as stranded", () => {
    const r = auditArchiveLane(openPrs, archivedOnMain, NOW);
    expect(r.live).toBe(true);
    expect(r.stranded.map((f) => f.prNumber)).toEqual([13843]);
    expect(r.stranded[0]!.sourcePr).toBe(12059);
  });

  it("does NOT flag the genuinely-pending archive PR", () => {
    const r = auditArchiveLane(openPrs, archivedOnMain, NOW);
    const pending = r.findings.filter((f) => f.verdict === "pending");
    expect(pending.map((f) => f.prNumber)).toEqual([13937]);
  });

  it("ignores the heartbeat PR entirely — it is not this lane", () => {
    const r = auditArchiveLane(openPrs, archivedOnMain, NOW);
    expect(r.findings.map((f) => f.prNumber)).toEqual([13843, 13937]);
  });

  it("goes quiet once #13843 is closed — the fix is observable", () => {
    // The falsifier for the falsifier: after the close, the same tree and the
    // same index must produce zero stranded. A check that stays red after the
    // repair is not measuring the repair.
    const afterClose = openPrs.filter((p) => p.number !== 13843);
    const r = auditArchiveLane(afterClose, archivedOnMain, NOW);
    expect(r.stranded).toHaveLength(0);
    expect(r.live).toBe(true);
  });
});
