#!/usr/bin/env bun
// stalled-pr-classifier.ts — say WHY a PR is stalled, and refuse to guess.
//
// DRY RUN ONLY. This module writes no state, opens no PR, pushes nothing, and
// arms nothing. It classifies. The remedy side is designed in
// `docs/DECISIONS/2026-08-26-a-stalled-pr-healer-classifies-before-it-acts-and-attribution-is-the-gate.md`
// and is deliberately not wired: it has no operator write token.
//
// ── WHY A SEPARATE CLASSIFIER AT ALL ──────────────────────────────────────────
//
// On 2026-08-26 nine open PRs had gone quiet. All nine were ALREADY armed with
// auto-merge, which kills the obvious healer ("find unarmed PRs, arm them")
// before it is built. The nine sorted into four causes needing four different
// answers, and three of them were not the PR's fault at all.
//
// The failure this file exists to prevent is the one the retraction actuator
// still has: acting on a red that the PR did not cause. Uniqueness is a property
// of the commit GRAPH; attribution is a property of the FAILURE. An upstream
// outage produces a perfectly unique isolation and a completely wrong answer
// (the 2026-08-26 gnupg incident, `docs/DECISIONS/2026-08-26-acting-on-a-
// verdict-about-a-commit-that-is-no-longer-the-tip.md` §3.2).
//
// ── EDGE / CORE SPLIT ─────────────────────────────────────────────────────────
//
// Every decision lives in `classify()`, a pure total function over gathered
// facts. The edge only GATHERS. That keeps classification DST-replayable
// (§7) and keeps entropy in declared channels (§13): no clock, no network, and
// no filesystem is reachable from the core.
//
// Rule 0: TypeScript (no .sh) per `.claude/rules/rule-0-no-sh-files.md`.

/** The aggregator. It is red whenever anything it needs is red, so it is never a CAUSE. */
export const AGGREGATOR_CHECK = "gate (required)";

/**
 * A check-run as the classifier needs it.
 *
 * `conclusion: null` means the run exists and has not concluded. A check that is
 * ABSENT entirely is not represented here at all — and that distinction is the
 * whole point of `requiredCheckNames`: a required check that never ran
 * contributes zero to a failure count and reads, at rollup level, exactly like
 * one that passed.
 */
export interface CheckFact {
  readonly name: string;
  readonly conclusion:
    | "success"
    | "failure"
    | "cancelled"
    | "skipped"
    | "neutral"
    | "timed_out"
    | "action_required"
    | null;
  /**
   * Repo-relative paths the failing step is ABOUT, when they can be derived
   * (e.g. from annotations). Empty means "not derivable" — which is `unknown`,
   * never "unrelated".
   */
  readonly subjectPaths?: readonly string[];
}

/** Facts the edge gathers about one PR. Every field is measured, never inferred. */
export interface PrFacts {
  readonly number: number;
  readonly headSha: string;
  readonly autoMergeArmed: boolean;
  /**
   * Result of a LOCAL `git merge-tree` against fetched `origin/main`.
   * Never GitHub's `mergeable_state`: on 2026-08-26 it read `unknown` for nine
   * of nine PRs across two polls, so a healer trusting it would have concluded
   * "nothing is conflicted" and been wrong.
   */
  readonly localMerge: "clean" | "conflict" | "unknown";
  /** Conflicting paths, when `localMerge === "conflict"`. */
  readonly conflictPaths: readonly string[];
  readonly checks: readonly CheckFact[];
  /** Required check names, from branch protection. Absence of one is `unknown`. */
  readonly requiredCheckNames: readonly string[];
  /** Paths this PR's own diff touches, versus the merge base. */
  readonly diffPaths: readonly string[];
  /** True when the branch is checked out in another worktree or claimed by another agent. */
  readonly branchHeldElsewhere: boolean;
  /** Commits on `main` not yet on this branch. */
  readonly behindBy: number;
}

export type Classification =
  | "REFUSED_OWNERSHIP"
  | "UNKNOWN"
  | "UNDISPATCHED"
  | "CONFLICTED_CLEAN_CHECKS"
  | "STALE_FIX_LANDED"
  | "OWN_FAILURES"
  | "HEALTHY";

export interface Verdict {
  readonly number: number;
  readonly classification: Classification;
  /** Why, in a form a human can audit without re-deriving it. */
  readonly reason: string;
  /** Root failures, aggregator excluded. */
  readonly rootFailures: readonly string[];
  /** Root failures that intersect this PR's own diff. Only these are attributable. */
  readonly attributable: readonly string[];
  /** Root failures NOT attributable to this PR. */
  readonly unattributable: readonly string[];
  /** The remedy a healer WOULD apply. Advisory only — nothing here applies it. */
  readonly suggestedRemedy: "none" | "merge-main-and-push" | "resolve-generated-conflict" | "report-to-author";
}

/** A generated artifact whose conflict resolution has a declared regeneration recipe. */
const REGENERABLE = [/(^|\/)flake\.lock$/, /(^|\/)bun\.lock$/, /(^|\/)package-lock\.json$/];

export function isRegenerable(path: string): boolean {
  return REGENERABLE.some((re) => re.test(path));
}

/**
 * Root failures: everything red EXCEPT the aggregator.
 *
 * `gate (required)` is red whenever any of its `needs:` is red, so including it
 * would double-count one cause and, worse, make a PR look like it has a failure
 * of its own when the only red is downstream of somebody else's.
 */
export function rootFailures(checks: readonly CheckFact[]): string[] {
  return checks
    .filter((c) => c.name !== AGGREGATOR_CHECK)
    .filter((c) => c.conclusion === "failure" || c.conclusion === "timed_out")
    .map((c) => c.name);
}

