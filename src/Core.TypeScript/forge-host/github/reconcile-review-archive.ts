#!/usr/bin/env bun
// reconcile-review-archive.ts — heal, and then GUARD, the merge-time race in the PR-review archive.
//
// THE DEFECT (081M08MVPR9087G0R000NCF8PV, re-measured 2026-08-18)
// ---------------------------------------------------------------
// `pr-archive-on-merge.yml` fires on `pull_request: closed` and archives immediately. The
// repo's automated reviewer posts its review threads AFTER the merge event. The archiver
// wins that race, records the count it saw, and NOTHING EVER REVISITS — so the snapshot is
// frozen wrong, and `| Total threads | 0 |` reads identically whether it means "there were
// none" or "we looked too early". That is the vacuity class: a check that did not run
// looking like one that passed.
//
// WHAT WAS MEASURED, so the fix is aimed at the real mechanism and not at an inference:
//
//   * n=150 archive docs, uniformly sampled (seed 4), live-refetched:
//       - 30 under-report (20.0% of docs)
//       - thread-level capture 191/257 = 74.3%
//       - FETCHABLE capture   191/191 = 100.0%
//       - LOSS (a thread that EXISTED when the archiver looked and was not recorded): 0
//     Zero loss against what was fetchable is what excludes pagination, an API cap, a
//     permission gap and a parse bug. Every miss post-dates `fetched_at`. It is the race.
//
//   * 2,000 most recent merged PRs, archive-independent (GitHub only):
//       - 65 post-merge threads, ALL from `copilot-pull-request-reviewer`
//       - p50 lag 177 s, p90 242 s, MAX 283 s -> a 300 s window covers 100% of them
//     The work item's "+78 min max" came from an older reviewer population; the tail today
//     is minutes. Both numbers are honest about their sample, and the design below does not
//     depend on either being stable, which is the point.
//
// WHY THIS IS A SWEEP AND NOT A `sleep` IN THE MERGE JOB
// ------------------------------------------------------
// Waiting ~5 min inside `pr-archive-on-merge.yml` would work and is the obvious fix. It is
// also the wrong one here, on two independent grounds:
//
//   1. COST. 55 of 1,997 recent merged PRs (2.8%) ever acquire a review thread. A blanket
//      wait spends the window on all 1,997 to help 55 — roughly 165 runner-hours a month to
//      re-fetch data that, for 97% of merges, does not exist and never will.
//   2. THE TAIL IS NOT BOUNDED BY MEASUREMENT. Today's max is 283 s. The filed measurement
//      saw 78 minutes. A `sleep` is only ever correct until the reviewer population changes,
//      and when it is wrong it is wrong SILENTLY — the same failure in a new coat.
//
// A sweep that re-archives when the live count exceeds the recorded count is correct for
// ANY tail, costs one cheap scan per tick, and is idempotent (§12): once the counts agree it
// does nothing at all.
//
// THE ONE-WAY GUARD
// -----------------
// Reconciliation may only ADD. `writeArchive` is a whole-file rewrite, so a re-archive run
// while GitHub is degraded (or after a human deletes a comment) could replace a rich capture
// with a poor one — destroying the archive to fix it. So a PR is re-archived only when
// live > recorded, and after the rewrite the new recorded count is re-read and the doc is
// RESTORED BYTE-FOR-BYTE if it went down. §5 Memory Preservation: this tool cannot lose a
// thread it already had. (Restoring the markdown alone is sufficient — the shard carries no
// thread counts, only `fetched_at`/`commit_sha` provenance.)
//
// THE POPULATION IS ENUMERATED FROM THE REPO, NOT FROM A PR LISTING
// ------------------------------------------------------------------
// Candidates come from `docs/history/pr-reviews/` joined to the PR shards, which carry
// `fetched_at`. That is a complete enumeration by construction: finite, local, no API cap,
// no ordering assumption, zero requests. The first draft used `gh pr list --state merged`
// and filtered by `mergedAt`, which is WRONG because that listing is ordered by CREATION —
// a PR created weeks before it merged falls off the end of any bounded listing. It was
// caught by deliberately doctoring PR #10367 and finding the guard did not fire; see
// `enumerateArchivedPrs`. The window is likewise measured on `fetched_at` (when the
// archiver looked), because that is the clock the race is defined against.
//
// `--check` IS THE FALSIFIER, AND IT REFUSES TO BE VACUOUS
// --------------------------------------------------------
// A capture-rate check that cannot fail is worthless, and the easiest way to build a
// worthless one here is to scan a window that happens to contain no reviewed PRs and call
// the silence a pass. So `--check` demands a POSITIVE CONTROL: at least one PR in the
// examined window whose recorded count equals its live count and is greater than zero —
// proof that the instrument can see threads at all. No control, no verdict: it widens the
// window, and if it still cannot find one it exits 2 (INCONCLUSIVE) rather than 0.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const DEFAULT_ARCHIVE_DIR = "docs/history/pr-reviews";
const DEFAULT_SHARD_DIR = "docs/github/prs/shards";
const DEFAULT_OWNER = "Lucent-Financial-Group";
const DEFAULT_REPO = "Zeta";
/**
 * The archiver, resolved relative to THIS FILE rather than to the target repo root.
 *
 * It used to be the repo-relative string and the spawn used `cwd: repoRoot`, which works
 * only when the repo being reconciled is also the repo the tool lives in. Running against
 * any other checkout produced `Module not found` — and because the sweep treats an archiver
 * failure as non-fatal (a `::warning::`), that would have been a lane that fails quietly on
 * every tick while the step still reports success. Same silent-no-op family as the `--batch`
 * defect this workflow already ate once. The archiver is a sibling module; resolve it as one.
 */
