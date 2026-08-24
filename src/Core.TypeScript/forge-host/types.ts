/**
 * forge-host/types.ts — host-agnostic data types for the ForgeHost abstraction.
 *
 * These types define the contract between the core loop/tools and any forge host
 * (GitHub, GitLab, Gitea, etc.). No host-specific fields leak through this boundary.
 *
 * Architectural rule: "GitHub is NOT git-native — it's a plugin."
 * (src/Core.FSharp.Git/CredentialSource.fs, Aaron 2026-06-07)
 */

// ─── Result type (project convention: Result-over-exception) ────────────────

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// ─── Error types ────────────────────────────────────────────────────────────

export type ForgeErrorKind =
  | "not-supported"      // adapter hasn't implemented this method
  | "auth-failure"       // credentials invalid or expired
  | "rate-limited"       // API rate limit hit
  | "not-found"          // resource doesn't exist
  | "network"            // transient network failure
  | "parse-failure"      // response couldn't be parsed
  | "permission-denied"  // valid auth but insufficient permissions
  | "internal";          // unexpected adapter error

export interface ForgeError {
  readonly kind: ForgeErrorKind;
  readonly message: string;
  readonly retryable: boolean;
  readonly raw?: unknown;
}

// ─── Forge detection ────────────────────────────────────────────────────────

export type ForgeType =
  | "github"
  | "gitlab"
  | "gitea"
  | "bitbucket"
  | "sourcehut"
  | "codeberg"
  | "unknown";

export interface DetectedForge {
  readonly forge: ForgeType;
  readonly owner: string;
  readonly repo: string;
  readonly host: string;
}

// ─── PR types ───────────────────────────────────────────────────────────────

export type PrState = "open" | "merged" | "closed";
export type MergeStateStatus = "clean" | "blocked" | "dirty" | "unstable" | "unknown";
export type ReviewDecision = "approved" | "changes-requested" | "review-required" | null;
export type MergeMethod = "merge" | "squash" | "rebase";

export interface PullRequest {
  readonly number: number;
  readonly title: string;
  readonly headRef: string;
  readonly baseRef: string;
  readonly state: PrState;
  readonly isDraft: boolean;
  readonly mergeStateStatus: MergeStateStatus;
  readonly reviewDecision: ReviewDecision;
  readonly url: string;
  readonly updatedAt: string;
  readonly author: string;
}

export type NextAction =
  | "wait-ci"
  | "fix-failed-checks"
  | "resolve-threads"
  | "rebase"
  | "verify-merge"
  | "none";

export interface CheckSummary {
  readonly ok: number;
  readonly inProgress: number;
  readonly pending: number;
  readonly failed: number;
}

export interface PrGateState {
  readonly number: number;
  readonly state: PrState;
  readonly gate: "clean" | "blocked" | "dirty" | "unstable" | "unknown";
  readonly checks: CheckSummary;
  readonly requiredChecks: CheckSummary;
  readonly unresolvedThreads: number;
  readonly autoMerge: "armed" | "none";
  readonly mergeCommit: string | null;
  readonly warnings: readonly string[];
  readonly nextAction: NextAction;
}

// ─── Thread types ───────────────────────────────────────────────────────────

export interface ThreadResolution {
  readonly threadId: string;
  readonly body: string;
}

export interface BatchResult {
  readonly resolved: number;
  readonly failed: readonly { readonly threadId: string; readonly error: ForgeError }[];
}

// ─── Issue types ────────────────────────────────────────────────────────────

export interface Issue {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly state: "open" | "closed";
  readonly url: string;
  readonly labels: readonly string[];
}

// ─── CI types ───────────────────────────────────────────────────────────────

export type CiConclusion =
  | "success" | "neutral" | "skipped"
  | "failure" | "cancelled" | "timed-out"
  | "startup-failure" | "action-required" | "stale";

export interface CiCheck {
  readonly name: string;
  readonly status: "queued" | "in-progress" | "completed";
  readonly conclusion: CiConclusion | null;
  readonly required: boolean;
}

export interface CheckRollup {
  readonly ref: string;
  readonly checks: readonly CiCheck[];
  readonly summary: CheckSummary;
  readonly requiredSummary: CheckSummary;
}

