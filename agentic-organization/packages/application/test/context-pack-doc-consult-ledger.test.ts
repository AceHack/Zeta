import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { DocScopeKind, DocType, QualityGateKind, type QualityGateEvaluation } from "../../domain/src/index.ts";
import { QualityGateOutcome, StageOutcome } from "../../domain/src/index.ts";
import {
  ContextPackCurationStageKind,
  ContextPackFreshness,
  ContextPackItemKind,
  ContextPackBusinessValidationOutcome,
  ContextPackDocConsultOutcomeClass,
  ContextPackSourcePointerKind,
  ContextPackStatus,
  RunLifecyclePhase,
  RunScope,
  asZetaIdDecimal,
  contextPackDocConsultRecordsForSnapshot,
  contextPackDocConsultOutcomeClassFor,
  contextPackDocConsultOutcomeStampForBusinessValidation,
  contextPackDocConsultOutcomeStampForQualityGate,
  contextPackDocConsultOutcomeStampForLifecycleTransition,
  createContextPackSnapshotRecorder,
  type ContextPackDocConsultLedgerPort,
  type ContextPackDocConsultRecord,
  type ContextPackSnapshotRecord,
  type ContextReadout,
} from "../src/index.ts";

test("context pack doc consult ledger extracts one durable consult per shown doc unit", () => {
  const snapshot = snapshotRecord();

  const records = contextPackDocConsultRecordsForSnapshot(snapshot);

  equal(records.length, 1);
  const [record] = records;
  ok(record !== undefined);
  ok(record.docConsultId.startsWith("context_pack_doc_consult:"));
  equal(record.docConsultId.length, "context_pack_doc_consult:".length + 64);
  equal(record.contextPackId, "ctx-director-blocker");
  equal(record.runId, "42");
  equal(record.scope, RunScope.WorkItem);
  equal(record.organizationId, "org-lfg");
  equal(record.hatId, "engineering_director");
  equal(record.hatAssignmentId, "99");
  equal(record.agentId, "agent-addison");
  equal(record.projectId, "project-billing");
  equal(record.teamId, "team-platform");
  equal(record.workItemId, "work-123");
  equal(record.stageId, RunLifecyclePhase.Blocked);
  equal(record.docUnitId, "doc-billing-brd");
  equal(record.docType, DocType.Brd);
  equal(record.docScopeKind, DocScopeKind.Project);
  equal(record.docScopeId, "project-billing");
  equal(record.contentRef, "docs/projects/billing/brd.md#rules");
  equal(record.contentHash, "hash-billing-brd");
  equal(record.sourceId, "source-git");
  equal(record.docVersion, 7);
  equal(record.required, true);
  equal(record.freshness, ContextPackFreshness.Stale);
  deepEqual(record.contextItemIds, ["business-doc", "synthesis-briefing"]);
  deepEqual(record.sourceRefs, ["doc:doc-billing-brd", "synthesis:blocked"]);
  deepEqual(record.reasons, ["required_consult", "management_blocker", "ranked_context"]);
  deepEqual(record.trace, {
    traceId: "trace-context",
    correlationId: "corr-context",
    causationId: "cause-context",
  });
});

test("context pack doc consult ledger ignores snapshots without lifecycle phase", () => {
  const snapshot = snapshotRecord({ omitPhase: true });

  deepEqual(contextPackDocConsultRecordsForSnapshot(snapshot), []);
});

test("context pack doc consult ledger keeps doc-unit versions distinct even when content hash is unchanged", () => {
  const versionSeven = contextPackDocConsultRecordsForSnapshot(snapshotRecord({ docVersion: 7 }));
  const versionEight = contextPackDocConsultRecordsForSnapshot(snapshotRecord({ docVersion: 8 }));

  equal(versionSeven.length, 1);
  equal(versionEight.length, 1);
  ok(versionSeven[0] !== undefined);
  ok(versionEight[0] !== undefined);
  equal(versionSeven[0].contentHash, versionEight[0].contentHash);
  equal(versionSeven[0].docUnitId, versionEight[0].docUnitId);
  equal(versionSeven[0].docVersion, 7);
  equal(versionEight[0].docVersion, 8);
  ok(versionSeven[0].docConsultId !== versionEight[0].docConsultId);
});