export const ARCHIVER = join(import.meta.dir, "archive-pr-reviews.ts");

/** `| Total threads | 12 |` — the archive's own recorded count. */
export const RECORDED_THREADS_RE = /^\|\s*Total threads\s*\|\s*(\d+)\s*\|\s*$/m;
const FILENAME_RE = /^PR-(\d+)-/;

// --- pure core (everything below is unit-tested without network or disk) ------

export interface PrLiveState {
  readonly number: number;
  /** ISO-8601 UTC. */
  readonly mergedAt: string;
  readonly liveThreads: number;
}

export type Verdict =
  | "AGREE"
  | "UNDER-REPORTED"
  | "OVER-RECORDED"
  | "NO-ARCHIVE";

/**
 * Compare what the archive says against what GitHub holds.
 *
 * `recorded === null` means no archive doc exists — a DIFFERENT lane's job (the
 * `--all-merged` backfill net in agent-heartbeat.yml). Reported, never reconciled here:
 * silently widening this tool's remit to "archive anything missing" is how a bounded
 * sweep becomes an unbounded one.
 */
export function classify(recorded: number | null, live: number): Verdict {
  if (recorded === null) return "NO-ARCHIVE";
  if (live > recorded) return "UNDER-REPORTED";
  if (live < recorded) return "OVER-RECORDED";
  return "AGREE";
}

/**
 * Is this capture old enough to judge, and recent enough to still be in scope?
 *
 * THE CLOCK IS `fetched_at`, NOT `merged_at`, and that is the point. The race is "did a
 * reviewer post AFTER the archiver looked", so the interval that matters starts when it
 * looked. A merge-time clock would mis-window every doc that the on-merge job archived late
 * or that a backfill sweep archived days after the fact — and those backfilled captures are
 * precisely the ones a merge clock calls ancient and a capture clock correctly calls fresh.
 *
 * `minAgeMs` is what keeps the guard from crying wolf: a PR captured 30 seconds ago is
 * EXPECTED to under-report, because the reviewer has not posted yet (measured p50 +177 s,
 * max +283 s). Judging it would make the guard fire on healthy behaviour, and a check that
 * cries wolf gets switched off — which is how a repo ends up with no check at all.
 */
export function isEligible(
  fetchedAt: string,
  now: number,
  sinceMs: number,
  minAgeMs: number,
): boolean {
  const t = Date.parse(fetchedAt);
  if (Number.isNaN(t)) return false;
  const age = now - t;
  return age >= minAgeMs && age <= sinceMs;
}

/**
 * Bounded batch, OLDEST FIRST.
 *
 * Newest-first with a small cap re-picks the same head every tick and starves the tail —
 * the exact shape already fixed in the `--all-merged` sweep (`selectBatch`). Oldest-first
 * makes the bound a DRAIN: every tick permanently removes `limit` items from the head of
 * the queue, so each PR's position strictly decreases and progress is guaranteed.
 */
