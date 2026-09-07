/**
 * corporate/prioritization.ts — what the organization does first, and who is allowed to say.
 *
 * ── THE GAP THIS CLOSES ──────────────────────────────────────────────────────
 * The cycle ran ONE goal. With two, nothing in this register could say which comes first, and
 * "priority" existed only as an unranked queue. Once goals compete, the ordering IS the
 * organization's answer to what it is for.
 *
 * ── DETERMINISM RECOMMENDS; AN AUTHORITY DECIDES ─────────────────────────────
 * The score is computed from inputs anyone can check, and it produces a RECOMMENDATION. The final
 * class is chosen by an authority hat through `chooseWithinLegal`, clamped to what that level may
 * set. Neither half alone would do: a score nobody can override is a policy the organization cannot
 * change, and a class with no recommendation behind it is a preference with no argument.
 *
 * ── THE REASON CODES ARE THE POINT ───────────────────────────────────────────
 * A bare number tells nobody why. Every term that contributed names itself, so "why is this
 * expedited" is answerable from the recommendation rather than by re-running the arithmetic in
 * someone's head.
 *
 * ── TWO DIVERGENCES FROM THE REFERENCE, BOTH DELIBERATE ──────────────────────
 *
 * **1. `estimatedEffort` is actually applied.** In the reference it is a REQUIRED field of
 * `PriorityInputs`, is supplied by callers, and is never read — while the comment beside the scoring
 * says *"budget burn + high effort push DOWN"*. So a caller raising it to deprioritise a large job
 * sees no effect and has no way to find out why. Here it lowers the score, which is what the field
 * was named and documented to do.
 *
 * **2. The authority ladder has three real rungs, not two.** The reference gives Director and the
 * C-suite the same five classes, so the level distinction between them is decorative. `Paused` stops
 * work entirely — an org-level decision — so it is reserved for the C-suite and the board here, which
 * makes Director a genuine rung rather than a synonym.
 */

import { chooseWithinLegal, type OrgChooser } from "./org-decision";
import type { HatLevel, OrgChart } from "./org-chart";

export const PriorityClass = {
  Expedite: "expedite",
  High: "high",
  Normal: "normal",
  Defer: "defer",
  Paused: "paused",
} as const;

export type PriorityClass = (typeof PriorityClass)[keyof typeof PriorityClass];

/** Most urgent first. The single source of truth for ordering. */
export const PRIORITY_ORDER: readonly PriorityClass[] = [
  PriorityClass.Expedite,
  PriorityClass.High,
  PriorityClass.Normal,
  PriorityClass.Defer,
  PriorityClass.Paused,
];

/**
 * Is this string one of the five?
 *
 * The generative menu hands the register a string the grammar never interpreted — deliberately, so
 * the core stays ignorant of what a priority is. That makes this the boundary where the ignorance
 * ends, and an unrecognised class must be REFUSED rather than coerced: a work item silently priced
 * `normal` because somebody sent "urgent" is worse than one that was never priced, because the
 * first looks decided.
 */
export function isPriorityClass(value: string): value is PriorityClass {
  return (PRIORITY_ORDER as readonly string[]).includes(value);
}

export function priorityRank(c: PriorityClass): number {
  return PRIORITY_ORDER.indexOf(c);
}

/** Is `a` more urgent than `b`? */
export function outranksPriority(a: PriorityClass, b: PriorityClass): boolean {
  return priorityRank(a) < priorityRank(b);
}

/**
 * The inputs. All normalized to `0..1` except the counts and the age.
 *
 * Every field is read by `computeRecommendation` — a required input that changes nothing is worse
 * than an absent one, because a caller will tune it and watch nothing happen.
 */
export interface PriorityInputs {
  readonly executivePriority: number;
  readonly customerImpact: number;
  readonly severity: number;
  readonly releaseRisk: number;
  readonly blockedDownstreamCount: number;
  readonly dependencyFanOut: number;
  readonly queueAgeMs: number;
  readonly hatScarcity: number;
  /** Cost pressure. Pushes DOWN. */
  readonly budgetBurn: number;
  /** How big the job is. Pushes DOWN — value per unit effort, not value alone. */
  readonly estimatedEffort: number;
}

export interface PriorityRecommendation {
  readonly workId: string;
  readonly score: number;
  readonly priorityClass: PriorityClass;
  /** Every term that contributed, named. */
  readonly reasonCodes: readonly string[];
  readonly requiredHatIds: readonly string[];
}

/**
 * Clamp a normalized input to `0..1`.
 *
 * Two dispositions, deliberately different:
 *   - **out of range** (`5`, `-5`) — a caller over- or under-reporting a real signal. Clamped.
 *   - **not finite** (`NaN`, `Infinity`) — a BUG in whatever produced it, not a maximum. Treated as
 *     absent, because clamping it to 1 would let a broken upstream silently pin a field at full
 *     strength forever.
 *
 * Exported so the contract is testable on its own. The callers below all happen to guard on
 * `> 0`, which would mask a broken clamp — a guard that hides a defect in the thing it guards is
 * the reason this needs its own test rather than only its callers'.
 */
export function normalizeInput(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}

const unit = normalizeInput;

/**
 * The deterministic score and the class it recommends.
 *
 * Weights are the reference's, and are a policy rather than a measurement — they encode that
 * executive direction outweighs customer impact outweighs release risk. Recorded as such: nothing
 * here has been calibrated against outcomes, so this is a stated ordering, not a derived one.
 */
