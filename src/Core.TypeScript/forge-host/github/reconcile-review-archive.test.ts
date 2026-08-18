// reconcile-review-archive.test.ts — the falsifier for the merge-time archive race.
//
// WHAT THESE TESTS ARE FOR. The bug being fixed (081M08MVPR9087G0R000NCF8PV) is a SILENT
// data loss: the archive records `| Total threads | 0 |` and nothing downstream can tell
// that apart from "there were none". So every test here is written to fail when the fix
// stops working, not to confirm that it currently does. Two properties get the most
// pressure, because they are the two ways this tool could become theatre:
//
//   1. `reconcileOne` must REFUSE to lower a recorded count. A re-archive is a whole-file
//      rewrite; the naive version of this tool overwrites a rich capture with a thin one
//      when GitHub is degraded and calls it success. That is the original bug with the
//      sign flipped, and it destroys memory (§5) instead of merely failing to record it.
//   2. `findPositiveControl` must refuse a window with nothing to see. A capture check run
//      over PRs that have no threads passes trivially, forever — the vacuity class.
//
// Mutation-tested: see the work-item / PR body for the mutants killed.

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import {
  ARCHIVER,
  buildBatchQuery,
  classify,
  decideCheckVerdict,
  enumerateArchivedPrs,
  findPositiveControl,
  isEligible,
  parseBatchResponse,
  pickControlCandidates,
  RECORDED_THREADS_RE,
  reconcileOne,
  selectReconcileBatch,
  type PrLiveState,
  type ReconcileEffects,
} from "./reconcile-review-archive";

const HOUR = 3_600_000;
const MINUTE = 60_000;

/** Minimal archive doc carrying just the Outcome row the tools read. */
function doc(threads: number): string {
  return [
    "# PR #1 -- something",
    "",
    "## Outcome",
    "",
    "| Field | Value |",
    "|---|---|",
    "| Merged | true |",
    `| Total threads | ${String(threads)} |`,
    "| Resolved threads | 0 |",
    "",
  ].join("\n");
}

describe("classify — recorded vs live", () => {
  test("live above recorded is the defect under repair", () => {
    expect(classify(0, 3)).toBe("UNDER-REPORTED");
    expect(classify(2, 3)).toBe("UNDER-REPORTED");
  });

  test("equal counts agree, including the honest zero", () => {
    expect(classify(0, 0)).toBe("AGREE");
    expect(classify(7, 7)).toBe("AGREE");
  });

  test("recorded above live is a separate class and never silently 'fine'", () => {
    // Never observed in 250 sampled docs, which is why it must stay visible rather than
    // being folded into AGREE: if it ever appears, something deleted history.
    expect(classify(3, 1)).toBe("OVER-RECORDED");
  });

  test("no archive doc is UNKNOWN, never zero", () => {
    expect(classify(null, 0)).toBe("NO-ARCHIVE");
    expect(classify(null, 5)).toBe("NO-ARCHIVE");
  });
});

describe("isEligible — windowed on CAPTURE time, not merge time", () => {
  const now = Date.parse("2026-08-18T12:00:00Z");
  const since = 48 * HOUR;
  const minAge = 30 * MINUTE;

  test("a capture one minute old is NOT judged — the reviewer has not posted yet", () => {
    // This is the whole reason min-age exists. Judging fresh captures would make the guard
    // fire on healthy behaviour, and a guard that cries wolf gets switched off.
    expect(isEligible("2026-08-18T11:59:00Z", now, since, minAge)).toBe(false);
  });

  test("a capture exactly at the min-age boundary IS judged", () => {
    expect(isEligible("2026-08-18T11:30:00Z", now, since, minAge)).toBe(true);
  });

  test("a capture inside the window is judged", () => {
    expect(isEligible("2026-08-17T12:00:00Z", now, since, minAge)).toBe(true);
  });

  test("a capture older than the window is out of scope", () => {
    expect(isEligible("2026-08-15T12:00:00Z", now, since, minAge)).toBe(false);
  });

  test("an unparseable timestamp is excluded rather than defaulting into scope", () => {
    expect(isEligible("not-a-date", now, since, minAge)).toBe(false);
  });

  test("a doc BACKFILLED long after merge is judged on when it was CAPTURED", () => {
    // The clock choice, as a behaviour. A PR merged in May and archived by the backfill
    // sweep an hour ago has an hour-old blind spot, not a three-month-old one. Windowing on
    // merge time would place it far outside scope and quietly leave the freshest, most
    // race-prone captures in the repo unguarded.
    const capturedAnHourAgo = "2026-08-18T11:00:00Z";
    expect(isEligible(capturedAnHourAgo, now, since, minAge)).toBe(true);
  });
});

