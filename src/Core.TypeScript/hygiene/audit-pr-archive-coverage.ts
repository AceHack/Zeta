#!/usr/bin/env bun
// audit-pr-archive-coverage.ts — the falsifier for the condition nobody was
// measuring: merged PRs that never get an archive record at all.
//
// WHY THIS FILE EXISTS
// --------------------
// The PR-review archive exists to move review discussion out of GitHub's
// database and into git, where the project owns it and can train on it. Every
// unarchived PR is data the project does not own — and, unlike a broken build,
// its absence produces no signal whatsoever. There is no failed run to find, no
// red check, no error in a log. It is invisible by construction.
//
// It was invisible for four days. Measured on main at 2026-08-25:
//
//     merged PRs (GraphQL totalCount)            13,347
//     archive docs on main                       10,337
//     lifetime coverage                           77.4%
//     unarchived                                  3,010
//
// THE MECHANISM, MEASURED — it is not one failure, it is three populations.
//
//   A. 578 PRs the lane DELIBERATELY skips (`automation/pr-archive-*` and
//      `claim/archive-pr-*` — archiving an archive PR is a recursive chain).
//      Not a gap. See `archive-eligibility.ts` for why this had to become a
//      shared predicate rather than a rule each lane re-guessed.
//
//   B. 1,506 PRs merged before `pr-archive-on-merge.yml` landed (2026-05-06).
//      A real category, and one no fix to the lane can ever move — only a
//      deliberate backfill can. Counted, never quietly folded into either the
//      healthy number or the failure number.
//
//   C. 926 eligible PRs the lane SHOULD have archived and did not — 765 of them
//      since 2026-08-21, i.e. still happening while this was written.
//
// THE ROOT CAUSE OF (C), and it is a documented GitHub behaviour rather than a
// bug in this repo's code: **a workflow authenticating as `GITHUB_TOKEN` cannot
// trigger another workflow.** When a PR is merged by `github-actions[bot]`, the
// `pull_request: closed` event is SUPPRESSED, so `pr-archive-on-merge.yml`
// never runs. No run is created; nothing fails; nothing is red.
//
// Checked, not assumed — two samples over the same 5-day window:
//
//     population                          merged by github-actions   by a user
//     unarchived + eligible (n=765)                 747 (97.6%)     18 ( 2.4%)
//     archived, same window (n=539)                   9 ( 1.7%)    530 (98.3%)
//
// and directly, by asking the API whether a run exists for the merge SHA:
//
//     PR #15280 heartbeat/society   merged by github-actions[bot] -> 0 runs
//     PR #15267 soraya-flush        merged by github-actions[bot] -> 0 runs
//     PR #15272 heartbeat/tick-metrics  merged by AceHack         -> 1 run, success
//     PR #15264 heartbeat/society       merged by AceHack         -> 1 run, success
//
// The bot-merge share of all merges crossed over on 2026-08-20 (9/40 on 08-18,
// 11/40 on 08-19, 29/40 on 08-20), which is the day before coverage collapsed.
// The lane did not break. Its trigger stopped being reachable for a population
// that had, until then, been small.
//
// AND THE REASON THOSE MERGES ARE BOT-MERGED IS AN ALREADY-OPEN P1.
// `agent-heartbeat.yml` prefers `ZETA_TELEMETRY_FLUSH_TOKEN` and falls back to
// `GITHUB_TOKEN` when the API refuses that PAT. It refuses on EVERY run —
// checked against the six most recent heartbeat runs (32823324598, 32821142228,
// 32818569388, 32816194481, 32814829813, 32813161986): all six emit
// `::warning title=Heartbeat API credential denied`. So every flush merges as
// `github-actions[bot]`, and the whole chain is:
//
//     PAT lacks contents:write  (081M05G8D36087G0R0034D3QPA, P1, open,
//                                explicitly "NEEDS THE OPERATOR")
//        -> fallback to GITHUB_TOKEN
//        -> flush PRs merge as github-actions[bot]
//        -> `pull_request: closed` is suppressed
//        -> pr-archive-on-merge.yml never runs
//        -> the PR is never archived, silently.
//
// That is a CREDENTIAL SCOPE GRANT, not a code change, and it is a gated class:
// an agent cannot make it. Which is precisely why this audit and the resized
// sweep are the right deliverable — they hold the line while the credential is
// waiting on a human, and they go red again if it regresses. Nobody had
// connected the open credential bug to archive coverage; the cost of that P1 is
// 910 unarchived PRs and counting.
//
// WHY THIS IS NOT AH003, AND WHY BOTH ARE NEEDED
// ----------------------------------------------
// `audit-orphaned-archive-refs.ts` (AH003, fatal on the gate.yml floor) asks:
// for every `automation/pr-archive-*` REF that exists, did its record reach
// main? That is the right question for a lane that pushed a branch and then
// failed to land it, and it caught a real 1,290-ref accumulation.
//
// It takes REFS as its input, so it is STRUCTURALLY BLIND to the population
// here: a PR whose merge never triggered the workflow produces no ref, no run,
// and no branch, so there is nothing for a ref-driven audit to enumerate. It is
// the same blindness its own header calls out in ITS sibling — one level up.
//
// Measured on one tree at one instant (2026-08-25, after #15309 landed):
//
//     AH003 (ref-driven)          1,287 refs examined ->     4 stranded
//     this audit (merged-driven)  12,782 PRs examined -> 907 missing
//
// 903 of those 907 are invisible to AH003 by construction. Neither audit
// subsumes the other: AH003 catches a record that was BUILT and lost, this one
// catches a record that was NEVER BUILT. The lane needs both, because "the
// workflow ran and failed to deliver" and "the workflow never ran" are different
// failures and only the first one leaves evidence behind.
//
// WHY AN AUDIT AND NOT JUST A FIX
// -------------------------------
// Because the fix is to a SUPPRESSED EVENT, and the next thing that suppresses
// it will be just as silent. The backfill sweep is the net under the event lane,
// and the net's own health has exactly the same property: it is a number nobody
// looks at until someone counts files by hand. This audit is what makes 77.4% a
// value that goes red.
//
// WHAT IT ASSERTS
// ---------------
// Two numbers, two thresholds, and they answer different questions:
//
//   * WINDOW coverage (default: last 7 days, minus a grace period) — "is the
//     lane working RIGHT NOW". This is the one that catches a new break within a
//     day, and it is the one whose threshold is high.
//   * LIFETIME coverage over eligible PRs — "how much of the corpus do we own".
//     Moves only when a backfill lands, so it is a ratchet, not an alarm.
//
// LIVENESS: this audit refuses to pass while inspecting nothing. An empty
// archive index or an empty merged list means the lookup is broken, not that
// coverage is perfect — "checked 0 PRs" must never read as success. That is the
// vacuity class, and it is the failure this whole subsystem keeps producing.

