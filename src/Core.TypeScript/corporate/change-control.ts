/**
 * corporate/change-control.ts — the register's work becoming a real CHANGE.
 *
 * ── THE GAP THIS CLOSES ──────────────────────────────────────────────────────
 * The corporate register could staff, schedule, verify and gate a task, and the outcome stayed
 * inside itself. `work-market` merges a shard into its own queue; `goal-cascade` marks a node done.
 * Neither produces a branch, a pull request, or a review — so "delivered" meant delivered *to the
 * organization's own bookkeeping*.
 *
 * The canonical package already models the real thing. `workflow-engine/agent-loop/
 * work-lifecycle-state-machine.ts` carries an eleven-state lifecycle —
 *
 *     Backlog → Claimed → InProgress → PrOpen → InReview
 *                                                 ↕ (RevisionRequested ↔ RevisionPushed)
 *                                              Approved → Merged | Closed | Abandoned
 *
 * — and it is the TS twin of `src/Core/WorkflowEngine.fs`, so the vocabulary is treaty-locked across
 * languages rather than invented here.
 *
 * ── THE PROJECTION IS DERIVED, NEVER SET ─────────────────────────────────────
 * Every transition below is driven by something the organization ALREADY decided: the cascade
 * assigned the task, the loop picked it, the market completed the shard, a gate approved or turned
 * it back. Nothing here chooses to advance.
 *
 * That is the whole discipline of change control. Two records that can be updated independently
 * drift, and the drift is silent in the direction that matters — an organization reporting a merge
 * with no PR, or a PR nobody's gates ever saw. `disagreementsWith` is the check that they have not.
 *
 * ── WHAT THIS IS NOT ─────────────────────────────────────────────────────────
 * It does not talk to a forge. The canonical package has `forge-host/` for that, and a projection
 * that also performed the network call could not be replayed. This produces the STATE a forge
 * adapter would act on, and `run-org.ts` prints it; wiring it to a live PR is the adapter's job and
 * a separate decision, because opening pull requests is not something a test suite should do.
 */

import {
  applyTransition,
  isTerminal,
  revisionCount,
  type BacklogRow,
  type WorkLifecycleState,
  type WorkLifecycleTransition,
} from "../workflow-engine/agent-loop/work-lifecycle-state-machine";
import type { AgentPersona } from "../protocol/agent-loop-contract";
import { childrenOf, nodeById, WorkState, type Cascade } from "./goal-cascade";
import { isPassing, ORDERED_GATES, type GateEvaluation, type GateKind } from "./quality-gate";
import { ShardState, type WorkQueue } from "./work-market";
import { chainOf, producesCode } from "./gate-demand";

/** What the organization did to one task, in the order it did it. */
export interface OrgFacts {
  readonly workId: string;
  /** The hat assigned to it, if the cascade staffed it. */
  readonly assigneeHatId?: string;
  /** The agent whose loop tick picked it up. */
  readonly pickedByAgentId?: string;
  readonly claimAtMs?: number;
  /** The shard the market tracked it as. */
  readonly shardId?: string;
  readonly gateEvaluations: readonly GateEvaluation[];
  readonly cancelled: boolean;
  /**
   * The gates THIS work item owes — its own type's chain.
   *
   * Absent means "every canonical gate", which is what this module assumed unconditionally until a
   * run measured the consequence: once the runtime began walking each work type's own chain, no
   * item could satisfy all fourteen, so nothing merged and every task reported as done-in-the-
   * cascade-but-InReview. The owed set travels with the facts because the change lifecycle has no
   * business knowing what a defect owes versus a task — that rule lives in `gate-demand`.
   */
  readonly owedGates?: readonly GateKind[];
}

