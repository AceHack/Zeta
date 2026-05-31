import {
  ChangeSetPhase,
  DocLifecycleState,
  GraphConfidence,
  HatBindingPhase,
  MemoryPhase,
  OrgEventKind,
  ScheduleBlockState,
  WorkBatchState,
  WorkItemState,
  baseLegalNextStates,
  isScheduleBlockState,
  legalChangeSetTransitions,
  legalConfidencePromotions,
  legalDocTransitions,
  legalNextBatchStates,
  legalMemoryTransitions,
  type ChangeSet,
  type OrgEvent,
  type OrgEventTransitionContext,
  type ReviewPipeline,
} from "../../domain/src/index.ts";
import { PipelineStage } from "./pipeline.ts";

export type ConformanceViolation = {
  eventId: string;
  kind: OrgEventKind;
  subjectId: string;
  fromState: string;
  toState: string;
  legalToStates: readonly string[];
  reason: string;
};

export type ConformanceSkip = {
  eventId: string;
  kind: OrgEventKind;
  subjectId: string;
  reason: string;
  ambiguous: boolean;
};

export type ConformanceReport = {
  checked: number;
  conformant: number;
  nonconformant: number;
  skipped: number;
  skippedAmbiguous: number;
  coverageRatio: number;
  ratchetViolated: boolean;
  ratchetViolation?: {
    maxSkippedAmbiguous: number;
    skippedAmbiguous: number;
  };
  skipReasonCounts: Readonly<Record<string, number>>;
  violations: readonly ConformanceViolation[];
  skips: readonly ConformanceSkip[];
};

type TransitionCheck =
  | { kind: "checked"; legalToStates: readonly string[]; reason: string }
  | { kind: "skipped"; reason: string; ambiguous: boolean };

export type ReplayLedgerOptions = {
  maxSkippedAmbiguous?: number;
};

const ChangeTransitionKinds = new Set<OrgEventKind>([
  OrgEventKind.ChangeSetOpened,
  OrgEventKind.ChangesRequested,
  OrgEventKind.ChangeSetApproved,
  OrgEventKind.ChangeSetApplied,
  OrgEventKind.ChangeSetRejected,
]);

const MemoryTransitionKinds = new Set<OrgEventKind>([
  OrgEventKind.MemoryPhaseTransition,
  OrgEventKind.MemoryArchived,
  OrgEventKind.MemoryPromoted,
  OrgEventKind.MemoryDemoted,
  OrgEventKind.MemoryConflictFlagged,
]);

const DocTransitionKinds = new Set<OrgEventKind>([
  OrgEventKind.DocLifecycleTransition,
  OrgEventKind.DocCanonicalized,
  OrgEventKind.DocSuperseded,
  OrgEventKind.DocStaleFlagged,
  OrgEventKind.DocArchived,
]);

const GraphTransitionKinds = new Set<OrgEventKind>([
  OrgEventKind.GraphConfidencePromoted,
  OrgEventKind.GraphEdgeRetracted,
]);

const ExplicitNonTransitionKinds = new Set<OrgEventKind>([
  OrgEventKind.HatSupplyDecision,
  OrgEventKind.PriorityDecision,
  OrgEventKind.HatAssignment,
  OrgEventKind.QualityGateEvaluation,
  OrgEventKind.SuccessionPlanned,
  OrgEventKind.TestCaseAuthored,
  OrgEventKind.TestRunRecorded,
  OrgEventKind.RegressionDetected,
  OrgEventKind.DefectOpened,
  OrgEventKind.ChurnDetected,
  OrgEventKind.EscalationDecision,
  OrgEventKind.IntakeReceived,
  OrgEventKind.MemoryRetained,
  OrgEventKind.MemoryInjected,
  OrgEventKind.MemoryCited,
  OrgEventKind.MemoryOutcomeObserved,
  OrgEventKind.MemoryReinforced,
  OrgEventKind.MemoryMaintenanceCycle,
  OrgEventKind.ReviewStageAdvanced,
  OrgEventKind.ReviewFindingRaised,
  OrgEventKind.StageApproved,
  OrgEventKind.ProjectionCreated,
  OrgEventKind.ProjectionSynced,
  OrgEventKind.HumanSignoffRequested,
  OrgEventKind.DocIngested,
  OrgEventKind.DocClassified,
  OrgEventKind.DocConsulted,
  OrgEventKind.DocMaintenanceCycle,
  OrgEventKind.GraphNodeExtracted,
  OrgEventKind.GraphEdgeInferred,
  OrgEventKind.GraphDerivedIntelligence,
  OrgEventKind.ModelEvalCompleted,
  OrgEventKind.DecisionOptimizationProposed,
  OrgEventKind.ReputationOutcomeObserved,
  OrgEventKind.RecoveryIncidentDetected,
  OrgEventKind.RecoveryScanCompleted,
  OrgEventKind.ObserveActTick,
]);

