#!/usr/bin/env bun
// audit-orphaned-archive-refs.ts — the falsifier for the invariant the archive
// lane has never been able to state: A PUSHED ARCHIVE REF MUST END WITH ITS
// RECORD ON `main`.
//
// WHY A SECOND ARCHIVE AUDIT, AND WHY THE FIRST ONE CANNOT SEE THIS
// -----------------------------------------------------------------
// `audit-archive-pr-lane.ts` is the sibling of this file and it is not
// redundant with it — it audits OPEN PULL REQUESTS on archive branches. Its
// input is `gh pr list`. That makes it structurally blind to the failure
// measured here, because the 1,284 refs at issue HAVE NO PR AT ALL: nothing
// ever opened one, so nothing ever listed them, so no check ever looked at
// them. A lane can be perfectly clean by that audit's reading while stranding a
// record on every merge.
//
// This is the proxy-vs-invariant distinction that let ten fixes pass while the
// leak continued. `pr-archive-on-merge.yml` was changed seventeen times; its
// recent run history is 12 success / 8 skipped / 0 failures. It was GREEN while
// stranding records, because every check it had asked a proxy question — "did
// the tool run", "did I create a PR", "is an open PR redundant" — and none
// asked the only question that is actually the point: IS THE RECORD ON MAIN?
//
// So this audit takes REFS as its input, not PRs. A ref is evidence that the
// lane produced a record; `main` is where that record was supposed to arrive.
// Anything in the gap is substrate that exists in exactly one place, on a
// branch nobody reads, which is the condition the archive lane exists to
// prevent for GitHub's own review threads. The lane had acquired the very
// defect it was built to cure.
//
// THE TWO VERDICTS, AND WHY THEY MUST NOT BE COLLAPSED
// ----------------------------------------------------
//   STRANDED — the ref exists and PR <N>'s record is NOT on main. This is
//              substrate loss in waiting. Deleting such a ref DESTROYS the only
//              copy; it must be LANDED. This is the number this audit gates on.
//   LANDED   — the ref exists and the record IS on main. The record is safe and
//              the ref is now litter. Reporting it separately is what lets a
//              cleanup pass delete refs without having to re-derive, one at a
//              time, which ones are safe to touch.
//
// Collapsing the two into "orphan count" is how a cleanup ends up deleting the
// records it was run to preserve, so the split is load-bearing rather than
// cosmetic.
//
// THE GATE IS A RATCHET, NOT A THRESHOLD
// ---------------------------------------
// `STRANDED_BASELINE` is a high-water mark that may only ever be lowered. A
// plain "fail if any stranded" would go red on the pre-existing backlog, stay
// red through work nobody in this change can finish, and be tolerated — which
// is precisely the failure mode that produced the backlog. A plain "fail over
// 1500" would let it grow again. The ratchet fails IMMEDIATELY on any NEW
// strand while the backfill drains the old ones, and each drained batch lowers
// the constant. It cannot be satisfied by deletion, because deleting a stranded
// ref does not put its record on main — it only destroys it, and the next run
// still counts the missing record via the ref that is gone. That asymmetry is
// deliberate: the cheap wrong fix does not make this check pass.
//
// LIVENESS: the audit refuses to pass while inspecting nothing. An empty record
// index means the lookup is broken, not that every record landed — "checked 0
// records" must never read as success. Zero archive refs IS a legitimately
// healthy state and passes.

import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { ARCHIVE_BRANCH_PREFIX, indexArchivedPrs, parseSourcePr } from "./audit-archive-pr-lane";

