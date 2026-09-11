/**
 * corporate/gate-demand.ts — the SDLC as a source of demand, not as an executor.
 *
 * ── THE INVERSION ────────────────────────────────────────────────────────────
 * Today `runPipeline` WALKS an item: it takes `DEFAULT_PIPELINE`, crosses fourteen gates in order,
 * and the organization is whatever that walk happens to touch. That is why the whole org reads as
 * one pipeline repeated — because it is one, and every agent is a step inside it.
 *
 * This module turns the same constraint the other way up. It never executes anything. It reads the
 * cascade and the gate record and answers one question:
 *
 *     WHICH GATE STEPS ARE READY TO BE WORKED RIGHT NOW?
 *
 * That list is DEMAND. A scheduler books it onto agents' calendars (`review-calendar.ts` already
 * does exactly this for reviews and QA), an agent reaches its slot, and `room-runtime` executes
 * that ONE step deterministically. Crossing the gate is what completing the room means. Nothing
 * anywhere walks an item from end to end, and yet the item cannot skip a gate — because a gate that
 * has not passed is the only step this module will ever offer for that item.
 *
 * So the agents are free-flowing and the work is still enforced. Those are not in tension; they are
 * the same mechanism read from two ends.
 *
 * ── GATES BELONG TO THE WORK TYPE ────────────────────────────────────────────
 * The second half of "too pipeline focused" is that all fourteen gates were applied to everything.
 * A goal and a defect are not the same kind of object and do not owe the same reviews. `CHAIN_BY_TYPE`
 * gives each rung its own chain, and the rungs partition the fourteen rather than each replaying
 * them — a director enforces an initiative's gates, a TPM a project's, a lead a task's, which is the
 * hierarchy doing its job rather than one loop doing everyone's.
 *
 * ── REWORK IS A FIRST-CLASS STEP, NOT AN EXCEPTION ───────────────────────────
 * A gate whose latest outcome is `ChangesRequested` or `Rejected` becomes ready AGAIN, and it comes
 * back ahead of everything after it — so a failed review sends the item back to that gate exactly
 * as it would in a real organization. The step carries its `attempt` and the outcome that sent it
 * back, so the agent that picks it up knows it is redoing work and why. Whether the SAME agent
 * redoes it is the scheduler's call, not this module's: this says what must happen, never who.
 */

import {
  childrenOf,
  deliveredSet,
  isLeafType,
  nodeById,
  WorkState,
  WorkType,
  type Cascade,
  type CascadeNode,
} from "./goal-cascade";
import { GateKind, isPassing, type GateEvaluation, type GateOutcome } from "./quality-gate";

/**
 * The gate chain each work TYPE must cross — the SDLC, distributed across the ladder.
 *
 * Read down the rungs and the fourteen canonical gates are covered exactly once each. That is the
 * property that makes this a redistribution rather than a reduction: nothing was dropped to make
 * the chains short, every gate still has an owner, and the owner is the rung whose hat holds the
 * authority to judge it.
 *
 *   goal        the business outcome is real, and was delivered
 *   initiative  it is specified and funded, and it paid off
 *   project     it is designed, the design survived attack, and the structure holds  (the epic)
 *   leaves      it was built, it works, and it can ship
 *
 * A leaf's chain varies by KIND, which is the whole reason `LEAF_TYPES` exists: an incident owes a
 * restoration and a business account, not an implementation review, and giving every leaf the task
 * chain would have made that unexpressible.
 */
