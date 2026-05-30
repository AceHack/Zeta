/**
 * Work pipeline driver — moves one work item from customer discovery through
 * release across the 7 business quality gates (BUSINESS_QUALITY_GATE_SYSTEM.md).
 * The ordered gate chain + prior-gate enforcement already live in
 * company-work-policy.ts; this driver adds:
 *
 *   - the gate → owner-hat mapping (who may evaluate each gate),
 *   - nextLegalGate (deterministic: the first gate whose priors are satisfied),
 *   - an owner-hat evaluator chosen via observe→decide,
 *   - gate evaluation that an authority hat drives (approve / changes / reject),
 *   - recovery-path routing for failures,
 *   - one OrgEvent per gate evaluation AND per pipeline-stage transition.
 *
 * Determinism: which gate is next, and who may evaluate it. Agent-driven: the
 * actual approve/reject outcome.
 */

import { DefaultCompanyQualityGateSequencePolicy } from "../../domain/src/company-work-policy.ts";
import { QualityGateKind, QualityGateOutcome } from "../../domain/src/records.ts";
import { OrgEventKind, type OrgEvent } from "../../domain/src/org-event.ts";
import type { HatDefinition } from "../../domain/src/hat-definition.ts";
import { chooseWithinLegal, type OrgChooser } from "./org-decision.ts";

/** The pipeline stage a work item is in, named for the gate it is awaiting. */
export const PipelineStage = {
  Intake: "intake",
  AwaitingCustomerRfpReview: "awaiting_customer_rfp_review",
  AwaitingBrdApproval: "awaiting_brd_approval",
  AwaitingArchitectureApproval: "awaiting_architecture_approval",
  AwaitingImplementationReview: "awaiting_implementation_review",
  AwaitingRuntimeValidation: "awaiting_runtime_validation",
  AwaitingFinalBusinessValidation: "awaiting_final_business_validation",
  AwaitingReleaseReadiness: "awaiting_release_readiness",
  Merged: "merged",
} as const;

export type PipelineStage = (typeof PipelineStage)[keyof typeof PipelineStage];

/** Owner hats permitted to evaluate each gate (BUSINESS_QUALITY_GATE_SYSTEM + the inventory). */
export const GateOwnerHats: Record<QualityGateKind, readonly string[]> = {
  [QualityGateKind.CustomerRfpReview]: ["product_owner", "business_analyst", "customer_interviewer"],
  [QualityGateKind.BrdApproval]: ["brd_reviewer", "business_approver", "product_owner"],
  [QualityGateKind.ArchitectureApproval]: ["architect", "architecture_reviewer", "chief_architect"],
  [QualityGateKind.ImplementationReview]: ["code_reviewer", "engineering_manager"],
  [QualityGateKind.RuntimeValidation]: ["qa_verifier", "qa_reviewer", "browser_automation_qa"],
  [QualityGateKind.FinalBusinessValidation]: ["product_owner", "business_analyst"],
  [QualityGateKind.ReleaseReadiness]: ["release_manager", "delivery_reviewer", "tpm"],
};

const ORDERED_GATES = DefaultCompanyQualityGateSequencePolicy.orderedGateKinds;

const GATE_TO_STAGE: Record<QualityGateKind, PipelineStage> = {
  [QualityGateKind.CustomerRfpReview]: PipelineStage.AwaitingCustomerRfpReview,
  [QualityGateKind.BrdApproval]: PipelineStage.AwaitingBrdApproval,
  [QualityGateKind.ArchitectureApproval]: PipelineStage.AwaitingArchitectureApproval,
  [QualityGateKind.ImplementationReview]: PipelineStage.AwaitingImplementationReview,
  [QualityGateKind.RuntimeValidation]: PipelineStage.AwaitingRuntimeValidation,
  [QualityGateKind.FinalBusinessValidation]: PipelineStage.AwaitingFinalBusinessValidation,
  [QualityGateKind.ReleaseReadiness]: PipelineStage.AwaitingReleaseReadiness,
};

const PASSED: ReadonlySet<QualityGateOutcome> = new Set([QualityGateOutcome.Approved, QualityGateOutcome.Waived]);

/**
 * The next legal gate: the first gate in the ordered chain not yet passed whose
 * required prior gates are all approved/waived. Returns undefined when every gate
 * is passed (the work item may merge).
 */
export function nextLegalGate(
  passedGateKinds: ReadonlySet<QualityGateKind>,
): QualityGateKind | undefined {
  // a gate is legal iff every earlier gate in the ordered chain has passed
  // (ORDERED_GATES is the single source of truth for the chain order).
  for (let i = 0; i < ORDERED_GATES.length; i += 1) {
    const gateKind = ORDERED_GATES[i]!;
    if (passedGateKinds.has(gateKind)) continue;
    const priorsAllPassed = ORDERED_GATES.slice(0, i).every((g) => passedGateKinds.has(g));
    if (priorsAllPassed) {
      return gateKind;
    }
  }
  return undefined;
}

/** The stage a work item is in given which gates have passed. */
export function stageFor(passedGateKinds: ReadonlySet<QualityGateKind>): PipelineStage {
  const next = nextLegalGate(passedGateKinds);
  return next === undefined ? PipelineStage.Merged : GATE_TO_STAGE[next];
}

