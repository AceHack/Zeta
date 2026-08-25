#!/usr/bin/env bun
// archive-eligibility.ts — ONE definition of "which merged PRs are supposed to
// have an archive record", shared by every lane that has an opinion about it.
//
// WHY THIS FILE EXISTS
// --------------------
// Three surfaces each carried their own answer, and they DISAGREED:
//
//   1. `pr-archive-on-merge.yml`'s `if:` guard SKIPS repo-local
//      `automation/pr-archive-*` and `claim/archive-pr-*` PRs, because archiving
//      an archive PR starts a recursive archive-of-archive chain. That exclusion
//      is deliberate and documented in the workflow.
//   2. `archive-pr-reviews.ts`'s `listMergedPRs` applied NO such filter, so the
//      backfill sweep happily archived exactly what the event lane refuses to.
//   3. Nothing computed coverage at all, so the disagreement was invisible.
//
// Measured on main at 2026-08-25 (13,347 merged PRs, 10,337 archive docs):
//
//   * 1,352 merged PRs match the event lane's exclusion rule.
//   * 774 of them HAVE an archive doc — written by the backfill sweep, i.e. the
//     exact records the event lane declined to create.
//   * In the sweep's reachable window (the 3,000 newest merged PRs), 524 of the
//     1,289 unarchived PRs are archive-of-archive — so **41% of the sweep's
//     oldest-first budget is spent producing records the other lane calls
//     out-of-scope**, while the real gap behind them is starved.
//
// A coverage number computed against an ambiguous denominator is not a
// measurement, it is a coin flip between two defensible answers. So the
// predicate moves here, and both lanes import it.
//
// WHAT IT DOES NOT DO
// -------------------
// It does not delete the 774 records that already exist. They are captured
// substrate and §5 (memory preservation) says captured substrate is not thrown
// away because a policy tightened afterwards. The predicate governs what is
// SELECTED going forward and what the coverage denominator counts; it never
// authorises a deletion.

/**
 * Branch-name prefixes the archive lane produces for its OWN bookkeeping.
 *
 * `automation/pr-archive-*` is the per-PR branch `pr-archive-on-merge.yml`
 * pushes; `claim/archive-pr-*` is the repair branch an agent opens when draining
 * a stranded one. A PR whose head is one of these IS an archive record, so
 * archiving it captures the review discussion of a robot commit that has none.
 */
export const ARCHIVE_BOOKKEEPING_PREFIXES = ["automation/pr-archive-", "claim/archive-pr-"] as const;

/** The minimum a caller must know about a merged PR to judge its eligibility. */
export interface EligibilityInput {
  /** `head.ref` — the branch the PR merged FROM. */
  readonly headRefName: string;
  /**
   * Whether the head branch lives in THIS repository.
   *
   * Load-bearing, and it mirrors the workflow's `if:` exactly. A FORK may name
   * its branch `automation/pr-archive-anything` — that is an ordinary
   * contribution from someone else's namespace and it must still be archived.
   * Only a repo-local branch with these prefixes is our own bookkeeping.
   *
   * Defaults to `true` because every caller that cannot cheaply determine it is
   * reading repo-local automation output; a caller with fork PRs in scope must
   * pass it.
   */
  readonly headRepoIsSameRepo?: boolean;
}

/**
 * True when a merged PR is expected to have an archive record.
 *
 * This is the SAME rule `pr-archive-on-merge.yml` applies in its `if:` guard,
 * expressed once so the event lane, the backfill sweep and the coverage audit
 * cannot drift apart again.
 */
export function isArchiveEligible(input: EligibilityInput): boolean {
  if (input.headRepoIsSameRepo === false) return true;
  return !ARCHIVE_BOOKKEEPING_PREFIXES.some((p) => input.headRefName.startsWith(p));
}

/**
 * The date `pr-archive-on-merge.yml` first landed on main, as `YYYY-MM-DD`.
 *
 * PRs merged before this could not have been archived by the event lane — there
 * was no event lane. That is a REAL category and it is counted as such rather
 * than either silently backfilled into the "healthy" number or silently ignored:
 * 1,506 of the 3,010 unarchived PRs on main are in it, and no fix to the lane
 * can ever move them. Only a deliberate backfill can.
 *
 * Derived, not guessed:
 *   git log --diff-filter=A --format=%ad --date=short -1 \
 *     -- .github/workflows/pr-archive-on-merge.yml   ->  2026-05-06
 */
export const EVENT_LANE_LANDED = "2026-05-06";

/** Why a merged PR has no archive record. Ordered from "by design" to "defect". */
export type GapClass =
  /** The lane deliberately does not archive this PR. Not a gap. */
  | "excluded"
  /** Merged before the event lane existed. Backfill-only; never a lane defect. */
  | "pre-lane"
  /** Merged recently enough that the record may still be in flight. */
  | "in-flight"
  /** Eligible, old enough that the lane has had its chance, and still missing. */
  | "missing";

export interface ClassifyInput extends EligibilityInput {
  /** ISO-8601 `mergedAt`. */
  readonly mergedAt: string;
  readonly isArchived: boolean;
}

/**
 * Classify one merged PR.
 *
 * `graceMs` exists because a PR merged sixty seconds ago has not FAILED to be
 * archived — the event lane is still running, or the record is sitting on the
 * staging lane waiting for its flush. Counting those as defects would make the
 * audit flap on healthy operation at exactly the busiest moments, and a check
 * that cries wolf is one that gets ignored.
 *
 * It is not a loophole: the window is finite, so a genuinely-lost record ages
 * out of it and is reported. `graceMs` bounds how long a defect stays invisible,
 * never whether it is eventually seen.
 */
export function classifyGap(input: ClassifyInput, now: Date, graceMs: number): GapClass | null {
  if (input.isArchived) return null;
  if (!isArchiveEligible(input)) return "excluded";
  if (input.mergedAt.slice(0, 10) < EVENT_LANE_LANDED) return "pre-lane";
  const mergedMs = Date.parse(input.mergedAt);
  // A merge timestamp we cannot parse is treated as OLD, never as fresh:
  // fail-closed, so an unreadable date surfaces as a gap instead of hiding in
  // the grace window forever.
  if (Number.isNaN(mergedMs)) return "missing";
  if (now.getTime() - mergedMs < graceMs) return "in-flight";
  return "missing";
}