test("context pack doc consult outcome classification maps known gates and review stages conservatively", () => {
  equal(contextPackDocConsultOutcomeClassFor(QualityGateOutcome.Approved), ContextPackDocConsultOutcomeClass.Success);
  equal(contextPackDocConsultOutcomeClassFor(QualityGateOutcome.Waived), ContextPackDocConsultOutcomeClass.Success);
  equal(contextPackDocConsultOutcomeClassFor(ContextPackBusinessValidationOutcome.Approved), ContextPackDocConsultOutcomeClass.Success);
  equal(contextPackDocConsultOutcomeClassFor(ContextPackBusinessValidationOutcome.Waived), ContextPackDocConsultOutcomeClass.Success);
  equal(contextPackDocConsultOutcomeClassFor(StageOutcome.Approve), ContextPackDocConsultOutcomeClass.Success);
  equal(contextPackDocConsultOutcomeClassFor(QualityGateOutcome.ChangesRequested), ContextPackDocConsultOutcomeClass.Failure);
  equal(contextPackDocConsultOutcomeClassFor(QualityGateOutcome.Rejected), ContextPackDocConsultOutcomeClass.Failure);
  equal(contextPackDocConsultOutcomeClassFor(ContextPackBusinessValidationOutcome.ChangesRequested), ContextPackDocConsultOutcomeClass.Failure);
  equal(contextPackDocConsultOutcomeClassFor(ContextPackBusinessValidationOutcome.Rejected), ContextPackDocConsultOutcomeClass.Failure);
  equal(contextPackDocConsultOutcomeClassFor(StageOutcome.RequestChanges), ContextPackDocConsultOutcomeClass.Failure);
  equal(contextPackDocConsultOutcomeClassFor(StageOutcome.Reject), ContextPackDocConsultOutcomeClass.Failure);
  equal(contextPackDocConsultOutcomeClassFor("unknown_outcome"), undefined);
});

test("context pack doc consult outcome stamp derives scope from quality gate evaluation", () => {
  deepEqual(contextPackDocConsultOutcomeStampForQualityGate(qualityGateEvaluation()), {
    organizationId: "org-lfg",
    agentId: "agent-qa",
    hatAssignmentId: "hat-qa",
    projectId: "project-billing",
    teamId: "team-platform",
    workItemId: "work-123",
    outcome: QualityGateOutcome.ChangesRequested,
    outcomeRef: "quality_gate:quality-gate-123",
    outcomeRecordedAt: "2026-06-02T13:00:00.000Z",
  });
});

test("context pack doc consult outcome stamp derives scope from observe lifecycle transitions", () => {
  deepEqual(contextPackDocConsultOutcomeStampForLifecycleTransition({
    organizationId: "org-lfg",
    projectId: "project-billing",
    teamId: "team-platform",
    workItemId: "work-123",
    actor: {
      agentId: "agent-reviewer",
      hatAssignmentId: "hat-reviewer",
    },
    workStateTransitionId: "work-state-transition-123",
    outcome: StageOutcome.RequestChanges,
    outcomeRecordedAt: "2026-06-02T14:00:00.000Z",
  }), {
    organizationId: "org-lfg",
    agentId: "agent-reviewer",
    hatAssignmentId: "hat-reviewer",
    projectId: "project-billing",
    teamId: "team-platform",
    workItemId: "work-123",
    outcome: StageOutcome.RequestChanges,
    outcomeRef: "work_state_transition:work-state-transition-123",
    outcomeRecordedAt: "2026-06-02T14:00:00.000Z",
  });
});