import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { resolve } from "node:path";

import { classifyGap, EVENT_LANE_LANDED, type GapClass } from "../forge-host/github/archive-eligibility.ts";

/** One merged PR as the audit needs to see it. */
export interface MergedPr {
  readonly number: number;
  readonly mergedAt: string;
  readonly headRefName: string;
  readonly headRepoIsSameRepo?: boolean;
}

export interface CoverageThresholds {
  /** Minimum acceptable coverage over the recent window, as a fraction 0..1. */
  readonly window: number;
  /** Minimum acceptable lifetime coverage over eligible PRs, as a fraction 0..1. */
  readonly lifetime: number;
}

/**
 * The defaults, and why each is the number it is.
 *
 * `window` at 0.95 rather than 1.0: the event lane and the backfill sweep race,
 * flushes batch, and a handful of records legitimately straddle the grace
 * boundary on a busy day. 1.0 would flap. 0.95 over 7 days is roughly 130 PRs
 * of slack at the current merge rate, which no real break fits inside — the
 * measured break ran at 43% coverage.
 *
 * BACKTESTED, because a threshold argued from first principles is a guess with
 * a paragraph attached. Replaying this exact computation against the real merge
 * history for the fifteen days around the break:
 *
 *     2026-08-11 .. 08-20    100.00% every day      GREEN  (10 healthy days)
 *     2026-08-21              94.62%                RED    <- day ONE of the break
 *     2026-08-22              80.37%                RED
 *     2026-08-23              73.04%                RED
 *     2026-08-24              64.50%                RED
 *     2026-08-25              59.22%                RED
 *
 * So 0.95 has both properties a threshold needs and which are usually only
 * asserted: it does not flap on ten consecutive days of healthy operation, and
 * it fires on the FIRST day of the real incident rather than after it has
 * accumulated. Raising it to 0.99 would still have caught 08-21; lowering it to
 * 0.90 would have missed it for a day. (The pre-break days use today's archived
 * set, so they are upper bounds — which only strengthens the no-flap half.)
 *
 * `lifetime` is a RATCHET at the level a backfill can hold, not an aspiration.
 * It starts below where main sits so the audit lands green-on-truth rather than
 * red-on-history, and it is raised as backfill lands. A threshold set above the
 * current value would make this audit's first act be to fail for a reason it
 * cannot fix, which is how gates get disabled.
 */
