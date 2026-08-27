/**
 * drift-dashboard/fold.ts — the substrate-neutral core.
 *
 * WHAT THIS FILE IS NOT ALLOWED TO KNOW: what a forge host is. It imports types from
 * the plugin contract (`forge-host/types.ts`, host-agnostic by construction) and
 * nothing else — no adapter, no registry, no `gh`, no workflow, no run id. The stated
 * destination is **sovereign mode**: no centralized forge host at all, author/verifier
 * agent attestations where forge gates stand today. If this fold could not run with no
 * forge host present, the migration Aaron described would not be possible, so
 * `fold.test.ts` exercises it with observations carrying no forge fields at all.
 *
 * THE ONE PROPERTY THE WHOLE FILE EXISTS FOR:
 *
 *   > a check that was never observed must never render identically to a check
 *   > that passed.
 *
 * Measured live 2026-08-22: `gh run list --branch main --limit 200` — the query the
 * fleet had been reporting "main is clean" from all session — contained runs from only
 * **22 of 81 active workflows**, because heartbeat traffic saturates the window.
 * Latest-per-check instead surfaced four workflows that had been failing unseen for up
 * to six days. A window sample is not a slow instrument, it is a *structurally blind*
 * one, and its blindness renders as green.
 *
 * Prior art in-repo, and this is the discipline it asked for:
 *   docs/research/2026-08-13-peer-agents-parallel-experiments-and-why-a-health-dashboard-is-a-check-that-must-not-lie.md
 *     §3 — "a dashboard is a check that a human trusts *instead of looking*", its Opens
 *     #1 (derive the coverage set and display it) and #2 (write the falsifier first).
 *   src/Core.TypeScript/ci/platform-drift-report.ts — the same coverage-is-not-a-footnote
 *     stance, scoped to one workflow's legs.
 *   src/Core.TypeScript/agent-heartbeats/heartbeat-liveness.ts — level-triggered, not
 *     edge-triggered, for one lane; this generalises that shape to the whole roster.
 */

import type {
  CheckExpectation,
  CheckId,
  AttemptSummary,
  CheckObservation,
  ConcludedOutcome,
  CheckObservationFailure,
  TriggerClass,
  SupersedingVerdict,
  UnknownReason,
  Verdict,
  VerdictKind,
} from "../forge-host/types.ts";
import { ordinal, type Roster } from "./roster.ts";

// ─── Configuration ──────────────────────────────────────────────────────────

export interface FoldConfig {
  /**
   * A periodic check is STALE once its newest verdict is older than
   * `stalenessFactor × periodSeconds`. Staleness is RED, including when the stale
   * verdict itself is green: a daily check whose last green is eight days old did not
   * run, and "its last answer was yes" is not an answer about today.
   */
  readonly stalenessFactor: number;
  /**
   * A check is **dark** when inconclusive attempts newer than its last verdict span
   * more than this. Time, not count, is the discriminator: `gate` is cancelled by its
   * own concurrency group on most pushes and still concludes every few minutes (alive,
   * churning); `tlaps-proof` went 33-of-40 cancelled with no success since 2026-07-01
   * (dark). A count threshold would flag the first; a span threshold flags only the
   * second.
   */
  readonly darkSpanSeconds: number;
  /** At least this many inconclusive attempts before "dark" is considered at all. */
  readonly darkMinAttempts: number;
  /**
   * Concluded FAILURES in the inspected window, at or above which a check whose newest
   * verdict is green is reported `flapping` rather than green.
   *
   * 2 rather than 1: one failure among twenty concluded runs is a flake, and promoting
   * every flake to its own band would bury the lanes that are genuinely oscillating.
   * `build-ai-cluster-iso` sat at 2 failures in its last 8 concluded runs, inside three
   * hours, which is the shape this is for.
   */
  readonly flappingMinRed: number;
  /**
   * A failure RATE is only a finding over a window recent enough to describe the
   * PRESENT. Concluded runs older than this do not enter the rate.
   *
   * The rule this bounds went out time-blind and produced two false positives on its
   * first day. `vocab-hygiene`: "12 of the last 20 concluded runs failed" — every
   * failure from June, the lane fixed and passing every run since 2026-06-10, and the
   * 20-run window still reaching back two months. For a high-frequency lane 20 runs is
   * an hour and the rate means what it says; for a rarely-run one it can be a quarter,
   * and a single old incident then dominates the verdict FOREVER because passing runs
   * arrive too slowly to dilute the window.
   *
   * This is `not-yet-due` on the other axis. That one refuses to call a trigger dead
   * before it has had an opportunity to fire; this one refuses to call a lane broken
   * off evidence that has stopped describing it.
   */
  readonly rateWindowSeconds: number;
  /**
   * Below this many concluded runs inside the window there is no rate, only a small
   * sample. Reported as insufficient data — never as a clean bill of health, and never
   * as a verdict.
   */
  readonly minConcludedForRate: number;
  /**
   * Consecutive passes since the last failure that clear a rate finding.
   *
   * "Recency should be able to clear it" — a lane that broke, was fixed, and has passed
   * this many times running has earned its way out, and a rule that never lets it is
   * the cries-wolf generator with extra steps.
   */
  readonly recoveryPassStreak: number;
}