export type GateEvaluation = {
  workItemId: string;
  gateKind: QualityGateKind;
  outcome: QualityGateOutcome;
  evaluatedByHatId: string;
};

export type GateEvaluationResult =
  | { outcome: "evaluated"; evaluation: GateEvaluation; events: readonly OrgEvent[]; advancedTo: PipelineStage }
  | { outcome: "not_authorized"; reason: string };

export type PipelineContext = {
  createEventId: () => string;
  nowIso: () => string;
  organizationId: string;
  supervisorChain: readonly string[];
  correlationId: string;
  causationId: string;
  traceId: string;
};

/** Legal gate outcomes an evaluator may choose (the agent drives which one). */
export function legalGateOutcomes(): readonly QualityGateOutcome[] {
  return [QualityGateOutcome.Approved, QualityGateOutcome.ChangesRequested, QualityGateOutcome.Rejected];
}

/**
 * An owner hat evaluates a gate. Verifies the hat owns the gate (has the matching
 * approval scope), records the evaluation, and — if approved/waived — advances
 * the work item to the next stage. Emits a QualityGateEvaluation event and, on
 * advance, a PipelineStageTransition event.
 */
export function evaluateGate(
  input: {
    workItemId: string;
    gateKind: QualityGateKind;
    evaluatorHat: HatDefinition;
    passedGateKinds: ReadonlySet<QualityGateKind>;
    outcomeChooser: OrgChooser<QualityGateOutcome>;
  },
  ctx: PipelineContext,
): GateEvaluationResult {
  const owners = GateOwnerHats[input.gateKind];
  if (!owners.includes(input.evaluatorHat.id) || !input.evaluatorHat.approvalScopes.includes(input.gateKind)) {
    return { outcome: "not_authorized", reason: `${input.evaluatorHat.name} is not an owner of gate ${input.gateKind}` };
  }
  const choice = chooseWithinLegal(legalGateOutcomes(), `gate ${input.gateKind} for ${input.workItemId}`, input.outcomeChooser);
  if (choice.outcome === "no_legal_option") {
    return { outcome: "not_authorized", reason: choice.reason };
  }
  const evaluation: GateEvaluation = {
    workItemId: input.workItemId,
    gateKind: input.gateKind,
    outcome: choice.option,
    evaluatedByHatId: input.evaluatorHat.id,
  };

  const fromStage = GATE_TO_STAGE[input.gateKind];
  const events: OrgEvent[] = [
    {
      id: ctx.createEventId(),
      kind: OrgEventKind.QualityGateEvaluation,
      occurredAt: ctx.nowIso(),
      organizationId: ctx.organizationId,
      actorHatId: input.evaluatorHat.id,
      departmentId: input.evaluatorHat.departmentId,
      subjectId: input.workItemId,
      fromState: fromStage,
      toState: choice.option,
      decision: `${input.evaluatorHat.name} evaluated ${input.gateKind} → ${choice.option} (${choice.reason})`,
      supervisorChain: ctx.supervisorChain,
      evidenceRefs: [],
      correlationId: ctx.correlationId,
      causationId: ctx.causationId,
      traceId: ctx.traceId,
    },
  ];

  let advancedTo = fromStage;
  if (PASSED.has(choice.option)) {
    const nextPassed = new Set(input.passedGateKinds);
    nextPassed.add(input.gateKind);
    advancedTo = stageFor(nextPassed);
    events.push({
      id: ctx.createEventId(),
      kind: OrgEventKind.PipelineStageTransition,
      occurredAt: ctx.nowIso(),
      organizationId: ctx.organizationId,
      actorHatId: input.evaluatorHat.id,
      departmentId: input.evaluatorHat.departmentId,
      subjectId: input.workItemId,
      fromState: fromStage,
      toState: advancedTo,
      decision: `${input.workItemId} advanced ${fromStage} → ${advancedTo} after ${input.gateKind}`,
      supervisorChain: ctx.supervisorChain,
      evidenceRefs: [],
      correlationId: ctx.correlationId,
      causationId: ctx.causationId,
      traceId: ctx.traceId,
    });
  }

  return { outcome: "evaluated", evaluation, events, advancedTo };
}

/** Where a failed gate routes (BUSINESS_QUALITY_GATE_SYSTEM §Recovery Paths). */
export const RecoveryPath = {
  BackToEngineering: "back_to_engineering",
  ReopenDiscoveryOrBrd: "reopen_discovery_or_brd",
  ReopenArchitecture: "reopen_architecture",
  ValidationProcessImprovement: "validation_process_improvement",
  ChangeRequest: "change_request",
} as const;

export type RecoveryPath = (typeof RecoveryPath)[keyof typeof RecoveryPath];

export function recoveryPathFor(gateKind: QualityGateKind): RecoveryPath {
  switch (gateKind) {
    case QualityGateKind.CustomerRfpReview:
    case QualityGateKind.BrdApproval:
      return RecoveryPath.ReopenDiscoveryOrBrd;
    case QualityGateKind.ArchitectureApproval:
      return RecoveryPath.ReopenArchitecture;
    case QualityGateKind.ImplementationReview:
      return RecoveryPath.BackToEngineering;
    case QualityGateKind.RuntimeValidation:
      return RecoveryPath.ValidationProcessImprovement;
    case QualityGateKind.FinalBusinessValidation:
    case QualityGateKind.ReleaseReadiness:
      return RecoveryPath.ChangeRequest;
  }
}
