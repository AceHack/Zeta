import {
  ChangeSetPhase,
  DocLifecycleState,
  GraphConfidence,
  MemoryPhase,
  OrgEventKind,
  WorkItemState,
  baseLegalNextStates,
  legalChangeSetTransitions,
  legalConfidencePromotions,
  legalDocTransitions,
  legalMemoryTransitions,
  type ChangeSet,
  type OrgEvent,
  type ReviewPipeline,
} from "../../domain/src/index.ts";

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
};

export type ConformanceReport = {
  checked: number;
  conformant: number;
  nonconformant: number;
  skipped: number;
  violations: readonly ConformanceViolation[];
  skips: readonly ConformanceSkip[];
};

type TransitionCheck =
  | { kind: "checked"; legalToStates: readonly string[]; reason: string }
  | { kind: "skipped"; reason: string };

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

export function replayLedger(events: readonly OrgEvent[]): ConformanceReport {
  let checked = 0;
  let conformant = 0;
  const violations: ConformanceViolation[] = [];
  const skips: ConformanceSkip[] = [];

  for (const event of events) {
    const check = classifyTransition(event);
    if (check.kind === "skipped") {
      skips.push(skip(event, check.reason));
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

  return {
    checked,
    conformant,
    nonconformant: violations.length,
    skipped: skips.length,
    violations,
    skips,
  };
}

function classifyTransition(event: OrgEvent): TransitionCheck {
  if (!isReplayableTransitionKind(event.kind)) {
    return { kind: "skipped", reason: "event kind is not a replayable state transition" };
  }

  if (event.fromState === undefined || event.toState === undefined) {
    return { kind: "skipped", reason: "event does not carry from/to state" };
  }

  if (event.fromState === event.toState) {
    return { kind: "skipped", reason: "event does not change state" };
  }

  if (event.kind === OrgEventKind.WorkItemTransition) {
    if (!isWorkItemState(event.fromState) || !isWorkItemState(event.toState)) {
      return { kind: "skipped", reason: "event states do not name a known work-item transition" };
    }
    return {
      kind: "checked",
      legalToStates: baseLegalNextStates(event.fromState),
      reason: "illegal work item transition",
    };
  }

  if (MemoryTransitionKinds.has(event.kind)) {
    if (!isMemoryPhase(event.fromState) || !isMemoryPhase(event.toState)) {
      return { kind: "skipped", reason: "event states do not name a known memory phase transition" };
    }
    return {
      kind: "checked",
      legalToStates: legalMemoryTransitions(event.fromState).map((transition) => transition.to),
      reason: "illegal memory phase transition",
    };
  }

  if (ChangeTransitionKinds.has(event.kind)) {
    if (!isChangeSetPhase(event.fromState) || !isChangeSetPhase(event.toState)) {
      return { kind: "skipped", reason: "event states do not name a known change-set phase transition" };
    }
    if (event.fromState === ChangeSetPhase.InReview && event.toState === ChangeSetPhase.Approved) {
      return { kind: "skipped", reason: "change-set approval requires pipeline cursor replay context" };
    }
    return {
      kind: "checked",
      legalToStates: legalChangeTargets(event.fromState, event.toState),
      reason: "illegal change-set phase transition",
    };
  }

  if (DocTransitionKinds.has(event.kind)) {
    if (!isDocLifecycleState(event.fromState) || !isDocLifecycleState(event.toState)) {
      return { kind: "skipped", reason: "event states do not name a known document lifecycle transition" };
    }
    if (event.fromState === DocLifecycleState.Draft && event.toState === DocLifecycleState.Active) {
      return { kind: "skipped", reason: "document draft→active requires load-bearing replay context" };
    }
    return {
      kind: "checked",
      legalToStates: unique([...legalDocTransitions(event.fromState, true), ...legalDocTransitions(event.fromState, false)]),
      reason: "illegal document lifecycle transition",
    };
  }

  if (GraphTransitionKinds.has(event.kind)) {
    if (!isGraphConfidence(event.fromState) || !isGraphConfidence(event.toState)) {
      return { kind: "skipped", reason: "event states do not name a known graph confidence transition" };
    }
    return {
      kind: "checked",
      legalToStates: legalConfidencePromotions(event.fromState),
      reason: "illegal graph confidence transition",
    };
  }
  return { kind: "skipped", reason: "event kind is not a replayable state transition" };
}

function isReplayableTransitionKind(kind: OrgEventKind): boolean {
  return (
    kind === OrgEventKind.WorkItemTransition ||
    MemoryTransitionKinds.has(kind) ||
    ChangeTransitionKinds.has(kind) ||
    DocTransitionKinds.has(kind) ||
    GraphTransitionKinds.has(kind)
  );
}

function legalChangeTargets(from: ChangeSetPhase, to: ChangeSetPhase): readonly ChangeSetPhase[] {
  if (from === ChangeSetPhase.InReview && to === ChangeSetPhase.Approved) {
    return [];
  }

  return legalChangeSetTransitions(syntheticChangeSet(from, 0), syntheticPipeline(2));
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

function skip(event: OrgEvent, reason: string): ConformanceSkip {
  return {
    eventId: event.id,
    kind: event.kind,
    subjectId: event.subjectId,
    reason,
  };
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