export const CHAIN_BY_TYPE: Readonly<Record<WorkType, readonly GateKind[]>> = {
  [WorkType.Goal]: [
    GateKind.BusinessContextGrooming,
    GateKind.CustomerRfpReview,
    GateKind.FinalBusinessValidation,
  ],
  [WorkType.Initiative]: [GateKind.BrdApproval, GateKind.CostApproval],
  [WorkType.Project]: [
    GateKind.PeerReview,
    GateKind.ArchitectureDesign,
    GateKind.ArchitectureApproval,
    GateKind.AdversarialReview,
    GateKind.FinalArchitectureReview,
  ],
  [WorkType.Task]: [
    GateKind.ImplementationReview,
    GateKind.QaUat,
    GateKind.RuntimeValidation,
    GateKind.ReleaseReadiness,
  ],
  // A DEFECT FIX SHIPS LIKE ANY OTHER CHANGE, so it owes `release_readiness` too. What
  // distinguishes a defect is that it needs REPRODUCTION before it is workable — `intake` enforces
  // that — not that it may reach production having skipped the release gate. Omitting it here made
  // "a gate nobody owns blocks delivery" untestable on a defect: stripping the gate's owners
  // changed nothing, because nothing owed it.
  [WorkType.Defect]: [
    GateKind.ImplementationReview,
    GateKind.QaUat,
    GateKind.RuntimeValidation,
    GateKind.ReleaseReadiness,
  ],
  // A CAPABILITY REQUEST IS BUILT, NOT MERELY APPROVED.
  //
  // It owed `brd_approval` and `cost_approval` and nothing else, so a run marked one DONE having
  // passed two approvals — no implementation, no tests, no change, and its parents counting it as
  // delivered. A leaf that ships nothing while satisfying its parent's delivery is the vacuity
  // class at the level of a work type.
  //
  // Cost stays FIRST and stays here rather than only on the initiative: new capability is new
  // spend, and the last cheap moment to refuse it is before anyone builds it.
  [WorkType.CapabilityRequest]: [
    GateKind.CostApproval,
    GateKind.ImplementationReview,
    GateKind.QaUat,
    GateKind.RuntimeValidation,
    GateKind.ReleaseReadiness,
  ],
  // A REVIEW ITEM MUST ACTUALLY VERIFY, AND `runtime_validation` IS THE GATE WITH TEETH.
  //
  // Measured twice. First: owing only `peer_review`, a 'verify X' task merged and reported success
  // while the implementation it verifies sat rejected — verification that verified nothing. Adding
  // `qa_uat` did NOT fix it, which is the more useful half of the measurement: `gateChooserFrom`
  // routes the TEST EVIDENCE to `runtime_validation` alone, and every other gate is a reviewer's
  // opinion. A verification item not owing `runtime_validation` can be signed off by opinion over
  // failing tests.
  [WorkType.Review]: [GateKind.PeerReview, GateKind.QaUat, GateKind.RuntimeValidation],
  [WorkType.Incident]: [GateKind.RuntimeValidation, GateKind.FinalBusinessValidation],
};

/**
 * Does this work type produce CODE?
 *
 * Derived from the chain rather than declared: a type produces code exactly when it owes
 * `implementation_review`, because that is the gate whose producer writes the change. A second
 * table would be one more thing to keep in step with the first.
 *
 * Measured need: a `review` item ("verify X") owes no implementation gate, so nothing writes to its
 * branch — and the real git change-control port then refused to merge it, correctly, with "has no
 * commits: a merge that moves nothing is not a merge". It had only ever appeared to work because
 * every leaf used to walk every gate, so the work producer ran for a verification task too.
 */
export function producesCode(workType: WorkType): boolean {
  return chainFor(workType).includes(GateKind.ImplementationReview);
}

export function chainFor(workType: WorkType): readonly GateKind[] {
  return CHAIN_BY_TYPE[workType] ?? [];
}

/**
 * Gates that may not be crossed until the rung's children are delivered.
 *
 * The LAST gate of every non-leaf chain — a director cannot validate that an initiative paid off
 * while its projects are still open, and a TPM cannot sign the final architecture of an epic whose
 * tasks are unbuilt. Without this an epic could pass every gate it owns and be Done above unfinished
 * children, which is the "signed off on something that did not work" failure stated structurally.
 */
export function acceptanceGateFor(workType: WorkType): GateKind | undefined {
  if (isLeafType(workType)) return undefined;
  const chain = chainFor(workType);
  return chain[chain.length - 1];
}

/**
 * Have this item's children stopped being delivered since its acceptance gate passed?
 *
 * Only meaningful for a non-leaf with live children. A parent whose children were ALL cancelled has
 * nothing left to regress against, and reopening it would demand the re-acceptance of nothing.
 */
function deliveryRegressed(
  cascade: Cascade,
  node: CascadeNode,
  delivered: ReadonlySet<string>,
): boolean {
  const live = childrenOf(cascade, node.workId).filter((c) => c.state !== WorkState.Canceled);
  return live.length > 0 && live.some((c) => !delivered.has(c.workId));
}

/** One unit of work an agent can be scheduled to do: cross ONE gate on ONE item. */
export interface GateStep {
  readonly workId: string;
  readonly workType: WorkType;
  readonly gate: GateKind;
  readonly title: string;
  /** The hat accountable for this rung — who answers for the step, not necessarily who does it. */
  readonly ownerHatId: string;
  /** 1 the first time. 2+ means this gate was failed before and is being redone. */
  readonly attempt: number;
  readonly rework: boolean;
  /** What sent it back. Present exactly when `rework` is true. */
  readonly priorOutcome?: GateOutcome;
  /** One line an agent picking this up can act on. */
  readonly why: string;
}