test("context pack doc consult outcome stamp derives scope from business validation decisions", () => {
  deepEqual(contextPackDocConsultOutcomeStampForBusinessValidation({
    organizationId: "org-lfg",
    projectId: "project-billing",
    teamId: "team-platform",
    workItemId: "work-123",
    actor: {
      agentId: "agent-product-owner",
      hatAssignmentId: "hat-product-owner",
    },
    businessValidationId: "decision-record-123",
    outcome: ContextPackBusinessValidationOutcome.Approved,
    outcomeRecordedAt: "2026-06-02T15:00:00.000Z",
  }), {
    organizationId: "org-lfg",
    agentId: "agent-product-owner",
    hatAssignmentId: "hat-product-owner",
    projectId: "project-billing",
    teamId: "team-platform",
    workItemId: "work-123",
    outcome: ContextPackBusinessValidationOutcome.Approved,
    outcomeRef: "business_validation:decision-record-123",
    outcomeRecordedAt: "2026-06-02T15:00:00.000Z",
  });
});

test("context pack snapshot recorder records the snapshot and then records consulted documents", async () => {
  const snapshots: ContextPackSnapshotRecord[] = [];
  const consults: ContextPackDocConsultRecord[][] = [];
  const recorder = createContextPackSnapshotRecorder({
    snapshots: {
      record: async (snapshot) => {
        snapshots.push(snapshot);
      },
    },
    docConsultLedger: {
      recordMany: async (records) => {
        consults.push([...records]);
      },
    } satisfies ContextPackDocConsultLedgerPort,
  });
  const snapshot = snapshotRecord();

  await recorder(snapshot);

  equal(snapshots.length, 1);
  equal(snapshots[0], snapshot);
  equal(consults.length, 1);
  equal(consults[0]?.length, 1);
  equal(consults[0]?.[0]?.docUnitId, "doc-billing-brd");
});

test("context pack snapshot recorder can record snapshot and consults through a transaction-scoped port", async () => {
  const rootSnapshots: ContextPackSnapshotRecord[] = [];
  const transactionSnapshots: ContextPackSnapshotRecord[] = [];
  const transactionConsults: ContextPackDocConsultRecord[][] = [];
  const recorder = createContextPackSnapshotRecorder({
    snapshots: {
      record: async (snapshot) => {
        rootSnapshots.push(snapshot);
      },
    },
    transaction: {
      run: async (operation) => {
        await operation({
          snapshots: {
            record: async (snapshot) => {
              transactionSnapshots.push(snapshot);
            },
          },
          docConsultLedger: {
            recordMany: async (records) => {
              transactionConsults.push([...records]);
            },
          },
        });
      },
    },
  });

  await recorder(snapshotRecord());

  equal(rootSnapshots.length, 0);
  equal(transactionSnapshots.length, 1);
  equal(transactionConsults.length, 1);
  equal(transactionConsults[0]?.[0]?.docUnitId, "doc-billing-brd");
});

function snapshotRecord(
  overrides: {
    phase?: RunLifecyclePhase | undefined;
    omitPhase?: boolean | undefined;
    docVersion?: number | undefined;
  } = {},
): ContextPackSnapshotRecord {
  return {
    context: contextReadout({ docVersion: overrides.docVersion }),
    ...(overrides.omitPhase === true ? {} : { phase: overrides.phase ?? RunLifecyclePhase.Blocked }),
    recordedAt: "2026-06-02T12:00:00.000Z",
    trace: {
      traceId: "trace-context",
      correlationId: "corr-context",
      causationId: "cause-context",
    },
  };
}

function qualityGateEvaluation(): QualityGateEvaluation {
  return {
    qualityGateEvaluationId: "quality-gate-123",
    organizationId: "org-lfg",
    projectId: "project-billing",
    teamId: "team-platform",
    workItemId: "work-123",
    discussionAnchorId: "discussion-gate",
    gateKind: QualityGateKind.RuntimeValidation,
    outcome: QualityGateOutcome.ChangesRequested,
    summary: "Runtime validation reproduced the defect.",
    evaluatedArtifactIds: ["artifact://qa/report"],
    businessRuleResults: [],
    evaluatedAt: "2026-06-02T13:00:00.000Z",
    evaluatedBy: {
      agentId: "agent-qa",
      hatAssignmentId: "hat-qa",
    },
    metadata: {
      updatedAt: "2026-06-02T13:00:00.000Z",
      version: 1,
      correlationId: "corr-gate",
      causationId: "cause-gate",
      traceId: "trace-gate",
    },
  };
}