export function computeRecommendation(
  workId: string,
  inputs: PriorityInputs,
  requiredHatIds: readonly string[] = [],
): PriorityRecommendation {
  const reasonCodes: string[] = [];
  let score = 0;

  const add = (weight: number, value: number, code: string): void => {
    const v = unit(value);
    if (v > 0) {
      score += weight * v;
      reasonCodes.push(code);
    }
  };

  add(4, inputs.executivePriority, "executive_priority");
  add(3, inputs.customerImpact, "customer_impact");
  add(3, inputs.severity, "severity");
  add(2, inputs.releaseRisk, "release_risk");
  add(2, inputs.blockedDownstreamCount / 5, "blocked_downstream");
  add(1, inputs.dependencyFanOut / 5, "dependency_fanout");
  add(1, inputs.queueAgeMs / 3_600_000, "queue_age");
  add(1, inputs.hatScarcity, "hat_scarcity");

  // Downward pressure. Named separately because a negative term is not a reason to do the work.
  const burn = unit(inputs.budgetBurn);
  if (burn > 0) {
    score -= 2 * burn;
    reasonCodes.push("budget_pressure");
  }
  const effort = unit(inputs.estimatedEffort);
  if (effort > 0) {
    score -= 2 * effort;
    reasonCodes.push("effort_cost");
  }

  const priorityClass =
    score >= 9
      ? PriorityClass.Expedite
      : score >= 5
        ? PriorityClass.High
        : score >= 2
          ? PriorityClass.Normal
          : score >= 0
            ? PriorityClass.Defer
            : PriorityClass.Paused;

  return {
    workId,
    score: Math.round(score * 100) / 100,
    priorityClass,
    reasonCodes,
    requiredHatIds,
  };
}

/**
 * Which classes an authority at this level may set.
 *
 *   - **C-suite and board** — everything, including `Paused`. Stopping work entirely is an org-level
 *     decision.
 *   - **Director** — everything except `Paused`. May expedite within its department.
 *   - **Manager** — `High`, `Normal`, `Defer`. A manager sequences its team's work; it does not
 *     declare an organization-wide emergency, and `Expedite` is exactly that claim.
 *   - **Lead and IC** — none. Priority is set for them, and they may raise a signal about it
 *     (`supervisor-signal.ts`) rather than change it.
 */
export function legalPriorityClassesFor(level: HatLevel): readonly PriorityClass[] {
  switch (level) {
    case "executive_board":
    case "c_suite":
      return PRIORITY_ORDER;
    case "director":
      return PRIORITY_ORDER.filter((c) => c !== PriorityClass.Paused);
    case "manager":
      return [PriorityClass.High, PriorityClass.Normal, PriorityClass.Defer];
    case "lead":
    case "individual_contributor":
      return [];
  }
  return assertNeverLevel(level);
}

function assertNeverLevel(x: never): never {
  throw new Error(`unhandled hat level: ${String(x)}`);
}

export interface PriorityDecision {
  readonly workId: string;
  readonly priorityClass: PriorityClass;
  readonly decidedByHatId: string;
  readonly reason: string;
  /** What the deterministic scorer recommended, kept alongside what was decided. */
  readonly recommended: PriorityClass;
  readonly reasonCodes: readonly string[];
}

export type PriorityResult =
  | { readonly ok: true; readonly decision: PriorityDecision }
  | { readonly ok: false; readonly reason: string };

/**
 * An authority sets the priority.
 *
 * The recommendation is kept ON the decision beside the chosen class, so a reader can see where an
 * authority overrode the score and by how much. Recording only the outcome would erase every
 * override, which is the one thing about a priority decision worth reviewing later.
 */
export function decidePriority(
  chart: OrgChart,
  input: {
    readonly recommendation: PriorityRecommendation;
    readonly deciderHatId: string;
    readonly chooser: OrgChooser<PriorityClass>;
  },
): PriorityResult {
  const hat = chart.byId.get(input.deciderHatId);
  if (hat === undefined) return { ok: false, reason: `unknown hat '${input.deciderHatId}'` };

  const legal = legalPriorityClassesFor(hat.level);
  if (legal.length === 0) {
    return {
      ok: false,
      reason: `'${hat.id}' is ${hat.level}; priority is set for it, not by it — raise a signal instead`,
    };
  }

  const choice = chooseWithinLegal(
    legal,
    `priority for ${input.recommendation.workId}`,
    input.chooser,
  );
  if (choice.outcome === "no_legal_option") return { ok: false, reason: choice.reason };

  return {
    ok: true,
    decision: {
      workId: input.recommendation.workId,
      priorityClass: choice.option,
      decidedByHatId: hat.id,
      reason: choice.reason,
      recommended: input.recommendation.priorityClass,
      reasonCodes: input.recommendation.reasonCodes,
    },
  };
}

/** Did the authority depart from what the score recommended? */
export function wasOverridden(decision: PriorityDecision): boolean {
  return decision.priorityClass !== decision.recommended;
}

/**
 * Order work most urgent first.
 *
 * Ties break on `workId` so the order is TOTAL — without it two equally-prioritized items would be
 * sequenced by however the list arrived, and the same queue would be worked in a different order on
 * different runs.
 */
export function orderByPriority(
  decisions: readonly PriorityDecision[],
): readonly PriorityDecision[] {
  return [...decisions].sort((a, b) => {
    const byClass = priorityRank(a.priorityClass) - priorityRank(b.priorityClass);
    return byClass !== 0 ? byClass : a.workId < b.workId ? -1 : a.workId > b.workId ? 1 : 0;
  });
}

/** The items an organization should actually pick up — everything not paused. */
export function workable(decisions: readonly PriorityDecision[]): readonly PriorityDecision[] {
  return orderByPriority(decisions).filter((d) => d.priorityClass !== PriorityClass.Paused);
}