describe("enumerateArchivedPrs — complete by construction, no listing cap", () => {
  const docs = new Map<number, string>([
    [10367, "/a/PR-10367.md"],
    [11630, "/a/PR-11630.md"],
  ]);
  const shards = new Map([
    [10367, { fetchedAt: "2026-08-17T03:10:40Z", mergedAt: "2026-08-17T03:10:05Z" }],
    [11630, { fetchedAt: "2026-08-17T20:37:40Z", mergedAt: "2026-08-17T20:37:06Z" }],
  ]);
  const read = (path: string): string => (path === "/a/PR-10367.md" ? doc(12) : doc(1));

  test("a PR created weeks before it merged is still enumerated", () => {
    // THE REGRESSION TEST FOR THIS TOOL'S OWN FIRST DRAFT. It enumerated candidates with
    // `gh pr list --state merged --limit N`, which is ordered by CREATION, then filtered by
    // merge time. PR #10367 (created 2026-08-13, merged 2026-08-17, 12 threads) sat past the
    // end of that listing, so doctoring its doc to record 0 produced a cheerful PASS — a
    // scan reporting success while silently missing rows, which is the very defect class
    // this tool exists to catch. Enumerating from the archive has no ordering and no cap.
    const { rows } = enumerateArchivedPrs(docs, shards, read);
    expect(rows.map((r) => r.number)).toEqual([10367, 11630]);
    expect(rows[0]?.recorded).toBe(12);
  });

  test("a doc with no shard is COUNTED, not silently dropped", () => {
    // No shard means no fetched_at, so the doc cannot be placed in time. Skipping it
    // quietly would shrink the denominator and make the run look cleaner than it is.
    const orphan = new Map(docs).set(9999, "/a/PR-9999.md");
    const { rows, unshardedDocs } = enumerateArchivedPrs(orphan, shards, read);
    expect(unshardedDocs).toBe(1);
    expect(rows.map((r) => r.number)).not.toContain(9999);
  });

  test("an unparseable doc yields recorded=null (unknown), never 0", () => {
    const { rows } = enumerateArchivedPrs(docs, shards, () => "no outcome table here");
    expect(rows.every((r) => r.recorded === null)).toBe(true);
  });

  test("carries the shard's fetched_at through, since that is the window clock", () => {
    const { rows } = enumerateArchivedPrs(docs, shards, read);
    expect(rows[0]?.fetchedAt).toBe("2026-08-17T03:10:40Z");
  });
});

describe("selectReconcileBatch — bounded and oldest-first", () => {
  const state = (n: number): PrLiveState => ({ number: n, mergedAt: "2026-08-18T00:00:00Z", liveThreads: 1 });

  test("takes the OLDEST PRs, so a bounded sweep drains instead of treadmilling", () => {
    // Newest-first with a cap re-picks the same head every tick and starves the tail
    // forever. The archive's own --all-merged sweep was fixed for exactly this.
    const batch = selectReconcileBatch([state(300), state(100), state(200)], 2);
    expect(batch.map((b) => b.number)).toEqual([100, 200]);
  });

  test("no limit means everything, still ordered", () => {
    expect(selectReconcileBatch([state(3), state(1)], undefined).map((b) => b.number)).toEqual([1, 3]);
  });

  test("a limit larger than the queue is not an error", () => {
    expect(selectReconcileBatch([state(5)], 99).map((b) => b.number)).toEqual([5]);
  });
});

describe("findPositiveControl — the anti-vacuity guard on --check", () => {
  const row = (recorded: number | null, live: number) => ({
    state: { number: 1, mergedAt: "2026-08-18T00:00:00Z", liveThreads: live },
    recorded,
  });

  test("a window where every PR has zero threads yields NO control", () => {
    // THE CENTRAL VACUITY TEST. All-agree over threadless PRs is exactly what a broken
    // archiver also produces. Without a control, --check would pass forever on silence.
    expect(findPositiveControl([row(0, 0), row(0, 0), row(0, 0)])).toBeNull();
  });

  test("an agreeing nonzero count is a valid control", () => {
    const control = findPositiveControl([row(0, 0), row(3, 3)]);
    expect(control).not.toBeNull();
    expect(control?.liveThreads).toBe(3);
  });

  test("an UNDER-REPORTED row is not a control — it proves the opposite", () => {
    expect(findPositiveControl([row(0, 4)])).toBeNull();
  });

  test("a PARTIALLY-capturing row is not a control either", () => {
    // Caught by mutation: weakening `recorded === live` to `recorded <= live` lets a doc
    // that captured 2 of 5 threads certify the instrument as healthy — the check would
    // then vouch for itself using the very failure it exists to detect.
    expect(findPositiveControl([row(2, 5)])).toBeNull();
  });

  test("a missing archive doc is not a control", () => {
    expect(findPositiveControl([row(null, 4)])).toBeNull();
  });
});

