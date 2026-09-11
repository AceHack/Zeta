/**
 * corporate/quality-gate.ts — the seven gates a work item crosses before it is done.
 *
 * ── THE GAP THIS CLOSES ──────────────────────────────────────────────────────
 * Before this, `org-cycle.ts` took a task straight from assigned to `done` on the assignee's own
 * say-so. Every other refusal in this register was in place — a goal cannot be closed by closing the
 * goal, an anchor cannot resolve without producing its output, a calendar cannot double-book — and
 * the middle of the pipeline had nothing at all. "Delivered" meant "the dev said so", which is the
 * exact shape the rest of this package exists to remove.
 *
 * The corporate register puts the item through seven gates (`BUSINESS_QUALITY_GATE_SYSTEM.md`),
 * each owned by named hats, each with a legal outcome set and a recovery path when it fails.
 *
 * ── ONE SOURCE OF TRUTH FOR WHO OWNS A GATE ──────────────────────────────────
 * The reference keeps TWO lists and requires both: a `GateOwnerHats` roster, and the evaluating
 * hat's own `approvalScopes`. Two lists that must agree are two lists that can disagree — and the
 * disagreement is silent in the permissive direction the moment a hat is added to one and not the
 * other.
 *
 * Here the roster is DERIVED: a hat owns a gate iff its `approvalScopes` contain it. `gateOwners`
 * computes the list rather than storing it, so there is nothing to drift.
 *
 * ── DETERMINISM SETS THE GATE; THE AGENT SETS THE OUTCOME ────────────────────
 * Which gate is next, and who may evaluate it, are computed (`nextLegalGate`, `gateOwners`). Whether
 * it passes is chosen by an agent through `chooseWithinLegal`, clamped to the legal outcomes. That
 * split is the same one the observe loop makes, and it is what keeps a gate from being either a
 * rubber stamp (code decides) or a suggestion (the agent decides everything).
 */

import { chooseWithinLegal, preferChooser, type OrgChooser } from "./org-decision";
import { preflightGateEvaluation } from "./hat-guardrails";
import type { OrgChart, OrgHat } from "./org-chart";
import { BlockerKind, BLOCKER_POLICY } from "./blocker-taxonomy";
// `org-policy` imports only `type GateKind` from here, and a type import is erased at compile time,
// so this pair is a compile-time cycle and not a runtime one.
import { unmetRules, type OrgPolicy } from "./org-policy";