/**
 * High-water mark for stranded archive records, measured against `origin` on
 * 2026-08-25 when the leak was diagnosed. MAY ONLY BE LOWERED.
 *
 * Raising it is the tolerance this audit exists to remove: the previous lane
 * tolerated an unbounded number silently, and a constant that drifts upward is
 * the same tolerance with a number written next to it.
 *
 * THE MEASUREMENT THAT SET IT, because it corrected the diagnosis that
 * commissioned this file. The leak was reported as "1,284 stranded records".
 * Running this audit against `origin` and `main` together says otherwise:
 *
 *     1298 archive ref(s); 1279 landed (safe to delete),
 *     19 not on main (16 in flight, 3 settled, 0 unreadable age)
 *
 * Three numbers, three different meanings, and the reported one was none of them:
 *
 *   1,279  records that ARE on main. The backfill lane — soraya's archive duty in
 *          `agent-heartbeat.yml`, which sweeps un-archived merged PRs — landed them
 *          by a different route than the ref they were pushed on, and nothing ever
 *          went back to reap the ref. This is REF LITTER, safe to delete.
 *      16  pushed within the grace window and still landing. Normal operation.
 *       3  genuinely stranded: PRs #14346, #14882, #15186. THE ONLY REAL LOSS.
 *
 * This is why the verdicts are not collapsed. Had this audit reported a single
 * "orphan count" of 1,298, the obvious next act — delete the orphans — would have
 * destroyed 3 irreplaceable records to tidy up 1,279 dead refs. And had it reported
 * 1,284 as "stranded records needing a batched backfill", the work would have been
 * sized at four hundred times its actual scope.
 */
export const STRANDED_BASELINE = 3;

export type RefVerdict = "stranded" | "landed";

export interface RefFinding {
  /** The full branch name, e.g. `automation/pr-archive-12059-run-32589658743-attempt-1`. */
  readonly ref: string;
  /** The source PR whose record the ref carries, parsed from the branch name. */
  readonly sourcePr: number;
  readonly verdict: RefVerdict;
}

export interface RefAuditResult {
  readonly findings: readonly RefFinding[];
  /** Refs whose record is NOT on main. These must be landed, never deleted. */
  readonly stranded: readonly RefFinding[];
  /** Refs whose record IS on main. Safe for a cleanup pass to delete. */
  readonly landed: readonly RefFinding[];
  /** False when the record index was empty — the lookup is broken, not the lane clean. */
  readonly live: boolean;
}

/**
 * Classify every archive ref against the records present on `main`.
 *
 * Pure — no clock, no network, no filesystem. Unlike the sibling audit this one
 * needs no grace window: a ref is not a race in flight, it is a durable
 * artifact, and "the record is on main" is a settled fact at any instant. Adding
 * a time-based excuse here would reintroduce exactly the tolerance being removed.
 *
 * Refs that do not parse are OUT OF SCOPE rather than silently counted as clean
 * — declining to classify is honest; guessing zero is the vacuity class.
 */
export function auditArchiveRefs(
  refs: readonly string[],
  archivedOnMain: ReadonlySet<number>,
): RefAuditResult {
  const findings: RefFinding[] = [];
  for (const ref of refs) {
    const sourcePr = parseSourcePr(ref);
    if (sourcePr === null) continue;
    findings.push({
      ref,
      sourcePr,
      verdict: archivedOnMain.has(sourcePr) ? "landed" : "stranded",
    });
  }
  return {
    findings,
    stranded: findings.filter((f) => f.verdict === "stranded"),
    landed: findings.filter((f) => f.verdict === "landed"),
    live: archivedOnMain.size > 0,
  };
}

/** Default grace window: past this, a record that is not on main is not merely in flight. */
export const DEFAULT_GRACE_MINUTES = 120;

export interface AgePartition {
  /** Older than the grace window and still absent from main — the real defect. */
  readonly settled: readonly RefFinding[];
  /** Recently pushed and still landing. Normal operation, not a finding. */
  readonly inFlight: readonly RefFinding[];
  /** Age could not be read. Counted WITH `settled` — see below. */
  readonly unknownAge: readonly RefFinding[];
}