export function replayLedger(events: readonly OrgEvent[], options: ReplayLedgerOptions = {}): ConformanceReport {
  let checked = 0;
  let conformant = 0;
  const violations: ConformanceViolation[] = [];
  const skips: ConformanceSkip[] = [];

  for (const event of events) {
    const check = classifyTransition(event);
    if (check.kind === "skipped") {
      skips.push(skip(event, check.reason, check.ambiguous));
      continue;
    }

    checked += 1;
    if (check.legalToStates.includes(event.toState!)) {
      conformant += 1;
      continue;
    }

    violations.push({
      eventId: event.id,
      kind: event.kind,
      subjectId: event.subjectId,
      fromState: event.fromState!,
      toState: event.toState!,
      legalToStates: check.legalToStates,
      reason: check.reason,
    });
  }

  const skippedAmbiguous = skips.filter((entry) => entry.ambiguous).length;
  const coverageDenominator = checked + skippedAmbiguous;
  const ratchetViolated = options.maxSkippedAmbiguous !== undefined && skippedAmbiguous > options.maxSkippedAmbiguous;

  return {
    checked,
    conformant,
    nonconformant: violations.length,
    skipped: skips.length,
    skippedAmbiguous,
    coverageRatio: coverageDenominator === 0 ? 1 : checked / coverageDenominator,
    ratchetViolated,
    ...(ratchetViolated
      ? { ratchetViolation: { maxSkippedAmbiguous: options.maxSkippedAmbiguous!, skippedAmbiguous } }
      : {}),
    skipReasonCounts: countSkipReasons(skips),
    violations,
    skips,
  };
}