export function selectReconcileBatch(
  rows: readonly PrLiveState[],
  limit: number | undefined,
): PrLiveState[] {
  const ascending = [...rows].sort((a, b) => (a.number < b.number ? -1 : a.number > b.number ? 1 : 0));
  return limit === undefined ? ascending : ascending.slice(0, limit);
}

/**
 * The positive control that keeps `--check` from passing vacuously.
 *
 * A window with no thread-bearing PR proves nothing: the comparison would return "all
 * agree" whether the archiver works perfectly or does not run at all. A control is a row
 * where the archive RECORDED a nonzero count that still matches live — the instrument
 * demonstrably reads threads, and demonstrably agrees when agreement is real.
 */
export function findPositiveControl(
  rows: ReadonlyArray<{ state: PrLiveState; recorded: number | null }>,
): PrLiveState | null {
  for (const r of rows) {
    if (r.recorded !== null && r.recorded > 0 && r.recorded === r.state.liveThreads) return r.state;
  }
  return null;
}

/**
 * Archive docs to try as a FALLBACK control when the judged window has none.
 *
 * Without this the guard renders no verdict on a quiet week: a window in which nobody was
 * reviewed yields no control, `--check` returns INCONCLUSIVE, and a check that is
 * permanently inconclusive is a check nobody reads. So when the window is silent, the
 * instrument is proved against the newest archive docs that DO record threads — which
 * costs one extra batched call and keeps the judgement itself scoped to the window.
 *
 * Newest-first here, deliberately opposite to `selectReconcileBatch`: this is not a queue
 * being drained, it is a probe, and the most recent capture is the most relevant evidence
 * that the archiver works TODAY.
 */
export function pickControlCandidates(
  recordedByPr: ReadonlyMap<number, number>,
  attempts: number,
): number[] {
  return [...recordedByPr.entries()]
    .filter(([, recorded]) => recorded > 0)
    .map(([pr]) => pr)
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, attempts);
}

export type CheckVerdict = "PASS" | "FAIL" | "INCONCLUSIVE";

/**
 * The `--check` verdict, as a pure function of what the scan established.
 *
 * THE ORDER OF THESE THREE RULES IS THE POINT.
 *
 *   1. No control  -> INCONCLUSIVE. Without proof the instrument can see a thread at all,
 *      "everything agrees" is exactly what a totally broken archiver also produces.
 *   2. Any under-report -> FAIL, *even if the scan was incomplete*. An under-scan can only
 *      HIDE further failures; it can never make an observed one untrue. Returning
 *      INCONCLUSIVE while holding a real finding would be this bug committed by the guard.
 *   3. Incomplete scan with nothing found -> INCONCLUSIVE, never PASS. A check that did not
 *      cover its window is a check that did not run.
 */
export function decideCheckVerdict(input: {
  readonly hasControl: boolean;
  readonly underReportedCount: number;
  readonly windowCovered: boolean;
}): CheckVerdict {
  if (!input.hasControl) return "INCONCLUSIVE";
  if (input.underReportedCount > 0) return "FAIL";
  if (!input.windowCovered) return "INCONCLUSIVE";
  return "PASS";
}

/**
 * One archived PR, as enumerated from the repo itself.
 *
 * `fetchedAt` is the clock this tool reasons in, and the choice is load-bearing — see
 * `isEligible` below.
 */
export interface ArchivedPr {
  readonly number: number;
  /** ISO-8601 UTC, from the PR shard: when the archiver LOOKED. */
  readonly fetchedAt: string;
  /** ISO-8601 UTC, from the PR shard. Reporting only. */
  readonly mergedAt: string | null;
  readonly recorded: number | null;
}