/**
 * Split stranded refs into "still landing" and "should have landed by now".
 *
 * WHY A GRACE WINDOW IS PART OF THE INVARIANT AND NOT A LOOPHOLE.
 * The first version of this file had none, on the reasoning that a ref is a durable
 * artifact rather than a race in flight. Running it proved that wrong within half an
 * hour: the stranded count went 11 -> 18 while the lane was operating perfectly
 * normally, because records legitimately spend time between "pushed" and "on main"
 * (the lane flushes about hourly, then the flush PR waits on `gate`).
 *
 * So the honest invariant is not "a record is never off main", which healthy
 * operation violates constantly. It is "a record does not remain off main
 * INDEFINITELY". A check that fires on normal operation is one that gets ignored,
 * and an ignored check is how this lane accumulated four times.
 *
 * UNKNOWN AGE COUNTS AS SETTLED — fail-closed. An audit that cannot measure a ref
 * must not report it as clean; "I could not tell" and "it is fine" are different
 * answers and collapsing them is the tolerance this whole change removes. In steady
 * state the stranded set is empty, so this costs nothing when the lane is healthy.
 *
 * Pure: `now` is injected, so the verdict is a function of (evidence, phase) and
 * replays deterministically rather than depending on when it happened to run.
 */
export function partitionByAge(
  stranded: readonly RefFinding[],
  pushedAt: ReadonlyMap<string, string | null>,
  now: Date,
  graceMinutes: number = DEFAULT_GRACE_MINUTES,
): AgePartition {
  const settled: RefFinding[] = [];
  const inFlight: RefFinding[] = [];
  const unknownAge: RefFinding[] = [];
  for (const f of stranded) {
    const iso = pushedAt.get(f.ref) ?? null;
    const ms = iso === null ? Number.NaN : new Date(iso).getTime();
    if (!Number.isFinite(ms)) {
      unknownAge.push(f);
      continue;
    }
    if ((now.getTime() - ms) / 60_000 > graceMinutes) settled.push(f);
    else inFlight.push(f);
  }
  return { settled, inFlight, unknownAge };
}

/** The set the ratchet counts: settled strands plus any whose age could not be read. */
export function gatedFindings(part: AgePartition): readonly RefFinding[] {
  return [...part.settled, ...part.unknownAge];
}

/** Exit 1 when the lane stranded more records than the ratchet permits. */
export function gate(
  result: RefAuditResult,
  baseline: number = STRANDED_BASELINE,
  gated: readonly RefFinding[] = result.stranded,
): { readonly ok: true } | { readonly error: string } {
  if (!result.live) {
    return {
      error:
        "record index is EMPTY, so every ref would classify as stranded and the audit would " +
        "be measuring its own broken lookup. Refusing to report a verdict. Check that " +
        "docs/history/pr-reviews/ exists in this checkout.",
    };
  }
  // Distinct source PRs, not refs: re-runs push `-attempt-2`, so counting refs
  // would inflate the backlog with duplicates of one missing record.
  const distinct = new Set(gated.map((f) => f.sourcePr)).size;
  if (distinct > baseline) {
    return {
      error:
        `${String(distinct)} archive records are stranded on refs and absent from main past ` +
        `the grace window, above the high-water mark of ${String(baseline)}. A record has been ` +
        "stranded for longer than the lane takes to flush. Do NOT delete these refs — they " +
        "hold the only copy of the record. Land them, then lower STRANDED_BASELINE.",
    };
  }
  return { ok: true };
}

export interface RemoteRef {
  readonly ref: string;
  readonly sha: string;
}

/** List the lane's refs on the remote. Separated from the pure core for testability. */
export function listArchiveRefs(remote: string): { readonly ok: readonly RemoteRef[] } | { readonly error: string } {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const r = spawnSync("git", ["ls-remote", "--heads", remote, `refs/heads/${ARCHIVE_BRANCH_PREFIX}*`], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (r.error) return { error: `git ls-remote failed to launch: ${r.error.message}` };
  if ((r.status ?? 1) !== 0) return { error: `git ls-remote failed: ${r.stderr}` };
  const out: RemoteRef[] = [];
  for (const line of (r.stdout ?? "").split("\n")) {
    const [sha, ref] = line.split("\t");
    if (sha === undefined || ref === undefined || !ref.startsWith("refs/heads/")) continue;
    out.push({ sha, ref: ref.slice("refs/heads/".length) });
  }
  return { ok: out };
}

/**
 * When each stranded ref's tip was committed, from the forge API.
 *
 * ONLY the stranded subset is queried, never all ~1,300 refs: in steady state that
 * set is empty and this costs nothing, and when it is not empty its size is exactly
 * what the audit is about to report. `null` for anything unreadable — the caller
 * counts unknown age as a strand rather than as clean.
 */
export function fetchPushedAt(repo: string, refs: readonly RemoteRef[]): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const { ref, sha } of refs) {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const r = spawnSync("gh", ["api", `repos/${repo}/commits/${sha}`, "--jq", ".commit.committer.date"], {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    });
    const date = (r.stdout ?? "").trim();
    out.set(ref, !r.error && (r.status ?? 1) === 0 && date !== "" ? date : null);
  }
  return out;
}

