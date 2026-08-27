#!/usr/bin/env bun
// forward-action-du.ts — 081M10JB2FJ087G0R00159NYSZ
//
// A TOTAL discriminated union over "what is the forward action on this PR",
// plus a CLOSED, reversibility-partitioned command set the selector may NAME
// but can never DEFINE.
//
// REGISTER: `toy` / `unmetered`. Nothing here has been metered against a
// population large enough to price its error rate. It has been RUN (read-only)
// against the open-PR set once; that is a demonstration, not a falsifier of the
// classification itself. Do not cite it as `metered`.
//   — .claude/rules/toy-is-free-metered-must-be-earned.md
//
// ── WHAT THIS IS FOR ──────────────────────────────────────────────────────────
//
// Operator framing (2026-08-26): "a different agent runs the verification based
// on our discriminated unions, and that's the only choices it has before it's
// allowed to merge. This is how we enforce global rules one local agent at a
// time … the escape hatch is edit the discriminated union by updating code, and
// that itself has to go through a review process based on its own
// discriminated-union workflow around editing workflows."
//
// So there are two artifacts here and they are deliberately separate:
//
//   1. `Disposition` — the MEASURED state of a PR. Total: every PR maps to
//      exactly one arm, including `Unknown`.
//   2. `ACTION_REGISTRY` — the closed command set. `decide()` returns an action
//      NAME plus its arguments; it never returns a command string, a shell
//      fragment, or a URL. Compromising the selector buys you the ability to
//      pick the wrong arm from a fixed list of nine — not arbitrary execution.
//
// ── WHY A SEPARATE MODULE FROM `stalled-pr-classifier.ts` ─────────────────────
//
// `stalled-pr-classifier.ts` (PR #15698, unmerged at the time of writing)
// answers "WHY is this PR stalled", and its safety property is ATTRIBUTION: do
// not act on a red the PR did not cause. This module answers the next question,
// "WHAT MAY AN AGENT DO ABOUT IT, AND WHO DECIDES", and its safety property is
// REVERSIBILITY: do not auto-execute an action that cannot be undone.
//
// They are complementary and the seam is real: a `Disposition` here is roughly
// a refinement of a `Classification` there, and once #15698 lands the two
// should share the attribution helpers rather than each carrying their own.
// That unification is deliberately NOT done here — depending on an unmerged
// branch is how you get a PR that can never be verified in isolation.
//
// ── THE MEASUREMENT / READING DISTINCTION (the load-bearing one) ──────────────
//
// Two of the empirically observed classes are OPPOSITES THAT LOOK IDENTICAL
// from outside. GitHub reports `mergeable_state: dirty` both when a branch
// genuinely conflicts with `main` and when its cached verdict simply predates a
// merge that resolved the conflict. On 2026-08-26 #15724 read `dirty` while a
// local three-way merge against current `main` produced zero conflicts.
//
// Therefore mergeability is a MEASUREMENT (`git merge-tree` against a freshly
// fetched `main`) and never a READING (`mergeable_state`). The DU encodes the
// measurement; `mergeable_state` is carried only as a corroborating fact, and
// `MergeVerdictStale` exists precisely to name the case where the two disagree.
//
// Rule 0: TypeScript, no `.sh` — `.claude/rules/rule-0-no-sh-files.md`.

// ─────────────────────────────────────────────────────────────────────────────
// FACTS — what the edge gathers. Every field is measured; none is inferred.
// ─────────────────────────────────────────────────────────────────────────────

/** The single required check, from ruleset "CI Gate" (id 16134995), measured 2026-08-27. */
export const REQUIRED_CHECK = "gate (required)";

/**
 * The aggregator is red whenever anything it needs is red, so it is never a
 * CAUSE. Counting it as one double-counts a single upstream failure and makes a
 * PR look like it has a defect of its own.
 */
export const AGGREGATOR_CHECK = REQUIRED_CHECK;

/**
 * `pull_request` activity types `gate.yml` actually listens on, measured from
 * `.github/workflows/gate.yml` on 2026-08-27.
 *
 * `edited` is ABSENT, and that absence is a DU arm: retargeting a stacked PR
 * (which fires `edited` and nothing else) produces no workflow run at all, so
 * `gate (required)` can never report and auto-merge waits forever on a verdict
 * that no event will ever request.
 */