/** The seven gates. */
export const GateKind = {
  /**
   * The business context, groomed from a SOURCE rather than from the agent's own recollection.
   *
   * First on purpose. Everything downstream — the BRD, the architecture, the adversarial pass —
   * argues about a context; if that context was invented by whoever happened to start, the whole
   * chain is a well-reviewed opinion about nothing. This gate asks the narrow question the rest
   * cannot: was the context READ from somewhere a second party could read too?
   */
  BusinessContextGrooming: "business_context_grooming",
  /**
   * The EXISTING system around the affected site, understood and written down — before anybody
   * writes a requirement or a design for changing it.
   *
   * Not a design. A description: what the components in and around the affected site are for,
   * what they are trying to accomplish, how they fit together, and the business they serve. For a
   * feature it is what the BRD and the architecture are drafted against; for a defect it is what
   * "supposed to" means, which a reproduction and a fix are both judged by.
   *
   * Second, after grooming: grooming reads what the organization has WRITTEN about the business;
   * this reads the system itself. A BRD drafted without it describes a system nobody looked at.
   */
  SystemContext: "system_context",
  CustomerRfpReview: "customer_rfp_review",
  BrdApproval: "brd_approval",
  /**
   * A PEER on the same work looks at the groomed context before anyone designs against it.
   *
   * Distinct from `BrdApproval`, which is a director signing off DOWNWARD. This is lateral: the
   * cheapest place to catch a misread requirement is before an architecture exists to defend.
   */
  PeerReview: "peer_review",
  /** The architecture document is PRODUCED. Separate from approving it — see the next two. */
  ArchitectureDesign: "architecture_design",
  /** The architecture document is REVIEWED and approved. */
  ArchitectureApproval: "architecture_approval",
  /**
   * What the approved architecture COSTS, ruled on by the hat that holds the money.
   *
   * Sits immediately after the design is approved and before anybody builds against it, because
   * that is the last moment a cost is cheap to avoid. An architecture approved on its merits and
   * discovered to be unaffordable six gates later has already been built.
   *
   * MOST DOCUMENTS IMPLY NO COST, and those pass as `Waived` — the gate does not apply here.
   * `Waived` rather than `Approved` on purpose: an audit must be able to tell "the CFO looked and
   * there was nothing to rule on" from "the CFO approved the spending", and `PASSING` already
   * treats the two as equally passing while keeping them distinguishable in the record.
   */
  CostApproval: "cost_approval",
  /**
   * An ADVERSARIAL pass across the context, the BRD and the architecture together.
   *
   * The one gate whose job is to fail. Every gate before it asks "is this acceptable?", which is a
   * question a tired reviewer answers yes to; this one asks "where does this break?" — and it sits
   * after the design rather than inside each review because the interesting failures are between
   * the documents, not inside any one of them.
   */
  AdversarialReview: "adversarial_review",
  /**
   * The defect is REPRODUCED before anybody fixes it — as steps AND as something that fails.
   *
   * A fix for a defect nobody observed is a belief about the defect. This gate asks whether the
   * failure was actually made to happen: by reading the code when the cause is plain, and by
   * running the program when it is not. Its artifact is the reproduction a person can follow and
   * a test that fails on the unfixed code — which the implementation after it must turn green.
   *
   * It is also the organization's cheapest "is this even a bug?": a reproduction attempt that
   * finds the behaviour is as designed stops the work here, before a fix exists to defend.
   *
   * Immediately before implementation, because that is where the branch already exists and a
   * failing test committed now is the first commit the fix builds on.
   */
  Reproduction: "reproduction",
  ImplementationReview: "implementation_review",
  /** User-acceptance: does it do what the BRD said, judged by someone who did not build it. */
  QaUat: "qa_uat",
  /** The automated half — tests actually ran and actually passed. Decided by QA, not by opinion. */
  RuntimeValidation: "runtime_validation",
  FinalBusinessValidation: "final_business_validation",
  /**
   * The architect looks again, at what was BUILT rather than at what was drawn.
   *
   * `ArchitectureApproval` judged a document; six gates later the thing exists and can have drifted
   * from it. Approving the drawing is not approving the building.
   */
  FinalArchitectureReview: "final_architecture_review",
  ReleaseReadiness: "release_readiness",
} as const;

export type GateKind = (typeof GateKind)[keyof typeof GateKind];

/**
 * The chain, in order. This array is the single source of truth for sequencing — `nextLegalGate`
 * derives the prior-gate requirement from position rather than from a hand-maintained dependency
 * table, so the two cannot disagree about what comes before what.
 */
export const ORDERED_GATES: readonly GateKind[] = [
  GateKind.BusinessContextGrooming,
  GateKind.SystemContext,
  GateKind.CustomerRfpReview,
  GateKind.BrdApproval,
  GateKind.PeerReview,
  GateKind.ArchitectureDesign,
  GateKind.ArchitectureApproval,
  GateKind.CostApproval,
  GateKind.AdversarialReview,
  GateKind.Reproduction,
  GateKind.ImplementationReview,
  GateKind.QaUat,
  GateKind.RuntimeValidation,
  // ARCHITECTURE BEFORE BUSINESS at the end of the chain.
  //
  // The business validator is asked whether the change delivers the outcome; the architect is asked
  // whether the code does what it claims and addresses a cause. Asking business first meant the
  // organization could accept an outcome built on a structure it had not yet examined, and then
  // treat re-opening that structure as a regression against an approval it had already given.
  // Architecture is the cheaper rejection and belongs first.
  GateKind.FinalArchitectureReview,
  GateKind.FinalBusinessValidation,
  GateKind.ReleaseReadiness,
];

export const GateOutcome = {
  Approved: "approved",
  ChangesRequested: "changes_requested",
  Rejected: "rejected",
  Waived: "waived",
} as const;

export type GateOutcome = (typeof GateOutcome)[keyof typeof GateOutcome];

/**
 * The outcomes that let the item move on.
 *
 * `Waived` passes and is NOT the same as `Approved` — a waiver is an authority deciding the gate
 * does not apply here, which is a different fact from the gate having been satisfied, and the
 * distinction has to survive into the record or an audit cannot tell them apart.
 */