export function main(argv: readonly string[]): number {
  const read = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const remote = read("--remote") ?? "origin";
  const repo = read("--repo") ?? process.env["ZETA_AGENT_REPO"] ?? "Lucent-Financial-Group/Zeta";
  const dir = resolve(read("--dir") ?? "docs/history/pr-reviews");
  const baselineRaw = read("--baseline");
  const baseline = baselineRaw === undefined ? STRANDED_BASELINE : Number.parseInt(baselineRaw, 10);
  if (!Number.isSafeInteger(baseline) || baseline < 0) {
    process.stderr.write("audit-orphaned-archive-refs: --baseline must be a non-negative integer\n");
    return 2;
  }
  const graceRaw = read("--grace-minutes");
  const graceMinutes = graceRaw === undefined ? DEFAULT_GRACE_MINUTES : Number.parseInt(graceRaw, 10);
  if (!Number.isSafeInteger(graceMinutes) || graceMinutes < 0) {
    process.stderr.write("audit-orphaned-archive-refs: --grace-minutes must be a non-negative integer\n");
    return 2;
  }

  let archived: ReadonlySet<number>;
  try {
    archived = indexArchivedPrs(dir);
  } catch (err) {
    process.stderr.write(
      `audit-orphaned-archive-refs: could not read ${dir}: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 2;
  }

  const refs = listArchiveRefs(remote);
  if ("error" in refs) {
    process.stderr.write(`audit-orphaned-archive-refs: ${refs.error}\n`);
    return 2;
  }

  const result = auditArchiveRefs(
    refs.ok.map((r) => r.ref),
    archived,
  );

  // Age is read ONLY for the stranded subset — empty in steady state.
  const strandedRefs = new Set(result.stranded.map((f) => f.ref));
  const pushedAt = fetchPushedAt(repo, refs.ok.filter((r) => strandedRefs.has(r.ref)));
  const part = partitionByAge(result.stranded, pushedAt, new Date(), graceMinutes);
  const gated = gatedFindings(part);
  const distinctGated = new Set(gated.map((f) => f.sourcePr)).size;

  process.stdout.write(
    `[archive-refs] ${String(result.findings.length)} archive ref(s); ` +
      `${String(result.landed.length)} landed (safe to delete), ` +
      `${String(result.stranded.length)} not on main ` +
      `(${String(part.inFlight.length)} in flight, ${String(part.settled.length)} settled, ` +
      `${String(part.unknownAge.length)} unreadable age); ` +
      `records indexed on main: ${String(archived.size)}\n`,
  );
  if (argv.includes("--list-stranded")) {
    for (const f of part.inFlight) process.stdout.write(`  in-flight ${f.ref} (PR #${String(f.sourcePr)})\n`);
    for (const f of gated) process.stdout.write(`  STRANDED  ${f.ref} (PR #${String(f.sourcePr)})\n`);
  }

  const verdict = gate(result, baseline, gated);
  if ("error" in verdict) {
    process.stderr.write(`audit-orphaned-archive-refs: ${verdict.error}\n`);
    return 1;
  }
  process.stdout.write(
    `[archive-refs] OK — ${String(distinctGated)} settled strand(s), within the high-water mark of ${String(baseline)}\n`,
  );
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
