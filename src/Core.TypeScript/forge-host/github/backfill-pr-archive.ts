#!/usr/bin/env bun
// backfill-pr-archive.ts — the paced, resumable drain for the archive backlog.
//
// WHY A SEPARATE TOOL AND NOT JUST `--all-merged`
// ----------------------------------------------
// `archive-pr-reviews.ts --all-merged` is the right tool for the ONGOING gap and
// this file does not duplicate it: the per-PR work is `buildArchive` /
// `writeArchive` / `writeShard`, imported, not reimplemented. What it cannot do
// is reach the backlog, for two reasons that are both load-bearing:
//
//   1. `MERGED_LIST_LIMIT = 3000` and `gh pr list` returns the NEWEST N. On main
//      2026-08-25 that window starts at PR ~11458, so the 1,506 PRs merged
//      before the event lane existed (2026-05-06) are permanently invisible to
//      it. Raising that constant is not the fix — it makes every 15-minute tick
//      pay for a full-history listing to serve a one-time drain.
//   2. It has no checkpoint. It is designed to be called repeatedly with a small
//      `--limit` from a cadence job, where "resume" means "the next tick
//      re-derives what is left". A 3,000-PR drain takes hours, and re-deriving
//      the worklist from scratch after every interruption is most of the cost.
//
// So: the sweep keeps the lane current, this drains history, and the shared
// primitives keep them byte-identical in what they write.
//
// PACING — WHAT THE LIMITS ACTUALLY ARE
// -------------------------------------
// Authenticated GitHub gives 5,000 REST requests/hour and 5,000 GraphQL
// points/hour, and — undocumented, and the one that actually bites — SECONDARY
// limits on burst rate and concurrency that return 403 with a `Retry-After`.
// Each PR costs roughly 4 calls (metadata, review comments, review threads,
// commits), so ~1,200 PRs/hour is the hard ceiling and the practical rate is
// lower. This tool:
//
//   * reads `rate_limit` before starting and every `--check-every` PRs, and
//     SLEEPS until reset when the remaining budget falls under a reserve;
//   * honours `Retry-After` on 403/429, with exponential backoff and jitter
//     when the header is absent;
//   * paces requests with a minimum inter-PR delay so it never bursts.
//
// The reserve exists so this tool cannot starve the interactive agents sharing
// the same token. A backfill that blocks the factory is not an improvement.
//
// RESUMABILITY — WHY A CHECKPOINT AND NOT "JUST RE-DERIVE"
// -------------------------------------------------------
// The machine this runs on has kernel-panicked repeatedly. A crash must resume,
// not restart. The checkpoint is a JSON file holding the worklist and the
// cursor; it is rewritten after EVERY PR (a few KB — cheaper than the API call
// that preceded it), so the worst case loses one PR of progress.
//
// The checkpoint is a CACHE, never the source of truth. `--resume` re-checks the
// shard store on every PR before archiving it, so a record that landed from the
// sweep while this was stopped is skipped rather than re-fetched. That is what
// makes concurrent operation with the cadence lane safe.
//
// IDEMPOTENCY (§12). Re-running duplicates nothing, and this is a property of
// the writers rather than of this file: `writeArchive` short-circuits on
// identical bytes and `writeShard` no-ops modulo the two wall-clock-noise fields
// (`fetched_at`, `commit_sha`). Running it twice over the same range is a no-op.
//
// DELIVERY. It commits to the CURRENT branch in batches and does not push and
// does not open PRs. Opening one PR per record is the exact accumulation that
// produced 1,298 orphaned branches; batching into one branch is the shape
// `flush-via-staging.ts` uses and this tool stays out of its way by leaving
// delivery to the caller.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildArchive, buildManifestEntry, readGitHeadSha, writeArchive } from "./archive-pr-reviews.ts";
import { shardPathFor, writeShard, SHARD_ROOT_RELATIVE } from "./pr-manifest-shards.ts";
import { isArchiveEligible } from "./archive-eligibility.ts";

export interface Checkpoint {
  readonly version: 1;
  readonly owner: string;
  readonly repo: string;
  /** Oldest-first worklist, derived once. */
  readonly worklist: readonly number[];
  /** Index into `worklist` of the next PR to attempt. */
  readonly cursor: number;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly archived: number;
  readonly skipped: number;
  readonly failed: readonly number[];
}

export const DEFAULT_CHECKPOINT = ".backfill-pr-archive.checkpoint.json";

/**
 * Keep this much of the hourly budget unspent.
 *
 * 500 of 5,000. The token is shared with the heartbeat lanes, the archive sweep
 * and every interactive agent; a backfill that drains the budget to zero stops
 * the factory to save itself time, which is a bad trade at any speed.
 */