const PASSING: ReadonlySet<GateOutcome> = new Set([GateOutcome.Approved, GateOutcome.Waived]);

/**
 * The proposer for work nobody has been assigned.
 *
 * A sentinel rather than `undefined`, so choosing to evaluate a gate with no author is a visible
 * decision at the call site instead of an omitted argument.
 */
export const NO_PROPOSER = "(unassigned)";

export function isPassing(outcome: GateOutcome): boolean {
  return PASSING.has(outcome);
}

/**
 * The outcomes an evaluator may pick.
 *
 * `Waived` is deliberately ABSENT from the ordinary legal set. Waiving is not one of three normal
 * verdicts — it is a decision to skip a control, and offering it beside "approved" in every
 * evaluation makes the cheapest way past a hard gate a single index. It is reachable only through
 * `legalGateOutcomesFor` below, and only for a hat senior enough to carry it.
 */
export function legalGateOutcomes(): readonly GateOutcome[] {
  return [GateOutcome.Approved, GateOutcome.ChangesRequested, GateOutcome.Rejected];
}

/**
 * The legal outcomes for a specific evaluator.
 *
 * A Director or above may additionally waive. Anyone else gets the ordinary three — so skipping a
 * control requires standing, and the standing is checked here rather than trusted to a convention.
 */
export function legalGateOutcomesFor(hat: OrgHat): readonly GateOutcome[] {
  const base = legalGateOutcomes();
  const mayWaive = hat.level === "director" || hat.level === "c_suite" || hat.level === "executive_board";
  return mayWaive ? [...base, GateOutcome.Waived] : base;
}

/**
 * Gates whose owners have a MEANINGFUL ORDER, and where it comes from.
 *
 * `gateOwners` filters `chart.hats`, so without this the order is the order the seed happens to
 * declare hats in — and `runGateChain` takes the first owner as the default evaluator. The seed
 * declares the Executive Board first, because it is the root of the chart, so the board evaluated
 * every cost gate in the organization. That is the "whichever was listed first" defect this
 * register has now corrected in domain routing, in rung ownership, in alternative ranking and in
 * executive selection; this is its fifth appearance, through a default nobody had looked at.
 *
 * The order is not invented here. `blocker-taxonomy` already answers "who owns money questions",
 * most specific first — the CFO, then the program director, then the board — and a cost gate goes
 * to the nearest hat that holds the money, with the board as where it lands when the nearer ones
 * are the author or absent.
 *
 * A gate absent from this table keeps chart order, which is honest: nothing has said those owners
 * are ranked, and inventing a ranking would be worse than admitting there is none.
 */
const GATE_OWNER_ORDER: Partial<Record<GateKind, readonly string[]>> = {
  [GateKind.CostApproval]: BLOCKER_POLICY[BlockerKind.BudgetExceeded].ownerHatIds,
};

/**
 * Every hat authorized to evaluate this gate — derived from the hats' own approval scopes.
 *
 * Ranked where the gate declares a ranking (see `GATE_OWNER_ORDER`), chart order otherwise. The
 * ranking matters because `runGateChain` takes the first as its default evaluator.
 */