export interface CiRun {
  readonly id: string;
  readonly name: string;
  readonly status: "queued" | "in-progress";
  readonly headSha: string;
}

// ─── Repository info ────────────────────────────────────────────────────────

export interface RepoInfo {
  readonly owner: string;
  readonly name: string;
  readonly defaultBranch: string;
  readonly isPrivate: boolean;
  readonly url: string;
}

export interface BranchProtection {
  readonly requiredChecks: readonly string[];
  readonly requiresReview: boolean;
  readonly requiredReviewCount: number;
  readonly dismissesStaleReviews: boolean;
}

// ─── Git data API types ─────────────────────────────────────────────────────

export interface TreeEntry {
  readonly path: string;
  readonly mode: "100644" | "100755" | "040000" | "160000" | "120000";
  readonly type: "blob" | "tree" | "commit";
  readonly sha: string;
}

export interface CreateCommitOpts {
  readonly message: string;
  readonly tree: string;
  readonly parents: readonly string[];
}

// ─── Comment reference ──────────────────────────────────────────────────────

export interface CommentRef {
  readonly id: string;
  readonly url: string;
}

// ─── Option types ───────────────────────────────────────────────────────────

export interface ListPrOpts {
  readonly limit?: number;
  readonly orderBy?: "updated" | "created";
}

export interface ListMergedPrOpts {
  readonly limit?: number;
  readonly since?: string; // ISO 8601
}

export interface CreatePrOpts {
  readonly title: string;
  readonly body: string;
  readonly head: string;
  readonly base: string;
  readonly draft?: boolean;
}

export interface ListIssueOpts {
  readonly limit?: number;
  readonly labels?: readonly string[];
}

export interface CreateIssueOpts {
  readonly title: string;
  readonly body: string;
  readonly labels?: readonly string[];
}

// --- Git ref/commit read types ---

export interface GitRef {
  readonly ref: string;
  readonly sha: string;
}

export interface GitCommitInfo {
  readonly sha: string;
  readonly treeSha: string;
  readonly message: string;
  readonly parents: readonly string[];
}

// --- Extended PR search ---

export interface SearchPrOpts {
  readonly state?: "open" | "merged" | "closed" | "all";
  readonly search?: string;
  readonly limit?: number;
  readonly author?: string;
  readonly since?: string;
}

export interface SearchPrResult {
  readonly number: number;
  readonly state: "open" | "merged" | "closed";
  readonly createdAt: string;
  readonly mergedAt: string | null;
  readonly closedAt: string | null;
}

// ─── Check-observation types (the drift dashboard's producer contract) ──────
//
// WHY THESE LIVE HERE AND NOT IN THE DASHBOARD.
//
// GitHub is a *forge host*, never *the* forge host, and the stated destination is
// **sovereign mode** — fully decentralized, no centralized forge host at all, with
// author/verifier agent attestations in place of forge gates. A dashboard whose
// model is workflow-run-shaped dies with the forge host. So the vocabulary the
// dashboard folds over is part of the *plugin contract* (host-agnostic by
// construction, this file's whole purpose), and the dashboard core imports only
// these types — never an adapter, never a registry, never `gh`.
//
// The partition is Data Vault 2.0 (`.claude/rules/dv2-data-split-discipline-activated.md`)
// applied to CI observation:
//   hub       — CheckId + Verdict + Expectation: stable, substrate-independent.
//   satellite — SourceDetail: fast-changing, substrate-specific (run id, url, raw
//               conclusion string). Carried for humans, never folded on.

/**
 * Stable identity of a check, independent of who produced it.
 *
 * It must survive the substrate migration: the same logical check observed via a
 * forge host's workflow run today and via an author/verifier attestation tomorrow
 * carries the SAME CheckId, or the dashboard cannot show "the same red" across the
 * change. Adapters mint it from the most stable name the substrate offers (for
 * GitHub Actions: the workflow file's basename without extension — the workflow
 * *name* and numeric id both churn, the path does not).
 */
export type CheckId = string;