export const RATE_RESERVE = 500;

/** Roughly how many API calls archiving one PR costs. Measured, not guessed. */
export const CALLS_PER_PR = 4;

export interface RateSnapshot {
  readonly remaining: number;
  readonly limit: number;
  /** Unix seconds. */
  readonly reset: number;
}

export function parseRateLimit(raw: string): RateSnapshot {
  const j = JSON.parse(raw) as {
    resources?: { core?: { remaining?: number; limit?: number; reset?: number } };
  };
  const core = j.resources?.core;
  if (core?.remaining === undefined || core.reset === undefined) {
    throw new Error(`unexpected rate_limit shape: ${raw.slice(0, 200)}`);
  }
  return { remaining: core.remaining, limit: core.limit ?? 5000, reset: core.reset };
}

/**
 * How long to wait before the next PR, in ms.
 *
 * Returns the full time-to-reset when the budget is under the reserve — the only
 * correct answer, because the budget does not refill gradually. Otherwise it
 * paces to `minDelayMs`, which is what keeps the SECONDARY (burst) limit out of
 * play; those are the ones with no published number, so the only safe strategy
 * is to never approach them.
 */
export function pacingDelayMs(rate: RateSnapshot, nowMs: number, minDelayMs: number): number {
  if (rate.remaining < RATE_RESERVE + CALLS_PER_PR) {
    // +5s so we wake AFTER the reset rather than one tick before it.
    return Math.max(0, rate.reset * 1000 - nowMs) + 5_000;
  }
  return minDelayMs;
}

function gh(args: readonly string[]): { ok: boolean; out: string; err: string } {
  const r = spawnSync("gh", args as string[], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: r.stdout ?? "", err: r.stderr ?? "" };
}

/**
 * Seconds to wait after a throttled response.
 *
 * `Retry-After` is authoritative when present — GitHub is telling us exactly how
 * long, and guessing shorter is how a secondary limit becomes a longer one.
 * Absent it, exponential with jitter; the jitter matters because several agents
 * share this token and synchronised retries are how a burst limit is re-hit at
 * the moment it lifts.
 */
export function backoffSeconds(stderr: string, attempt: number, jitter: number): number {
  const m = /retry-after:\s*(\d+)/i.exec(stderr);
  if (m !== null) return Number.parseInt(m[1] ?? "60", 10);
  return Math.min(900, 2 ** Math.min(attempt, 8) * 15) * (1 + jitter * 0.25);
}

export function isThrottled(stderr: string): boolean {
  return /\b(403|429)\b/.test(stderr) && /rate limit|secondary rate|abuse detection|retry-after/i.test(stderr);
}

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => {
    setTimeout(r, ms);
  });

function loadCheckpoint(path: string): Checkpoint | null {
  // No existsSync gate. Read it and interpret the failure — ENOENT (no
  // checkpoint yet, the ordinary first run) and a corrupt file both mean the
  // same thing here, "we have no resumable state", and both are safe.
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null; // first run, or the file vanished between two instants
  }
  try {
    const c = JSON.parse(raw) as Checkpoint;
    if (c.version !== 1 || !Array.isArray(c.worklist)) return null;
    return c;
  } catch {
    // A corrupt checkpoint is discarded rather than trusted. Re-deriving the
    // worklist costs a few minutes; resuming from a half-written cursor could
    // skip records silently, which is the failure this whole change set exists
    // to stop.
    process.stderr.write("[backfill] checkpoint unreadable — re-deriving worklist\n");
    return null;
  }
}

function saveCheckpoint(path: string, c: Checkpoint): void {
  writeFileSync(path, `${JSON.stringify(c, null, 2)}\n`);
}