/**
 * Enumerate the judged population from the ARCHIVE, not from a PR listing.
 *
 * THIS FUNCTION IS THE FIX FOR A BUG IN THIS TOOL'S OWN FIRST DRAFT, and that bug had the
 * exact shape of the defect the tool exists to catch — so it is worth stating plainly.
 *
 * The first draft enumerated candidates with `gh pr list --state merged --limit N` and then
 * filtered them by `mergedAt`. But that listing is ordered by CREATION, and the two orders
 * are not the same: a long-lived PR created weeks ago and merged yesterday sits far down the
 * creation order and falls off the end of any bounded listing. Caught by deliberately
 * doctoring PR #10367 (created 2026-08-13, merged 2026-08-17, 12 review threads) to record
 * zero and checking that the guard fired. IT DID NOT. The scan reported "window fully
 * covered" and PASS, because the coverage test compared the oldest listed *mergedAt* against
 * the window start — sound only if merge order matched listing order, which it does not.
 *
 * A scan that returns success while silently missing rows is the 250-item-cap family, and a
 * guard with that defect is worse than no guard: it certifies.
 *
 * Enumerating from `docs/history/pr-reviews/` + the PR shards removes the failure mode
 * rather than bounding it. The population being judged IS the set of archive docs; it is
 * finite and local, there is no cap and no ordering assumption, and it costs zero API calls.
 */
export function enumerateArchivedPrs(
  docs: ReadonlyMap<number, string>,
  shards: ReadonlyMap<number, { fetchedAt: string; mergedAt: string | null }>,
  readDoc: (path: string) => string,
): { rows: ArchivedPr[]; unshardedDocs: number } {
  const rows: ArchivedPr[] = [];
  let unshardedDocs = 0;
  for (const [pr, path] of docs) {
    const shard = shards.get(pr);
    if (shard === undefined) {
      // No shard means no `fetched_at`, so this doc cannot be placed in time at all.
      // Counted and reported — never silently dropped, never assumed fresh.
      unshardedDocs++;
      continue;
    }
    const m = RECORDED_THREADS_RE.exec(readDoc(path));
    rows.push({
      number: pr,
      fetchedAt: shard.fetchedAt,
      mergedAt: shard.mergedAt,
      recorded: m === null ? null : Number.parseInt(m[1]!, 10),
    });
  }
  rows.sort((a, b) => (a.number < b.number ? -1 : a.number > b.number ? 1 : 0));
  return { rows, unshardedDocs };
}

export type ReconcileStatus =
  | "reconciled"
  | "noop"
  | "refused-regression"
  | "archiver-failed"
  | "doc-missing";

export interface ReconcileEffects {
  /** Current bytes of the archive doc for this PR, or null when it does not exist. */
  readonly readDoc: (pr: number) => string | null;
  /** Restore path — writes exact bytes back. Only ever called to UNDO a regression. */
  readonly restoreDoc: (pr: number, content: string) => void;
  /** Re-run the archiver for one PR. */
  readonly runArchiver: (pr: number) => boolean;
}

export interface ReconcileOutcome {
  readonly pr: number;
  readonly status: ReconcileStatus;
  readonly before: number | null;
  readonly after: number | null;
}

/**
 * Re-archive ONE PR, then verify the rewrite did not lose ground.
 *
 * The verification is not ceremony. `writeArchive` replaces the whole file, so if the
 * re-fetch comes back thinner than what is on disk — GitHub degraded, a comment deleted,
 * a token scoped down — the naive version of this tool would overwrite a good archive with
 * a worse one and report success. Here the pre-image is held in memory and written back.
 */
export function reconcileOne(pr: number, fx: ReconcileEffects): ReconcileOutcome {
  const beforeDoc = fx.readDoc(pr);
  if (beforeDoc === null) return { pr, status: "doc-missing", before: null, after: null };
  const beforeMatch = RECORDED_THREADS_RE.exec(beforeDoc);
  const before = beforeMatch === null ? null : Number.parseInt(beforeMatch[1]!, 10);

  if (!fx.runArchiver(pr)) return { pr, status: "archiver-failed", before, after: null };

  const afterDoc = fx.readDoc(pr);
  const afterMatch = afterDoc === null ? null : RECORDED_THREADS_RE.exec(afterDoc);
  const after = afterMatch === null ? null : Number.parseInt(afterMatch[1]!, 10);

  // Unreadable-after, or fewer threads than we started with: put the pre-image back.
  // `after === null` is included deliberately — an archive we can no longer parse is not
  // evidence that the rewrite was fine, and unknown is never treated as agreement.
  if (before !== null && (after === null || after < before)) {
    fx.restoreDoc(pr, beforeDoc);
    return { pr, status: "refused-regression", before, after };
  }
  if (before !== null && after !== null && after === before) {
    return { pr, status: "noop", before, after };
  }
  return { pr, status: "reconciled", before, after };
}