function contextReadout(input: { docVersion?: number | undefined } = {}): ContextReadout {
  const docPointer = {
    kind: ContextPackSourcePointerKind.DocUnit,
    docUnitId: "doc-billing-brd",
    organizationId: "org-lfg",
    docType: DocType.Brd,
    scopeKind: DocScopeKind.Project,
    scopeId: "project-billing",
    contentRef: "docs/projects/billing/brd.md#rules",
    contentHash: "hash-billing-brd",
    sourceId: "source-git",
    version: input.docVersion ?? 7,
  } as const;

  return {
    status: ContextPackStatus.Current,
    pack: {
      id: "ctx-director-blocker",
      runId: asZetaIdDecimal("42"),
      organizationId: "org-lfg",
      scope: RunScope.WorkItem,
      hatAssignmentId: asZetaIdDecimal("99"),
      hatId: "engineering_director",
      agentId: "agent-addison",
      projectId: "project-billing",
      teamId: "team-platform",
      workItemId: "work-123",
      generatedAt: "2026-06-02T12:00:00.000Z",
      freshnessDeadline: "2026-06-02T12:05:00.000Z",
      sourceGraphVersion: "graph:v1",
      policyVersion: "policy:v1",
      tokenBudget: 4096,
      curationTrace: [{
        stage: ContextPackCurationStageKind.RequiredConsult,
        summary: "Business rules were required for this blocked director context.",
        evidenceRefs: ["doc:doc-billing-brd"],
      }],
      items: [{
        id: "business-doc",
        kind: ContextPackItemKind.BusinessDocument,
        title: "Billing BRD",
        summary: "Customer billing rules.",
        sourceRef: "doc:doc-billing-brd",
        required: true,
        freshness: ContextPackFreshness.Current,
        confidence: 1,
        reasons: ["required_consult", "management_blocker"],
        citationRefs: ["doc:doc-billing-brd"],
        sourcePointers: [docPointer],
      }, {
        id: "synthesis-briefing",
        kind: ContextPackItemKind.SynthesisBriefing,
        title: "Blocked-context synthesis",
        summary: "The blocker depends on the billing BRD.",
        sourceRef: "synthesis:blocked",
        required: false,
        freshness: ContextPackFreshness.Stale,
        confidence: 0.8,
        reasons: ["ranked_context"],
        citationRefs: ["business-doc"],
        sourcePointers: [docPointer],
      }, {
        id: "memory-note",
        kind: ContextPackItemKind.MemoryPointer,
        title: "Prior memory",
        summary: "Advisory memory, not a document consult.",
        sourceRef: "memory:1",
        required: false,
        freshness: ContextPackFreshness.Current,
        confidence: 0.5,
        reasons: ["memory"],
        sourcePointers: [{
          kind: ContextPackSourcePointerKind.HindsightMemory,
          providerId: "hindsight",
          memoryId: "memory-1",
          advisory: true,
        }],
      }],
      omittedItemsWithReason: [],
      contradictions: [],
      staleInputs: [],
      lifecycleBlockers: [],
    },
    requiredItems: [],
    optionalItems: [],
    omittedItemsWithReason: [],
    contradictions: [],
    staleInputs: [],
    lifecycleBlockers: [],
    uncertainty: {
      signalCount: 0,
      highSeverityCount: 0,
      mediumSeverityCount: 0,
      lowSeverityCount: 0,
      groups: [],
    },
    drillTargetGroups: [],
    summary: {
      requiredItemCount: 1,
      optionalItemCount: 2,
      omissionCount: 0,
      contradictionCount: 0,
      staleInputCount: 0,
      lifecycleBlockerCount: 0,
      uncertaintySignalCount: 0,
    },
  };
}
