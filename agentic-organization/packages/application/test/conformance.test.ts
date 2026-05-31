import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import { replayLedger, unclassifiedOrgEventKinds } from "../src/conformance.ts";
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
  type OrgEvent,
  type OrgEventTransitionContext,
} from "../../domain/src/index.ts";
import { PipelineStage } from "../src/pipeline.ts";

function event(input: {
  id: string;
  kind: OrgEventKind;
  fromState?: string;
  toState?: string;
  subjectId?: string;
  transitionContext?: OrgEventTransitionContext;
}): OrgEvent {
  return {
    id: input.id,
    kind: input.kind,
    occurredAt: "2026-05-30T12:00:00.000Z",
    organizationId: "org-1",
    subjectId: input.subjectId ?? "subject-1",
    decision: "test event",
    supervisorChain: [],
    evidenceRefs: [],
    correlationId: "corr-1",
    causationId: "cause-1",
    traceId: "trace-1",
    ...(input.fromState !== undefined ? { fromState: input.fromState } : {}),
    ...(input.toState !== undefined ? { toState: input.toState } : {}),
    ...(input.transitionContext !== undefined ? { transitionContext: input.transitionContext } : {}),
  };
}

test("replayLedger accepts legal transitions across the replayable kernels", () => {
  const report = replayLedger([
    event({ id: "evt-work", kind: OrgEventKind.WorkItemTransition, fromState: WorkItemState.Ready, toState: WorkItemState.InProgress }),
    event({ id: "evt-memory", kind: OrgEventKind.MemoryPhaseTransition, fromState: MemoryPhase.Active, toState: MemoryPhase.Stale }),
    event({ id: "evt-change", kind: OrgEventKind.ChangeSetApplied, fromState: ChangeSetPhase.Approved, toState: ChangeSetPhase.Applied }),
    event({ id: "evt-doc", kind: OrgEventKind.DocLifecycleTransition, fromState: DocLifecycleState.Draft, toState: DocLifecycleState.InReview }),
    event({ id: "evt-graph", kind: OrgEventKind.GraphConfidencePromoted, fromState: GraphConfidence.Verified, toState: GraphConfidence.Canonical }),
  ]);

  equal(report.checked, 5);
  equal(report.conformant, 5);
  equal(report.nonconformant, 0);
  equal(report.skipped, 0);
  equal(report.skippedAmbiguous, 0);
  equal(report.coverageRatio, 1);
  deepEqual(report.violations, []);
});

test("replayLedger reports illegal transitions with the legal target set", () => {
  const report = replayLedger([
    event({ id: "evt-bypass", kind: OrgEventKind.WorkItemTransition, fromState: WorkItemState.Created, toState: WorkItemState.Done, subjectId: "work-1" }),
  ]);

  equal(report.checked, 1);
  equal(report.conformant, 0);
  equal(report.nonconformant, 1);
  equal(report.violations.length, 1);
  deepEqual(report.violations[0], {
    eventId: "evt-bypass",
    kind: OrgEventKind.WorkItemTransition,
    subjectId: "work-1",
    fromState: WorkItemState.Created,
    toState: WorkItemState.Done,
    legalToStates: [WorkItemState.Intake],
    reason: "illegal work item transition",
  });
});

test("replayLedger skips non-transition and non-state events without failing the report", () => {
  const report = replayLedger([
    event({ id: "evt-intake", kind: OrgEventKind.IntakeReceived }),
    event({ id: "evt-cycle", kind: OrgEventKind.MemoryMaintenanceCycle }),
    event({ id: "evt-stage", kind: OrgEventKind.ReviewStageAdvanced, fromState: "code-review", toState: "qa" }),
    event({ id: "evt-doc-conflict", kind: OrgEventKind.DocLifecycleTransition, fromState: DocLifecycleState.Active, toState: DocLifecycleState.Active }),
  ]);

  equal(report.checked, 0);
  equal(report.conformant, 0);
  equal(report.nonconformant, 0);
  equal(report.skipped, 4);
  equal(report.skippedAmbiguous, 0);
  deepEqual(report.skips.map((s) => s.reason), [
    "event kind is explicitly classified as non-transition",
    "event kind is explicitly classified as non-transition",
    "event kind is explicitly classified as non-transition",
    "event does not change state",
  ]);
});

