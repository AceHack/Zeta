#!/usr/bin/env bun
// audit-archive-pr-lane.ts — the falsifier for a condition the archive lane
// could not previously see: an open archive PR that can never contribute
// substrate, sitting open forever because nothing reaps it.
//
// WHY THIS FILE EXISTS
// --------------------
// `pr-archive-on-merge.yml` opens one PR per merged source PR. Two independent
// writers produce those records:
//
//   1. the event lane — `pr-archive-on-merge.yml`, fires on `pull_request: closed`
//   2. the backfill lane — soraya's archive duty in `agent-heartbeat.yml`, which
//      sweeps un-archived merged PRs and reconciles under-reported ones
//
// Both are individually correct and individually IDEMPOTENT: `writeArchive`
// short-circuits on identical bytes, and `writeShard` / the manifest updater
// both no-op modulo the two wall-clock-noise fields (`fetched_at`, `commit_sha`).
// Idempotency is not the gap.
//
// The gap is that they race from DIFFERENT BASES. Measured 2026-08-22:
//
//   18:04:39  PR #12059 merges
//   18:04:42  event lane starts, from a main WITHOUT the record
//   18:05:19  event lane fetches -> opens archive PR #13843
//   18:08:40  backfill lane fetches the SAME PR
//   18:25:04  backfill copy lands on main via heartbeat batch merge #13850
//   ...       #13843 is now an unresolvable add/add on its own shard path
//
// The loser of that race is not recoverable by rebasing and not merge-able:
// its markdown is byte-identical to main's and its shard is strictly STALER
// (`fetched_at` 18:05:19 against main's 18:08:40). Merging it would move the
// audit timestamp backwards and add zero review substrate.
//
// And nothing noticed. It is armed, so the heartbeat's arming step filters it
// out (`auto_merge != null`); `--auto` can never merge a CONFLICTING PR; no
// reaper exists. #13843 sat open for three hours and was found by hand.
//
// That is the accumulation generator this audit closes: not the conflict, which
// is a benign race, but the SILENCE afterwards. This is the fourth accumulation
// in this lane's history (~4,049 branches drained in #6879, 1,132 in #8043, 16
// in #9059, 1,229 in #10346) and every previous round drained the symptom.
//
// WHAT IT CHECKS
// --------------
// For every open PR on an `automation/pr-archive-<N>-run-...` branch: if source
// PR <N> ALREADY has an archive doc on main, that PR is REDUNDANT — its record
// is already preserved, so it can only ever merge a duplicate or sit conflicting.
//
// WHY AN AGE GRACE WINDOW, AND WHY IT IS NOT A LOOPHOLE
// -----------------------------------------------------
// A redundant archive PR younger than the grace window is the NORMAL race in
// flight, not a defect — the two writers legitimately overlap for a few minutes
// and the lane resolves it. Failing on that would make this audit flap on
// healthy operation, and a check that cries wolf is one that gets ignored.
// Past the window the race is over and the PR is simply stranded.
//
// LIVENESS: this audit refuses to pass while inspecting nothing. An empty
// archive-doc index means the index lookup is broken, not that the lane is
// clean — "checked 0 records" must never read as success. A lane with no open
// archive PRs IS a legitimately healthy state and passes.

import { readdirSync } from "node:fs";
import { resolve } from "node:path";

/** Default grace window: past this, a redundant archive PR is stranded, not racing. */
export const DEFAULT_GRACE_MINUTES = 60;

/** The branch prefix the event lane pushes. Anything else is out of scope. */
export const ARCHIVE_BRANCH_PREFIX = "automation/pr-archive-";

export interface OpenArchivePr {
  number: number;
  /** Head branch, e.g. `automation/pr-archive-12059-run-32589658743-attempt-1`. */
  headRef: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
}

export type ArchivePrVerdict = "redundant-stranded" | "redundant-racing" | "pending";

export interface ArchivePrFinding {
  /** The archive PR's own number. */
  prNumber: number;
  /** The source PR whose record it carries, parsed from the branch. */
  sourcePr: number;
  verdict: ArchivePrVerdict;
  ageMinutes: number;
}

/**
 * Parse the source PR number out of an archive branch name.
 *
 * Returns null for anything that is not an archive branch. Deliberately strict:
 * a branch we cannot parse is OUT OF SCOPE, never a silent 0. Fail-closed in the
 * sense that matters here — we decline to classify rather than guess.
 */