function classifyTransition(event: OrgEvent): TransitionCheck {
  if (!isReplayableTransitionKind(event.kind)) {
    if (ExplicitNonTransitionKinds.has(event.kind)) {
      return { kind: "skipped", reason: "event kind is explicitly classified as non-transition", ambiguous: false };
    }
    return { kind: "skipped", reason: "event kind is not classified as replayable or non-transition", ambiguous: true };
  }

  if (event.kind === OrgEventKind.HatBindingTransition && event.fromState === undefined && event.toState === HatBindingPhase.Warmup) {
    return { kind: "skipped", reason: "hat binding initialization is a legal non-ambiguous transition", ambiguous: false };
  }

  if (event.kind === OrgEventKind.WorkScheduleBlockTransition && event.fromState === undefined && event.toState === ScheduleBlockState.Scheduled) {
    return { kind: "skipped", reason: "schedule block initialization is a legal non-ambiguous transition", ambiguous: false };
  }

  if (event.fromState === undefined || event.toState === undefined) {
    return { kind: "skipped", reason: "event does not carry from/to state", ambiguous: true };
  }

  if (event.fromState === event.toState) {
    return { kind: "skipped", reason: "event does not change state", ambiguous: false };
  }

  if (event.kind === OrgEventKind.WorkItemTransition) {
    if (!isWorkItemState(event.fromState) || !isWorkItemState(event.toState)) {
      return { kind: "skipped", reason: "event states do not name a known work-item transition", ambiguous: true };
    }
    return {
      kind: "checked",
      legalToStates: baseLegalNextStates(event.fromState),
      reason: "illegal work item transition",
    };
  }

  if (event.kind === OrgEventKind.HatBindingTransition) {
    if (!isHatBindingPhase(event.fromState) || !isHatBindingPhase(event.toState)) {
      return { kind: "skipped", reason: "event states do not name a known hat binding phase transition", ambiguous: true };
    }
    return {
      kind: "checked",
      legalToStates: legalHatBindingTargets(event.fromState),
      reason: "illegal hat binding phase transition",
    };
  }

  if (event.kind === OrgEventKind.PipelineStageTransition) {
    if (!isPipelineStage(event.fromState) || !isPipelineStage(event.toState)) {
      return { kind: "skipped", reason: "event states do not name a known pipeline stage transition", ambiguous: true };
    }
    return {
      kind: "checked",
      legalToStates: legalPipelineStageTargets(event.fromState),
      reason: "illegal pipeline stage transition",
    };
  }

  if (event.kind === OrgEventKind.WorkBatchTransition) {
    if (!isWorkBatchState(event.fromState) || !isWorkBatchState(event.toState)) {
      return { kind: "skipped", reason: "event states do not name a known work batch transition", ambiguous: true };
    }
    return {
      kind: "checked",
      legalToStates: legalNextBatchStates(event.fromState),
      reason: "illegal work batch transition",
    };
  }

  if (event.kind === OrgEventKind.WorkScheduleBlockTransition) {
    if (!isScheduleBlockState(event.fromState) || !isScheduleBlockState(event.toState)) {
      return { kind: "skipped", reason: "event states do not name a known schedule block state transition", ambiguous: true };
    }
    return {
      kind: "checked",
      legalToStates: legalScheduleBlockTargets(event.fromState),
      reason: "illegal schedule block state transition",
    };
  }

  if (MemoryTransitionKinds.has(event.kind)) {
    if (!isMemoryPhase(event.fromState) || !isMemoryPhase(event.toState)) {
      return { kind: "skipped", reason: "event states do not name a known memory phase transition", ambiguous: true };
    }
    return {
      kind: "checked",
      legalToStates: legalMemoryTransitions(event.fromState).map((transition) => transition.to),
      reason: "illegal memory phase transition",
    };
  }

  if (ChangeTransitionKinds.has(event.kind)) {
    if (!isChangeSetPhase(event.fromState) || !isChangeSetPhase(event.toState)) {
      return { kind: "skipped", reason: "event states do not name a known change-set phase transition", ambiguous: true };
    }
    if (event.fromState === ChangeSetPhase.InReview && event.toState === ChangeSetPhase.Approved) {
      if (!isChangeSetReviewContext(event.transitionContext)) {
        return { kind: "skipped", reason: "change-set approval requires pipeline cursor replay context", ambiguous: true };
      }
      if (!isValidReviewCursor(event.transitionContext)) {
        return { kind: "skipped", reason: "change-set approval carries malformed pipeline cursor replay context", ambiguous: true };
      }
    }
    return {
      kind: "checked",
      legalToStates: legalChangeTargets(event.fromState, event.transitionContext),
      reason: "illegal change-set phase transition",
    };
  }

  if (DocTransitionKinds.has(event.kind)) {
    if (!isDocLifecycleState(event.fromState) || !isDocLifecycleState(event.toState)) {
      return { kind: "skipped", reason: "event states do not name a known document lifecycle transition", ambiguous: true };
    }
    if (event.fromState === DocLifecycleState.Draft && event.toState === DocLifecycleState.Active) {
      if (!isValidDocumentLifecycleContext(event.transitionContext)) {
        return { kind: "skipped", reason: "document draft->active requires load-bearing replay context", ambiguous: true };
      }
    }
    return {
      kind: "checked",
      legalToStates: legalDocTargets(event.fromState, event.transitionContext),
      reason: "illegal document lifecycle transition",
    };
  }

  if (GraphTransitionKinds.has(event.kind)) {
    if (!isGraphConfidence(event.fromState) || !isGraphConfidence(event.toState)) {
      return { kind: "skipped", reason: "event states do not name a known graph confidence transition", ambiguous: true };
    }
    return {
      kind: "checked",
      legalToStates: legalConfidencePromotions(event.fromState),
      reason: "illegal graph confidence transition",
    };
  }
  return { kind: "skipped", reason: "event kind is not classified as replayable or non-transition", ambiguous: true };
}