// --- effects: archive docs on disk -------------------------------------------

/** pr_number -> absolute path of its archive doc. */
export function indexArchiveDocs(dir: string): Map<number, string> {
  const out = new Map<number, string>();
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".md")) continue;
    const m = FILENAME_RE.exec(name);
    if (m === null) continue;
    out.set(Number.parseInt(m[1]!, 10), join(dir, name));
  }
  return out;
}

// --- effects: GitHub ---------------------------------------------------------

function gh(args: readonly string[]): { ok: boolean; stdout: string; stderr: string } {
  const p = Bun.spawnSync(["gh", ...args]);
  return { ok: p.exitCode === 0, stdout: p.stdout.toString(), stderr: p.stderr.toString() };
}

/**
 * `pr_number -> {fetched_at, merged_at}` from the PR shard store.
 *
 * NO API CALL, NO CAP, NO ORDERING ASSUMPTION. The shards are the archive's own ledger
 * (`docs/github/prs/shards/<NNN>/<zetaid>.json`, path = f(pr_number)), so reading them is a
 * complete enumeration by construction — which is exactly what the `gh pr list` approach
 * this replaced could not promise.
 *
 * Where several shards exist for one PR across re-archives, the LATEST `fetched_at` wins:
 * that is the capture whose blind spot is being judged, because it is the one that wrote
 * the doc now on disk.
 */
export function readShardIndex(dir: string): Map<number, { fetchedAt: string; mergedAt: string | null }> {
  const out = new Map<number, { fetchedAt: string; mergedAt: string | null }>();
  if (!existsSync(dir)) return out;
  for (const bucket of readdirSync(dir)) {
    let entries: string[];
    try {
      entries = readdirSync(join(dir, bucket));
    } catch {
      continue; // a file, not a bucket directory
    }
    for (const name of entries) {
      if (!name.endsWith(".json")) continue;
      let parsed: { pr_number?: number; fetched_at?: string; merged_at?: string };
      try {
        parsed = JSON.parse(readFileSync(join(dir, bucket, name), "utf8")) as typeof parsed;
      } catch {
        continue;
      }
      if (typeof parsed.pr_number !== "number" || typeof parsed.fetched_at !== "string") continue;
      const prior = out.get(parsed.pr_number);
      if (prior === undefined || prior.fetchedAt < parsed.fetched_at) {
        out.set(parsed.pr_number, {
          fetchedAt: parsed.fetched_at,
          mergedAt: typeof parsed.merged_at === "string" ? parsed.merged_at : null,
        });
      }
    }
  }
  return out;
}

/**
 * Live `reviewThreads.totalCount` for a batch of PRs, in ONE request per chunk.
 *
 * Aliased fields rather than one query per PR: a 7-day window is ~400 PRs here, and 400
 * round trips per tick is not a sweep anyone will keep running. `totalCount` is a count,
 * not a page, so it is immune to the `first:` truncation that would silently cap a naive
 * `nodes` query at 100.
 */
export function buildBatchQuery(prs: readonly number[]): string {
  const fields = prs
    .map((n) => `p${String(n)}: pullRequest(number:${String(n)}){number reviewThreads(first:0){totalCount}}`)
    .join(" ");
  return `query($o:String!,$r:String!){repository(owner:$o,name:$r){${fields}}}`;
}

interface BatchShape {
  data?: { repository?: Record<string, { number?: number; reviewThreads?: { totalCount?: number } } | null> | null };
  errors?: Array<{ message?: string }>;
}

/** Returns null for any PR whose count did not come back — unknown, never zero. */
export function parseBatchResponse(stdout: string): Map<number, number> | string {
  let parsed: BatchShape;
  try {
    parsed = JSON.parse(stdout) as BatchShape;
  } catch {
    return `unparseable graphql response: ${stdout.slice(0, 200)}`;
  }
  if (parsed.errors !== undefined && parsed.errors.length > 0) {
    return `graphql errors: ${JSON.stringify(parsed.errors).slice(0, 300)}`;
  }
  const repo = parsed.data?.repository;
  if (repo === undefined || repo === null) return "no repository in graphql response";
  const out = new Map<number, number>();
  for (const value of Object.values(repo)) {
    if (value === null || value === undefined) continue;
    const n = value.number;
    const c = value.reviewThreads?.totalCount;
    if (typeof n === "number" && typeof c === "number") out.set(n, c);
  }
  return out;
}