export const GATE_PR_TRIGGERS = ["opened", "reopened", "synchronize", "ready_for_review"] as const;

export type CheckConclusion =
  "success" | "failure" | "cancelled" | "skipped" | "neutral" | "timed_out" | "stale" | "action_required" | null;

export interface CheckFact {
  readonly name: string;
  /** `null` when the run exists but has not concluded. An ABSENT check is not in this list at all. */
  readonly conclusion: CheckConclusion;
  /** GitHub check-run status. `queued` / `in_progress` mean a verdict is still coming. */
  readonly status: "queued" | "in_progress" | "completed";
  /** ISO-8601, or null when not completed. Used ONLY to compare two GitHub-side timestamps. */
  readonly completedAt: string | null;
  /** The workflow run this check belongs to, so a re-run can name it. */
  readonly runId: number | null;
  /**
   * Repo-relative paths the failing step is ABOUT, derived from annotations.
   * Empty means NOT DERIVABLE, which is `unknown` — never "unrelated".
   */
  readonly subjectPaths: readonly string[];
}

export interface PrFacts {
  readonly number: number;
  readonly headSha: string;
  readonly headRef: string;
  readonly baseRef: string;
  readonly isDraft: boolean;
  readonly autoMergeArmed: boolean;

  /**
   * Does `refs/pull/<n>/merge` resolve?
   *
   * GitHub creates this ref only when it can compute a merge commit. A 404 means
   * it CANNOT, which means no `pull_request` workflow run can be created for the
   * head, which means `gate (required)` can never report. Measured by REST, not
   * inferred from `mergeable_state`.
   */
  readonly mergeRefExists: boolean;

  /**
   * MEASURED with `git merge-tree` against a freshly fetched `origin/main`.
   * `unknown` when the probe could not be run — never silently "clean".
   */
  readonly localMerge: "clean" | "conflict" | "unknown";
  readonly conflictPaths: readonly string[];

  /** GitHub's cached READING. Carried only to detect disagreement with the measurement. */
  readonly remoteMergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";

  readonly checks: readonly CheckFact[];
  /** Required check names from branch protection / rulesets. Absence of one is `unknown`, never pass. */
  readonly requiredCheckNames: readonly string[];

  /** Paths this PR's own diff touches versus the merge base. */
  readonly diffPaths: readonly string[];
  /** Commits on `main` not yet on this branch. */
  readonly behindBy: number;

  /** ISO-8601 tip-commit date of `origin/main` at gather time. */
  readonly mainTipDate: string;

  /**
   * Highest `run_attempt` seen across this head's gate runs.
   *
   * A re-run is the CHEAPEST action in the set, which makes it the right
   * discriminator for "was that an infra flake?" — but only once. A second
   * identical re-run buys no new information and burns runner minutes, so
   * `> 0` is what moves a PR from "probe it" to "escalate it".
   */
  readonly priorRerunAttempts: number;

  /** True when the branch is checked out in another worktree or claimed by another agent. */
  readonly branchHeldElsewhere: boolean;