describe("decideCheckVerdict — a finding outranks an incomplete scan", () => {
  test("clean, covered, with a control is the only PASS", () => {
    expect(decideCheckVerdict({ hasControl: true, underReportedCount: 0, windowCovered: true })).toBe("PASS");
  });

  test("no control is INCONCLUSIVE even when everything agrees", () => {
    // The vacuity refusal at the verdict layer: agreement across PRs that have no threads
    // is what a completely broken archiver produces too, so it cannot be a pass.
    expect(decideCheckVerdict({ hasControl: false, underReportedCount: 0, windowCovered: true })).toBe("INCONCLUSIVE");
  });

  test("an under-report FAILS even when the scan was incomplete", () => {
    // An under-scan can only HIDE further failures; it can never make an observed one
    // untrue. Downgrading a real finding to INCONCLUSIVE would be this very bug —
    // something known-wrong reported as something merely unknown — inside the guard.
    expect(decideCheckVerdict({ hasControl: true, underReportedCount: 3, windowCovered: false })).toBe("FAIL");
  });

  test("an incomplete scan that found nothing is INCONCLUSIVE, never PASS", () => {
    expect(decideCheckVerdict({ hasControl: true, underReportedCount: 0, windowCovered: false })).toBe("INCONCLUSIVE");
  });

  test("no control outranks even a finding — the instrument is not trusted yet", () => {
    expect(decideCheckVerdict({ hasControl: false, underReportedCount: 5, windowCovered: true })).toBe("INCONCLUSIVE");
  });
});

describe("pickControlCandidates — the fallback that keeps INCONCLUSIVE rare", () => {
  test("only thread-bearing docs are candidates", () => {
    // A zero-thread doc cannot prove the instrument reads threads, which is the whole
    // job of a control. Admitting one would restore the vacuity by the back door.
    const picked = pickControlCandidates(new Map([[1, 0], [2, 3], [3, 0]]), 5);
    expect(picked).toEqual([2]);
  });

  test("newest first — the probe wants evidence the archiver works TODAY", () => {
    expect(pickControlCandidates(new Map([[10, 1], [30, 2], [20, 1]]), 5)).toEqual([30, 20, 10]);
  });

  test("bounded by attempts, so a silent window costs one extra call and not a scan", () => {
    expect(pickControlCandidates(new Map([[10, 1], [30, 2], [20, 1]]), 2)).toEqual([30, 20]);
  });

  test("no thread-bearing doc anywhere yields no candidate — honestly inconclusive", () => {
    expect(pickControlCandidates(new Map([[1, 0]]), 5)).toEqual([]);
  });
});

describe("reconcileOne — the one-way guard (§5 memory preservation)", () => {
  interface Harness {
    fx: ReconcileEffects;
    written: string[];
    archiverCalls: number;
    current: () => string | null;
  }

  function harness(initial: string | null, afterArchive: string | null, archiverOk = true): Harness {
    let state = initial;
    const written: string[] = [];
    let archiverCalls = 0;
    return {
      written,
      get archiverCalls() {
        return archiverCalls;
      },
      current: () => state,
      fx: {
        readDoc: () => state,
        restoreDoc: (_pr, content) => {
          written.push(content);
          state = content;
        },
        runArchiver: () => {
          archiverCalls++;
          if (!archiverOk) return false;
          state = afterArchive;
          return true;
        },
      },
    };
  }

  test("a richer re-archive is accepted", () => {
    const h = harness(doc(0), doc(4));
    const out = reconcileOne(7, h.fx);
    expect(out.status).toBe("reconciled");
    expect(out.before).toBe(0);
    expect(out.after).toBe(4);
    expect(h.written).toHaveLength(0); // nothing restored
  });

  test("a THINNER re-archive is refused and the original bytes are restored", () => {
    // The failure this prevents: GitHub degraded / a token scoped down / a deleted comment
    // makes the re-fetch come back thin, and a whole-file rewrite then DESTROYS a good
    // archive while reporting success. Losing a captured thread is worse than never
    // having captured it, because the doc looked correct until this ran.
    const h = harness(doc(5), doc(1));
    const out = reconcileOne(7, h.fx);
    expect(out.status).toBe("refused-regression");
    expect(out.before).toBe(5);
    expect(out.after).toBe(1);
    expect(h.current()).toBe(doc(5)); // byte-for-byte pre-image is back
  });

  test("an archive that becomes UNPARSEABLE is also refused — unknown is not agreement", () => {
    const h = harness(doc(5), "corrupted, no outcome table");
    const out = reconcileOne(7, h.fx);
    expect(out.status).toBe("refused-regression");
    expect(h.current()).toBe(doc(5));
  });

  test("an unchanged count is a no-op, not a false 'reconciled'", () => {
    const h = harness(doc(2), doc(2));
    expect(reconcileOne(7, h.fx).status).toBe("noop");
  });

  test("an archiver failure never touches the doc", () => {
    const h = harness(doc(3), doc(9), false);
    const out = reconcileOne(7, h.fx);
    expect(out.status).toBe("archiver-failed");
    expect(h.current()).toBe(doc(3));
    expect(h.written).toHaveLength(0);
  });

  test("a missing doc does not invoke the archiver at all", () => {
    // This tool reconciles EXISTING archives. Creating missing ones is the --all-merged
    // backfill net's job; quietly widening the remit turns a bounded sweep unbounded.
    const h = harness(null, doc(1));
    expect(reconcileOne(7, h.fx).status).toBe("doc-missing");
    expect(h.archiverCalls).toBe(0);
  });
});

