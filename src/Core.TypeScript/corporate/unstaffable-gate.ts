/**
 * corporate/unstaffable-gate.ts — the caller `blockerEvent` never had.
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 * `human-blocker.ts` is the organization's way OUT: an agent raises a blocker that leaves the
 * chart and a person answers it. The module is complete — an `Exhaustion` union, refusals that
 * check the claim against the chart, an answer path. And `blockerEvent`, its event constructor,
 * had NO CALLERS anywhere outside its own definition. Nothing ever raised one.
 *
 * That is the mirror of a reader with no writer, and it is worse in one specific way: the reading
 * side looked finished, so an inbox built on top of it silently had nothing to show and fell back
 * to reporting every ready step as though a person had been asked about it.
 *
 * ── THE RAISE IS DERIVED, NEVER ASSERTED ─────────────────────────────────────
 * An agent claiming "this needs a human" is unfalsifiable, and `human-blocker`'s own header says
 * why that matters: an escape hatch that is free to take eventually carries everything. So this
 * module never takes an agent's word for it. It asks the CHART two questions about a gate step
 * that `gate-demand` already says is ready:
 *
 *   1. can anybody here APPROVE it?   `gateOwners(chart, gate)`
 *   2. can anybody here AUTHOR it?    `candidatesFor(chart, gate).candidates`
 *
 * Both empty means the organization cannot perform this step by its own structure — not that it
 * tried and failed, but that there is nobody to try. That is exactly `no_owner_in_org`, the one
 * exhaustion form `human-blocker` says must NOT require a prior attempt, because an organization
 * with no security hat cannot ask its security hat first.
 *
 * ── AND IT DEFERS TO THE INTERNAL PATH FIRST ─────────────────────────────────
 * A gate nobody can approve is a capability the organization is missing, and `blocker-taxonomy`
 * may already route that kind to a hat internally. If it does, this is NOT a raise to a person —
 * it is an escalation, and `internalOwners` names who. Going out to a human while a hat sits right
 * there is the failure `acceptBlocker` refuses, so the check happens here rather than being
 * discovered at the door.
 */

import { candidatesFor } from "./phase-staffing";
import { BlockerKind, ownersFor } from "./blocker-taxonomy";
import { gateOwners, type GateKind } from "./quality-gate";
import type { OrgChart } from "./org-chart";
import type { GateDemand, GateStep } from "./gate-demand";
import type { RaisedBlocker } from "./human-blocker";

/**
 * Why a ready step cannot be performed here, or that it can.
 *
 * `performable` is the common answer and is returned rather than filtered so a caller can report
 * "every ready step is staffable" as a fact instead of as an empty list, which reads the same as
 * "nothing was checked".
 */
export interface Staffability {
  readonly step: GateStep;
  readonly canApprove: readonly string[];
  readonly canAuthor: readonly string[];
  readonly performable: boolean;
  /** Hats the taxonomy would route this to INSIDE the org. Non-empty means escalate, not raise. */
  readonly internalOwners: readonly string[];
  readonly because: string;
}

/** The blocker kind a gate nobody can perform maps to. */
export const UNSTAFFABLE_KIND: BlockerKind = BlockerKind.CapabilityMissing;

export function staffabilityOf(chart: OrgChart, step: GateStep): Staffability {
  const canApprove = gateOwners(chart, step.gate).map((h) => h.id);
  const canAuthor = candidatesFor(chart, step.gate).candidates.map((c) => c.hatId);
  const performable = canApprove.length > 0 || canAuthor.length > 0;
  const internalOwners = performable ? [] : ownersFor(chart, UNSTAFFABLE_KIND).map((h) => h.id);
  return {
    step,
    canApprove,
    canAuthor,
    performable,
    internalOwners,
    because: performable
      ? `${String(canAuthor.length)} hat(s) could author '${step.gate}' and ${String(canApprove.length)} could approve it`
      : internalOwners.length > 0
        ? `no hat can author or approve '${step.gate}', but ${internalOwners.join(", ")} owns missing capabilities here`
        : `no hat in this chart can author or approve '${step.gate}', and nobody owns missing capabilities either`,
  };
}

/**
 * Blockers to raise OUT of the organization, derived from what it currently owes.
 *
 * `createId` mints the blocker id and `atMs` stamps it, both injected — a raise is an event in the
 * log and has to replay identically, which it cannot do off an ambient clock or a random id.
 *
 * The id is derived from the work item and gate rather than from a counter, so raising the same
 * unstaffable step on two consecutive runs produces ONE blocker. `human-blocker`'s own comment
 * says a stable id is what makes raising the same blocker twice one blocker; without it a person's
 * queue would grow by one entry per tick for a problem nobody has fixed yet.
 */
export function unstaffableRaises(input: {
  readonly chart: OrgChart;
  readonly demand: GateDemand;
  readonly byHatId: string;
  readonly atMs: number;
}): {
  readonly raises: readonly RaisedBlocker[];
  readonly escalations: readonly Staffability[];
  readonly checked: readonly Staffability[];
} {
  const checked = input.demand.ready.map((step) => staffabilityOf(input.chart, step));
  const raises: RaisedBlocker[] = [];
  const escalations: Staffability[] = [];

  for (const verdict of checked) {
    if (verdict.performable) continue;
    // A hat owns it internally — escalate rather than spend a person's attention.
    if (verdict.internalOwners.length > 0) {
      escalations.push(verdict);
      continue;
    }
    raises.push({
      blockerId: `blk-${verdict.step.workId}-${String(verdict.step.gate)}`,
      about: `no hat in this organization can author or approve '${verdict.step.gate}'`,
      blocking: verdict.step.workId,
      kind: UNSTAFFABLE_KIND,
      exhaustion: { kind: "no_owner_in_org", forBlockerKind: UNSTAFFABLE_KIND },
      unblocks: `'${verdict.step.title}' can cross '${verdict.step.gate}' and move to its next gate`,
      byHatId: input.byHatId,
      atMs: input.atMs,
      why: verdict.because,
    });
  }
  return { raises, escalations, checked };
}

/**
 * The gates an operator declared need a PERSON, crossed with what is ready right now.
 *
 * Separate from `unstaffableRaises` because the two answer different questions and conflating them
 * is what made a first cut of `inbox` report five items as waiting on a human when nobody had asked
 * about any of them. This one is a CONFIGURED stop — the operator turned a checkpoint on — while a
 * raise is the organization discovering it cannot proceed. A person's queue needs both, labelled.
 */
export function checkpointStops(
  demand: GateDemand,
  humanGates: ReadonlySet<GateKind>,
): readonly GateStep[] {
  return demand.ready.filter((s) => humanGates.has(s.gate));
}