function fetchLiveThreadCounts(
  owner: string,
  repo: string,
  prs: readonly number[],
  chunkSize: number,
): { counts: Map<number, number>; errors: string[] } {
  const counts = new Map<number, number>();
  const errors: string[] = [];
  for (let i = 0; i < prs.length; i += chunkSize) {
    const chunk = prs.slice(i, i + chunkSize);
    const r = gh(["api", "graphql", "-f", `query=${buildBatchQuery(chunk)}`, "-F", `o=${owner}`, "-F", `r=${repo}`]);
    if (!r.ok) {
      errors.push(`chunk ${String(i)}: gh failed: ${r.stderr.trim().slice(0, 200)}`);
      continue;
    }
    const parsed = parseBatchResponse(r.stdout);
    if (typeof parsed === "string") {
      errors.push(`chunk ${String(i)}: ${parsed}`);
      continue;
    }
    for (const [k, v] of parsed) counts.set(k, v);
  }
  return { counts, errors };
}

// --- CLI ---------------------------------------------------------------------

interface Args {
  owner: string;
  repo: string;
  archiveDir: string;
  shardDir: string;
  repoRoot: string;
  sinceHours: number;
  minAgeMinutes: number;
  limit: number;
  chunkSize: number;
  controlAttempts: number;
  write: boolean;
  check: boolean;
}

function parseHours(flag: string, raw: string | undefined): number {
  if (raw === undefined || !/^\d+(\.\d+)?$/.test(raw)) {
    process.stderr.write(`${flag} requires a positive number (got: ${raw ?? "nothing"})\n`);
    process.exit(2);
  }
  return Number.parseFloat(raw);
}

function parseArgs(argv: readonly string[]): Args {
  const a: Args = {
    owner: DEFAULT_OWNER,
    repo: DEFAULT_REPO,
    archiveDir: DEFAULT_ARCHIVE_DIR,
    shardDir: DEFAULT_SHARD_DIR,
    repoRoot: process.cwd(),
    sinceHours: 48,
    // 30 min: comfortably past the measured 283 s post-merge tail, with room for the
    // tail to grow by an order of magnitude before this starts reporting healthy lag.
    minAgeMinutes: 30,
    limit: 10,
    chunkSize: 50,
    controlAttempts: 5,
    write: false,
    check: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--owner") a.owner = argv[++i] ?? a.owner;
    else if (arg === "--repo") a.repo = argv[++i] ?? a.repo;
    else if (arg === "--archive-dir") a.archiveDir = argv[++i] ?? a.archiveDir;
    else if (arg === "--shard-dir") a.shardDir = argv[++i] ?? a.shardDir;
    else if (arg === "--repo-root") a.repoRoot = argv[++i] ?? a.repoRoot;
    else if (arg === "--since-hours") a.sinceHours = parseHours("--since-hours", argv[++i]);
    else if (arg === "--min-age-minutes") a.minAgeMinutes = parseHours("--min-age-minutes", argv[++i]);
    else if (arg === "--limit") a.limit = Math.trunc(parseHours("--limit", argv[++i]));
    else if (arg === "--chunk-size") a.chunkSize = Math.trunc(parseHours("--chunk-size", argv[++i]));
    else if (arg === "--control-attempts") a.controlAttempts = Math.trunc(parseHours("--control-attempts", argv[++i]));
    else if (arg === "--write") a.write = true;
    else if (arg === "--check") a.check = true;
    else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage:\n" +
          "  bun src/Core.TypeScript/forge-host/github/reconcile-review-archive.ts [--write|--check]\n" +
          "\n" +
          "  (default)  DRY RUN — report under-reported archive docs, change nothing.\n" +
          "  --write    re-archive the under-reported PRs (bounded by --limit, oldest first).\n" +
          "  --check    FALSIFIER — exit 1 if any PR older than --min-age-minutes still\n" +
          "             under-reports; exit 2 if no positive control was found (inconclusive).\n" +
          "\n" +
          "  --since-hours N        capture window to examine, on fetched_at (default 48)\n" +
          "  --min-age-minutes N    ignore captures younger than this (default 30)\n" +
          "  --limit N              max PRs re-archived per run (default 10)\n",
      );
      process.exit(0);
    } else {
      process.stderr.write(`unknown arg: ${arg}\n`);
      process.exit(2);
    }
  }
  if (a.write && a.check) {
    process.stderr.write("--write and --check are mutually exclusive: the guard must not repair what it judges\n");
    process.exit(2);
  }
  return a;
}

