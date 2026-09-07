/**
 * reconciliation.ts — does REALITY agree with what the organization believes?
 *
 * ── THE LAST STEP OF THE NORTH-STAR LOOP ─────────────────────────────────────
 * `ALWAYS_ON_ORCHESTRATION_RUNTIME.md` ends its cycle with
 *
 *   ... -> outcomes observed -> reconciliation verifies reality matches Organization state
 *
 * and the register had one instance of the idea and no general form: `changesUnlanded`, a single
 * check that a change projected as merged actually merged. That check is right and it is one row of
 * a table with several.
 *
 * ── WHAT THIS COMPARES ───────────────────────────────────────────────────────
 * Three parties, each of which can be wrong about the other two:
 *
 *   the CASCADE      what the organization believes about each item's state
 *   the REPOSITORY   what the change-control port actually merged
 *   the TRACKER      what the external system the work came from says
 *
 * Every disagreement is a named variant rather than a string, so a caller can decide what each one
 * MEANS without parsing prose — and so adding a kind is a compile error at every exhaustive match
 * rather than a case someone forgets.
 *
 * ── UNKNOWN IS NOT AGREEMENT, AND THAT IS THE WHOLE DESIGN ───────────────────
 * A tracker nobody asked says nothing, and the tempting reading — no disagreement found, therefore
 * agreement — is the vacuity class in the place it does the most damage: a reconciler that reports
 * "everything agrees" because it never looked is worse than no reconciler, since it manufactures
 * confidence. So the report carries `checked` and `notChecked` separately, and a party that was not
 * consulted appears in the second list by name.
 *
 * ── AND IT NEVER REPAIRS ─────────────────────────────────────────────────────
 * Reconciliation REPORTS. It does not move a work item to match the repository, or reopen a change
 * to match the cascade, because either would destroy the evidence that they disagreed — the finding
 * is the product. Which of the three parties is right is a judgement, and judgements belong to
 * whoever holds the hat, not to the comparison.
 */

import { WorkState, type CascadeNode } from "./goal-cascade";
import type { GateEvaluation } from "./quality-gate";

/**
 * A way the three parties can disagree. Named, never a free string.
 *
 * Each one is a DIFFERENT operational problem with a different fix, which is why they are not one
 * `Mismatch` kind carrying a message: `LandedButNotDone` is a bookkeeping lag, and
 * `DoneWithoutGates` is work that skipped its process. Collapsing them would make the second
 * invisible inside the first.
 */
export const DisagreementKind = {
  /** The organization projected a merge; the repository never took it. */
  ProjectedMergedButNotLanded: "projected_merged_but_not_landed",
  /** The repository has it; the organization still calls the item open. */
  LandedButNotDone: "landed_but_not_done",
  /** The item is done and no gate ever judged it — work that went round the process. */
  DoneWithoutGates: "done_without_gates",
  /** The tracker and the organization disagree about the same item. */
  TrackerDisagrees: "tracker_disagrees",
  /** The goal is delivered while a change it depended on never landed. */
  DeliveredOverUnlandedChange: "delivered_over_unlanded_change",
} as const;

export type DisagreementKind = (typeof DisagreementKind)[keyof typeof DisagreementKind];

export interface Disagreement {
  readonly kind: DisagreementKind;
  readonly workId: string;
  /** What the organization believes. */
  readonly organizationSays: string;
  /** What the other party says. `undefined` only where the party has no opinion to state. */
  readonly realitySays: string | undefined;
  /** One line for a human, alongside the structure rather than instead of it. */
  readonly detail: string;
}

/** A party this reconciliation could compare against, and whether it was actually consulted. */
export const Party = {
  Repository: "repository",
  Tracker: "tracker",
  Gates: "gates",
} as const;

export type Party = (typeof Party)[keyof typeof Party];

export interface ReconcileInput {
  readonly cascade: readonly CascadeNode[];
  /** Work ids the change-control port actually merged. */
  readonly changesLanded: readonly string[];
  /** Projected as merged, and the port refused. */
  readonly changesUnlanded: readonly string[];
  readonly gateEvaluations: readonly GateEvaluation[];
  readonly delivered: boolean;
  /**
   * What the external tracker says, per work id — ABSENT means it was not consulted.
   *
   * Deliberately `undefined` rather than an empty map for the not-consulted case, because an empty
   * map is a tracker that was asked and knew nothing, and that is a different fact. The report
   * distinguishes them and refuses to let the second read as agreement.
   */
  readonly trackerStates?: ReadonlyMap<string, string>;
  /**
   * Which tracker strings mean "this is finished". Required when `trackerStates` is supplied.
   *
   * No default: every tracker spells done differently, and guessing produces a reconciler that
   * silently disagrees with a Jira whose done column is called "Shipped".
   */
  readonly trackerDoneStates?: ReadonlySet<string>;
}

export interface ReconciliationReport {
  readonly disagreements: readonly Disagreement[];
  /** Parties actually compared. */
  readonly checked: readonly Party[];
  /** Parties that could have been compared and were not — never counted as agreement. */
  readonly notChecked: readonly Party[];
  /** How many items were examined at all. */
  readonly itemsExamined: number;
  readonly summary: string;
}