/** Page every merged PR, oldest-first, applying the shared eligibility rule. */
function deriveWorklist(owner: string, repo: string, shardRootAbs: string): number[] {
  process.stderr.write("[backfill] deriving worklist (full history — this pages ~134 times)\n");
  const out: number[] = [];
  let cursor: string | null = null;
  for (;;) {
    const after = cursor === null ? "null" : `"${cursor}"`;
    const query = `query { repository(owner: "${owner}", name: "${repo}") {
      pullRequests(states: MERGED, first: 100, after: ${after}, orderBy: {field: CREATED_AT, direction: ASC}) {
        pageInfo { hasNextPage endCursor }
        nodes { number mergedAt headRefName headRepositoryOwner { login } }
      } } }`;
    const r = gh(["api", "graphql", "-f", `query=${query}`]);
    if (!r.ok) throw new Error(`worklist paging failed: ${r.err.slice(0, 300)}`);
    const page = (
      JSON.parse(r.out) as {
        data: {
          repository: {
            pullRequests: {
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
      }
    ).data.repository.pullRequests;
    for (const n of page.nodes) {
      if (n.mergedAt === null) continue;
      if (
        !isArchiveEligible({
          headRefName: n.headRefName,
          headRepoIsSameRepo: n.headRepositoryOwner === null || n.headRepositoryOwner.login === owner,
        })
      ) {
        continue;
      }
      if (existsSync(shardPathFor(n.number, shardRootAbs))) continue;
      out.push(n.number);
    }
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }
  // OLDEST-FIRST, for the anti-starvation reason `selectBatch` documents: a
  // newest-first drain re-selects the head every run and the tail never lands.
  return out.sort((a, b) => a - b);
}

function commitBatch(repoRoot: string, n: number): void {
  const add = spawnSync("git", ["-C", repoRoot, "add", "docs/history/pr-reviews/", "docs/github/prs/shards/"], {
    encoding: "utf8",
  });
  if (add.status !== 0) return;
  const dirty = spawnSync("git", ["-C", repoRoot, "diff", "--cached", "--quiet"], {
    encoding: "utf8",
  });
  if (dirty.status === 0) return; // nothing staged
  // The derived manifest is deliberately NOT staged, for the same reason
  // pr-archive-on-merge.yml does not stage it: it is a single trailing region
  // that every concurrent writer appends to, which makes batches conflict
  // PAIRWISE. It is repaired by the serialised writer (derive-pr-manifest.ts).
  spawnSync("git", ["-C", repoRoot, "restore", "--staged", "docs/github/prs/manifest.jsonl"], {
    encoding: "utf8",
  });
  spawnSync(
    "git",
    [
      "-C",
      repoRoot,
      "commit",
      "-q",
      "-m",
      `archive(pr-reviews): backfill batch — ${String(n)} record(s)\n\n` +
        `Generated by src/Core.TypeScript/forge-host/github/backfill-pr-archive.ts.\n\n` +
        "Agency-Signature-Version: 1\n" +
        "Agent: otto\n" +
        "Agent-Runtime: claude-code\n" +
        "Agent-Model: claude-opus-5\n" +
        "Credential-Identity: AceHack\n" +
        "Credential-Mode: shared\n" +
        "Human-Review: not-implied-by-credential\n" +
        "Human-Review-Evidence: none\n" +
        "Action-Mode: autonomous-fail-closed\n" +
        "Task: none\n" +
        "Co-authored-by: Claude Opus 5 <noreply@anthropic.com>\n",
    ],
    { encoding: "utf8" },
  );
}

export async function run(argv: readonly string[]): Promise<number> {
  let owner = "Lucent-Financial-Group";
  let repo = "Zeta";
  let repoRoot = process.cwd();
  let checkpointPath = DEFAULT_CHECKPOINT;
  let limit = Number.POSITIVE_INFINITY;
  let minDelayMs = 1200;
  let checkEvery = 25;
  let batchSize = 50;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? "";
    const v = (): string => argv[++i] ?? "";
    if (a === "--owner") owner = v();
    else if (a === "--repo") repo = v();
    else if (a === "--repo-root") repoRoot = v();
    else if (a === "--checkpoint") checkpointPath = v();
    else if (a === "--limit") limit = Number.parseInt(v(), 10);
    else if (a === "--min-delay-ms") minDelayMs = Number.parseInt(v(), 10);
    else if (a === "--check-every") checkEvery = Number.parseInt(v(), 10);
    else if (a === "--batch-size") batchSize = Number.parseInt(v(), 10);
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--resume") {
      /* default behaviour; accepted so the documented command reads honestly */
    } else if (a === "--help" || a === "-h") {
      process.stdout.write(
        "usage: bun backfill-pr-archive.ts [--resume] [--limit N] [--min-delay-ms MS]\n" +
          "         [--batch-size N] [--check-every N] [--checkpoint PATH] [--dry-run]\n\n" +
          "Resumable. Re-run the same command after any interruption; progress is in the\n" +
          "checkpoint file and the shard store is re-checked per PR, so nothing is redone.\n",
      );
      return 0;
    }
  }

  const shardRootAbs = resolve(repoRoot, SHARD_ROOT_RELATIVE);
  const cpAbs = resolve(repoRoot, checkpointPath);

  let cp: Checkpoint | null = loadCheckpoint(cpAbs);
  if (cp === null || cp.owner !== owner || cp.repo !== repo) {
    const worklist = deriveWorklist(owner, repo, shardRootAbs);
    cp = {
      version: 1,
      owner,
      repo,
      worklist,
      cursor: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: 0,
      skipped: 0,
      failed: [],
    };
    saveCheckpoint(cpAbs, cp);
  }

  // `cp` is non-null past this point — the branch above assigns a fresh
  // checkpoint whenever it was null. The annotation is what lets tsc see the
  // element type of `worklist` through the `{ ...cp }` reassignments below;
  // without it the inference is circular (TS7022).
  let state: Checkpoint = cp;
  const total = state.worklist.length;
  process.stderr.write(
    `[backfill] worklist ${String(total)} PR(s); resuming at index ${String(state.cursor)} ` +
      `(${String(total - state.cursor)} remaining)\n`,
  );
  if (dryRun) {
    process.stderr.write(
      `[backfill] dry run — first 20: ${state.worklist.slice(state.cursor, state.cursor + 20).join(",")}\n`,
    );
    return 0;
  }

  const commitSha = readGitHeadSha(repoRoot);
  const outputDirAbs = resolve(repoRoot, "docs/history/pr-reviews");
  const startedCursor = state.cursor;
  let sinceCommit = 0;
  let attempt = 0;
  const t0 = Date.now();

  while (state.cursor < total && state.cursor - startedCursor < limit) {
    const pr: number | undefined = state.worklist[state.cursor];
    if (pr === undefined) break;

    // Re-check the shard store EVERY time rather than trusting the worklist. The
    // cadence sweep is running concurrently and may have landed this record
    // while we were stopped; re-fetching it would spend four API calls to
    // produce identical bytes.
    if (existsSync(shardPathFor(pr, shardRootAbs))) {
      state = { ...state, cursor: state.cursor + 1, skipped: state.skipped + 1, updatedAt: new Date().toISOString() };
      saveCheckpoint(cpAbs, state);
      continue;
    }

    if ((state.cursor - startedCursor) % checkEvery === 0) {
      const r = gh(["api", "rate_limit"]);
      if (r.ok) {
        const rate = parseRateLimit(r.out);
        const wait = pacingDelayMs(rate, Date.now(), 0);
        if (wait > 0) {
          process.stderr.write(
            `[backfill] rate budget ${String(rate.remaining)}/${String(rate.limit)} under reserve — ` +
              `sleeping ${String(Math.round(wait / 1000))}s until reset\n`,
          );
          await sleep(wait);
        }
      }
    }

    try {
      const archive = buildArchive(owner, repo, pr);
      const w = writeArchive(archive, outputDirAbs);
      const entry = buildManifestEntry(archive, w.path, repoRoot, commitSha);
      writeShard(entry, shardRootAbs);
      state = { ...state, cursor: state.cursor + 1, archived: state.archived + 1, updatedAt: new Date().toISOString() };
      attempt = 0;
      sinceCommit += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isThrottled(msg)) {
        attempt += 1;
        const s = backoffSeconds(msg, attempt, Math.random());
        process.stderr.write(
          `[backfill] throttled — backing off ${String(Math.round(s))}s (attempt ${String(attempt)})\n`,
        );
        await sleep(s * 1000);
        continue; // same PR, do NOT advance the cursor
      }
      // A PR that genuinely cannot be archived (deleted, permission, malformed)
      // is RECORDED and skipped rather than allowed to wedge the drain. The
      // failed list is the honest residue — it is not retried silently and it is
      // not hidden.
      process.stderr.write(`[backfill] PR #${String(pr)} failed: ${msg.slice(0, 200)}\n`);
      state = {
        ...state,
        cursor: state.cursor + 1,
        failed: [...state.failed, pr],
        updatedAt: new Date().toISOString(),
      };
    }

    saveCheckpoint(cpAbs, state);

    if (sinceCommit >= batchSize) {
      commitBatch(repoRoot, sinceCommit);
      sinceCommit = 0;
    }
    const done = state.cursor - startedCursor;
    if (done > 0 && done % 25 === 0) {
      const rate = done / ((Date.now() - t0) / 1000 / 60);
      const left = total - state.cursor;
      process.stderr.write(
        `[backfill] ${String(state.cursor)}/${String(total)} ` +
          `(archived ${String(state.archived)}, skipped ${String(state.skipped)}, failed ${String(state.failed.length)}) ` +
          `— ${rate.toFixed(1)}/min, ~${(left / Math.max(rate, 0.01) / 60).toFixed(1)}h remaining\n`,
      );
    }
    await sleep(minDelayMs);
  }

  if (sinceCommit > 0) commitBatch(repoRoot, sinceCommit);
  process.stderr.write(
    `[backfill] stopped at ${String(state.cursor)}/${String(total)}; archived ${String(state.archived)}, ` +
      `skipped ${String(state.skipped)}, failed ${String(state.failed.length)}. ` +
      `Resume: bun src/Core.TypeScript/forge-host/github/backfill-pr-archive.ts --resume\n`,
  );
  return 0;
}

if (import.meta.main) {
  process.exit(await run(process.argv.slice(2)));
}