/** Why a verdict is `unknown`. These are NOT interchangeable — see `Verdict`. */
export type UnknownReason =
  /** No data has ever existed for this check, from any source, in any pass. */
  | "never-observed"
  /** Data may exist; THIS pass did not see it. Today's bug wears this one's clothes. */
  | "not-observed-this-pass"
  /** We could not derive whether this check is even supposed to run on this ref. */
  | "expectation-unknown"
  /** The producer errored while asking. Absence of an answer, not an answer. */
  | "source-error"
  /**
   * The producer DECLARES this check, and its definition is not in the repository.
   *
   * A distinct fact from "we could not parse it", and one that is invisible to both a
   * run-list check and a file-tree check because each surface alone looks consistent.
   * Measured live 2026-08-22: three workflows are `state: active` on the forge host
   * with no file on `main` — `inventory-phase5-proof`, `substrate-claim-checker`,
   * `zz-rustup-cache-probe`. That is roster-versus-repository drift, and it needs its
   * own name or it hides inside `expectation-unknown`.
   */
  | "registered-but-absent";

/**
 * A check's verdict. **`unknown` is first-class and can never aggregate into green.**
 *
 * Aaron 2026-08-22: *"Unknown is a first-class verdict that can never aggregate into
 * green yes this would be Ideal, this is what most humans and AI are not good at
 * keeping in their head the unknowns they forgot about lol, so the more mechanical
 * the better."*
 *
 * Modelled as a discriminated union rather than an enum + optional reason so that an
 * `unknown` is UNCONSTRUCTIBLE without saying which unknown it is. Collapsing
 * "never observed" into "not observed this pass" is precisely the failure this
 * dashboard exists to make impossible.
 *
 * `not-applicable` is NOT a synonym for green: it is "this check correctly produced
 * nothing on this ref" (a PR-only check on a branch ref). Rendering it as green
 * would launder a real distinction; rendering it as unknown would manufacture noise.
 */
export type Verdict =
  | { readonly kind: "green" }
  | { readonly kind: "red"; readonly detail: string }
  | { readonly kind: "running" }
  | { readonly kind: "skipped"; readonly detail: string }
  | { readonly kind: "not-applicable"; readonly detail: string }
  /**
   * The check is declared, correct, and **has not yet had an opportunity to run**.
   *
   * Its own state, and it has to be, because both alternatives are wrong. Rendering it
   * green claims a verdict nobody gave; rendering it red burns the alarm's credibility
   * on every newly-added scheduled check, and **a guard that cries wolf gets muted**,
   * which is worse than not having it.
   *
   * Measured the hard way 2026-08-22: `chart-version-refresh` was reported as a
   * never-fired weekly cron. It landed on `main` Friday 20:18, its cron is Sundays at
   * 17:07, and the report was written on Saturday. The run history and the alarming
   * story were consistent; so was the innocent one. Only the definition's AGE
   * separates them.
   */
  | { readonly kind: "not-yet-due"; readonly detail: string }
  /**
   * The check's recent CONCLUDED history contains both passes and failures.
   *
   * Its own state because neither neighbour is honest about it. Two instruments
   * disagreed about `build-ai-cluster-iso` on 2026-08-22 and **both were right**: its
   * concluded runs on `main` that afternoon went success 21:53, failure 21:18, success
   * 20:37, success 20:03, failure 19:07. A latest-verdict reader sampling at 21:55 says
   * green; one sampling at 21:20 says red. Neither is wrong and neither is useful,
   * because a lane whose next verdict is a coin flip has no colour.
   *
   * Reporting it as green would launder a 90% claim as a 100% one. Reporting it as red
   * would make an oscillating lane permanently red and get the alarm muted. So it is
   * named, ranked directly under red, and it says the mix out loud.
   */
  | { readonly kind: "flapping"; readonly detail: string }
  | { readonly kind: "unknown"; readonly reason: UnknownReason; readonly detail: string };

export type VerdictKind = Verdict["kind"];

/**
 * What the substrate DECLARES about when this check should produce a verdict on a
 * given ref. This is what separates an expected-absent check from an
 * unexpectedly-absent one — and collapsing those two is what produces the grey wall
 * of unknowns that everyone scrolls past.
 *
 * Derived from the substrate's own declaration, never assumed: for GitHub Actions,
 * parsed out of the workflow's `on:` triggers. A check whose declaration could not
 * be read is `unknown` — loudly — not quietly assumed to be on-demand.
 */