  /**
   * A "lane" is a rolling telemetry branch (`heartbeat/*`) whose flush PRs are
   * meant to be superseded every cycle. True when this PR's head IS the current
   * lane tip AND it is the only open PR for that lane — so nothing will ever
   * supersede it and it cannot self-heal.
   */
  readonly isFrozenLane: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE CLOSED COMMAND SET
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every action an agent may NAME. There is no arm for "run this string".
 *
 * Anchor (Beacon): the portable half of the hub-and-agent design in
 * US10834144B2 (Higgins & Stainback, assigned to Itron) — the far side may NAME
 * a pre-configured command but can never DEFINE one, so compromising the far
 * side does not buy arbitrary execution. See
 * `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`; the hub
 * itself is deliberately not adopted, only this property.
 *
 * Anchor (Beacon): Saltzer & Schroeder 1975, "least privilege" and "economy of
 * mechanism" — a small, fully enumerated mechanism is one you can actually audit.
 */
export type ActionName =
  | "Wait"
  | "RerunFailedJobs"
  | "MergeMainAndPush"
  | "ReArmAutoMerge"
  | "ProposeRetireLane"
  | "ProposeConflictResolution"
  | "ProposeAuthorReview"
  | "Escalate"
  | "NoAction";

/**
 * Reversibility class. This is the ONLY thing that decides auto-executability,
 * and it is a property of the action, never of the confidence of the classifier.
 *
 * Anchor (Beacon): Garcia-Molina & Salem, "Sagas" (SIGMOD 1987) — a long-lived
 * transaction is safe to run in pieces exactly when each piece has a
 * COMPENSATING transaction that semantically undoes it. An action with no
 * compensation cannot be part of an automatic saga; it needs a commit point.
 *
 * - `idempotent-reversible` — applying twice equals applying once, and a named
 *   compensation exists. Automatable.
 * - `irreversible-shaped` — no compensation, or the compensation destroys work
 *   (closing a PR, retiring a lane, force-anything). PROPOSAL ONLY.
 * - `inert` — touches nothing in the repository at all.
 */
export type Reversibility = "idempotent-reversible" | "irreversible-shaped" | "inert";

export interface ActionSpec {
  readonly name: ActionName;
  readonly reversibility: Reversibility;
  /**
   * MUST equal `reversibility === "idempotent-reversible"`. Stored explicitly
   * rather than derived so that a future edit which flips one and forgets the
   * other is caught by a test instead of silently widening what may auto-run.
   */
  readonly autoExecutable: boolean;
  /** The compensating action, in words. Empty iff not `idempotent-reversible`. */
  readonly compensation: string;
  /**
   * Name of the test that applies the action twice and asserts one effect.
   * Required (non-empty) iff `autoExecutable`. This is the escape hatch's price:
   * a new automatable arm must ship its idempotence witness.
   */
  readonly idempotenceWitness: string;
  readonly rationale: string;
}

/**
 * The registry. This IS the closed command set — enumerable by a linter, not a
 * hand-maintained allowlist that drifts from the code.
 *
 * TO ADD AN ARM (the escape hatch, spelled out because a closed set with no
 * legitimate way to extend it simply gets bypassed):
 *
 *   1. Add the `ActionName` literal and a row here. TypeScript's exhaustiveness
 *      check then FAILS every `switch` that does not handle it — the compiler
 *      is the first reviewer.
 *   2. Declare `reversibility` honestly. If you claim `idempotent-reversible`
 *      you must name a `compensation` AND write the `idempotenceWitness` test
 *      that applies the action twice and asserts a single effect.
 *   3. `lint-forward-action-registry.ts` refuses the change otherwise, and runs
 *      on every PR — so the edit to the DU passes the same gate as any code.
 *   4. Because that lint is itself code in this repo, changing the RULES for
 *      adding an arm is a PR that must pass the rules as they currently stand.
 *      That is the "workflow around editing workflows" the operator asked for,
 *      and it needs no new machinery: the gate is already reflexive.
 */
export const ACTION_REGISTRY: Readonly<Record<ActionName, ActionSpec>> = {
  Wait: {
    name: "Wait",
    reversibility: "inert",
    autoExecutable: false,
    compensation: "",
    idempotenceWitness: "",
    rationale: "a verdict is still in flight; the correct forward action is to not act",
  },
  RerunFailedJobs: {
    name: "RerunFailedJobs",
    reversibility: "idempotent-reversible",
    autoExecutable: true,
    compensation:
      "none needed — a re-run replaces a check-run verdict and destroys no commit; the prior run's logs remain addressable by run id",
    idempotenceWitness: "rerun twice yields one pending verdict, not two",
    rationale:
      "re-running a job that failed on stale inputs costs runner minutes and nothing else; the branch, its commits, and its history are untouched",
  },
  MergeMainAndPush: {
    name: "MergeMainAndPush",
    reversibility: "idempotent-reversible",
    autoExecutable: true,
    compensation:
      "reset the branch to the pre-merge head, which is still reachable via reflog and via the PR's own commit list",
    idempotenceWitness: "merging an already-merged main is a no-op fast-forward, not a second commit",
    rationale:
      "only when the local merge probe measured CLEAN; adds a merge commit to somebody else's branch, which is additive and revertible, and never rewrites their commits",
  },
  ReArmAutoMerge: {
    name: "ReArmAutoMerge",
    reversibility: "idempotent-reversible",
    autoExecutable: true,
    compensation: "disable auto-merge on the PR",
    idempotenceWitness: "arming an already-armed PR changes nothing",
    rationale:
      "arming does not merge; the required check still gates. Note `gh pr merge --auto` exits 0 whether it armed, merged, or failed — the effect must be verified by REST, never by exit status",
  },
  ProposeRetireLane: {
    name: "ProposeRetireLane",
    reversibility: "irreversible-shaped",
    autoExecutable: false,
    compensation: "",
    idempotenceWitness: "",
    rationale:
      "retiring discards the PR's accumulated telemetry rather than recovering it. On 2026-08-26 the operator retired #15709 and explicitly DECLINED to retire #15724, choosing recovery instead — from the outside the two looked the same. That is exactly the judgement a machine must escalate rather than guess",
  },
  ProposeConflictResolution: {
    name: "ProposeConflictResolution",
    reversibility: "irreversible-shaped",
    autoExecutable: false,
    compensation: "",
    idempotenceWitness: "",
    rationale:
      "choosing which side of a conflict survives is a content decision, i.e. authorship. #15743 and #15744 carried opposite remedies for one finding; a resolver picking one would have silently decided a research question",
  },
  ProposeAuthorReview: {
    name: "ProposeAuthorReview",
    reversibility: "irreversible-shaped",
    autoExecutable: false,
    compensation: "",
    idempotenceWitness: "",
    rationale: "diagnosing why someone's test fails and changing their code is authorship, not maintenance",
  },
  Escalate: {
    name: "Escalate",
    reversibility: "inert",
    autoExecutable: false,
    compensation: "",
    idempotenceWitness: "",
    rationale:
      "the state was classified but the remedy needs judgement no arm of this set expresses. Carries the evidence that defeated selection, never a bare 'could not handle'",
  },
  NoAction: {
    name: "NoAction",
    reversibility: "inert",
    autoExecutable: false,
    compensation: "",
    idempotenceWitness: "",
    rationale: "nothing is wrong, or nothing may be touched",
  },
};

/**
 * The ONLY authority for auto-execution. Derived from the registry, never from
 * the call site — so a caller cannot talk itself into running a proposal.
 */
export function mayAutoExecute(name: ActionName): boolean {
  return ACTION_REGISTRY[name].autoExecutable;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE DISPOSITION DU — total over PR states
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Note the two distinct "I cannot proceed" arms. They are NOT the same failure
 * and collapsing them would hide the more interesting one:
 *
 *   `Unknown`          — DIAGNOSIS failed. The evidence is missing or self-
 *                        contradictory; I do not know what state this PR is in.
 *   `NeedsIntelligence`— diagnosis SUCCEEDED. I know the state; the remedy needs
 *                        judgement that no arm of the closed command set can
 *                        express. This is escalation as a case, not a fallback.
 *
 * Anchor (Beacon): Kleene's three-valued logic (1938) treats "unknown" as a
 * first-class truth value rather than a failure of evaluation — the same move
 * this repo already makes in `src/Core.TypeScript/tri-boolean/`. Anchor:
 * Yaron Minsky, "make illegal states unrepresentable" (Jane Street, ~2011) —
 * the reason this is a sum type rather than a bag of booleans.
 */
export type Disposition =
  | { readonly kind: "Healthy"; readonly armed: boolean }
  | { readonly kind: "AwaitingVerdict"; readonly pending: readonly string[] }
  | { readonly kind: "OwnedElsewhere" }
  | { readonly kind: "VerdictUndispatchable"; readonly why: string }
  | { readonly kind: "VerdictNotDispatched"; readonly missing: readonly string[] }
  | { readonly kind: "VerdictStale"; readonly unattributable: readonly string[]; readonly behindBy: number }
  | { readonly kind: "SuspectedInfraFlake"; readonly unattributable: readonly string[] }
  | { readonly kind: "MergeVerdictStale"; readonly remote: string }
  | { readonly kind: "MergeConflicted"; readonly paths: readonly string[] }
  | { readonly kind: "FrozenLane"; readonly lane: string }
  | { readonly kind: "OwnFailure"; readonly attributable: readonly string[] }
  | { readonly kind: "NeedsIntelligence"; readonly measured: readonly string[]; readonly ambiguity: string }
  | { readonly kind: "Unknown"; readonly reason: string; readonly evidence: readonly string[] };

export type DispositionKind = Disposition["kind"];

export interface Proposal {
  readonly number: number;
  readonly headSha: string;
  readonly disposition: Disposition;
  readonly action: ActionName;
  /** Arguments the named action needs. Never a command; never interpolated into one. */
  readonly args: Readonly<Record<string, string | number>>;
  /** True iff `mayAutoExecute(action)`. Recomputed here so a mismatch is testable. */
  readonly autoExecutable: boolean;
  /** Human-auditable, without re-deriving the classification. */
  readonly why: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DETECTORS — each is separately testable and separately mutable
// ─────────────────────────────────────────────────────────────────────────────

export function rootFailures(checks: readonly CheckFact[]): string[] {
  return checks
    .filter((c) => c.name !== AGGREGATOR_CHECK)
    .filter((c) => c.conclusion === "failure" || c.conclusion === "timed_out")
    .map((c) => c.name);
}

/** Checks that have not concluded. A PR with these is waiting, not stuck. */
export function pendingChecks(checks: readonly CheckFact[]): string[] {
  return checks.filter((c) => c.status !== "completed").map((c) => c.name);
}

export function missingRequiredChecks(checks: readonly CheckFact[], required: readonly string[]): string[] {
  const present = new Set(checks.map((c) => c.name));
  return required.filter((r) => !present.has(r));
}

/**
 * Attributable iff the failing step's subject paths INTERSECT the PR's own diff.
 *
 * The asymmetry is deliberate and is the safety property: an empty or absent
 * `subjectPaths` yields NOT attributable, so an underivable subject WITHHOLDS a
 * remedy rather than licensing one. Being wrong this way costs a delay; being
 * wrong the other way edits an innocent branch.
 */
export function isAttributable(check: CheckFact, diffPaths: readonly string[]): boolean {
  if (check.subjectPaths.length === 0) return false;
  const diff = new Set(diffPaths);
  return check.subjectPaths.some((p) => diff.has(p));
}

/**
 * The separator for the two `dirty`s.
 *
 * GitHub says CONFLICTING; a local three-way merge against freshly fetched
 * `main` says clean. The remote verdict is stale. This is a MEASUREMENT
 * disagreeing with a READING, and the measurement wins — but only when it
 * actually answered. `localMerge === "unknown"` is not clean.
 */
export function isRemoteMergeVerdictStale(f: PrFacts): boolean {
  return f.remoteMergeable === "CONFLICTING" && f.localMerge === "clean";
}

/**
 * A verdict is STALE when every check has concluded, none is pending, the
 * failures are none of this PR's doing, and `main` has moved underneath it.
 *
 * All three conjuncts are load-bearing. Without "none pending" a running job
 * looks stale; without "unattributable" a real defect looks stale; without
 * "behind main" there is no reason to believe a re-run would decide differently,
 * and re-running then just burns minutes to reproduce the same red.
 */
export function isVerdictStale(f: PrFacts, roots: readonly string[], attributable: readonly string[]): boolean {
  return roots.length > 0 && attributable.length === 0 && pendingChecks(f.checks).length === 0 && f.behindBy > 0;
}

/** The workflow run id to re-run, preferring the run that carries the required check. */
export function rerunTargetRunId(checks: readonly CheckFact[]): number | null {
  const failed = checks.filter(
    (c) => c.conclusion === "failure" || c.conclusion === "timed_out" || c.conclusion === "cancelled",
  );
  const required = failed.find((c) => c.name === REQUIRED_CHECK);
  const pick = required ?? failed[0];
  return pick?.runId ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE CLASSIFIER — pure, total, fail-closed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Order encodes PRECEDENCE, and the order is itself a safety claim:
 *
 *   ownership  > unknowns > dispatch faults > merge state > staleness > own defect
 *
 * Ownership first because refusing costs a delay and racing another agent costs
 * their work. Unknowns second because a probe that did not answer is not a
 * negative result — the single most common way a healer does damage is reading
 * an unanswered probe as "fine".
 */
export function classify(f: PrFacts): Disposition {
  const roots = rootFailures(f.checks);
  const attributable = f.checks
    .filter((c) => roots.includes(c.name))
    .filter((c) => isAttributable(c, f.diffPaths))
    .map((c) => c.name);
  const pending = pendingChecks(f.checks);
  const missing = missingRequiredChecks(f.checks, f.requiredCheckNames);

  // 1. Ownership outranks everything. Not ours to move.
  if (f.branchHeldElsewhere) return { kind: "OwnedElsewhere" };

  // 2. The merge ref cannot be built. GitHub cannot create a `pull_request` run,
  //    so the required check can NEVER report. Reopening does not help — the
  //    event fires and still finds no merge ref (measured on #15709 and #15724).
  if (!f.mergeRefExists) {
    // Distinguish the cause when we can. A measured conflict explains it; an
    // unexplained 404 does not, and pretending otherwise invents a diagnosis.
    if (f.localMerge === "conflict") {
      return { kind: "MergeConflicted", paths: f.conflictPaths };
    }
    if (f.localMerge === "unknown") {
      return {
        kind: "Unknown",
        reason: "merge ref absent and the local merge probe did not answer; cause undetermined",
        evidence: [`mergeRefExists=false`, `localMerge=unknown`, `remoteMergeable=${f.remoteMergeable}`],
      };
    }
    // CORROBORATION GATE, added after the first live run mis-fired on #15756.
    //
    // A 404 on the merge ref has two causes that look identical: GitHub CANNOT
    // build the merge commit, or it has simply NOT BUILT IT YET. GitHub reports
    // exactly this in `mergeable: null` -> `remoteMergeable: "UNKNOWN"`, which
    // its own docs describe as "still computing, poll again".
    //
    // The first version of this function ignored that field and returned
    // `VerdictUndispatchable` for #15756 — a PR sixteen minutes old whose merge
    // ref GitHub was still working on. That is an UNANSWERED PROBE READ AS A
    // NEGATIVE RESULT, the exact failure the precedence order above exists to
    // prevent, committed one branch below the comment saying so.
    //
    // So `VerdictUndispatchable` now requires GitHub to have settled its own
    // opinion. If GitHub says unknown, we say Unknown.
    if (f.remoteMergeable === "UNKNOWN") {
      return {
        kind: "Unknown",
        reason:
          "merge ref absent but GitHub has not settled its own mergeability opinion (mergeable=null); cannot distinguish 'cannot build the merge commit' from 'has not built it yet'",
        evidence: [
          `mergeRefExists=false`,
          `localMerge=clean`,
          `remoteMergeable=UNKNOWN`,
          `behindBy=${String(f.behindBy)}`,
        ],
      };
    }
    return {
      kind: "VerdictUndispatchable",
      why: "refs/pull/<n>/merge does not resolve, so no pull_request run can be created and the required check can never report — yet the local merge measured CLEAN and GitHub has settled its opinion, so the 404 is not explained by a conflict or by an in-flight computation",
    };
  }

  // 3. Unknowns. A probe that did not answer is not a negative result.
  if (f.localMerge === "unknown") {
    return {
      kind: "Unknown",
      reason: "local merge probe did not answer; mergeability is unknown, not clean",
      evidence: [`remoteMergeable=${f.remoteMergeable}`, `behindBy=${String(f.behindBy)}`],
    };
  }

  // 4. Something is still running. Waiting is a forward action.
  if (pending.length > 0) return { kind: "AwaitingVerdict", pending };

  // 5. Real conflict, measured locally. Never read from `mergeable_state`.
  if (f.localMerge === "conflict") return { kind: "MergeConflicted", paths: f.conflictPaths };

  // 6. The remote verdict disagrees with the measurement, in the stale direction.
  if (isRemoteMergeVerdictStale(f)) return { kind: "MergeVerdictStale", remote: f.remoteMergeable };

  // 7. A frozen lane cannot heal itself: nothing will supersede it. Recognising
  //    this is mechanical; deciding retire-vs-recover is not, which is why the
  //    action for this arm is a proposal.
  if (f.isFrozenLane) return { kind: "FrozenLane", lane: f.headRef };

  // 8. The required check simply is not there, and nothing is red. Either the
  //    base was retargeted (fires `edited`, which gate.yml does not listen for)
  //    or the run was never dispatched for this head.
  if (roots.length === 0 && missing.length > 0) {
    return { kind: "VerdictNotDispatched", missing };
  }

  // 9. A required check absent ALONGSIDE failures is not classifiable: the
  //    absent one might have been the decisive verdict either way.
  if (missing.length > 0) {
    return {
      kind: "Unknown",
      reason: `required check(s) absent (${missing.join(", ")}) alongside ${String(roots.length)} failure(s); a check that never ran is not a check that passed`,
      evidence: roots,
    };
  }

  // 10. Red, none of it this PR's doing, and main has moved. A re-run is cheap
  //     and is both the diagnostic and, usually, the fix.
  if (isVerdictStale(f, roots, attributable)) {
    return { kind: "VerdictStale", unattributable: roots, behindBy: f.behindBy };
  }

  // 11. The PR's own defect. Judgement about someone else's design.
  if (attributable.length > 0) return { kind: "OwnFailure", attributable };

  // 12. Red, unattributable, CURRENT with main, and the cheap probe is unspent.
  //     A re-run is the discriminator: pass => it was infra, fail again => the
  //     failure is reproducible and the probe has told us so for one run's worth
  //     of minutes.
  if (roots.length > 0 && f.priorRerunAttempts === 0) {
    return { kind: "SuspectedInfraFlake", unattributable: roots };
  }

  // 13. Same state, but the cheap probe is SPENT and did not resolve it. The
  //     mechanical remedies are now exhausted while the state itself is
  //     perfectly well understood. This is the escalation case: diagnosis
  //     succeeded, prescription needs intelligence.
  if (roots.length > 0) {
    return {
      kind: "NeedsIntelligence",
      measured: [
        `rootFailures=${roots.join(",")}`,
        `attributable=0`,
        `behindBy=${String(f.behindBy)}`,
        `localMerge=clean`,
        `pending=0`,
        `priorRerunAttempts=${String(f.priorRerunAttempts)}`,
      ],
      ambiguity:
        "failures reproduce across a re-run, are unattributable to this diff, and the branch is current with main — so the failure is real but not this PR's, and no arm of the closed set would change it. Deciding whether this is a main-side regression, a persistently broken check, or an attribution miss requires reading the logs",
    };
  }

  return { kind: "Healthy", armed: f.autoMergeArmed };
}

/**
 * `Disposition -> ActionName`. Total by exhaustiveness: adding a `Disposition`
 * arm without adding its action here is a COMPILE error, which is what makes the
 * escape hatch reviewable rather than merely documented.
 */
export function actionFor(d: Disposition, f: PrFacts): { action: ActionName; args: Record<string, string | number> } {
  switch (d.kind) {
    case "Healthy":
      return d.armed ? { action: "NoAction", args: {} } : { action: "ReArmAutoMerge", args: { pr: f.number } };
    case "AwaitingVerdict":
      return { action: "Wait", args: { pr: f.number, pending: d.pending.length } };
    case "OwnedElsewhere":
      return { action: "NoAction", args: { pr: f.number } };
    case "VerdictUndispatchable":
      // Cannot be fixed by pushing: the merge ref is absent for a reason we did
      // not establish. Reopen does not help. Hand it up.
      return { action: "Escalate", args: { pr: f.number } };
    case "VerdictNotDispatched":
      // A merge commit changes the head, which fires `synchronize` — the one
      // trigger gate.yml does listen for. Additive and revertible.
      return { action: "MergeMainAndPush", args: { pr: f.number, sha: f.headSha } };
    case "VerdictStale":
      // NOT `RerunFailedJobs`, and the reason is a measured property of the
      // workflow rather than a preference.
      //
      // `gate.yml` pins no `ref:` on `actions/checkout`, so checkout uses the
      // default `github.sha`, which for a `pull_request` event is the merge
      // commit computed AT EVENT TIME and recorded on the run. Re-running
      // replays that pinned commit. A fix that landed on `main` afterwards is
      // therefore NOT picked up by a re-run — only a new merge commit gets it.
      //
      // This splits a class the 2026-08-26 evidence had conflated. "Checks
      // complete, zero running, unattributable" covers BOTH a transient infra
      // flake (re-run fixes it) and a fix that has since landed on main (re-run
      // cannot). They are indistinguishable from outside, and re-running the
      // second one burns minutes to faithfully reproduce the same red.
      //
      // `MergeMainAndPush` dominates: it creates a fresh merge commit, fires
      // `synchronize`, and resolves BOTH sub-cases. Choosing it here also means
      // the residual uncertainty about GitHub's exact re-run semantics cannot
      // change the outcome — which is the point of picking it.
      return { action: "MergeMainAndPush", args: { pr: f.number, sha: f.headSha, behindBy: d.behindBy } };
    case "SuspectedInfraFlake": {
      // Current with main, so by construction there is nothing new for a fresh
      // merge commit to pick up — which makes the re-run semantics question
      // moot here too, and makes the cheapest arm the correct one.
      const runId = rerunTargetRunId(f.checks);
      return runId === null
        ? { action: "Escalate", args: { pr: f.number } }
        : { action: "RerunFailedJobs", args: { pr: f.number, runId } };
    }
    case "MergeVerdictStale":
      return { action: "MergeMainAndPush", args: { pr: f.number, sha: f.headSha } };
    case "MergeConflicted":
      return { action: "ProposeConflictResolution", args: { pr: f.number, paths: d.paths.join(",") } };
    case "FrozenLane":
      return { action: "ProposeRetireLane", args: { pr: f.number, lane: d.lane } };
    case "OwnFailure":
      return { action: "ProposeAuthorReview", args: { pr: f.number, checks: d.attributable.join(",") } };
    case "NeedsIntelligence":
      return { action: "Escalate", args: { pr: f.number } };
    case "Unknown":
      return { action: "NoAction", args: { pr: f.number } };
  }
}

export function why(d: Disposition): string {
  switch (d.kind) {
    case "Healthy":
      return d.armed ? "no failures, armed" : "no failures, NOT armed";
    case "AwaitingVerdict":
      return `${String(d.pending.length)} check(s) still running: ${d.pending.slice(0, 3).join(", ")}`;
    case "OwnedElsewhere":
      return "branch held by another worktree or agent; not ours to move";
    case "VerdictUndispatchable":
      return d.why;
    case "VerdictNotDispatched":
      return `required check(s) never dispatched for this head: ${d.missing.join(", ")} (gate.yml listens on ${GATE_PR_TRIGGERS.join("/")} — note 'edited' is absent, so a retarget produces no run)`;
    case "VerdictStale":
      return `${String(d.unattributable.length)} failure(s), none attributable to this diff, and ${String(d.behindBy)} commit(s) behind main — a re-run would replay the pinned merge commit and miss anything main has since fixed`;
    case "SuspectedInfraFlake":
      return `${String(d.unattributable.length)} failure(s), none attributable to this diff, branch is CURRENT with main, and no re-run has been spent yet — re-run is the cheap discriminator`;
    case "MergeVerdictStale":
      return `GitHub reads ${d.remote} but a local merge against current main measured CLEAN; the remote verdict predates a fix`;
    case "MergeConflicted":
      return `local merge measured a real conflict in: ${d.paths.join(", ")}`;
    case "FrozenLane":
      return `head IS the lane tip for ${d.lane} and it is the only open PR for that lane, so nothing will supersede it`;
    case "OwnFailure":
      return `failure(s) attributable to this diff: ${d.attributable.join(", ")}`;
    case "NeedsIntelligence":
      return `ESCALATION — measured [${d.measured.join(" ")}]; ambiguity: ${d.ambiguity}`;
    case "Unknown":
      return `${d.reason}${d.evidence.length > 0 ? ` [${d.evidence.join(" ")}]` : ""}`;
  }
}

/**
 * The full pass. Returns a PROPOSAL, never an effect.
 *
 * Per `.claude/rules/no-directives.md`, source is not authorization: this
 * function's output carries zero authority. The receiving agent applies its own
 * local policy and may decline any row. That is deliberate — the operator's
 * model is that A accepts B's change only if A agrees, and the resulting drift
 * between agents is a FEATURE (it is what makes forking possible), not a
 * consistency bug to be engineered away. This is therefore a local policy, not
 * a controller enforcing global truth.
 */
export function propose(f: PrFacts): Proposal {
  const disposition = classify(f);
  const { action, args } = actionFor(disposition, f);
  return {
    number: f.number,
    headSha: f.headSha,
    disposition,
    action,
    args,
    autoExecutable: mayAutoExecute(action),
    why: why(disposition),
  };
}

export function renderProposal(p: Proposal): string {
  const lane = p.autoExecutable ? "AUTO" : "PROPOSE";
  return [`PR #${String(p.number)}  ${p.disposition.kind}  -> ${p.action} [${lane}]`, `    why: ${p.why}`].join("\n");
}

if (import.meta.main) {
  console.error(
    [
      "forward-action-du: a library. It classifies and proposes; it never acts.",
      "",
      "The read-only fact-gathering edge is `forward-action-report.ts`.",
      "No module in this pair holds a write token, arms auto-merge, pushes,",
      "closes, or retires anything.",
    ].join("\n"),
  );
  process.exit(2);
}