export const DEFAULT_FOLD_CONFIG: FoldConfig = {
  stalenessFactor: 3,
  darkSpanSeconds: 6 * 3600,
  darkMinAttempts: 2,
  flappingMinRed: 2,
  rateWindowSeconds: 7 * 86_400,
  minConcludedForRate: 5,
  recoveryPassStreak: 5,
};

// ─── Report shape ───────────────────────────────────────────────────────────

/** Why a row sits where it sits. Rendered, so the ranking is auditable, not magic. */
export type RowBand = "red" | "flapping" | "unknown" | "running" | "not-yet-due" | "skipped" | "not-applicable" | "green";

export interface DashboardRow {
  readonly checkId: CheckId;
  readonly displayName: string;
  readonly source: string;
  readonly expectation: CheckExpectation;
  readonly verdict: Verdict;
  readonly band: RowBand;
  /** ISO-8601 of the verdict this row reports, or `null` if nothing was ever observed. */
  readonly observedAt: string | null;
  /**
   * Seconds since the newest verdict for this check. `null` when nothing has EVER been
   * observed — which sorts as infinite silence, because that is what it is.
   */
  readonly silenceSeconds: number | null;
  /** True when this pass saw a verdict for this check. */
  readonly observedThisPass: boolean;
  /**
   * A newer attempt is in flight; this row shows the last CONCLUDED verdict, which may
   * be superseded shortly. An annotation, never a replacement — the optimistic read of
   * an unfinished run is how `gate`'s red hid behind an `in_progress` on 2026-08-22.
   */
  readonly recheckInFlight: boolean;
  /** True when no source declared this check in this pass, though the roster remembers it. */
  readonly undeclared: boolean;
  /**
   * A newer verdict that arrived by a different trigger. Rendered beside the verdict so
   * a reader can see the evidence that qualifies it rather than having to run a second
   * instrument and wonder which one is lying.
   */
  readonly supersededBy?: SupersedingVerdict;
}

export interface Coverage {
  /**
   * Checks whose declaration says they SHOULD report on this ref (periodic, on-change,
   * or undeciderable). This is the denominator that can go red.
   *
   * On-demand checks are excluded on purpose. Counting a PR-only check as an
   * uncovered gap on a branch ref would pin coverage permanently below 100% — and a
   * red that is always red is a red nobody reads, which is the habituation failure
   * this dashboard is built against.
   */
  readonly expected: number;
  /**
   * Of `expected`, how many actually ESTABLISHED a verdict in this pass.
   *
   * An `unknown` row never counts here, whatever produced it — a cancelled run whose
   * jobs never executed, a producer that errored, or nothing at all. All three are the
   * same fact ("we did not learn anything about this check") and coverage is the count
   * of the times we did. This keeps `shortfall` and the unknown count in lockstep by
   * construction rather than by convention.
   */
  readonly observed: number;
  /** `expected - observed`. **Any shortfall is a RED condition, never a footnote.** */
  readonly shortfall: number;
  /** Correctly-silent checks: declared to fire only on request. */
  readonly onDemand: number;
  /** Hand-retired checks, excluded from every count above. */
  readonly retired: number;
  /** Total non-retired roster size. `expected + onDemand`. */
  readonly known: number;
}

export interface DashboardReport {
  readonly ref: string;
  /** ISO-8601 of the pass. Injected, never read from an ambient clock. */
  readonly at: string;
  readonly rows: readonly DashboardRow[];
  readonly counts: Readonly<Record<RowBand, number>>;
  readonly coverage: Coverage;
  /** Longest silence among unknown rows, in seconds. `null` if some unknown was never observed. */
  readonly oldestUnknownSilenceSeconds: number | null;
  /** True when at least one unknown row has never been observed at all. */
  readonly hasNeverObserved: boolean;
  /** Sources that contributed to this pass, sorted ordinally. Provenance, never authority. */
  readonly sources: readonly string[];
  /** Producer failures. A source that could not answer is an absence, not an all-clear. */
  readonly sourceErrors: readonly string[];
  /**
   * `false` when anything is red, anything is unknown, coverage fell short, or a source
   * errored. **Unknown never aggregates into green** — that is the whole point, and it
   * is asserted here rather than left to the renderer.
   */
  readonly ok: boolean;
}