export type CheckExpectation =
  /** Declared to run on a clock. Silence is a RED condition, not an unknown. */
  | { readonly kind: "periodic"; readonly periodSeconds: number; readonly detail: string }
  /** Declared to run when the ref changes. Silence is unknown and ranks high. */
  | { readonly kind: "on-change"; readonly detail: string }
  /** Only fires on a request (PR, manual dispatch, another ref). Silence is CORRECT. */
  | { readonly kind: "on-demand"; readonly detail: string }
  /**
   * Could not derive the declaration. Silence is unknown and must be loud.
   *
   * `reason` separates two genuinely different failures: `definition-absent` (the
   * producer declares a check whose definition is not in the repository) from
   * `underivable` (the definition is here and we could not read it). Collapsing them
   * would hide a real drift class inside a parser complaint.
   */
  | { readonly kind: "unknown"; readonly reason: "definition-absent" | "underivable"; readonly detail: string };

/**
 * A check that a source declares EXISTS. This is the dashboard's denominator, and it
 * is the half a window-sampling query structurally cannot produce: you cannot notice
 * a check you never knew about.
 */
export interface CheckDefinition {
  readonly checkId: CheckId;
  /** Human label. May churn; never used as a key. */
  readonly displayName: string;
  readonly expectation: CheckExpectation;
  /** Which producer declared it. Provenance, never authority. */
  readonly source: string;
  /**
   * ISO-8601 of when this check's DEFINITION first existed, as best the producer can
   * establish it (for a repository workflow: the commit that added the file).
   *
   * Load-bearing for `not-yet-due`: "has this ever fired" is only a finding once the
   * trigger has had an opportunity to fire, and the first opportunity is derived from
   * when the definition landed — never from when the dashboard started looking.
   * `undefined` ⇒ unknown age, and the fold then declines to raise a never-fired alarm
   * rather than raising a possibly-false one.
   */
  readonly definitionSince?: string;
  /** Substrate-specific detail for humans. Never folded on. */
  readonly sourceDetail?: Readonly<Record<string, string>>;
}

/**
 * Which DECLARED trigger class an observation came from.
 *
 * Load-bearing, and the reason is a live finding: `chart-version-refresh` declares a
 * weekly cron `7 17 * * 0`, and every one of the 14 runs in its entire history is
 * `event=pull_request`. Zero schedule events, ever. A model that only asks *"what did
 * the last run say"* cannot see that — the workflow is registered, its file is present,
 * its cron is declared, and the trigger has never once fired. So an observation must
 * say WHICH trigger produced it, and a periodic check whose verdicts all arrive from
 * some other trigger is red however green those verdicts are.
 */
export type TriggerClass = "periodic" | "on-change" | "on-request" | "unknown";

/**
 * One observed verdict for one check.
 *
 * `observedAt` is when the verdict was ESTABLISHED (the run's completion / the
 * attestation's timestamp), not when we looked — the fold sorts on it, so it must be
 * the evidence's own time. Local wall-clock steers only the *pass*, never the fold
 * (`.claude/rules/local-time-never-enters-the-shared-fold.md`).
 */
