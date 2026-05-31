import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import { replayLedger } from "../src/conformance.ts";
import { ChangeSetPhase, DocLifecycleState, GraphConfidence, MemoryPhase, OrgEventKind, WorkItemState, type OrgEvent } from "../../domain/src/index.ts";

function event(input: {
  id: string;
  kind: OrgEventKind;
  fromState?: string;
  toState?: string;
  subjectId?: string;
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
  deepEqual(report.skips.map((s) => s.reason), [
    "event kind is not a replayable state transition",
    "event kind is not a replayable state transition",
    "event kind is not a replayable state transition",
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
  deepEqual(report.skips.map((s) => s.reason), [
    "change-set approval requires pipeline cursor replay context",
    "document draft→active requires load-bearing replay context",
  ]);
});