export function gateOwners(chart: OrgChart, gate: GateKind): readonly OrgHat[] {
  const holders = chart.hats.filter((h) => h.approvalScopes?.includes(gate) === true);
  const ranking = GATE_OWNER_ORDER[gate];
  if (ranking === undefined) return holders;
  // A holder the ranking does not mention sorts AFTER every one it does, rather than being dropped.
  // Silently omitting a hat that genuinely holds the scope would make a chart's own declaration
  // count for nothing.
  const rank = (h: OrgHat): number => {
    const i = ranking.indexOf(h.id);
    return i < 0 ? ranking.length : i;
  };
  return [...holders].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function mayEvaluate(chart: OrgChart, hatId: string, gate: GateKind): boolean {
  return gateOwners(chart, gate).some((h) => h.id === hatId);
}

/**
 * The next gate this item must cross: the first in the chain not yet passed.
 *
 * Because the chain is ordered and gates are consumed in order, the first unpassed gate is by
 * construction the one whose priors are all satisfied. Returns `undefined` when every gate has
 * passed — the item may merge.
 */
export function nextLegalGate(
  passed: ReadonlySet<GateKind>,
  chain: readonly GateKind[] = ORDERED_GATES,
): GateKind | undefined {
  return chain.find((g) => !passed.has(g));
}

/** How far through the chain this item is, as a fraction — for reporting only. */
export function gateProgress(passed: ReadonlySet<GateKind>): number {
  return ORDERED_GATES.filter((g) => passed.has(g)).length / ORDERED_GATES.length;
}

/** Have all of them passed? The count is `ORDERED_GATES.length`, never a number written twice. */
export function allGatesPassed(passed: ReadonlySet<GateKind>): boolean {
  return nextLegalGate(passed) === undefined;
}

/** Where a failed gate sends the work. */
export const RecoveryPath = {
  ReopenDiscoveryOrBrd: "reopen_discovery_or_brd",
  ReopenArchitecture: "reopen_architecture",
  BackToEngineering: "back_to_engineering",
  ValidationProcessImprovement: "validation_process_improvement",
  ChangeRequest: "change_request",
} as const;

export type RecoveryPath = (typeof RecoveryPath)[keyof typeof RecoveryPath];

export function recoveryPathFor(gate: GateKind): RecoveryPath {
  switch (gate) {
    case GateKind.BusinessContextGrooming:
    // A system description that does not hold is a misreading of what exists — discovery's to redo.
    case GateKind.SystemContext:
    case GateKind.CustomerRfpReview:
    case GateKind.BrdApproval:
    case GateKind.PeerReview:
      // A peer rejecting the groomed context sends it back to grooming, not to engineering: the
      // defect is in what was understood, and building on it faster does not fix it.
      return RecoveryPath.ReopenDiscoveryOrBrd;
    case GateKind.Reproduction:
      // A defect that could not be reproduced is a defect NOT YET UNDERSTOOD — the report is missing
      // something, or the behaviour is as designed. Both are discovery's to resolve with whoever
      // filed it; sending it to engineering would be asking for a fix to something nobody has seen.
      return RecoveryPath.ReopenDiscoveryOrBrd;
    case GateKind.ArchitectureDesign:
    case GateKind.ArchitectureApproval:
    case GateKind.FinalArchitectureReview:
      return RecoveryPath.ReopenArchitecture;
    case GateKind.CostApproval:
      // BACK TO THE ARCHITECTURE, not to engineering and not to a budget conversation. A cost the
      // organization will not fund is a fact about the DESIGN — this way of doing it is the
      // expensive way — and the answer is another design. Routing it to a change request would
      // make the money somebody else problem to negotiate away, which is how a cost control turns
      // into a queue.
      return RecoveryPath.ReopenArchitecture;
    case GateKind.AdversarialReview:
      // Deliberately BackToEngineering rather than a path of its own. An adversarial finding is a
      // defect in the thing, and routing it somewhere special would let it become a note nobody
      // has to act on — which is how this gate would quietly become decorative.
      return RecoveryPath.BackToEngineering;
    case GateKind.ImplementationReview:
      return RecoveryPath.BackToEngineering;
    case GateKind.QaUat:
    case GateKind.RuntimeValidation:
      return RecoveryPath.ValidationProcessImprovement;
    case GateKind.FinalBusinessValidation:
    case GateKind.ReleaseReadiness:
      return RecoveryPath.ChangeRequest;
  }
  return assertNeverGate(gate);
}

/** Exhaustiveness, enforced by the compiler: a new gate fails to typecheck until it is routed. */
function assertNeverGate(x: never): never {
  throw new Error(`unhandled gate: ${String(x)}`);
}

export interface GateEvaluation {
  readonly workId: string;
  readonly gate: GateKind;
  readonly outcome: GateOutcome;
  readonly byHatId: string;
  readonly reason: string;
  readonly atMs: number;
  /**
   * What the approver consulted. Retained on the record, not merely shown to the reviewer.
   *
   * The `Review` port already receives evidence so a reviewer can judge from it; until this field
   * existed none of it survived into the evaluation, so a gate's whole claim rested on the
   * approver's say-so and an audit could not tell a considered approval from a reflex.
   */
  readonly evidenceRefs: readonly string[];
}

/**
 * Gates whose entire claim is that something OUTSIDE the approver's own opinion was consulted.
 *
 * Deliberately three, not thirteen. Requiring evidence everywhere would turn the requirement into
 * a field people fill with the word "reviewed" — the shape that makes a control decorative. These
 * three are the ones whose name is a claim about an act:
 *
 *   grooming     asserts a data source was READ. With no reference, it asserts a recollection.
 *   adversarial  asserts someone TRIED TO BREAK IT. A rubber stamp passes this gate exactly like
 *                a real attempt, and without a reference the two are indistinguishable.
 *   uat          asserts the thing was EXERCISED by someone who did not build it.
 *
 * The others are judgements, and a judgement's evidence is its reason.
 */
export const GATES_REQUIRING_EVIDENCE: readonly GateKind[] = [
  GateKind.BusinessContextGrooming,
  GateKind.AdversarialReview,
  GateKind.QaUat,
];

export function requiresEvidence(gate: GateKind): boolean {
  return GATES_REQUIRING_EVIDENCE.includes(gate);
}

/**
 * Approvals that asserted an act and referenced nothing.
 *
 * DERIVED from the evaluations rather than counted as they are made, so it cannot drift from the
 * record. Only passing outcomes are reported: a rejection that consulted nothing is a reviewer
 * declining to engage, which is a different fact and not one this is measuring.
 */
export function unattestedApprovals(
  evaluations: readonly GateEvaluation[],
): readonly GateEvaluation[] {
  return evaluations.filter(
    (e) => requiresEvidence(e.gate) && isPassing(e.outcome) && e.evidenceRefs.length === 0,
  );
}

export type GateResult =
  | {
      readonly ok: true;
      readonly evaluation: GateEvaluation;
      readonly passed: ReadonlySet<GateKind>;
      /** Set when the outcome did NOT pass. */
      readonly recovery?: RecoveryPath;
    }
  | { readonly ok: false; readonly reason: string };

/**
 * One hat evaluates one gate.
 *
 * Four refusals, and each is a way a gate becomes decorative:
 *
 *   - **out of order** — evaluating a gate whose priors have not passed lets an item reach release
 *     readiness without an architecture review, by evaluating the gates in a convenient order.
 *   - **not an owner** — a hat without the approval scope is not the authority for this control.
 *   - **already passed** — re-evaluating a passed gate is how a rejection gets overwritten by a
 *     second opinion nobody asked for.
 *   - **no legal outcome** — reported, never defaulted.
 */
export function evaluateGate(
  chart: OrgChart,
  input: {
    readonly workId: string;
    readonly gate: GateKind;
    readonly evaluatorHatId: string;
    readonly passed: ReadonlySet<GateKind>;
    readonly chooser: OrgChooser<GateOutcome>;
    readonly atMs: number;
    /**
     * The hat that DID the work. REQUIRED — the evaluator may not be it.
     *
     * Not optional, deliberately. An approval whose subject nobody recorded cannot be checked for
     * self-approval, and a caller that cannot name the author does not know what it is approving.
     * Making it optional left "unrecorded" reading as "fine", which is the quiet-loss shape this
     * module exists to remove. Pass `NO_PROPOSER` for the rare gate that genuinely evaluates
     * unassigned work, so that choice is visible at the call site.
     */
    readonly proposerHatId: string;
    /**
     * What was consulted. REQUIRED for the gates in `GATES_REQUIRING_EVIDENCE`, and refused when
     * missing — an approval on those is a claim about an act, and a claim about an act that
     * references nothing is the assertion this whole layer exists to refuse.
     */
    readonly evidenceRefs?: readonly string[];
    /**
     * The chain THIS run is crossing. Defaults to the canonical order.
     *
     * WHY THIS IS A PARAMETER. The order was a module constant, so "the gates are crossed in order"
     * silently meant "in the order this file happens to declare" — and a pipeline that legitimately
     * reorders or omits phases was refused as out-of-order. That made the pipeline's
     * configurability nominal: you could describe a different process and not run it.
     *
     * Making it a parameter does not weaken the guarantee, it locates it. Within a run, gates are
     * crossed in the chain that run declared, and none can be skipped. What changes is that the
     * chain is the caller's to state rather than this module's to impose — which is the difference
     * between a process engine and one organization's process hardcoded as a law.
     */
    readonly chain?: readonly GateKind[];
    /**
     * THIS ORGANIZATION'S extra demands at this gate, and the facts to check them against.
     *
     * Optional: an org with no policy behaves exactly as before. Supplied, a PASSING outcome that
     * does not satisfy the org's rules is downgraded to `ChangesRequested` naming what is missing —
     * downgraded rather than refused, because the attempt happened and a refusal would leave no
     * record of it, and because `ChangesRequested` is precisely what feeds the rework loop.
     *
     * `priorApproverHatIds` is the caller's to supply because `MinApprovers` counts across
     * evaluations and this function sees one. Passing none means this approval is the first.
     *
     * HONEST LIMIT. Like the evidence field above, this checks what was REFERENCED, not what was
     * run. It is a stronger control than the evidence check — `autoApproveReview`'s
     * `auto-approved:<gate>:<workId>` does not contain a needle like `playwright-report`, so the
     * null adapter does NOT satisfy it — but a caller that fabricates a matching ref would pass.
     * What it delivers is that the org's stated requirement and whether it was met both reach the
     * record.
     */
    readonly policy?: {
      readonly policy: OrgPolicy;
      readonly artifactPaths?: readonly string[];
      readonly priorApproverHatIds?: readonly string[];
    };
  },
): GateResult {
  const hat = chart.byId.get(input.evaluatorHatId);
  if (hat === undefined) return { ok: false, reason: `unknown hat '${input.evaluatorHatId}'` };

  if (input.passed.has(input.gate)) {
    return { ok: false, reason: `gate '${input.gate}' on '${input.workId}' has already passed` };
  }
  const expected = nextLegalGate(input.passed, input.chain ?? ORDERED_GATES);
  if (expected !== input.gate) {
    return {
      ok: false,
      reason: `'${input.workId}' is at '${expected ?? "merged"}', not '${input.gate}' — gates are crossed in order`,
    };
  }
  // Scope AND separation of duties, in one preflight. Checking the scope alone let a hat that both
  // implemented and held the review scope approve its own change.
  const allowed = preflightGateEvaluation(chart, {
    evaluatorHatId: input.evaluatorHatId,
    gate: input.gate,
    ...(input.proposerHatId === NO_PROPOSER ? {} : { proposerHatId: input.proposerHatId }),
  });
  if (!allowed.ok) return { ok: false, reason: allowed.reason };

  const choice = chooseWithinLegal(
    legalGateOutcomesFor(hat),
    `gate ${input.gate} for ${input.workId}`,
    input.chooser,
  );
  if (choice.outcome === "no_legal_option") return { ok: false, reason: choice.reason };

  // RECORDED, NOT REFUSED — and the first draft of this did refuse, which was an overclaim.
  //
  // Refusing an evidence-free approval looks like enforcement and is not: any string satisfies it.
  // `autoApproveReview` — whose own description is "reads no evidence and consults nobody" —
  // returns `auto-approved:<gate>:<workId>`, which would have passed the check while consulting
  // nothing. A control that the null adapter satisfies is the vacuity class, and shipping it as
  // "agents cannot approve without evidence" would have been a stronger claim than the mechanism
  // supports.
  //
  // What IS deliverable is the three-state honesty this register uses everywhere else: the record
  // keeps what was referenced, `unattested` names the approvals that referenced nothing, and a
  // reader can tell an attested approval from a bare one — which they could not before, because
  // the evidence reached the reviewer and never reached the record.
  const evidenceRefs = (input.evidenceRefs ?? []).filter((r) => r.trim() !== "");

  // ── THIS ORGANIZATION'S OWN RULES ──────────────────────────────────────────
  // Applied only to a PASSING outcome. A rejection needs no policy: refusing to record "this does
  // not work" because the org's evidence rules were unmet would be exactly backwards — the failing
  // case is when a check is missing, and that is the case a rejection is reporting.
  let outcome = choice.option;
  let reason = choice.reason;
  if (input.policy !== undefined && isPassing(outcome)) {
    const unmet = unmetRules(input.policy.policy, input.gate, {
      evidenceRefs,
      approverHatIds: [...(input.policy.priorApproverHatIds ?? []), hat.id],
      artifactPaths: input.policy.artifactPaths ?? [],
    });
    if (unmet.length > 0) {
      outcome = GateOutcome.ChangesRequested;
      reason =
        `${choice.reason} — held by ${input.policy.policy.orgId} policy: ` +
        unmet.map((u) => `${u.rule.id} (${u.because})`).join("; ");
    }
  }

  const evaluation: GateEvaluation = {
    workId: input.workId,
    gate: input.gate,
    outcome,
    byHatId: hat.id,
    reason,
    atMs: input.atMs,
    evidenceRefs,
  };

  if (!isPassing(outcome)) {
    // The passed set is UNCHANGED on failure. An item that fails a gate has not crossed it, and the
    // recovery path says where it goes instead.
    return { ok: true, evaluation, passed: input.passed, recovery: recoveryPathFor(input.gate) };
  }

  const next = new Set(input.passed);
  next.add(input.gate);
  return { ok: true, evaluation, passed: next };
}

/**
 * Where a person may be required to sign off, if the operator asks for it.
 *
 * BOTH ARE OPTIONAL AND OFF BY DEFAULT. With neither configured the organization runs the whole
 * chain agentically, exactly as it did before this existed — which is the behaviour every current
 * caller depends on, and a checkpoint that switched itself on would be a change of kind rather than
 * a change of configuration.
 */
export const HumanCheckpoint = {
  /** The business and architectural grooming, signed off BEFORE anybody starts building. */
  Grooming: "grooming",
  /** The approach itself, approved before it is built. */
  Approach: "approach",
} as const;
export type HumanCheckpoint = (typeof HumanCheckpoint)[keyof typeof HumanCheckpoint];

/**
 * The gate each checkpoint stops at.
 *
 * `brd_approval` is the end of grooming: the business rules are written and reviewed, and nothing
 * has been built. `architecture_approval` is the end of the approach: the design is assessed and
 * still nothing has been built. Both are the last moment where a person's "no" is cheap.
 */
export const CHECKPOINT_GATE: Readonly<Record<HumanCheckpoint, GateKind>> = {
  grooming: "brd_approval",
  approach: "architecture_approval",
};

/** The gates that need a person, for the checkpoints an operator turned on. Empty means agentic. */
export function humanGatesFor(checkpoints: readonly HumanCheckpoint[]): ReadonlySet<GateKind> {
  return new Set(checkpoints.map((c) => CHECKPOINT_GATE[c]));
}

export interface GateRunResult {
  readonly evaluations: readonly GateEvaluation[];
  readonly passed: ReadonlySet<GateKind>;
  readonly merged: boolean;
  /** The gate that stopped it, if any. */
  readonly blockedAt?: GateKind;
  /**
   * The gate WAITING ON A PERSON, if any.
   *
   * Deliberately not `blockedAt`. A rejection means somebody looked and said no, and the recovery
   * path sends the work backwards. Waiting means nobody has looked yet — the work is fine, it is
   * simply not anyone's turn. Collapsing the two would make an unanswered checkpoint indistinguish-
   * able from a failed review, and the organization would "recover" from a decision never made.
   */
  readonly awaitingHuman?: GateKind;
  readonly recovery?: RecoveryPath;
  readonly refusals: readonly string[];
}

/**
 * Run the whole chain for one work item until it merges, fails, or runs out of owners.
 *
 * Returns every evaluation, so a caller can see WHERE it stopped rather than only that it did.
 */
export function runGateChain(
  chart: OrgChart,
  input: {
    readonly workId: string;
    readonly chooser: OrgChooser<GateOutcome>;
    /** Picks which owner evaluates a gate. Absent = the first owner in chart order. */
    readonly evaluatorFor?: (gate: GateKind, owners: readonly OrgHat[]) => OrgHat | undefined;
    readonly atMs: number;
    /** The hat that did the work, so no gate is evaluated by its author. `NO_PROPOSER` if none. */
    readonly proposerHatId: string;
    /**
     * What each gate's decider consulted, keyed by gate.
     *
     * Supplied by the CALLER because the caller is what talked to the reviewer — the runtime hands
     * over what the `Review` port returned. Inventing a reference here would be the register
     * fabricating the evidence for a claim it is meant to be checking.
     */
    readonly evidenceFor?: (gate: GateKind) => readonly string[];
    /**
     * Gates that may not pass without a person. Absent or empty = fully agentic.
     *
     * See {@link humanGatesFor}. This is the whole opt-in: no checkpoint exists unless an operator
     * named one.
     */
    readonly humanRequiredAt?: ReadonlySet<GateKind>;
    /**
     * The person's answer for a gate, if they have given one.
     *
     * Returns the outcome AND the reference to the action that carried it, so the evaluation
     * records WHICH human decision it was — an approval with no traceable origin is the thing the
     * audit requirement exists to prevent.
     */
    readonly humanDecisionFor?: (
      gate: GateKind,
    ) => { readonly outcome: GateOutcome; readonly actionRef: string } | undefined;
    /**
     * A chooser for ONE gate, where its outcome is derived rather than judged.
     *
     * `cost_approval` is the case this exists for: whether an architecture implies a cost, and
     * whether the money for it was ruled on, are FACTS the organization already holds — not an
     * opinion an evaluator forms. A gate whose answer is derivable and asked as a preference is a
     * check that can disagree with the record it is checking.
     *
     * Still a chooser and not an outcome, deliberately: it goes through `chooseWithinLegal` like
     * every other, so a derived `waived` from a hat too junior to waive is CLAMPED and reported
     * rather than quietly honoured.
     */
    readonly chooserFor?: (gate: GateKind) => OrgChooser<GateOutcome> | undefined;
  },
): GateRunResult {
  const evaluations: GateEvaluation[] = [];
  const refusals: string[] = [];
  let passed: ReadonlySet<GateKind> = new Set<GateKind>();

  // Bounded by the chain length: every iteration either passes a gate or stops. The bound is a
  // backstop against a future change making the loop non-monotonic, not a suspicion about this one.
  for (let step = 0; step < ORDERED_GATES.length; step += 1) {
    const gate = nextLegalGate(passed);
    if (gate === undefined) break;

    // The proposer is excluded from its own review before an evaluator is even picked, so a chart
    // where the author is the only scope-holder BLOCKS rather than self-approving.
    const owners = gateOwners(chart, gate).filter((h) => h.id !== input.proposerHatId);
    const evaluator = input.evaluatorFor?.(gate, owners) ?? owners[0];
    if (evaluator === undefined) {
      // Nobody in this organization holds the scope. That is a staffing fact, not a pass.
      refusals.push(
        gateOwners(chart, gate).some((h) => h.id === input.proposerHatId)
          ? `the only hat holding '${gate}' is '${input.proposerHatId}', which did the work`
          : `no hat holds the approval scope for '${gate}'`,
      );
      return { evaluations, passed, merged: false, blockedAt: gate, refusals };
    }

    // ── A CHECKPOINT WAITS FOR A PERSON ───────────────────────────────────
    // Checked BEFORE the gate is evaluated, so an unanswered checkpoint never produces an
    // evaluation at all. Recording an agent's verdict and then overriding it would leave two
    // answers in the trace, and the wrong one is the easier to read.
    const human = input.humanRequiredAt?.has(gate) === true ? input.humanDecisionFor?.(gate) : undefined;
    if (input.humanRequiredAt?.has(gate) === true && human === undefined) {
      return { evaluations, passed, merged: false, awaitingHuman: gate, refusals };
    }

    const result = evaluateGate(chart, {
      workId: input.workId,
      gate,
      evaluatorHatId: evaluator.id,
      passed,
      // The person's answer replaces the judgement, through the SAME seam `cost_approval` uses for
      // an outcome that is derived rather than judged. The hat still records the gate; the decision
      // is the human's, and the evidence below says whose.
      chooser: human === undefined ? (input.chooserFor?.(gate) ?? input.chooser) : preferChooser(human.outcome, "human checkpoint"),
      atMs: input.atMs,
      proposerHatId: input.proposerHatId,
      evidenceRefs: human === undefined
        ? (input.evidenceFor?.(gate) ?? [])
        : [...(input.evidenceFor?.(gate) ?? []), human.actionRef],
    });
    if (!result.ok) {
      refusals.push(result.reason);
      return { evaluations, passed, merged: false, blockedAt: gate, refusals };
    }

    evaluations.push(result.evaluation);
    if (!isPassing(result.evaluation.outcome)) {
      return {
        evaluations,
        passed,
        merged: false,
        blockedAt: gate,
        ...(result.recovery === undefined ? {} : { recovery: result.recovery }),
        refusals,
      };
    }
    passed = result.passed;
  }

  return { evaluations, passed, merged: allGatesPassed(passed), refusals };
}