export function parseSourcePr(headRef: string): number | null {
  if (!headRef.startsWith(ARCHIVE_BRANCH_PREFIX)) return null;
  const m = /^automation\/pr-archive-(\d+)-run-/.exec(headRef);
  if (m === null) return null;
  const n = Number.parseInt(m[1]!, 10);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * Index the archive docs present on main, by source PR number.
 *
 * Filenames are `PR-<N>-<slug>.md`.
 *
 * The `0*` in the pattern is belt-and-braces, NOT load-bearing: `parseInt(_, 10)`
 * already normalises `0999` to `999`, so removing it changes no behaviour. Stated
 * plainly because the first version of this comment claimed the strip was
 * essential — a mutation run (drop the `0*`, tests still pass) proved that false.
 * An unfalsified claim about your own code is exactly what this file exists to
 * catch, and it does not get an exemption for being in a comment.
 */
export function indexArchivedPrs(prReviewsDir: string): Set<number> {
  const out = new Set<number>();
  for (const name of readdirSync(prReviewsDir)) {
    const m = /^PR-0*(\d+)-/.exec(name);
    if (m === null) continue;
    const n = Number.parseInt(m[1]!, 10);
    if (Number.isSafeInteger(n) && n > 0) out.add(n);
  }
  return out;
}

/**
 * Classify one open archive PR against the set of records already on main.
 *
 * Pure — no clock, no network. `now` is injected so the verdict is a function of
 * (evidence, phase) and replays deterministically under DST. Reading an ambient
 * clock here would make two runs against the same tree disagree, which is the
 * local-time-in-the-shared-fold defect stated for a check instead of a belief.
 */
export function classifyArchivePr(
  pr: OpenArchivePr,
  archivedOnMain: ReadonlySet<number>,
  now: Date,
  graceMinutes: number = DEFAULT_GRACE_MINUTES,
): ArchivePrFinding | null {
  const sourcePr = parseSourcePr(pr.headRef);
  if (sourcePr === null) return null;

  const ageMinutes = (now.getTime() - new Date(pr.createdAt).getTime()) / 60_000;

  if (!archivedOnMain.has(sourcePr)) {
    return { prNumber: pr.number, sourcePr, verdict: "pending", ageMinutes };
  }
  return {
    prNumber: pr.number,
    sourcePr,
    verdict: ageMinutes > graceMinutes ? "redundant-stranded" : "redundant-racing",
    ageMinutes,
  };
}

export interface AuditResult {
  findings: ArchivePrFinding[];
  stranded: ArchivePrFinding[];
  /** True when the audit inspected a real index; false means it checked nothing. */
  live: boolean;
}

export function auditArchiveLane(
  openPrs: readonly OpenArchivePr[],
  archivedOnMain: ReadonlySet<number>,
  now: Date,
  graceMinutes: number = DEFAULT_GRACE_MINUTES,
): AuditResult {
  const findings: ArchivePrFinding[] = [];
  for (const pr of openPrs) {
    const f = classifyArchivePr(pr, archivedOnMain, now, graceMinutes);
    if (f !== null) findings.push(f);
  }
  findings.sort((a, b) => a.prNumber - b.prNumber);
  return {
    findings,
    stranded: findings.filter((f) => f.verdict === "redundant-stranded"),
    // Liveness is about the INDEX, not the PR list. Zero open archive PRs is a
    // healthy caught-up lane; zero indexed records means the lookup is broken.
    live: archivedOnMain.size > 0,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  const repoRoot = resolve(import.meta.dir, "../../..");
  const prReviewsDir = resolve(repoRoot, "docs/history/pr-reviews");

  const graceArg = process.argv.indexOf("--grace-minutes");
  const graceMinutes =
    graceArg !== -1 && process.argv[graceArg + 1] !== undefined
      ? Number.parseInt(process.argv[graceArg + 1]!, 10)
      : DEFAULT_GRACE_MINUTES;

  let archivedOnMain: Set<number>;
  try {
    archivedOnMain = indexArchivedPrs(prReviewsDir);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[archive-lane] cannot read ${prReviewsDir}: ${msg}\n`);
    return 2;
  }

  const repo = process.env["GITHUB_REPOSITORY"] ?? "Lucent-Financial-Group/Zeta";
  const proc = Bun.spawn(
    [
      "gh",
      "api",
      `repos/${repo}/pulls?state=open&per_page=100`,
      "--jq",
      ".[] | [.number, .head.ref, .created_at] | @tsv",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const raw = await new Response(proc.stdout).text();
  const rc = await proc.exited;
  if (rc !== 0) {
    const err = await new Response(proc.stderr).text();
    process.stderr.write(`[archive-lane] gh api failed rc=${rc}: ${err}\n`);
    return 2;
  }

  const openPrs: OpenArchivePr[] = raw
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => l.split("\t"))
    .filter((p) => p.length >= 3)
    .map((p) => ({
      number: Number.parseInt(p[0]!, 10),
      headRef: p[1]!,
      createdAt: p[2]!,
    }));

  const result = auditArchiveLane(openPrs, archivedOnMain, new Date(), graceMinutes);

  if (!result.live) {
    process.stderr.write(
      "[archive-lane] REFUSING TO PASS: indexed 0 archive records. " +
        "An empty index means the lookup is broken, not that the lane is clean.\n",
    );
    return 2;
  }

  process.stdout.write(
    `[archive-lane] indexed ${String(archivedOnMain.size)} records on main; ` +
      `${String(result.findings.length)} open archive PR(s); grace ${String(graceMinutes)}min\n`,
  );

  for (const f of result.findings) {
    if (f.verdict === "pending") continue;
    const age = f.ageMinutes.toFixed(0);
    if (f.verdict === "redundant-racing") {
      process.stdout.write(
        `[archive-lane] PR #${String(f.prNumber)} (archives #${String(f.sourcePr)}) ` +
          `is redundant but only ${age}min old — the normal two-writer race, in flight.\n`,
      );
    } else {
      process.stdout.write(
        `::warning title=Stranded archive PR::PR #${String(f.prNumber)} archives #${String(f.sourcePr)}, ` +
          `whose record is ALREADY on main, and is ${age}min old. It can only merge a duplicate ` +
          `or sit conflicting. Verify its doc is byte-identical to main's, then close it.\n`,
      );
    }
  }

  if (result.stranded.length > 0) {
    process.stdout.write(
      `[archive-lane] ${String(result.stranded.length)} stranded archive PR(s) — ` +
        "each one is a record already preserved on main.\n",
    );
  } else {
    process.stdout.write("[archive-lane] no stranded archive PRs.\n");
  }

  // Non-zero ONLY on a broken audit (handled above). A stranded PR is reported
  // loudly and does not turn the tick red: closing a PR is a judgement call that
  // belongs to a reviewer, and this audit's job is to make the condition VISIBLE,
  // not to arrogate the close. Detection is not a verdict.
  return 0;
}

if (import.meta.main) {
  process.exit(await main());
}