test("replayLedger does not count context-sensitive transitions as conformant without replay context", () => {
  const report = replayLedger([
    event({ id: "evt-approved", kind: OrgEventKind.ChangeSetApproved, fromState: ChangeSetPhase.InReview, toState: ChangeSetPhase.Approved }),
    event({ id: "evt-doc-active", kind: OrgEventKind.DocLifecycleTransition, fromState: DocLifecycleState.Draft, toState: DocLifecycleState.Active }),
  ]);

  equal(report.checked, 0);
  equal(report.conformant, 0);
  equal(report.nonconformant, 0);
  equal(report.skipped, 2);
  equal(report.skippedAmbiguous, 2);
  equal(report.coverageRatio, 0);
  deepEqual(report.skips.map((s) => s.reason), [
    "change-set approval requires pipeline cursor replay context",
    "document draft->active requires load-bearing replay context",
  ]);
});

test("replayLedger accepts legal legacy transition kernels", () => {
  const report = replayLedger(
    [
      event({ id: "evt-hat", kind: OrgEventKind.HatBindingTransition, fromState: HatBindingPhase.Warmup, toState: HatBindingPhase.Active }),
      event({ id: "evt-schedule", kind: OrgEventKind.WorkScheduleBlockTransition, fromState: ScheduleBlockState.Scheduled, toState: ScheduleBlockState.Active }),
      event({
        id: "evt-pipeline",
        kind: OrgEventKind.PipelineStageTransition,
        fromState: PipelineStage.AwaitingCustomerRfpReview,
        toState: PipelineStage.AwaitingBrdApproval,
      }),
      event({ id: "evt-batch", kind: OrgEventKind.WorkBatchTransition, fromState: WorkBatchState.Active, toState: WorkBatchState.CompletionCheck }),
    ],
    { maxSkippedAmbiguous: 0 },
  );

  equal(report.checked, 4);
  equal(report.conformant, 4);
  equal(report.skippedAmbiguous, 0);
  equal(report.ratchetViolated, false);
});

test("replayLedger reports illegal legacy transition kernel targets", () => {
  const report = replayLedger([
    event({ id: "evt-hat", kind: OrgEventKind.HatBindingTransition, fromState: HatBindingPhase.Expired, toState: HatBindingPhase.Active, subjectId: "binding-1" }),
    event({
      id: "evt-pipeline",
      kind: OrgEventKind.PipelineStageTransition,
      fromState: PipelineStage.AwaitingBrdApproval,
      toState: PipelineStage.AwaitingReleaseReadiness,
      subjectId: "work-1",
    }),
    event({ id: "evt-batch", kind: OrgEventKind.WorkBatchTransition, fromState: WorkBatchState.Created, toState: WorkBatchState.Done, subjectId: "batch-1" }),
  ]);

  equal(report.checked, 3);
  equal(report.conformant, 0);
  equal(report.nonconformant, 3);
  deepEqual(report.violations.map((v) => v.reason), [
    "illegal hat binding phase transition",
    "illegal pipeline stage transition",
    "illegal work batch transition",
  ]);
});

test("replayLedger treats initial hat binding as non-ambiguous lifecycle initialization", () => {
  const report = replayLedger(
    [
      event({
        id: "evt-hat-init",
        kind: OrgEventKind.HatBindingTransition,
        toState: HatBindingPhase.Warmup,
        subjectId: "binding-1",
      }),
    ],
    { maxSkippedAmbiguous: 0 },
  );

  equal(report.checked, 0);
  equal(report.skipped, 1);
  equal(report.skippedAmbiguous, 0);
  equal(report.ratchetViolated, false);
  equal(report.skips[0]?.reason, "hat binding initialization is a legal non-ambiguous transition");
});

test("replayLedger treats malformed legacy transition kernel states as ambiguous", () => {
  const report = replayLedger(
    [
      event({ id: "evt-hat", kind: OrgEventKind.HatBindingTransition, fromState: "proposed", toState: "activated" }),
      event({ id: "evt-schedule", kind: OrgEventKind.WorkScheduleBlockTransition, fromState: "planned", toState: "running" }),
      event({ id: "evt-pipeline", kind: OrgEventKind.PipelineStageTransition, fromState: "draft", toState: "review" }),
      event({ id: "evt-batch", kind: OrgEventKind.WorkBatchTransition, fromState: "queued", toState: "running" }),
    ],
    { maxSkippedAmbiguous: 0 },
  );

  equal(report.skipped, 4);
  equal(report.skippedAmbiguous, 4);
  equal(report.ratchetViolated, true);
  deepEqual(report.skips.map((s) => s.reason), [
    "event states do not name a known hat binding phase transition",
    "event states do not name a known schedule block state transition",
    "event states do not name a known pipeline stage transition",
    "event states do not name a known work batch transition",
  ]);
});