/** Gather the facts for one task from the register's own state. */
export function factsFor(
  workId: string,
  input: {
    readonly cascade: Cascade;
    readonly queue: WorkQueue;
    readonly gateEvaluations: readonly GateEvaluation[];
    readonly pickedBy?: ReadonlyMap<string, string>;
    /**
     * Work items the CALLER already knows were staffed and actually executed outside the
     * agent-loop's own queue - the legacy path, where the cascade assigns a hat and that hat's
     * REAL producer runs directly, never touching a work-market claim. An explicit set from the
     * caller, not inferred here from gate evaluations existing: a SIMULATED work port can pass a
     * gate (an auto-approving reviewer needs no real diff to say yes) with nothing actually built,
     * and crediting that as "picked up" would let `StartWork`, and eventually `Merge`, fire for
     * work nobody did. Absent means none - the original, safe default.
     */
    readonly legacyStaffed?: ReadonlySet<string>;
    readonly nowMs: number;
  },
): OrgFacts | undefined {
  const node = nodeById(input.cascade, workId);
  if (node === undefined) return undefined;
  const shard = input.queue.shards.find((s) => s.workId === workId);
  const claim =
    shard?.claimedByClaimId === undefined
      ? undefined
      : input.queue.claims.find((c) => c.claimId === shard.claimedByClaimId);
  return {
    workId,
    ...(node.assigneeHatId === undefined ? {} : { assigneeHatId: node.assigneeHatId }),
    // WHO PICKED IT UP, with a THIRD fallback below the two the agent-loop's own queue supplies.
    //
    // `pickedBy` is this run's calendar/schedule blocks (empty for a task already done - nothing
    // gets freshly scheduled for finished work) and `claim` is the work-market's own claim record
    // (populated only once the newer agent-loop dispatch actually claims a shard there). Legacy
    // staffing never touches either: it schedules and calls the real work/review commands
    // directly. MEASURED: task-036 passed every gate (implementation_review through
    // release_readiness, real commits on its branch) and STILL projected `Claimed` forever,
    // because `StartWork` needs `pickedByAgentId` and neither of the first two ever had one to
    // give it - an org running the legacy path exclusively (the agent loop still in its
    // observe-only shadow soak) could never merge a single thing it finished.
    ...(input.pickedBy?.get(workId) === undefined
      ? claim === undefined
        ? node.assigneeHatId === undefined || input.legacyStaffed?.has(workId) !== true
          ? {}
          : { pickedByAgentId: node.assigneeHatId }
        : { pickedByAgentId: claim.ownerAgentId }
      : { pickedByAgentId: input.pickedBy.get(workId)! }),
    ...(claim === undefined ? {} : { claimAtMs: claim.claimedAtMs }),
    ...(shard === undefined ? {} : { shardId: shard.shardId }),
    gateEvaluations: input.gateEvaluations.filter((e) => e.workId === workId),
    cancelled: node.state === WorkState.Canceled,
  };
}

/** ISO from a millisecond stamp — the lifecycle's own field type. */
function iso(ms: number): string {
  return new Date(ms).toISOString();
}

export interface ProjectionInput {
  readonly facts: OrgFacts;
  readonly row: BacklogRow;
  readonly branchPrefix?: string;
  /** A deterministic PR number for this work. The forge assigns the real one. */
  readonly prNumber: number;
  readonly nowMs: number;
}

export interface Projection {
  readonly state: WorkLifecycleState;
  /** Every transition applied, in order — the audit trail of the projection itself. */
  readonly applied: readonly WorkLifecycleTransition[];
  /** Transitions the state machine refused, with its reason. Empty in a consistent projection. */
  readonly refused: readonly { readonly transition: WorkLifecycleTransition; readonly reason: string }[];
  readonly revisions: number;
  readonly terminal: boolean;
}

/**
 * Fold the organization's facts into a change-control state.
 *
 * Refusals are COLLECTED rather than thrown. A transition the canonical machine rejects means the
 * organization believes something the lifecycle says is impossible — which is exactly the
 * disagreement this module exists to surface, and throwing would hide it behind a stack trace.
 */