export const DEFAULT_THRESHOLDS: CoverageThresholds = { window: 0.95, lifetime: 0.75 };

/**
 * How long after a merge a missing record is still "in flight" rather than lost.
 *
 * 90 minutes. Derived from the slowest documented leg of the delivery path, not
 * picked round: the staging lane's flush gate is MIN_INTERVAL_SECONDS=3000
 * (50 min), plus the flush PR's own CI and merge. 90 covers that with margin.
 */
export const DEFAULT_GRACE_MINUTES = 90;

/** Default window for the "is it working now" question. */
export const DEFAULT_WINDOW_DAYS = 7;

export interface CoverageReport {
  readonly lifetime: Bucket;
  readonly window: Bucket;
  readonly windowDays: number;
  /** Eligible, out of grace, and still unarchived — the actual defect list. */
  readonly missing: readonly number[];
  readonly counts: Readonly<Record<GapClass, number>>;
}

export interface Bucket {
  readonly eligible: number;
  readonly archived: number;
  /** `archived / eligible`, or `null` when `eligible === 0` (never 1.0). */
  readonly coverage: number | null;
}

/**
 * Read the set of PR numbers that HAVE an archive record.
 *
 * It reads the SHARD store, not the markdown directory, because the shard path
 * is a pure function of the PR number (`shards/<bucket>/<zetaid>.json`) and the
 * markdown filename embeds a slug of the PR title. `selectBatch` in
 * `archive-pr-reviews.ts` already keys "is this archived?" off the shard, so
 * using anything else here would let the audit and the sweep disagree about the
 * same PR — which is the class of bug this whole change set is repairing.
 *
 * Cross-checked on main 2026-08-25: 10,336 shards vs 10,337 markdown docs, and
 * the single-doc difference is a known duplicate-slug record, not a missing
 * shard. The two indexes agree to within that.
 */
export function readArchivedPrNumbers(shardRootAbs: string): Set<number> {
  const out = new Set<number>();
  // No existsSync gate: the directory can be created or removed between the
  // check and the read, so the answer the check returned would be about a
  // moment that has passed. Do the operation, interpret its failure.
  let buckets: Dirent<string>[];
  try {
    buckets = readdirSync(shardRootAbs, { withFileTypes: true });
  } catch {
    // An absent or unreadable shard root yields ZERO archived PRs, which the
    // liveness check in `judge` then turns into exit 2. It must never be
    // mistaken for "the store is empty and coverage is therefore perfect".
    return out;
  }
  for (const bucket of buckets) {
    if (!bucket.isDirectory()) continue;
    const dir = resolve(shardRootAbs, bucket.name);
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      continue; // a bucket removed mid-scan contributes nothing, and says so by omission
    }
    for (const f of names) {
      if (!f.endsWith(".json")) continue;
      // The PR number is inside the shard rather than in its filename (the
      // filename is a ZetaId), so it is read rather than parsed off the path.
      try {
        const parsed: unknown = JSON.parse(readFileSync(resolve(dir, f), "utf8"));
        const n = (parsed as { pr_number?: unknown }).pr_number;
        if (typeof n === "number" && Number.isInteger(n) && n > 0) out.add(n);
      } catch {
        // An unreadable shard is NOT counted as archived. Fail-closed: a corrupt
        // record is a record we do not have, and pretending otherwise would let
        // corruption raise the coverage number.
      }
    }
  }
  return out;
}