export interface CheckObservation {
  readonly checkId: CheckId;
  readonly verdict: Verdict;
  /** ISO-8601. When the verdict was established by its producer. */
  readonly observedAt: string;
  /** Which producer established it. Provenance, never authority. */
  readonly source: string;
  /**
   * Which declared trigger class produced this verdict. Omitted only by producers that
   * genuinely cannot tell; `"unknown"` and absent both mean "do not conclude the
   * declared trigger fired".
   */
  readonly trigger?: TriggerClass;
  /**
   * What the producer saw while looking for this verdict.
   *
   * A verdict alone cannot express two of the ways a check hides a failure, and both
   * were measured in this repo on 2026-08-22:
   *
   * **In-progress masking.** `gate`'s newest run on `main` was `in_progress`, so a
   * scanner that reads "the latest run" found no failure and main read as clean —
   * while the last CONCLUDED verdict was `failure`, with two cancelled runs in
   * between. A running check must never overwrite the last concluded verdict; it
   * **annotates** it. `recheckInFlight` is that annotation.
   *
   * **A dark lane.** `tlaps-proof` over its last 40 runs: 33 cancelled, 7 failure,
   * last success 2026-07-01 — seven weeks with the gate effectively switched off, and
   * every conclusion-only dashboard would render it as "not failing". The
   * discriminator against a lane that is merely *churning* (`gate` is cancelled by its
   * own concurrency group on ~88% of pushes and is perfectly alive) is **time, not
   * count**: how long has the check gone without concluding anything?
   */
  readonly attempts?: AttemptSummary;
  /**
   * A NEWER verdict for this check that arrived by a different trigger than the one
   * this observation reports.
   *
   * The reconciling field. A `periodic` check's verdict is deliberately drawn from its
   * SCHEDULED runs — a green from a hand-run proves the code works and does not prove
   * the cadence does, and letting a manual dispatch clear a scheduled lane's red would
   * be a snooze button anyone could press. But suppressing that dispatch entirely is
   * what made this dashboard and a hand-rolled scanner tell two different stories about
   * the same three cadence lanes on 2026-08-22, with no way for a reader to see why.
   *
   * So the stronger claim stays the verdict, and the weaker evidence is carried beside
   * it and rendered. Both instruments' answers become visible in one row.
   */
  readonly supersededBy?: SupersedingVerdict;
  readonly sourceDetail?: Readonly<Record<string, string>>;
}

/** A newer verdict from a trigger other than the one the observation reports. */
export interface SupersedingVerdict {
  readonly verdict: Verdict;
  readonly observedAt: string;
  readonly trigger: TriggerClass;
  readonly detail: string;
}

/** One attempt that established a verdict, and when. */
export interface ConcludedOutcome {
  /** ISO-8601 of when the verdict was established. */
  readonly at: string;
  readonly passed: boolean;
}

/** What a producer saw while looking for one check's verdict. */
export interface AttemptSummary {
  /** Recent attempts the producer inspected. */
  readonly inspected: number;
  /** Of those, how many produced no verdict at all (cancelled, killed, still running). */
  readonly withoutVerdict: number;
  /** Inconclusive attempts NEWER than the verdict being reported. */
  readonly newerThanVerdict: number;
  /** Wall-time span covered by those newer inconclusive attempts, in seconds. */
  readonly newerSpanSeconds: number;
  /** The newest attempt is still in flight — annotate, never overwrite. */
  readonly recheckInFlight: boolean;
  /**
   * Every attempt in the inspected slice that ESTABLISHED a verdict, newest first,
   * **with its timestamp**.
   *
   * Timestamps rather than counts, and that is the whole point. A bare
   * `concludedRed: 12` is time-blind: for an hourly lane it describes the last hour,
   * and for a rarely-run one it can reach back a quarter. `vocab-hygiene` was reported
   * broken off "12 of the last 20 concluded runs failed" when **every one of those
   * failures was from June** and the lane had passed every run since 2026-06-10.
   *
   * Reporting the outcomes and letting the FOLD do the windowing is also the right
   * split: the producer says what it saw, the policy decides what counts as recent.
   */
  readonly concluded: readonly ConcludedOutcome[];
}

/**
 * A check the producer was ASKED about and could not answer for.
 *
 * Modelled explicitly rather than dropped, because a producer failure is an absence of
 * evidence and absence of evidence must not be able to render as a pass. The fold
 * turns each of these into `unknown{ reason: "source-error" }` for that specific check.
 */
export interface CheckObservationFailure {
  readonly checkId: CheckId;
  readonly detail: string;
}

/**
 * The result of one observation pass: what was learned, and what could not be.
 *
 * Returning the failures alongside the observations is the contract's way of refusing
 * the convenient shape — a bare array would make "I could not ask" indistinguishable
 * from "there was nothing to report".
 */
export interface CheckObservationPass {
  readonly observations: readonly CheckObservation[];
  readonly failures: readonly CheckObservationFailure[];
}

/** Options for a check-observation pass. */
export interface CheckObservationOpts {
  /** Degree of parallelism for the pass. **1 ⇒ deterministic, replayable.** */
  readonly maxDegreeOfParallelism?: number;
}