test("replayLedger rejects illegal schedule block lifecycle transitions", () => {
  const report = replayLedger([
    event({
      id: "evt-schedule-backwards",
      kind: OrgEventKind.WorkScheduleBlockTransition,
      fromState: ScheduleBlockState.Completed,
      toState: ScheduleBlockState.Active,
      subjectId: "schedule-block-1",
    }),
  ]);

  equal(report.checked, 1);
  equal(report.conformant, 0);
  equal(report.nonconformant, 1);
  deepEqual(report.violations[0], {
    eventId: "evt-schedule-backwards",
    kind: OrgEventKind.WorkScheduleBlockTransition,
    subjectId: "schedule-block-1",
    fromState: ScheduleBlockState.Completed,
    toState: ScheduleBlockState.Active,
    legalToStates: [],
    reason: "illegal schedule block state transition",
  });
});

test("replayLedger treats initial schedule block as non-ambiguous lifecycle initialization", () => {
  const report = replayLedger(
    [
      event({
        id: "evt-schedule-init",
        kind: OrgEventKind.WorkScheduleBlockTransition,
        toState: ScheduleBlockState.Scheduled,
        subjectId: "schedule-block-1",
      }),
    ],
    { maxSkippedAmbiguous: 0 },
  );

  equal(report.checked, 0);
  equal(report.skipped, 1);
  equal(report.skippedAmbiguous, 0);
  equal(report.ratchetViolated, false);
  equal(report.skips[0]?.reason, "schedule block initialization is a legal non-ambiguous transition");
});

test("replayLedger uses transition context envelopes for context-sensitive transitions", () => {
  const report = replayLedger([
    event({
      id: "evt-approved",
      kind: OrgEventKind.ChangeSetApproved,
      fromState: ChangeSetPhase.InReview,
      toState: ChangeSetPhase.Approved,
      transitionContext: { kind: "change_set_review", currentStageIndex: 1, stageCount: 2 },
    }),
    event({
      id: "evt-doc-active",
      kind: OrgEventKind.DocLifecycleTransition,
      fromState: DocLifecycleState.Draft,
      toState: DocLifecycleState.Active,
      transitionContext: { kind: "document_lifecycle", loadBearing: false },
    }),
  ]);

  equal(report.checked, 2);
  equal(report.conformant, 2);
  equal(report.nonconformant, 0);
  equal(report.skipped, 0);
  equal(report.skippedAmbiguous, 0);
  equal(report.coverageRatio, 1);
});

test("replayLedger treats malformed document transition context as ambiguous", () => {
  const report = replayLedger([
    event({
      id: "evt-doc-active",
      kind: OrgEventKind.DocLifecycleTransition,
      fromState: DocLifecycleState.Draft,
      toState: DocLifecycleState.Active,
      transitionContext: { kind: "document_lifecycle" } as OrgEventTransitionContext,
    }),
  ]);

  equal(report.checked, 0);
  equal(report.skippedAmbiguous, 1);
  deepEqual(report.skips[0]?.reason, "document draft->active requires load-bearing replay context");
});

test("replayLedger reports load-bearing direct document activation as illegal when context is present", () => {
  const report = replayLedger([
    event({
      id: "evt-doc-active",
      kind: OrgEventKind.DocLifecycleTransition,
      fromState: DocLifecycleState.Draft,
      toState: DocLifecycleState.Active,
      transitionContext: { kind: "document_lifecycle", loadBearing: true },
    }),
  ]);

  equal(report.checked, 1);
  equal(report.nonconformant, 1);
  deepEqual(report.violations[0]?.legalToStates, [DocLifecycleState.InReview, DocLifecycleState.Archived]);
});

test("replayLedger ratchets ambiguous transition skips against a configured budget", () => {
  const report = replayLedger(
    [
      event({
        id: "evt-approved",
        kind: OrgEventKind.ChangeSetApproved,
        fromState: ChangeSetPhase.InReview,
        toState: ChangeSetPhase.Approved,
      }),
    ],
    { maxSkippedAmbiguous: 0 },
  );

  equal(report.checked, 0);
  equal(report.skippedAmbiguous, 1);
  equal(report.ratchetViolated, true);
  deepEqual(report.ratchetViolation, { maxSkippedAmbiguous: 0, skippedAmbiguous: 1 });
  deepEqual(report.skipReasonCounts, {
    "change-set approval requires pipeline cursor replay context": 1,
  });
});

test("every OrgEventKind is classified as replayable or explicitly non-transition", () => {
  deepEqual(unclassifiedOrgEventKinds(), []);
});