/** Pure core. No IO, no clock of its own — `now` is injected (§13). */
export function computeCoverage(
  merged: readonly MergedPr[],
  archived: ReadonlySet<number>,
  now: Date,
  windowDays: number = DEFAULT_WINDOW_DAYS,
  graceMinutes: number = DEFAULT_GRACE_MINUTES,
): CoverageReport {
  const graceMs = graceMinutes * 60_000;
  const windowStartMs = now.getTime() - windowDays * 86_400_000;
  const counts: Record<GapClass, number> = {
    excluded: 0,
    "pre-lane": 0,
    "in-flight": 0,
    missing: 0,
  };
  const missing: number[] = [];
  let lifeEligible = 0;
  let lifeArchived = 0;
  let winEligible = 0;
  let winArchived = 0;

  for (const pr of merged) {
    const isArchived = archived.has(pr.number);
    const cls = classifyGap({ ...pr, isArchived }, now, graceMs);
    if (cls !== null) counts[cls] += 1;
    if (cls === "excluded") continue; // out of scope for BOTH denominators
    if (cls === "missing") missing.push(pr.number);

    // Lifetime denominator: every eligible merged PR, including pre-lane ones.
    // Pre-lane PRs are counted as MISSING here on purpose — the corpus really
    // does not contain them, and hiding that would make lifetime coverage a
    // measure of the lane's diligence rather than of what we own.
    lifeEligible += 1;
    if (isArchived) lifeArchived += 1;

    const mergedMs = Date.parse(pr.mergedAt);
    if (Number.isNaN(mergedMs) || mergedMs < windowStartMs) continue;
    // In-flight records are excluded from the WINDOW denominator entirely rather
    // than counted as failures: they have not yet had their chance.
    if (cls === "in-flight") continue;
    winEligible += 1;
    if (isArchived) winArchived += 1;
  }

  const frac = (a: number, b: number): number | null => (b === 0 ? null : a / b);
  return {
    lifetime: { eligible: lifeEligible, archived: lifeArchived, coverage: frac(lifeArchived, lifeEligible) },
    window: { eligible: winEligible, archived: winArchived, coverage: frac(winArchived, winEligible) },
    windowDays,
    missing: missing.sort((a, b) => a - b),
    counts,
  };
}

export type Verdict =
  | { readonly ok: true; readonly lines: readonly string[] }
  | { readonly ok: false; readonly code: 1 | 2; readonly lines: readonly string[] };

/**
 * Turn a report into a verdict.
 *
 * exit 2 — LIVENESS. Nothing was inspected, so the audit learned nothing. This
 *          is distinct from failure and must never read as success.
 * exit 1 — coverage below a threshold.
 */