export function project(input: ProjectionInput): Projection {
  const { facts } = input;
  let state: WorkLifecycleState = { tag: "Backlog", row: input.row };
  const applied: WorkLifecycleTransition[] = [];
  const refused: { transition: WorkLifecycleTransition; reason: string }[] = [];

  const step = (transition: WorkLifecycleTransition): void => {
    const r = applyTransition(state, transition);
    if (r.ok) {
      state = r.state;
      applied.push(transition);
    } else {
      refused.push({ transition, reason: r.reason });
    }
  };

  const agent = (facts.pickedByAgentId ?? facts.assigneeHatId ?? "unassigned") as AgentPersona;

  // Assigned by the cascade ⇒ claimed.
  if (facts.assigneeHatId !== undefined) {
    step({ tag: "Claim", agent, timestamp: iso(facts.claimAtMs ?? input.nowMs) });
  }

  // Picked up in the agent's own loop tick ⇒ work started on a branch.
  if (facts.pickedByAgentId !== undefined) {
    step({
      tag: "StartWork",
      branchRef: `${input.branchPrefix ?? "work"}/${facts.workId}`,
    });
  }

  // The market completed or merged the shard ⇒ there is something to review.
  if (facts.shardId !== undefined && facts.gateEvaluations.length > 0) {
    step({ tag: "OpenPr", prNumber: input.prNumber, openedBy: agent, openedAt: iso(input.nowMs) });
  }

  // The gates ARE the review. Each attempt at the chain is one review pass.
  const reviewers = [...new Set(facts.gateEvaluations.map((e) => e.byHatId))];
  if (reviewers.length > 0) {
    step({ tag: "RequestReview", reviewers });
  }

  // Walk the verdicts in order. Each rejection is one turn of the canonical review cycle:
  //
  //     InReview → ReceiveRevisionRequest → RevisionRequested
  //              → PushRevision           → RevisionPushed
  //              → RequestReview          → InReview        (and around again)
  //
  // `RequestReview` is what closes the loop, NOT `ResolveAllThreads` — that one advances straight to
  // `Approved`, so emitting it per rework made every later revision request illegal and produced a
  // change that read as approved while its gates were still failing. Found by running the projection
  // against a failing pipeline and reading what the canonical machine refused.
  // ── ONLY IF THERE IS A PULL REQUEST TO REVISE ─────────────────────────────
  // The cycle above is a loop AROUND `InReview`, so it presupposes `OpenPr` applied. When it did
  // not — `StartWork` needs a `pickedByAgentId` the legacy staffing path never supplied, so the
  // change stuck at `Claimed` — marching the loop anyway asks the machine for three impossible
  // transitions PER FAILING GATE, and `project` is a pure fold recomputed every cycle, so it asks
  // again every cycle forever.
  //
  // MEASURED in the FlowDent store: 452 of 688 refusals across 20 runs (66%) were this one
  // derivative shape, climbing 12 → 54 per run as more changes fell in and never recovering. The
  // two refusals that name the ACTUAL fault — `OpenPr` and `RequestReview` refused from `Claimed`
  // — were buried under ~47 consequences of themselves.
  //
  // Asked of what was APPLIED, the same way the cancellation branch below asks it: a refused
  // transition leaves `state` untouched, so "was a pull request opened" is a question about the
  // transition log, not about the current tag. A projection where `OpenPr` applied is unchanged.
  const prOpen = applied.some((a) => a.tag === "OpenPr");
  for (const evaluation of prOpen ? facts.gateEvaluations : []) {
    if (isPassing(evaluation.outcome)) continue;
    step({ tag: "ReceiveRevisionRequest", threadIds: [`${evaluation.gate}:${evaluation.byHatId}`] });
    step({ tag: "PushRevision", sha: `${facts.workId}:${evaluation.gate}` });
    step({ tag: "RequestReview", reviewers });
  }

  // CANCELLATION SHORT-CIRCUITS. Checked before approval and merge, because `Merged` is terminal:
  // emitting the merge first left the cancellation refused and produced a cancelled task whose
  // change read as merged — the projection contradicting the organization in the one direction that
  // matters. Found by running it against a cancelled task.
  //
  // ABANDON vs CLOSE is the canonical machine's own distinction, and it is a real one: work dropped
  // before anyone opened a PR is ABANDONED, and work dropped after is CLOSED — there is a pull
  // request out there either way, and the two need different cleanup. `Abandon` is only legal from
  // Backlog, Claimed and InProgress.
  if (facts.cancelled) {
    // `prOpen`, computed above, is the same question and nothing since could have opened one — the
    // review cycle emits no `OpenPr`. Answered once so the two readers cannot drift.
    step(
      !prOpen
        ? { tag: "Abandon", reason: "cancelled by the organization" }
        : { tag: "Close", closedAt: iso(input.nowMs), reason: "cancelled by the organization" },
    );
    return {
      state,
      applied,
      refused,
      revisions: revisionCount(state),
      terminal: isTerminal(state),
    };
  }

  // Every gate passed ⇒ the threads are resolved and it is approved. Derived from the verdicts,
  // never asserted — an unfinished chain simply does not reach this.
  const passed = new Set(facts.gateEvaluations.filter((e) => isPassing(e.outcome)).map((e) => e.gate));
  // The item's OWN chain when it declared one, else every canonical gate. A work type owing three
  // gates must not be held to fourteen it never walks.
  const owed = facts.owedGates ?? ORDERED_GATES;
  // AN EMPTY CHAIN NEVER APPROVES. `[].every()` is vacuously true, so an item that owes nothing
  // would merge having crossed no gate at all — approval by having nothing to satisfy, which is
  // the vacuity class wearing a completed chain. Owing nothing is a configuration to investigate,
  // never a change to land.
  const allPassed = owed.length > 0 && owed.every((g) => passed.has(g));
  if (allPassed) {
    step({ tag: "Approve", approvedAt: iso(input.nowMs) });
  }

  // The market tracked it AND every gate passed ⇒ the change merged.
  if (facts.shardId !== undefined && allPassed) {
    step({
      tag: "Merge",
      mergeCommit: `merge:${facts.workId}`,
      mergedAt: iso(input.nowMs),
    });
  }

  return {
    state,
    applied,
    refused,
    revisions: revisionCount(state),
    terminal: isTerminal(state),
  };
}