// ─── Latest-per-check aggregation ───────────────────────────────────────────

/**
 * Collapse many observations of one check to the newest.
 *
 * The falsifier this earns: **an older green must never mask a newer red.** Ties on
 * `observedAt` break ordinally on `source` then on input order, so the fold is a
 * function of the observation SET and not of its arrival order (DST).
 */
export function latestPerCheck(
  observations: readonly CheckObservation[],
): ReadonlyMap<CheckId, CheckObservation> {
  const latest = new Map<CheckId, CheckObservation>();
  for (const obs of observations) {
    const held = latest.get(obs.checkId);
    if (held === undefined) {
      latest.set(obs.checkId, obs);
      continue;
    }
    const byTime = ordinal(obs.observedAt, held.observedAt);
    if (byTime > 0 || (byTime === 0 && ordinal(obs.source, held.source) > 0)) {
      latest.set(obs.checkId, obs);
    }
  }
  return latest;
}

// ─── Absence → a typed verdict ──────────────────────────────────────────────

function unknown(reason: UnknownReason, detail: string): Verdict {
  return { kind: "unknown", reason, detail };
}

/** Did this observation arrive by the trigger the check DECLARES? */
export function triggerMatchesExpectation(
  trigger: TriggerClass | undefined,
  expectation: CheckExpectation,
): boolean {
  if (trigger === undefined || trigger === "unknown") return false;
  if (expectation.kind === "periodic") return trigger === "periodic";
  if (expectation.kind === "on-change") return trigger === "on-change";
  if (expectation.kind === "on-demand") return trigger === "on-request";
  return false;
}

function secondsBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 1000);
}