function main(): number {
  const args = parseArgs(Bun.argv.slice(2));
  const repoRoot = resolve(args.repoRoot);
  const archiveDirAbs = resolve(repoRoot, args.archiveDir);
  const now = Date.now();
  const sinceMs = args.sinceHours * 3_600_000;
  const minAgeMs = args.minAgeMinutes * 60_000;

  const docs = indexArchiveDocs(archiveDirAbs);
  const shards = readShardIndex(resolve(repoRoot, args.shardDir));
  const enumerated = enumerateArchivedPrs(docs, shards, (path) => readFileSync(path, "utf8"));
  // Complete by construction over archive docs (see enumerateArchivedPrs). "Covered" here
  // means the enumeration itself succeeded — an empty shard store is a broken scan, not an
  // empty result, and must never read as a pass.
  const covered = shards.size > 0;
  if (!covered) {
    process.stderr.write(
      `::warning::no PR shards under ${args.shardDir} — nothing could be placed in time. ` +
        `This is a failed scan, not a clean one.\n`,
    );
  }
  if (enumerated.unshardedDocs > 0) {
    process.stderr.write(
      `::warning::${String(enumerated.unshardedDocs)} archive doc(s) have no shard, so they carry no ` +
        `fetched_at and cannot be judged. Not counted as agreeing.\n`,
    );
  }

  const eligible = enumerated.rows.filter((r) => isEligible(r.fetchedAt, now, sinceMs, minAgeMs));
  const { counts, errors } = fetchLiveThreadCounts(
    args.owner,
    args.repo,
    eligible.map((r) => r.number),
    args.chunkSize,
  );
  for (const e of errors) process.stderr.write(`::warning::live count fetch: ${e}\n`);

  const rows: Array<{ state: PrLiveState; recorded: number | null; verdict: Verdict }> = [];
  for (const r of eligible) {
    const live = counts.get(r.number);
    if (live === undefined) continue; // unknown, never zero
    const state: PrLiveState = { number: r.number, mergedAt: r.mergedAt ?? "", liveThreads: live };
    rows.push({ state, recorded: r.recorded, verdict: classify(r.recorded, live) });
  }

  const under = rows.filter((r) => r.verdict === "UNDER-REPORTED");
  const overRecorded = rows.filter((r) => r.verdict === "OVER-RECORDED");
  const unparseable = rows.filter((r) => r.verdict === "NO-ARCHIVE");
  const withThreads = rows.filter((r) => r.state.liveThreads > 0);

  process.stdout.write(`window            : CAPTURED between ${String(args.sinceHours)}h and ${String(args.minAgeMinutes)}min ago (fetched_at)\n`);
  process.stdout.write(
    `archive docs      : ${String(docs.size)} (${String(enumerated.rows.length)} placeable in time, ` +
      `${String(enumerated.unshardedDocs)} without a shard)\n`,
  );
  process.stdout.write(`in window         : ${String(eligible.length)}   live counts obtained: ${String(rows.length)}\n`);
  process.stdout.write(`with live threads : ${String(withThreads.length)}\n`);
  process.stdout.write(`UNDER-REPORTED    : ${String(under.length)}\n`);
  process.stdout.write(`OVER-RECORDED     : ${String(overRecorded.length)}\n`);
  process.stdout.write(`UNPARSEABLE doc   : ${String(unparseable.length)}\n`);
  for (const r of under) {
    process.stdout.write(
      `  under-reported  PR #${String(r.state.number)}  recorded=${String(r.recorded)} live=${String(r.state.liveThreads)}  merged ${r.state.mergedAt}\n`,
    );
  }

  if (args.check) {
    let control = findPositiveControl(rows);
    let controlSource = "in-window";
    if (control === null) {
      // Quiet window: prove the instrument against the newest thread-bearing archive docs
      // instead of declaring a permanent INCONCLUSIVE.
      const recordedByPr = new Map<number, number>();
      for (const [pr, path] of docs) {
        const m = RECORDED_THREADS_RE.exec(readFileSync(path, "utf8"));
        if (m !== null) {
          const n = Number.parseInt(m[1]!, 10);
          if (n > 0) recordedByPr.set(pr, n);
        }
      }
      const candidates = pickControlCandidates(recordedByPr, args.controlAttempts);
      const probe = fetchLiveThreadCounts(args.owner, args.repo, candidates, args.chunkSize);
      for (const pr of candidates) {
        const live = probe.counts.get(pr);
        const recorded = recordedByPr.get(pr);
        if (live !== undefined && recorded !== undefined && live === recorded && live > 0) {
          control = { number: pr, mergedAt: "", liveThreads: live };
          controlSource = "fallback (newest thread-bearing archive doc)";
          break;
        }
      }
    }
    if (control !== null) {
      process.stdout.write(
        `positive control  : PR #${String(control.number)} (recorded == live == ${String(control.liveThreads)}) ` +
          `[${controlSource}] — instrument sees threads\n`,
      );
    }
    const verdict = decideCheckVerdict({
      hasControl: control !== null,
      underReportedCount: under.length,
      windowCovered: covered,
    });
    if (verdict === "FAIL") {
      process.stdout.write(
        `FAIL: ${String(under.length)} PR(s) merged over ${String(args.minAgeMinutes)} minutes ago still under-report.\n` +
          "The on-merge archive lost them and the reconcile sweep did not heal them.\n" +
          "Repair: bun src/Core.TypeScript/forge-host/github/reconcile-review-archive.ts --write\n",
      );
      if (!covered) {
        process.stdout.write("(the shard store was also unreadable, so there may be MORE)\n");
      }
      return 1;
    }
    if (verdict === "INCONCLUSIVE") {
      if (control === null) {
        process.stdout.write(
          "INCONCLUSIVE: no positive control — neither the window nor the newest thread-bearing\n" +
            "archive docs produced a recorded, nonzero, agreeing count. 'Everything agrees' would\n" +
            "prove nothing here, so this is not a pass.\n",
        );
      } else {
        process.stdout.write(
          "INCONCLUSIVE: the PR shard store was empty or unreadable, so no archive doc could be\n" +
            "placed in time and nothing was actually scanned. A scan that did not run is not a pass.\n",
        );
      }
      return 2;
    }
    process.stdout.write("PASS: every archive doc in the window matches GitHub.\n");
    return 0;
  }

  if (under.length === 0) {
    process.stdout.write("nothing to reconcile.\n");
    return 0;
  }
  if (!args.write) {
    process.stdout.write("DRY RUN — pass --write to re-archive the PRs listed above.\n");
    return 0;
  }

  const batch = selectReconcileBatch(
    under.map((r) => r.state),
    args.limit,
  );
  const fx: ReconcileEffects = {
    readDoc: (pr) => {
      const p = indexArchiveDocs(archiveDirAbs).get(pr);
      return p === undefined ? null : readFileSync(p, "utf8");
    },
    restoreDoc: (pr, content) => {
      const p = indexArchiveDocs(archiveDirAbs).get(pr);
      if (p !== undefined) writeFileSync(p, content);
    },
    runArchiver: (pr) => {
      const p = Bun.spawnSync(["bun", ARCHIVER, String(pr), "--repo-root", repoRoot], { cwd: repoRoot });
      if (p.exitCode !== 0) process.stderr.write(`archiver failed for #${String(pr)}: ${p.stderr.toString().slice(0, 300)}\n`);
      return p.exitCode === 0;
    },
  };

  let failures = 0;
  for (const state of batch) {
    const outcome = reconcileOne(state.number, fx);
    process.stdout.write(
      `  ${outcome.status.padEnd(19)} PR #${String(outcome.pr)}  ${String(outcome.before)} -> ${String(outcome.after)}\n`,
    );
    if (outcome.status === "archiver-failed" || outcome.status === "refused-regression") failures++;
  }
  process.stdout.write(`reconciled ${String(batch.length - failures)} of ${String(batch.length)} attempted (${String(under.length)} under-reported in window)\n`);
  return failures > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(main());
}