/**
 * Compare what the organization believes against what actually happened.
 *
 * Pure and total: no clock, no ports, no repair. Given the same inputs it produces the same report,
 * which is what lets a reconciliation be replayed and argued with.
 */
export function reconcile(input: ReconcileInput): ReconciliationReport {
  const disagreements: Disagreement[] = [];
  const landed = new Set(input.changesLanded);
  const unlanded = new Set(input.changesUnlanded);
  const judged = new Set(input.gateEvaluations.map((g) => g.workId));

  for (const node of input.cascade) {
    const done = node.state === WorkState.Done;

    if (unlanded.has(node.workId)) {
      disagreements.push({
        kind: DisagreementKind.ProjectedMergedButNotLanded,
        workId: node.workId,
        organizationSays: "merged",
        realitySays: "not merged",
        detail: `${node.workId} was projected as merged and the change-control port refused it`,
      });
    }

    if (landed.has(node.workId) && !done) {
      disagreements.push({
        kind: DisagreementKind.LandedButNotDone,
        workId: node.workId,
        organizationSays: node.state,
        realitySays: "merged",
        detail: `${node.workId} is merged in the repository and the organization still calls it '${node.state}'`,
      });
    }

    // A done item nobody judged went around the process. Checked only for items that actually
    // reached done: an OPEN item with no gate verdicts is the normal case, not a finding.
    if (done && !judged.has(node.workId)) {
      disagreements.push({
        kind: DisagreementKind.DoneWithoutGates,
        workId: node.workId,
        organizationSays: "done",
        realitySays: undefined,
        detail: `${node.workId} is done and no quality gate ever evaluated it`,
      });
    }

    if (input.trackerStates !== undefined) {
      const external = input.trackerStates.get(node.workId);
      // An item the tracker has never heard of is not a disagreement — plenty of work is created
      // inside the organization. Only a tracker with an OPINION can contradict one.
      if (external !== undefined) {
        const trackerDone = input.trackerDoneStates?.has(external) ?? false;
        if (trackerDone !== done) {
          disagreements.push({
            kind: DisagreementKind.TrackerDisagrees,
            workId: node.workId,
            organizationSays: done ? "done" : node.state,
            realitySays: external,
            detail: `${node.workId}: the organization says '${done ? "done" : node.state}' and the tracker says '${external}'`,
          });
        }
      }
    }
  }

  // The goal-level version of the first check, and the one that decides whether a run may claim
  // delivery at all.
  if (input.delivered && unlanded.size > 0) {
    disagreements.push({
      kind: DisagreementKind.DeliveredOverUnlandedChange,
      workId: [...unlanded][0] ?? "unknown",
      organizationSays: "delivered",
      realitySays: `${String(unlanded.size)} change(s) never landed`,
      detail: `the goal is reported delivered while ${String(unlanded.size)} change(s) did not merge`,
    });
  }

  // WHAT WAS ACTUALLY COMPARED. The repository and the gates are always available from a run; the
  // tracker is only there if someone passed it. A party that was not consulted is listed as such
  // and NEVER contributes to a clean bill.
  const checked: Party[] = [Party.Repository, Party.Gates];
  const notChecked: Party[] = [];
  if (input.trackerStates === undefined) notChecked.push(Party.Tracker);
  else checked.push(Party.Tracker);

  return {
    disagreements,
    checked,
    notChecked,
    itemsExamined: input.cascade.length,
    summary: summarize(disagreements, checked, notChecked, input.cascade.length),
  };
}

/**
 * The one line a human reads, and it never says "everything agrees" without qualification.
 *
 * When a party was not consulted the sentence says so in the same breath as the clean result,
 * because "0 disagreements" over two of three parties is a narrower claim than it sounds and the
 * summary is where that narrowing gets lost.
 */
function summarize(
  disagreements: readonly Disagreement[],
  checked: readonly Party[],
  notChecked: readonly Party[],
  items: number,
): string {
  const scope =
    notChecked.length === 0
      ? `${String(checked.length)} part(ies)`
      : `${String(checked.length)} part(ies); NOT checked: ${notChecked.join(", ")}`;
  return disagreements.length === 0
    ? `${String(items)} item(s) reconciled against ${scope} — no disagreement found`
    : `${String(disagreements.length)} disagreement(s) across ${String(items)} item(s), against ${scope}`;
}

/** Disagreements of one kind — for a caller that treats them differently, as most should. */
export function ofKind(
  report: ReconciliationReport,
  kind: DisagreementKind,
): readonly Disagreement[] {
  return report.disagreements.filter((d) => d.kind === kind);
}

/**
 * True when everything compared agreed AND everything comparable was compared.
 *
 * The conjunction is the point. A caller asking "are we consistent?" wants one answer, and a
 * reconciliation that skipped the tracker cannot honestly give it — so an unconsulted party makes
 * this false rather than true, and the report says which party it was.
 */
export function fullyReconciled(report: ReconciliationReport): boolean {
  return report.disagreements.length === 0 && report.notChecked.length === 0;
}