function humanDuration(seconds: number): string {
  if (seconds < 90) return `${seconds}s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)}m`;
  if (seconds < 172800) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

/**
 * The verdict for a check that produced NOTHING in this pass.
 *
 * This is where "expected-absent" and "unexpectedly-absent" are separated, and the
 * separation is the reason the unknowns do not become a grey wall. A PR-only check
 * silent on a branch ref is *correct*; a weekly check that has never produced a verdict
 * is a red wearing unknown's clothes — the schedule declares it should have run.
 *
 * Nothing here is assumed. The expectation is derived from the substrate's own
 * declaration by the producer; an expectation that could not be derived stays
 * `unknown` and is loud, rather than being quietly defaulted to the convenient case.
 */
export function verdictForAbsence(
  expectation: CheckExpectation,
  lastObservedAt: string | null,
  now: string,
  config: FoldConfig,
  definitionSince?: string,
): Verdict {
  if (lastObservedAt === null) {
    switch (expectation.kind) {
      case "periodic": {
        const due = firstOpportunityPassed(expectation, definitionSince, now);
        if (!due.passed) {
          return {
            kind: "not-yet-due",
            detail: `declared to run every ${humanDuration(expectation.periodSeconds)} (${expectation.detail}) and ${due.why} — no verdict is owed yet`,
          };
        }
        return {
          kind: "red",
          detail: `declared to run every ${humanDuration(expectation.periodSeconds)} and has NEVER produced a verdict on this ref (${expectation.detail})`,
        };
      }
      case "on-change":
        return unknown(
          "never-observed",
          `declared to run on changes to this ref (${expectation.detail}) and has never produced a verdict`,
        );
      case "on-demand":
        return {
          kind: "not-applicable",
          detail: `declared to fire only on request (${expectation.detail}); silence on this ref is correct`,
        };
      case "unknown":
        return expectation.reason === "definition-absent"
          ? unknown(
              "registered-but-absent",
              `REGISTERED with the producer but its definition is ABSENT from the repository (${expectation.detail}) — roster-versus-repository drift, invisible to a run-list check and to a file-tree check alike`,
            )
          : unknown(
              "expectation-unknown",
              `cannot tell whether this check should run on this ref (${expectation.detail}), and it has never produced a verdict`,
            );
    }
  }

  if (expectation.kind === "unknown" && expectation.reason === "definition-absent") {
    return unknown(
      "registered-but-absent",
      `REGISTERED with the producer but its definition is ABSENT from the repository (${expectation.detail})`,
    );
  }

  const age = secondsBetween(lastObservedAt, now);
  if (expectation.kind === "periodic" && age > config.stalenessFactor * expectation.periodSeconds) {
    return {
      kind: "red",
      detail: `STALE: newest verdict is ${humanDuration(age)} old, declared to run every ${humanDuration(expectation.periodSeconds)} (${expectation.detail})`,
    };
  }
  if (expectation.kind === "on-demand") {
    return {
      kind: "not-applicable",
      detail: `declared to fire only on request (${expectation.detail}); newest verdict ${humanDuration(age)} old`,
    };
  }
  return unknown(
    "not-observed-this-pass",
    `known check, produced no verdict in this pass; newest verdict is ${humanDuration(age)} old`,
  );
}

/**
 * Staleness also applies to a check we DID observe. A periodic check whose newest
 * verdict is far older than its period did not run, whatever that verdict says — the
 * generalisation of the heartbeat watchdog's level-triggered reading to the whole
 * roster.
 */
function applyStaleness(
  verdict: Verdict,
  expectation: CheckExpectation,
  observedAt: string,
  now: string,
  config: FoldConfig,
): Verdict {
  if (expectation.kind !== "periodic") return verdict;
  if (verdict.kind === "red" || verdict.kind === "running") return verdict;
  const age = secondsBetween(observedAt, now);
  if (age <= config.stalenessFactor * expectation.periodSeconds) return verdict;
  return {
    kind: "red",
    detail: `STALE: newest verdict (${verdict.kind}) is ${humanDuration(age)} old, declared to run every ${humanDuration(expectation.periodSeconds)} (${expectation.detail})`,
  };
}

/**
 * Has this check had an OPPORTUNITY to run yet?
 *
 * A never-fired trigger is only a finding once the trigger could have fired. Without
 * this, every newly-added scheduled check is flagged broken on the day it lands — a
 * false-positive generator, and a guard that cries wolf gets muted, which is worse
 * than not having the guard.
 *
 * **Honest limit, stated rather than hidden:** this is *one full period elapsed since
 * the definition landed*, not *a matching cron instant has occurred*. It is a sound
 * over-approximation — it never raises a false alarm, and at worst it delays a true
 * one by less than one period. Computing real cron instants needs a cron evaluator and
 * a timezone, and the cheap version is honest about what it is.
 *
 * An unknown definition age **declines to alarm**. That direction is deliberate: an
 * unknown rendered as red burns credibility, and this branch has already been wrong
 * once in exactly that direction.
 */
export function firstOpportunityPassed(
  expectation: Extract<CheckExpectation, { kind: "periodic" }>,
  definitionSince: string | undefined,
  now: string,
): { readonly passed: boolean; readonly why: string } {
  if (definitionSince === undefined) {
    return { passed: false, why: "its definition's age is unknown, so no opportunity to fire can be established" };
  }
  const age = secondsBetween(definitionSince, now);
  if (age < expectation.periodSeconds) {
    return {
      passed: false,
      why: `its definition landed only ${humanDuration(Math.max(age, 0))} ago, less than one full period`,
    };
  }
  return { passed: true, why: `its definition has existed for ${humanDuration(age)}` };
}

/** The concluded outcomes that are recent enough to describe the present, and what they say. */
export interface RateWindow {
  /** Concluded outcomes inside the window, newest first. */
  readonly considered: readonly ConcludedOutcome[];
  readonly passed: number;
  readonly failed: number;
  readonly oldestAt: string | null;
  readonly newestAt: string | null;
  /** Enough concluded runs inside the window to speak of a rate at all. */
  readonly sufficient: boolean;
  /** Consecutive passes at the newest end of the window, before the first failure. */
  readonly passStreak: number;
  /**
   * The lane has passed enough times IN A ROW since its last failure to have earned
   * its way out.
   *
   * **A streak, not merely "the newest run passed".** The first version of this rule
   * defined recovery as "every failure predates the newest pass", which is true of
   * ANY lane whose most recent run passed — and since the rate rules only run when the
   * newest verdict is green, that definition nullified the entire rule. It was caught
   * by four of its own tests going red, which is the tests doing their job.
   *
   * A run of consecutive passes is evidence and must be able to clear a rate finding;
   * one pass after four failures is not that evidence.
   */
  readonly recovered: boolean;
}

/**
 * Restrict the concluded history to what still describes the present, and read it.
 *
 * Pure and total. Everything the rate rules decide is decided from this, so the window
 * is computed in exactly one place and can be printed in the row that used it.
 */
export function rateWindow(
  attempts: AttemptSummary | undefined,
  now: string,
  config: FoldConfig,
): RateWindow | null {
  if (attempts === undefined) return null;
  const cutoffMs = Date.parse(now) - config.rateWindowSeconds * 1000;
  const considered = attempts.concluded.filter((c) => {
    const t = Date.parse(c.at);
    return Number.isFinite(t) && t >= cutoffMs;
  });
  const passed = considered.filter((c) => c.passed).length;
  const failed = considered.length - passed;
  const times = considered.map((c) => c.at).sort(ordinal);
  // `considered` is newest-first, so the leading run of passes is the current streak.
  let passStreak = 0;
  for (const c of considered) {
    if (!c.passed) break;
    passStreak += 1;
  }
  return {
    considered,
    passed,
    failed,
    oldestAt: times[0] ?? null,
    newestAt: times.at(-1) ?? null,
    sufficient: considered.length >= config.minConcludedForRate,
    passStreak,
    recovered: failed > 0 && passStreak >= config.recoveryPassStreak,
  };
}

/** How the window reads in a row, so nobody has to re-derive it to judge the claim. */
export function describeWindow(w: RateWindow): string {
  if (w.considered.length === 0) return "no concluded runs inside the rate window";
  return `${w.failed} of ${w.considered.length} concluded runs failed, ${w.oldestAt} .. ${w.newestAt}, ${w.passStreak} consecutive pass(es) since the last failure`;
}

/**
 * **Is this lane FLAPPING?** — its recent concluded history contains both outcomes.
 *
 * The finding that produced this: on 2026-08-22 this dashboard reported
 * `build-ai-cluster-iso` green and a hand-rolled scanner reported it red, at the same
 * time, about the same repo. Both read the truth. Its concluded runs on `main` that
 * afternoon were success 21:53, failure 21:18, success 20:37, success 20:03, failure
 * 19:07 — a latest-verdict reader's answer depends on when it happened to look.
 *
 * A lane whose next verdict is a coin flip has no colour, so it gets its own. Green
 * would launder a 90% claim as a 100% one; red would make an oscillating lane
 * permanently red and get the alarm muted.
 *
 * Only applies when the newest verdict is GREEN — if it is red, the row is already red
 * and saying "and also unstable" adds nothing to the action.
 */
export function verdictForFlapping(
  verdict: Verdict,
  attempts: AttemptSummary | undefined,
  config: FoldConfig,
  now: string,
): Verdict | null {
  if (verdict.kind !== "green") return null;
  const w = rateWindow(attempts, now, config);
  if (w === null) return null;

  // Four refusals before any rate claim, and each one is a false positive this rule
  // already produced or would have produced. A guard that cries wolf gets muted, and a
  // muted guard is worse than none — the same reasoning that made `not-yet-due` its own
  // state rather than a threshold tweak.
  //
  // 1. Too few runs inside the window is a small sample, not a rate.
  if (!w.sufficient) return null;
  // 2. A sustained streak of passes since the last failure has earned its way out.
  if (w.recovered) return null;
  // 3. Below the flake floor there is nothing to say.
  if (w.failed < config.flappingMinRed) return null;

  const span = `over ${humanDuration(config.rateWindowSeconds)} (${describeWindow(w)})`;

  // **A MAJORITY of failures is RED, not flapping.** One band lumped
  // `pr-manifest-integrity` (15 of 20) with `agencysignature-enforcement` (2 of 20).
  // Those are not the same claim: when most concluded runs fail, the newest passing run
  // is the OUTLIER, and calling that "unstable" undersells a lane that is broken.
  if (w.failed > w.passed) {
    return {
      kind: "red",
      detail: `MOSTLY FAILING ${span}. The newest run passed and is the outlier — a majority-failing lane is broken, not flaky.`,
    };
  }

  return {
    kind: "flapping",
    detail: `FLAPPING ${span}, and the newest passed. The latest verdict is green; the lane's next verdict is not predictable from it.`,
  };
}

/**
 * **Is this lane DARK?** — inconclusive attempts piling up newer than the last verdict.
 *
 * `tlaps-proof`, measured 2026-08-22 over its last 40 runs: 33 cancelled, 7 failure,
 * last success 2026-07-01. Seven weeks of a gated proof lane switched off, rendering
 * as "not failing" to every conclusion-only dashboard. The fact was even already
 * written down in `apt-job-timings.measured.json` — recorded, and on no surface anyone
 * looked at, which is this dashboard's entire reason to exist.
 *
 * The threshold is a SPAN, not a count, and that is what keeps it honest: `gate` is
 * cancelled by its own concurrency group on most pushes (265 of 300 measured) and is
 * perfectly alive, because it still concludes something every few minutes. A count
 * threshold would call `gate` dark and be muted within a day.
 */
export function verdictForDarkLane(
  attempts: AttemptSummary | undefined,
  config: FoldConfig,
): Verdict | null {
  if (attempts === undefined) return null;
  if (attempts.newerThanVerdict < config.darkMinAttempts) return null;
  if (attempts.newerSpanSeconds <= config.darkSpanSeconds) return null;
  return {
    kind: "red",
    detail: `DARK LANE: ${attempts.newerThanVerdict} attempt(s) newer than this verdict produced nothing, spanning ${humanDuration(attempts.newerSpanSeconds)} (${attempts.withoutVerdict} of the last ${attempts.inspected} inspected attempts concluded no verdict). A check that keeps being killed is not passing.`,
  };
}

/**
 * **Has the DECLARED trigger ever fired?**
 *
 * The sharpest instance of the whole defect class, and it is invisible to any model
 * that only asks what the last run said. `chart-version-refresh` declares
 * `cron: '7 17 * * 0'`; all 14 runs in its entire history are `event=pull_request`.
 * Registered, file present, cron declared, and the schedule has never once fired.
 *
 * So a periodic check is RED when nothing has EVER arrived via its schedule — however
 * green the verdicts that arrived by some other route. A workflow that only runs when
 * a human opens a PR is not a cadence, whatever its cron says.
 */
export function verdictForNeverFiredTrigger(
  expectation: CheckExpectation,
  lastDeclaredTriggerAt: string | null,
  thisPassViaDeclaredTrigger: boolean,
  observedThisPass: boolean,
  definitionSince: string | undefined,
  now: string,
): Verdict | null {
  if (expectation.kind !== "periodic") return null;
  if (thisPassViaDeclaredTrigger || lastDeclaredTriggerAt !== null) return null;
  if (!observedThisPass) return null; // absence is already handled, and more loudly
  const due = firstOpportunityPassed(expectation, definitionSince, now);
  if (!due.passed) {
    return {
      kind: "not-yet-due",
      detail: `declares ${expectation.detail}, has only ever run from another trigger, and ${due.why} — no scheduled run is owed yet`,
    };
  }
  return {
    kind: "red",
    detail: `the DECLARED SCHEDULE HAS NEVER FIRED — every verdict for this check arrived from another trigger, though it declares ${expectation.detail}`,
  };
}

function bandOf(kind: VerdictKind): RowBand {
  return kind === "unknown" ? "unknown" : kind;
}

// ─── The fold ───────────────────────────────────────────────────────────────

export interface FoldInput {
  readonly roster: Roster;
  readonly observations: readonly CheckObservation[];
  /** ISO-8601. Injected — the fold never reads a clock. */
  readonly now: string;
  /** Per-check producer failures. Each becomes `unknown{ reason: "source-error" }`. */
  readonly failures?: readonly CheckObservationFailure[];
  /** Whole-source failures (e.g. the roster enumeration itself failed). */
  readonly sourceErrors?: readonly string[];
  /**
   * Source names we could not ask AT ALL this pass — the producer never answered, so
   * no check belonging to it was observed and none of them CAN be judged.
   *
   * WHY THIS EXISTS, and it is the inverted vacuity class. A check that cannot fail is
   * the familiar defect. Its mirror image is a check that reports THE WORLD IS BROKEN
   * when only its own credential is, and that direction is the dangerous one: it is
   * believed, then distrusted, then ignored. On 2026-08-27 this fold produced exactly
   * that — a credential refusal upstream meant zero observations, every row fell through
   * to `verdictForAbsence`, and twelve lanes that had each run successfully within the
   * hour were rendered RED / "STALE: newest verdict is 9h old".
   *
   * The fold ALREADY had the right sentence for this, one branch up, for the per-check
   * case: *"we do not get to conclude 'correctly silent' about a question we failed to
   * ask."* A whole-source outage is that same fact for every check at once, and it just
   * had no way in. This is that way in. The pass still fails — `unknown` is not OK — it
   * fails saying "I could not see", which is the true statement.
   */
  readonly blindSources?: readonly string[];
  readonly config?: FoldConfig;
}

/**
 * Roster + this pass's observations → the dashboard.
 *
 * Deterministic and total: same inputs ⇒ byte-identical report, every roster entry
 * yields exactly one row, and no row can be produced without a verdict that says how
 * it was reached.
 */
export function foldDashboard(input: FoldInput): DashboardReport {
  const config = input.config ?? DEFAULT_FOLD_CONFIG;
  const { roster, now } = input;
  const latest = latestPerCheck(input.observations);
  const failures = new Map((input.failures ?? []).map((f) => [f.checkId, f.detail]));
  const blindSources = new Set(input.blindSources ?? []);

  const rows: DashboardRow[] = [];
  let expected = 0;
  let observedExpected = 0;
  let onDemand = 0;
  let retired = 0;

  for (const entry of roster.checks) {
    if (entry.retired === true) {
      retired += 1;
      continue;
    }
    const obs = latest.get(entry.checkId);
    const isExpected = entry.expectation.kind !== "on-demand";
    if (isExpected) expected += 1;
    else onDemand += 1;

    const failure = failures.get(entry.checkId);
    let verdict: Verdict;
    let observedAt: string | null;
    if (obs !== undefined) {
      const viaDeclared = triggerMatchesExpectation(obs.trigger, entry.expectation);
      // Order matters and is argued, not incidental: a DARK lane outranks everything,
      // because "we have not been able to conclude anything for weeks" is a stronger
      // fact than whatever the last stale verdict happened to say.
      const base = applyStaleness(obs.verdict, entry.expectation, obs.observedAt, now, config);
      verdict =
        verdictForDarkLane(obs.attempts, config) ??
        verdictForFlapping(base, obs.attempts, config, now) ??
        verdictForNeverFiredTrigger(
          entry.expectation, entry.lastDeclaredTriggerAt, viaDeclared, true, entry.definitionSince, now,
        ) ??
        base;
      observedAt = obs.observedAt;
    } else if (failure !== undefined) {
      // The producer was asked and could not answer. That is an absence of evidence,
      // and it outranks the expectation-based derivation: we do not get to conclude
      // "correctly silent" about a question we failed to ask.
      verdict = unknown("source-error", `producer could not answer for this check: ${failure}`);
      observedAt = entry.lastObservedAt;
    } else if (blindSources.has(entry.source)) {
      // The producer for this check could not be reached AT ALL this pass. Absence of
      // an observation here says nothing about the lane — only about our own sight —
      // so it must not be derived into a staleness verdict against it.
      verdict = unknown(
        "source-error",
        `source '${entry.source}' could not be observed this pass, so nothing is known about this check; the silence is OURS, not the lane's`,
      );
      observedAt = entry.lastObservedAt;
    } else {
      verdict = verdictForAbsence(entry.expectation, entry.lastObservedAt, now, config, entry.definitionSince);
      observedAt = entry.lastObservedAt;
    }
    // `not-yet-due` does not count as covered either: nobody has told us anything about
    // this check. It is excluded from the coverage DENOMINATOR instead, below, because
    // a check that is not owed a verdict is not a gap in our watching.
    if (isExpected && verdict.kind !== "unknown" && verdict.kind !== "not-yet-due") observedExpected += 1;
    if (isExpected && verdict.kind === "not-yet-due") expected -= 1;

    rows.push({
      checkId: entry.checkId,
      displayName: entry.displayName,
      source: obs?.source ?? entry.source,
      expectation: entry.expectation,
      verdict,
      band: bandOf(verdict.kind),
      observedAt,
      silenceSeconds: observedAt === null ? null : secondsBetween(observedAt, now),
      observedThisPass: obs !== undefined,
      recheckInFlight: obs?.attempts?.recheckInFlight ?? false,
      ...(obs?.supersededBy === undefined ? {} : { supersededBy: obs.supersededBy }),
      undeclared: !entry.declaredNow,
    });
  }

  rows.sort(compareRows);

  const counts: Record<RowBand, number> = {
    red: 0, flapping: 0, unknown: 0, running: 0, "not-yet-due": 0, skipped: 0, "not-applicable": 0, green: 0,
  };
  for (const row of rows) counts[row.band] += 1;

  const unknownRows = rows.filter((r) => r.band === "unknown");
  const hasNeverObserved = unknownRows.some((r) => r.silenceSeconds === null);
  const oldestUnknownSilenceSeconds = hasNeverObserved
    ? null
    : unknownRows.reduce<number | null>((max, r) => (r.silenceSeconds !== null && (max === null || r.silenceSeconds > max) ? r.silenceSeconds : max), null);

  const shortfall = expected - observedExpected;
  const coverage: Coverage = {
    expected,
    observed: observedExpected,
    shortfall,
    onDemand,
    retired,
    known: expected + onDemand,
  };
  const sourceErrors = [...(input.sourceErrors ?? [])].sort(ordinal);
  const sources = [...new Set(rows.map((r) => r.source))].sort(ordinal);

  return {
    ref: roster.ref,
    at: now,
    rows,
    counts,
    coverage,
    oldestUnknownSilenceSeconds,
    hasNeverObserved,
    sources,
    sourceErrors,
    // **An empty roster is never OK.** Caught 2026-08-22 while measuring the offline
    // path: with no producer AND no persisted roster the report read
    // `OK — RED 0 · UNKNOWN 0 · coverage 0/0 · green 0`. That is "0 of 0 observed
    // renders green" — the exact vacuity this file refuses everywhere else, and the
    // reason `GitLabAdapter` returns `not-supported` rather than an empty roster.
    // A dashboard that knows of no checks has not passed; it has never successfully
    // enumerated anything, and saying so is the whole discipline.
    ok:
      coverage.known > 0 &&
      counts.red === 0 &&
      counts.flapping === 0 &&
      counts.unknown === 0 &&
      shortfall === 0 &&
      sourceErrors.length === 0,
  };
}

/**
 * The ranking, and it is the deliverable's real user interface.
 *
 * An unknown that is *displayed* but not *distinguished* has not been surfaced — a
 * grey block of 16 rows is scrolled past exactly as reliably as a check nobody built.
 * So the sort is mechanical and does the noticing for the reader:
 *
 *   red first, oldest red first      — "red since the 16th" outranks "red five minutes ago"
 *   unknown second, LONGEST SILENCE FIRST, never-observed at the very top
 *   running, skipped, not-applicable, green last
 *
 * Ageing the unknowns is the part that resists habituation: "not observed for 6 days"
 * has to read louder than "not observed since the last pass", and a check that has
 * NEVER been observed sorts as infinite silence, because that is what it is.
 */
export function compareRows(a: DashboardRow, b: DashboardRow): number {
  const order: Record<RowBand, number> = {
    red: 0, flapping: 1, unknown: 2, running: 3, "not-yet-due": 4, skipped: 5, "not-applicable": 6, green: 7,
  };
  if (order[a.band] !== order[b.band]) return order[a.band] - order[b.band];

  if (a.band === "red" || a.band === "flapping") {
    // Oldest red first: infinite silence (never observed) is the oldest of all.
    const as = a.silenceSeconds ?? Number.POSITIVE_INFINITY;
    const bs = b.silenceSeconds ?? Number.POSITIVE_INFINITY;
    if (as !== bs) return bs - as;
    return ordinal(a.checkId, b.checkId);
  }
  if (a.band === "unknown") {
    const as = a.silenceSeconds ?? Number.POSITIVE_INFINITY;
    const bs = b.silenceSeconds ?? Number.POSITIVE_INFINITY;
    if (as !== bs) return bs - as;
    return ordinal(a.checkId, b.checkId);
  }
  return ordinal(a.checkId, b.checkId);
}

/**
 * The one-line verdict. Coverage is IN the headline, not under it: "I could not see 59
 * of 81 checks" must read at least as loud as "3 checks failed", because an unobserved
 * check is an unbounded number of unknown failures.
 */
export function headline(report: DashboardReport): string {
  const c = report.counts;
  const cov = report.coverage;
  const silence = report.hasNeverObserved
    ? ", incl. NEVER observed"
    : report.oldestUnknownSilenceSeconds === null
      ? ""
      : `, oldest silence ${humanDuration(report.oldestUnknownSilenceSeconds)}`;
  if (cov.known === 0) {
    return "NOT OK — the roster is EMPTY: no check has ever been enumerated, so this dashboard is uninitialised, not clean";
  }
  const parts = [
    `RED ${c.red}`,
    ...(c.flapping > 0 ? [`FLAPPING ${c.flapping}`] : []),
    `UNKNOWN ${c.unknown}${silence}`,
    `coverage ${cov.observed}/${cov.expected}${cov.shortfall > 0 ? ` (SHORTFALL ${cov.shortfall})` : ""}`,
    `green ${c.green}`,
  ];
  if (c["not-yet-due"] > 0) parts.push(`not-yet-due ${c["not-yet-due"]}`);
  if (cov.onDemand > 0) parts.push(`on-demand ${cov.onDemand}`);
  if (report.sourceErrors.length > 0) parts.push(`SOURCE ERRORS ${report.sourceErrors.length}`);
  return `${report.ok ? "OK" : "NOT OK"} — ${parts.join(" · ")}`;
}

export { humanDuration };