/** A gate that is NEXT for an item but cannot be worked yet, and the reason. */
export interface BlockedStep {
  readonly workId: string;
  readonly workType: WorkType;
  readonly gate: GateKind;
  readonly because: string;
}

export interface GateDemand {
  /** Everything that can be scheduled right now. */
  readonly ready: readonly GateStep[];
  /**
   * Everything that is next but not yet workable, with its reason.
   *
   * Reported rather than filtered away: an organization with nothing ready and nine items blocked on
   * undelivered children is in a completely different state from one with nothing ready because
   * everything is done, and a bare empty list cannot tell them apart.
   */
  readonly blocked: readonly BlockedStep[];
}

/** The latest evaluation for each (workId, gate) — later `atMs` wins, ties broken by array order. */
function latestByGate(evaluations: readonly GateEvaluation[]): Map<string, GateEvaluation> {
  const out = new Map<string, GateEvaluation>();
  for (const e of evaluations) {
    const key = `${e.workId} ${e.gate}`;
    const prior = out.get(key);
    // `>=` so a later entry at the SAME instant wins. Evaluations are appended in order, and a
    // re-judgement stamped in the same millisecond as the one it replaces is a real case on a fast
    // clock — keeping the earlier one would resurrect an outcome that has been superseded.
    if (prior === undefined || e.atMs >= prior.atMs) out.set(key, e);
  }
  return out;
}

function attemptsAt(evaluations: readonly GateEvaluation[], workId: string, gate: GateKind): number {
  return evaluations.filter((e) => e.workId === workId && e.gate === gate).length;
}

/**
 * The one gate step this item currently owes, if any.
 *
 * The chain is walked in order and the FIRST gate that is not passing is the answer — which is what
 * makes skipping impossible without a rule that forbids it. A later gate is never offered while an
 * earlier one is outstanding, so a rejected architecture review holds the item at that gate rather
 * than letting implementation proceed underneath it.
 */
function stepFor(
  cascade: Cascade,
  node: CascadeNode,
  evaluations: readonly GateEvaluation[],
  latest: ReadonlyMap<string, GateEvaluation>,
  delivered: ReadonlySet<string>,
  acceptanceFallsBack: boolean,
): { readonly ready?: GateStep; readonly blocked?: BlockedStep } {
  if (node.state === WorkState.Canceled) return {};

  const chain = chainFor(node.workType);
  const acceptance = acceptanceGateFor(node.workType);

  for (const gate of chain) {
    const record = latest.get(`${node.workId} ${gate}`);
    if (record !== undefined && isPassing(record.outcome)) {
      // A passed gate is normally final. THE ACCEPTANCE GATE IS THE EXCEPTION, because what it
      // asserted was conditional: "the children are delivered". When a child is later rejected and
      // reopens, that premise stops holding, and a sign-off whose premise has gone is not a
      // sign-off — it is a record of one. The gate falls back and must be crossed again.
      //
      // Without this an epic keeps a passing acceptance over work that has since broken, which is
      // the "we signed off on something that did not work" failure occurring one step AFTER the
      // gate rather than at it — where no gate is watching for it.
      const fellBack =
        acceptanceFallsBack && gate === acceptance && deliveryRegressed(cascade, node, delivered);
      if (!fellBack) continue;
    }

    // This is the item's outstanding gate. Two things can still stop it being workable.
    if (gate === acceptance) {
      const children = childrenOf(cascade, node.workId);
      const live = children.filter((c) => c.state !== WorkState.Canceled);
      if (live.length === 0) {
        return {
          blocked: {
            workId: node.workId,
            workType: node.workType,
            gate,
            because: `nothing has been decomposed under this ${node.workType} yet, so there is nothing to accept`,
          },
        };
      }
      const outstanding = live.filter((c) => !delivered.has(c.workId));
      if (outstanding.length > 0) {
        return {
          blocked: {
            workId: node.workId,
            workType: node.workType,
            gate,
            because:
              `${outstanding.length} of ${live.length} children are not delivered ` +
              `(${outstanding.slice(0, 3).map((c) => c.workId).join(", ")}${outstanding.length > 3 ? ", ..." : ""})`,
          },
        };
      }
    }

    const attempts = attemptsAt(evaluations, node.workId, gate);
    const rework = record !== undefined;
    return {
      ready: {
        workId: node.workId,
        workType: node.workType,
        gate,
        title: node.title,
        ownerHatId: node.ownerHatId,
        attempt: attempts + 1,
        rework,
        ...(rework && record !== undefined ? { priorOutcome: record.outcome } : {}),
        why: rework
          ? `'${gate}' came back ${String(record?.outcome)} on attempt ${String(attempts)}: ${String(record?.reason)}`
          : `'${gate}' has not been judged on this ${node.workType}`,
      },
    };
  }

  return {};
}