/**
 * The organization calls this work DONE and its change record never reached `Merged`.
 *
 * ── WHY THIS IS A NAMED PREDICATE AND NOT AN INLINE CONDITION ────────────────
 * Two readers need it and they must never disagree. `disagreementsWith` reports it as one
 * disagreement among several; `runOrgRuntime` needs the SAME question answered to decide whether a
 * goal may be called delivered. Written twice, the two drift, and the drift is invisible: the run
 * reports the disagreement in a refusal and delivers anyway, which is precisely the state this
 * predicate was extracted to end.
 *
 * MEASURED, 2026-09-10, in the `newco` store:
 *
 *   "change control task-011: 'task-011' is done in the cascade but the change is Claimed"
 *   "decision": "goal DELIVERED"
 *
 * The detector fired, the refusal was recorded, and the run delivered over a repository in which
 * nothing had landed — because `changesUnlanded` (the only list DELIVERED consults) is populated
 * behind `if (projection.state.tag !== "Merged") continue;`, which this exact case never passes.
 */
export function doneWithNothingMerged(
  projection: Projection,
  input: { readonly cascade: Cascade; readonly workId: string },
): boolean {
  const node = nodeById(input.cascade, input.workId);
  return node?.state === WorkState.Done && projection.state.tag !== "Merged";
}

/**
 * Where the projection and the organization DISAGREE.
 *
 * The whole point of a derived projection is that it cannot drift — but "cannot" is a claim, and
 * this is the check. Each disagreement below is a state the two records could reach independently
 * and that no honest run should produce:
 *
 *   - the change merged while the task is not delivered,
 *   - the task is done while the change never merged,
 *   - the change merged with a gate unpassed,
 *   - the lifecycle refused a transition the organization believed it had made.
 */
export function disagreementsWith(
  projection: Projection,
  input: { readonly cascade: Cascade; readonly workId: string; readonly queue: WorkQueue },
): readonly string[] {
  const out: string[] = [];
  const node = nodeById(input.cascade, input.workId);
  const merged = projection.state.tag === "Merged";

  if (merged && node?.state !== WorkState.Done) {
    out.push(`change merged but '${input.workId}' is ${node?.state ?? "missing"} in the cascade`);
  }
  if (doneWithNothingMerged(projection, input)) {
    out.push(`'${input.workId}' is done in the cascade but the change is ${projection.state.tag}`);
  }
  // A refused transition is a disagreement when the organization believed it had MADE it. A
  // cancelled item's later transitions are the ones it decided not to make — a leaf cancelled
  // before it was walked has an assignee, a verdict and no shard, and the derived record cannot get
  // past Claimed; reporting that every cycle was noise about work already written off.
  if (node?.state !== WorkState.Canceled) {
    for (const r of projection.refused) {
      out.push(`the lifecycle refused '${r.transition.tag}': ${r.reason}`);
    }
  }
  const shard = input.queue.shards.find((s) => s.workId === input.workId);
  if (merged && shard !== undefined && shard.state !== ShardState.Merged) {
    out.push(`change merged but shard '${shard.shardId}' is ${shard.state}`);
  }
  return out;
}

/** Project every executable task in a cascade. */
export function projectAll(input: {
  readonly cascade: Cascade;
  readonly queue: WorkQueue;
  readonly gateEvaluations: readonly GateEvaluation[];
  readonly pickedBy?: ReadonlyMap<string, string>;
  readonly legacyStaffed?: ReadonlySet<string>;
  readonly nowMs: number;
  readonly branchPrefix?: string;
}): readonly { readonly workId: string; readonly projection: Projection; readonly disagreements: readonly string[] }[] {
  // Leaves THAT PRODUCE CODE. A verification item has no branch — projecting one for it invented a
  // change nothing ever wrote to, and the real git port then refused the empty merge. See
  // `producesCode`.
  const leaves = input.cascade.nodes.filter(
    (n) => childrenOf(input.cascade, n.workId).length === 0 && producesCode(n.workType),
  );
  return leaves.map((node, i) => {
    const facts = factsFor(node.workId, input);
    // The canonical row shape, filled honestly: this work came from the corporate register rather
    // than from a `docs/backlog/` file, and the path says so instead of naming a file that does not
    // exist.
    const row: BacklogRow = {
      id: node.workId,
      title: node.title,
      priority: "P2",
      filePath: `corporate/cascade/${node.workId}`,
      trajectory: "corporate-register",
    };
    const owedGates = chainOf(node);
    const projection = project({
      facts: {
        ...(facts ?? { workId: node.workId, gateEvaluations: [], cancelled: false }),
        owedGates,
      },
      row,
      prNumber: 1000 + i,
      nowMs: input.nowMs,
      ...(input.branchPrefix === undefined ? {} : { branchPrefix: input.branchPrefix }),
    });
    return {
      workId: node.workId,
      projection,
      disagreements: disagreementsWith(projection, {
        cascade: input.cascade,
        workId: node.workId,
        queue: input.queue,
      }),
    };
  });
}