function isReplayableTransitionKind(kind: OrgEventKind): boolean {
  return (
    kind === OrgEventKind.WorkItemTransition ||
    kind === OrgEventKind.HatBindingTransition ||
    kind === OrgEventKind.PipelineStageTransition ||
    kind === OrgEventKind.WorkBatchTransition ||
    kind === OrgEventKind.WorkScheduleBlockTransition ||
    MemoryTransitionKinds.has(kind) ||
    ChangeTransitionKinds.has(kind) ||
    DocTransitionKinds.has(kind) ||
    GraphTransitionKinds.has(kind)
  );
}

export function unclassifiedOrgEventKinds(): readonly OrgEventKind[] {
  return Object.values(OrgEventKind).filter(
    (kind) => !isReplayableTransitionKind(kind) && !ExplicitNonTransitionKinds.has(kind),
  );
}

function legalHatBindingTargets(from: HatBindingPhase): readonly HatBindingPhase[] {
  switch (from) {
    case HatBindingPhase.Pending:
      return [HatBindingPhase.Warmup, HatBindingPhase.Revoked];
    case HatBindingPhase.Warmup:
      return [HatBindingPhase.Active, HatBindingPhase.Expired, HatBindingPhase.Released, HatBindingPhase.Revoked];
    case HatBindingPhase.Active:
      return [
        HatBindingPhase.Probation,
        HatBindingPhase.Expired,
        HatBindingPhase.Released,
        HatBindingPhase.Succeeded,
        HatBindingPhase.Revoked,
      ];
    case HatBindingPhase.Probation:
      return [HatBindingPhase.Active, HatBindingPhase.Expired, HatBindingPhase.Released, HatBindingPhase.Revoked];
    case HatBindingPhase.Expired:
    case HatBindingPhase.Released:
    case HatBindingPhase.Succeeded:
    case HatBindingPhase.Revoked:
      return [];
  }
}

function legalPipelineStageTargets(from: PipelineStage): readonly PipelineStage[] {
  switch (from) {
    case PipelineStage.Intake:
      return [PipelineStage.AwaitingCustomerRfpReview];
    case PipelineStage.AwaitingCustomerRfpReview:
      return [PipelineStage.AwaitingBrdApproval];
    case PipelineStage.AwaitingBrdApproval:
      return [PipelineStage.AwaitingArchitectureApproval];
    case PipelineStage.AwaitingArchitectureApproval:
      return [PipelineStage.AwaitingImplementationReview];
    case PipelineStage.AwaitingImplementationReview:
      return [PipelineStage.AwaitingRuntimeValidation];
    case PipelineStage.AwaitingRuntimeValidation:
      return [PipelineStage.AwaitingFinalBusinessValidation];
    case PipelineStage.AwaitingFinalBusinessValidation:
      return [PipelineStage.AwaitingReleaseReadiness];
    case PipelineStage.AwaitingReleaseReadiness:
      return [PipelineStage.Merged];
    case PipelineStage.Merged:
      return [];
  }
}

function legalScheduleBlockTargets(from: ScheduleBlockState): readonly ScheduleBlockState[] {
  switch (from) {
    case ScheduleBlockState.Scheduled:
      return [ScheduleBlockState.Active, ScheduleBlockState.Canceled, ScheduleBlockState.Missed];
    case ScheduleBlockState.Active:
      return [
        ScheduleBlockState.Paused,
        ScheduleBlockState.Completed,
        ScheduleBlockState.Canceled,
        ScheduleBlockState.Missed,
      ];
    case ScheduleBlockState.Paused:
      return [ScheduleBlockState.Active, ScheduleBlockState.Canceled, ScheduleBlockState.Missed];
    case ScheduleBlockState.Completed:
    case ScheduleBlockState.Canceled:
    case ScheduleBlockState.Missed:
      return [];
  }
}

function legalChangeTargets(from: ChangeSetPhase, context: OrgEventTransitionContext | undefined): readonly ChangeSetPhase[] {
  const currentStageIndex = isChangeSetReviewContext(context) && isValidReviewCursor(context) ? context.currentStageIndex : 0;
  const stageCount = isChangeSetReviewContext(context) && isValidReviewCursor(context) ? context.stageCount : 2;
  return legalChangeSetTransitions(syntheticChangeSet(from, currentStageIndex), syntheticPipeline(stageCount));
}