/**
 * Is this failure attributable to this PR?
 *
 * Attributable iff the failing step's subject paths INTERSECT the PR's own diff.
 * Note the asymmetry, which is deliberate and is the safety property: an empty
 * or absent `subjectPaths` yields NOT attributable, so an underivable subject
 * withholds the remedy rather than licensing it. Being wrong in this direction
 * costs a delay; being wrong in the other direction retracts an innocent commit.
 */
export function isAttributable(check: CheckFact, diffPaths: readonly string[]): boolean {
  const subjects = check.subjectPaths ?? [];
  if (subjects.length === 0) return false;
  const diff = new Set(diffPaths);
  return subjects.some((p) => diff.has(p));
}

/** A required check with no run at all. Reads as green at rollup level; it is not. */
export function missingRequiredChecks(
  checks: readonly CheckFact[],
  required: readonly string[],
): string[] {
  const present = new Set(checks.map((c) => c.name));
  return required.filter((r) => !present.has(r));
}

/**
 * The classifier. Pure, total, and fail-closed.
 *
 * Order matters and encodes precedence: ownership outranks everything (never
 * touch what you do not hold), then unknowns (never guess), then the mechanical
 * classes, then the PR's own failures.
 */
export function classify(f: PrFacts): Verdict {
  const roots = rootFailures(f.checks);
  const attributable = f.checks
    .filter((c) => roots.includes(c.name))
    .filter((c) => isAttributable(c, f.diffPaths))
    .map((c) => c.name);
  const unattributable = roots.filter((r) => !attributable.includes(r));

  const base = { number: f.number, rootFailures: roots, attributable, unattributable };

  // 1. Ownership. Refusing costs nothing; racing another agent costs their work.
  if (f.branchHeldElsewhere) {
    return {
      ...base,
      classification: "REFUSED_OWNERSHIP",
      reason: "branch is held by another worktree or agent; not ours to move",
      suggestedRemedy: "none",
    };
  }

  // 2. Unknowns. A probe that did not answer is not a negative result.
  if (f.localMerge === "unknown") {
    return {
      ...base,
      classification: "UNKNOWN",
      reason: "local merge probe did not answer; mergeability is unknown, not clean",
      suggestedRemedy: "none",
    };
  }
  const missing = missingRequiredChecks(f.checks, f.requiredCheckNames);
  if (missing.length > 0 && f.localMerge === "clean" && roots.length > 0) {
    return {
      ...base,
      classification: "UNKNOWN",
      reason: `required checks absent (${missing.join(", ")}) alongside failures; a check that never ran is not a check that passed`,
      suggestedRemedy: "none",
    };
  }

  // 3. Undispatched: required checks simply are not there, and nothing is red.
  if (roots.length === 0 && missing.length > 0) {
    return {
      ...base,
      classification: "UNDISPATCHED",
      reason: `${String(missing.length)} required check(s) never dispatched: ${missing.join(", ")}`,
      suggestedRemedy: "merge-main-and-push",
    };
  }

  // 4. Conflicted with no failures.
  if (f.localMerge === "conflict" && roots.length === 0) {
    const allRegenerable = f.conflictPaths.length > 0 && f.conflictPaths.every(isRegenerable);
    return {
      ...base,
      classification: "CONFLICTED_CLEAN_CHECKS",
      reason: allRegenerable
        ? `conflicts confined to generated files (${f.conflictPaths.join(", ")}) with a regeneration recipe`
        : `conflicts touch hand-authored content (${f.conflictPaths.join(", ")}); resolution is a content decision`,
      suggestedRemedy: allRegenerable ? "resolve-generated-conflict" : "report-to-author",
    };
  }

  // 5. Red, but none of it this PR's doing, and the branch is behind.
  //    Merging main is both the diagnostic and, usually, the fix.
  if (roots.length > 0 && attributable.length === 0 && f.behindBy > 0 && f.localMerge === "clean") {
    return {
      ...base,
      classification: "STALE_FIX_LANDED",
      reason: `${String(roots.length)} failure(s), none attributable to this diff, and ${String(f.behindBy)} commit(s) behind main`,
      suggestedRemedy: "merge-main-and-push",
    };
  }

  // 6. The PR's own failures. Judgement about someone else's design: not ours.
  if (attributable.length > 0) {
    return {
      ...base,
      classification: "OWN_FAILURES",
      reason: `failure(s) attributable to this diff: ${attributable.join(", ")}`,
      suggestedRemedy: "report-to-author",
    };
  }

  if (roots.length > 0) {
    return {
      ...base,
      classification: "UNKNOWN",
      reason: "failures present but attribution undeterminable and branch is current",
      suggestedRemedy: "none",
    };
  }

  return {
    ...base,
    classification: "HEALTHY",
    reason: f.autoMergeArmed ? "no failures, armed" : "no failures, NOT armed",
    suggestedRemedy: "none",
  };
}

export function renderVerdict(v: Verdict): string {
  const head = `PR #${String(v.number)}  ${v.classification}`;
  const why = `    why: ${v.reason}`;
  const rem = `    would: ${v.suggestedRemedy}`;
  const un =
    v.unattributable.length > 0
      ? `\n    NOT this PR's: ${v.unattributable.join(", ")}`
      : "";
  return `${head}\n${why}\n${rem}${un}`;
}

if (import.meta.main) {
  console.error(
    [
      "stalled-pr-classifier: a library, deliberately without a live fact-gathering edge.",
      "",
      "It classifies; it does not act. Wiring a gatherer to it is an operator",
      "decision recorded in docs/DECISIONS/2026-08-26-a-stalled-pr-healer-classifies-",
      "before-it-acts-and-attribution-is-the-gate.md §5, and is not taken here.",
      "",
      "Import `classify` and hand it PrFacts you gathered yourself.",
    ].join("\n"),
  );
  process.exit(2);
}