/**
 * Every gate step the organization currently owes, across all work.
 *
 * At most ONE ready step per item, by construction — an item owes its next unpassed gate and
 * nothing else. That is the property that makes this schedulable: the demand list is a set of
 * independent units, so a scheduler can book them against calendars without having to reason about
 * ordering inside an item. The ordering is already spent here.
 */
export function gateDemand(input: {
  readonly cascade: Cascade;
  readonly evaluations: readonly GateEvaluation[];
  /**
   * Whether a passed acceptance gate REOPENS when a child stops being delivered.
   *
   * Defaults to true — the stricter reading, and the one that catches a parent standing Done above
   * work that has since broken. An organization that would rather track the regression as follow-up
   * than reopen a long-lived epic sets this false. A real choice real teams make differently, which
   * is why it is a parameter rather than a decision taken here.
   */
  readonly acceptanceFallsBack?: boolean;
}): GateDemand {
  const latest = latestByGate(input.evaluations);
  const delivered = deliveredSet(input.cascade);
  const ready: GateStep[] = [];
  const blocked: BlockedStep[] = [];

  for (const node of input.cascade.nodes) {
    const step = stepFor(
      input.cascade,
      node,
      input.evaluations,
      latest,
      delivered,
      input.acceptanceFallsBack ?? true,
    );
    if (step.ready !== undefined) ready.push(step.ready);
    if (step.blocked !== undefined) blocked.push(step.blocked);
  }

  return { ready, blocked };
}

/**
 * The gates this item owes that have NO passing evaluation on the record.
 *
 * The evidence form of `gatesComplete`: it answers "what is missing" rather than "is anything
 * missing", because a refusal that cannot name what it wants is one nobody can act on.
 *
 * Read from the RECORDED evaluations, never from a run's in-memory belief that it finished. Those
 * are different claims — "the walk completed" and "the log shows every gate passed" — and only the
 * second survives the process, which is what makes it the one worth marking work done on.
 */
export function missingGates(
  workType: WorkType,
  workId: string,
  evaluations: readonly GateEvaluation[],
): readonly GateKind[] {
  const latest = latestByGate(evaluations);
  return chainFor(workType).filter((gate) => {
    const record = latest.get(`${workId} ${gate}`);
    return record === undefined || !isPassing(record.outcome);
  });
}

/**
 * Has this item crossed every gate its own type owes?
 *
 * SEPARATE FROM `isDelivered`, which asks about children. An item is finished when BOTH hold, and
 * keeping them apart is what lets the two failures be told apart: gates passed with children
 * outstanding is a premature sign-off, children delivered with gates outstanding is unreviewed work.
 */
export function gatesComplete(
  workType: WorkType,
  workId: string,
  evaluations: readonly GateEvaluation[],
): boolean {
  const latest = latestByGate(evaluations);
  return chainFor(workType).every((gate) => {
    const record = latest.get(`${workId} ${gate}`);
    return record !== undefined && isPassing(record.outcome);
  });
}

/**
 * The steps that became ready BECAUSE something failed — the rework queue.
 *
 * Worth naming separately because it is the number that says whether the organization is making
 * progress or circling. A ready list that is entirely rework is an org redoing its own work, and
 * that reads as healthy activity in any count that does not separate them.
 */
export function reworkOnly(demand: GateDemand): readonly GateStep[] {
  return demand.ready.filter((s) => s.rework);
}

/** Ready steps for one item, for a CLI that asks "what does ELERA-149570 owe right now?". */
export function demandFor(demand: GateDemand, workId: string): readonly GateStep[] {
  return demand.ready.filter((s) => s.workId === workId);
}

/** Whether this item exists and is not canceled — a guard for callers taking a workId from argv. */
export function isLiveWork(cascade: Cascade, workId: string): boolean {
  const node = nodeById(cascade, workId);
  return node !== undefined && node.state !== WorkState.Canceled;
}