export function judge(report: CoverageReport, thresholds: CoverageThresholds): Verdict {
  const pct = (v: number | null): string => (v === null ? "n/a" : `${(v * 100).toFixed(2)}%`);
  const lines = [
    `lifetime: ${String(report.lifetime.archived)}/${String(report.lifetime.eligible)} eligible merged PRs archived = ${pct(report.lifetime.coverage)} (floor ${pct(thresholds.lifetime)})`,
    `window:   ${String(report.window.archived)}/${String(report.window.eligible)} over the last ${String(report.windowDays)}d = ${pct(report.window.coverage)} (floor ${pct(thresholds.window)})`,
    `classes:  excluded=${String(report.counts.excluded)} pre-lane=${String(report.counts["pre-lane"])} in-flight=${String(report.counts["in-flight"])} missing=${String(report.counts.missing)}`,
  ];

  if (report.lifetime.eligible === 0) {
    return {
      ok: false,
      code: 2,
      lines: [
        ...lines,
        "LIVENESS FAILURE: zero eligible merged PRs were inspected. The merged-PR listing or the",
        "shard index is broken. A coverage audit that examined nothing has not found coverage —",
        "it has found nothing, and reporting that as success is the vacuity class.",
      ],
    };
  }

  const failures: string[] = [];
  if (report.window.coverage !== null && report.window.coverage < thresholds.window) {
    failures.push(
      `WINDOW coverage ${pct(report.window.coverage)} is below the ${pct(thresholds.window)} floor. ` +
        `${String(report.counts.missing)} eligible PR(s) merged more than the grace period ago have no archive record. ` +
        `The most likely cause is a merge path that GitHub will not let trigger pr-archive-on-merge.yml ` +
        `(a merge performed with GITHUB_TOKEN creates no pull_request event), leaving the backfill sweep ` +
        `in agent-heartbeat.yml as the only net — check that it is running and that its --limit keeps up.`,
    );
  }
  if (report.lifetime.coverage !== null && report.lifetime.coverage < thresholds.lifetime) {
    failures.push(
      `LIFETIME coverage ${pct(report.lifetime.coverage)} is below the ${pct(thresholds.lifetime)} ratchet. ` +
        `Backfill with: bun src/Core.TypeScript/forge-host/github/backfill-pr-archive.ts --resume`,
    );
  }
  if (failures.length > 0) return { ok: false, code: 1, lines: [...lines, ...failures] };
  return { ok: true, lines };
}

// ── Edge: fetching the merged-PR list ────────────────────────────────────────

/**
 * Page the merged-PR list out of GraphQL.
 *
 * NOT `gh pr list --limit N`. That call returns the NEWEST N and silently
 * truncates, which is exactly the defect that caps the backfill sweep's
 * visibility at PR ~11458 and makes the 1,506 pre-lane PRs unreachable to it. An
 * audit whose denominator is silently truncated reports a coverage number for a
 * corpus it chose, which is worse than reporting none. This pages to exhaustion
 * and says so.
 *
 * Cost: 100 PRs per request, ~134 requests for the full history against a 5,000
 * point/hour budget. `--window-days` is honoured by stopping early once the page
 * cursor passes the window, so the routine CI call is a handful of requests.
 */
export async function fetchMergedPrs(
  owner: string,
  repo: string,
  runGh: (args: readonly string[]) => Promise<string>,
  sinceIso?: string,
): Promise<MergedPr[]> {
  const out: MergedPr[] = [];
  let cursor: string | null = null;
  // DESC so a windowed run can stop as soon as it passes the window start.
  for (;;) {
    const after = cursor === null ? "null" : `"${cursor}"`;
    const query = `query { repository(owner: "${owner}", name: "${repo}") {
      pullRequests(states: MERGED, first: 100, after: ${after}, orderBy: {field: CREATED_AT, direction: DESC}) {
        pageInfo { hasNextPage endCursor }
        nodes { number mergedAt headRefName headRepositoryOwner { login } }
      } } }`;
    const raw = await runGh(["api", "graphql", "-f", `query=${query}`]);
    const parsed = JSON.parse(raw) as {
      data?: {
        repository?: {
          pullRequests?: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: Array<{
              number: number;
              mergedAt: string | null;
              headRefName: string;
              headRepositoryOwner: { login: string } | null;
            }>;
          };
        };
      };
    };
    const page = parsed.data?.repository?.pullRequests;
    if (page === undefined) throw new Error(`unexpected GraphQL shape: ${raw.slice(0, 400)}`);
    for (const n of page.nodes) {
      if (n.mergedAt === null) continue;
      out.push({
        number: n.number,
        mergedAt: n.mergedAt,
        headRefName: n.headRefName,
        headRepoIsSameRepo: n.headRepositoryOwner === null || n.headRepositoryOwner.login === owner,
      });
    }
    // Ordering is by CREATION, so a PR created long before it merged can appear
    // after ones that merged later. Stopping on the first out-of-window node
    // would drop exactly those — the bug already found once in this subsystem
    // (PR #10367, created 08-13, merged 08-17). So the early stop is keyed on
    // the whole page being out of window, never on a single node.
    if (sinceIso !== undefined && page.nodes.length > 0) {
      const newest = page.nodes.reduce((acc, n) => (n.mergedAt !== null && n.mergedAt > acc ? n.mergedAt : acc), "");
      if (newest !== "" && newest < sinceIso) break;
    }
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }
  return out;
}