function legalDocTargets(from: DocLifecycleState, context: OrgEventTransitionContext | undefined): readonly DocLifecycleState[] {
  if (isValidDocumentLifecycleContext(context)) {
    return legalDocTransitions(from, context.loadBearing);
  }

  return unique([...legalDocTransitions(from, true), ...legalDocTransitions(from, false)]);
}

function syntheticChangeSet(phase: ChangeSetPhase, currentStageIndex: number): ChangeSet {
  return {
    changeSetId: "synthetic",
    organizationId: "synthetic",
    workItemId: "synthetic",
    proposerHatId: "synthetic",
    title: "synthetic",
    targetRef: "synthetic",
    phase,
    pipelineId: "synthetic",
    currentStageIndex,
    artifacts: [],
    projections: [],
    revision: 1,
    openedAt: "2026-05-30T00:00:00.000Z",
    updatedAt: "2026-05-30T00:00:00.000Z",
  };
}

function syntheticPipeline(stageCount: number): ReviewPipeline {
  return {
    pipelineId: "synthetic",
    organizationId: "synthetic",
    stages: Array.from({ length: stageCount }, (_, index) => ({
      id: `stage-${index}`,
      ownerLabel: "synthetic",
      authority: { kind: "hat", hatId: "synthetic" },
      gate: "tests_green",
      blocking: true,
    })),
  };
}

function skip(event: OrgEvent, reason: string, ambiguous: boolean): ConformanceSkip {
  return {
    eventId: event.id,
    kind: event.kind,
    subjectId: event.subjectId,
    reason,
    ambiguous,
  };
}

function countSkipReasons(skips: readonly ConformanceSkip[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const entry of skips) {
    counts[entry.reason] = (counts[entry.reason] ?? 0) + 1;
  }
  return counts;
}

function isChangeSetReviewContext(
  context: OrgEventTransitionContext | undefined,
): context is Extract<OrgEventTransitionContext, { kind: "change_set_review" }> {
  return context?.kind === "change_set_review";
}

function isDocumentLifecycleContext(
  context: OrgEventTransitionContext | undefined,
): context is Extract<OrgEventTransitionContext, { kind: "document_lifecycle" }> {
  return context?.kind === "document_lifecycle";
}

function isValidDocumentLifecycleContext(
  context: OrgEventTransitionContext | undefined,
): context is Extract<OrgEventTransitionContext, { kind: "document_lifecycle" }> {
  return isDocumentLifecycleContext(context) && typeof context.loadBearing === "boolean";
}

function isValidReviewCursor(context: Extract<OrgEventTransitionContext, { kind: "change_set_review" }>): boolean {
  return (
    Number.isInteger(context.currentStageIndex) &&
    Number.isInteger(context.stageCount) &&
    context.stageCount > 0 &&
    context.currentStageIndex >= 0 &&
    context.currentStageIndex < context.stageCount
  );
}

function unique<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

function isWorkItemState(value: string): value is WorkItemState {
  return Object.values(WorkItemState).includes(value as WorkItemState);
}

function isMemoryPhase(value: string): value is MemoryPhase {
  return Object.values(MemoryPhase).includes(value as MemoryPhase);
}

function isChangeSetPhase(value: string): value is ChangeSetPhase {
  return Object.values(ChangeSetPhase).includes(value as ChangeSetPhase);
}

function isDocLifecycleState(value: string): value is DocLifecycleState {
  return Object.values(DocLifecycleState).includes(value as DocLifecycleState);
}

function isGraphConfidence(value: string): value is GraphConfidence {
  return Object.values(GraphConfidence).includes(value as GraphConfidence);
}

function isHatBindingPhase(value: string): value is HatBindingPhase {
  return Object.values(HatBindingPhase).includes(value as HatBindingPhase);
}

function isPipelineStage(value: string): value is PipelineStage {
  return Object.values(PipelineStage).includes(value as PipelineStage);
}

function isWorkBatchState(value: string): value is WorkBatchState {
  return Object.values(WorkBatchState).includes(value as WorkBatchState);
}