describe("RECORDED_THREADS_RE — reads what the archive actually writes", () => {
  test("matches the Outcome row", () => {
    expect(RECORDED_THREADS_RE.exec(doc(12))?.[1]).toBe("12");
  });

  test("does not match a similar-looking row elsewhere", () => {
    expect(RECORDED_THREADS_RE.exec("| Total review comments | 4 |")).toBeNull();
  });
});

describe("buildBatchQuery / parseBatchResponse — batched, cap-free counts", () => {
  test("one aliased field per PR in a single query", () => {
    const q = buildBatchQuery([11, 22]);
    expect(q).toContain("p11: pullRequest(number:11)");
    expect(q).toContain("p22: pullRequest(number:22)");
    expect(q).toContain("totalCount");
  });

  test("asks for totalCount, not a page of nodes", () => {
    // `first:100` over nodes would silently cap at 100 threads — the same shape as the
    // 250-item truncation this bug's filing calls out. totalCount cannot truncate.
    expect(buildBatchQuery([1])).not.toContain("nodes");
  });

  test("parses counts by PR number", () => {
    const r = parseBatchResponse(
      JSON.stringify({ data: { repository: { p5: { number: 5, reviewThreads: { totalCount: 3 } } } } }),
    );
    expect(r).toBeInstanceOf(Map);
    expect((r as Map<number, number>).get(5)).toBe(3);
  });

  test("a PR present but MISSING its count is absent, not zero", () => {
    // Caught by mutation: keying the guard on the PR number alone and defaulting the count
    // to `?? 0` turns a partial response into "this PR has no threads" — which agrees with
    // a zero-thread archive and reproduces the original bug inside the checker.
    const r = parseBatchResponse(JSON.stringify({ data: { repository: { p5: { number: 5 } } } }));
    expect(r).toBeInstanceOf(Map);
    expect((r as Map<number, number>).has(5)).toBe(false);
  });

  test("a PR that came back null is ABSENT, not zero", () => {
    // Absent means "we do not know". Recording it as 0 would let a failed lookup read as
    // agreement with a zero-thread archive — the bug, reproduced inside the checker.
    const r = parseBatchResponse(
      JSON.stringify({ data: { repository: { p5: null, p6: { number: 6, reviewThreads: { totalCount: 1 } } } } }),
    );
    expect((r as Map<number, number>).has(5)).toBe(false);
    expect((r as Map<number, number>).get(6)).toBe(1);
  });

  test("graphql errors are returned as an error, never as an empty result set", () => {
    const r = parseBatchResponse(JSON.stringify({ data: null, errors: [{ message: "rate limited" }] }));
    expect(typeof r).toBe("string");
    expect(r as string).toContain("rate limited");
  });

  test("unparseable output is an error", () => {
    expect(typeof parseBatchResponse("<html>502</html>")).toBe("string");
  });
});

describe("ARCHIVER — the path the sweep actually spawns", () => {
  test("is absolute and resolved against this module, not the target repo", () => {
    // CAUGHT IN A SANDBOX RUN, not by reasoning. The path was the repo-relative string
    // "src/Core.TypeScript/forge-host/github/archive-pr-reviews.ts" and the spawn used
    // `cwd: repoRoot`, so reconciling any checkout other than the one the tool lives in
    // died with `Module not found`. The sweep treats an archiver failure as a non-fatal
    // ::warning::, so that would have been a lane failing quietly on every tick while the
    // step still reported success — the silent-no-op family this workflow has eaten before.
    expect(isAbsolute(ARCHIVER)).toBe(true);
    expect(ARCHIVER.endsWith("archive-pr-reviews.ts")).toBe(true);
  });

  test("points at a file that exists", () => {
    expect(existsSync(ARCHIVER)).toBe(true);
  });
});