async function gh(args: readonly string[]): Promise<string> {
  const proc = Bun.spawn(["gh", ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`gh ${args.slice(0, 2).join(" ")} exited ${String(code)}: ${stderr.slice(0, 400)}`);
  return stdout;
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  let owner = "Lucent-Financial-Group";
  let repo = "Zeta";
  let repoRoot = process.cwd();
  let windowDays = DEFAULT_WINDOW_DAYS;
  let graceMinutes = DEFAULT_GRACE_MINUTES;
  let thresholds = { ...DEFAULT_THRESHOLDS };
  let listMissing = false;
  let lifetimeScan = true;

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? "";
    const val = (): string => argv[++i] ?? "";
    if (a === "--owner") owner = val();
    else if (a === "--repo") repo = val();
    else if (a === "--repo-root") repoRoot = val();
    else if (a === "--window-days") windowDays = Number.parseInt(val(), 10);
    else if (a === "--grace-minutes") graceMinutes = Number.parseInt(val(), 10);
    else if (a === "--min-window") thresholds = { ...thresholds, window: Number.parseFloat(val()) };
    else if (a === "--min-lifetime") thresholds = { ...thresholds, lifetime: Number.parseFloat(val()) };
    else if (a === "--list-missing") listMissing = true;
    // Window-only mode: pages just far enough to answer "is the lane working
    // now". Lifetime coverage is then NOT computed, and the audit says so
    // instead of printing a truncated number that looks like a full one.
    else if (a === "--window-only") lifetimeScan = false;
    else if (a === "--help" || a === "-h") {
      process.stdout.write(
        "usage: bun audit-pr-archive-coverage.ts [--window-days N] [--grace-minutes N]\n" +
          "         [--min-window 0.95] [--min-lifetime 0.75] [--window-only] [--list-missing]\n" +
          "exit 0 = coverage above both floors; 1 = below a floor; 2 = liveness failure\n",
      );
      return 0;
    }
  }

  const now = new Date();
  const sinceIso = lifetimeScan
    ? undefined
    : new Date(now.getTime() - windowDays * 86_400_000 - graceMinutes * 60_000).toISOString();

  const merged = await fetchMergedPrs(owner, repo, gh, sinceIso);
  const archived = readArchivedPrNumbers(resolve(repoRoot, "docs/github/prs/shards"));
  const report = computeCoverage(merged, archived, now, windowDays, graceMinutes);
  const verdict = judge(
    lifetimeScan
      ? report
      : // Do not judge a lifetime number derived from a partial scan. Suppressing
        // the floor is honest; printing the partial figure as if complete is not.
        {
          ...report,
          lifetime: { eligible: report.lifetime.eligible, archived: report.lifetime.archived, coverage: null },
        },
    thresholds,
  );

  process.stdout.write(
    `pr-archive coverage (scan: ${lifetimeScan ? "full history" : `last ${String(windowDays)}d`}, since ${EVENT_LANE_LANDED} the event lane has existed)\n`,
  );
  for (const l of verdict.lines) process.stdout.write(`  ${l}\n`);
  if (listMissing && report.missing.length > 0) {
    process.stdout.write(`  missing: ${report.missing.join(",")}\n`);
  }
  return verdict.ok ? 0 : verdict.code;
}

if (import.meta.main) {
  process.exit(await main());
}
