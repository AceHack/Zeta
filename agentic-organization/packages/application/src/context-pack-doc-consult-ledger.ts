import { createHash } from "node:crypto";

import type {
  DocScopeKind,
  DocType,
} from "../../domain/src/index.ts";
import {
  type AgenticActor,
  QualityGateOutcome as QualityGateOutcomeValue,
  StageOutcome as StageOutcomeValue,
  type QualityGateEvaluation,
} from "../../domain/src/index.ts";
import {
  ContextPackFreshness,
  ContextPackSourcePointerKind,
  type ContextPackItem,
  type ContextPackSourcePointer,
  type RunLifecyclePhase,
  type RunScope,
  type RunTrace,
} from "./observe.ts";
import type { ContextPackSnapshotRecord } from "./context-pack-snapshot-store.ts";

export type ContextPackDocConsultRecord = {
  docConsultId: string;
  organizationId: string;
  docUnitId: string;
  stageId: RunLifecyclePhase;
  consultedAt: string;
  contextPackId: string;
  runId: string;
  scope: RunScope;
  hatId: string;
  hatAssignmentId: string;
  contextItemIds: readonly string[];
  sourceRefs: readonly string[];
  required: boolean;
  freshness: ContextPackFreshness;
  reasons: readonly string[];
  contentRef: string;
  contentHash: string;
  sourceId: string;
  docVersion: number;
  trace: RunTrace;
  workItemId?: string | undefined;
  agentId?: string | undefined;
  projectId?: string | undefined;
  teamId?: string | undefined;
  docType?: DocType | undefined;
  docScopeKind?: DocScopeKind | undefined;
  docScopeId?: string | undefined;
  outcome?: string | undefined;
};

export type ContextPackDocConsultLedgerPort = {
  recordMany: (records: readonly ContextPackDocConsultRecord[]) => Promise<void>;
};

export const ContextPackDocConsultOutcomeClass = {
  Success: "success",
  Failure: "failure",
} as const;

export type ContextPackDocConsultOutcomeClass =
  (typeof ContextPackDocConsultOutcomeClass)[keyof typeof ContextPackDocConsultOutcomeClass];

export const ContextPackBusinessValidationOutcome = {
  Approved: QualityGateOutcomeValue.Approved,
  ChangesRequested: QualityGateOutcomeValue.ChangesRequested,
  Rejected: QualityGateOutcomeValue.Rejected,
  Waived: QualityGateOutcomeValue.Waived,
} as const;

export type ContextPackBusinessValidationOutcome =
  (typeof ContextPackBusinessValidationOutcome)[keyof typeof ContextPackBusinessValidationOutcome];

export type ContextPackDocConsultOutcomeCounts = {
  success: number;
  failure: number;
};

export const ContextPackDocConsultOutcomeAggregationScope = {
  ExactWorkItem: "exact_work_item",
  SimilarWork: "similar_work",
} as const;

export type ContextPackDocConsultOutcomeAggregationScope =
  (typeof ContextPackDocConsultOutcomeAggregationScope)[keyof typeof ContextPackDocConsultOutcomeAggregationScope];

export type ContextPackDocConsultOutcomeLookupBase = {
  organizationId: string;
  hatId?: string | undefined;
  stageId?: string | undefined;
  projectId?: string | undefined;
  teamId?: string | undefined;
};

export type ContextPackDocConsultOutcomeLookup =
  | (ContextPackDocConsultOutcomeLookupBase & {
      aggregationScope: typeof ContextPackDocConsultOutcomeAggregationScope.ExactWorkItem;
      workItemId: string;
    })
  | (ContextPackDocConsultOutcomeLookupBase & {
      aggregationScope?: typeof ContextPackDocConsultOutcomeAggregationScope.SimilarWork | undefined;
      workItemId?: string | undefined;
    });

export type ContextPackDocConsultOutcomeReaderPort = {
  loadOutcomeCounts: (
    lookup: ContextPackDocConsultOutcomeLookup,
  ) => Promise<ReadonlyMap<string, ContextPackDocConsultOutcomeCounts>>;
};

export type ContextPackDocConsultOutcomeStamp = {
  organizationId: string;
  agentId: string;
  hatAssignmentId: string;
  outcome: string;
  outcomeRef: string;
  outcomeRecordedAt: string;
  workItemId: string;
  projectId?: string | undefined;
  teamId?: string | undefined;
};

export type ContextPackDocConsultOutcomeStampResult = {
  stampedCount: number;
};

export type ContextPackDocConsultOutcomeWriterPort = {
  stampOutcome: (
    stamp: ContextPackDocConsultOutcomeStamp,
  ) => Promise<ContextPackDocConsultOutcomeStampResult>;
};

export const ContextPackDocConsultOutcomeRefPrefix = {
  BusinessValidation: "business_validation",
  QualityGate: "quality_gate",
  WorkStateTransition: "work_state_transition",
} as const;

export type ContextPackDocConsultOutcomeRefPrefix =
  (typeof ContextPackDocConsultOutcomeRefPrefix)[keyof typeof ContextPackDocConsultOutcomeRefPrefix];

export type ContextPackSnapshotRecorderPorts = {
  snapshots: { record: (snapshot: ContextPackSnapshotRecord) => Promise<void> };
  docConsultLedger?: ContextPackDocConsultLedgerPort | undefined;
};

export type ContextPackSnapshotRecorderTransactionPort = {
  run: (operation: (ports: ContextPackSnapshotRecorderPorts) => Promise<void>) => Promise<void>;
};

export function contextPackDocConsultOutcomeClassFor(
  outcome: string,
): ContextPackDocConsultOutcomeClass | undefined {
  if (SUCCESSFUL_CONTEXT_PACK_DOC_CONSULT_OUTCOMES.has(outcome)) {
    return ContextPackDocConsultOutcomeClass.Success;
  }
  if (FAILED_CONTEXT_PACK_DOC_CONSULT_OUTCOMES.has(outcome)) {
    return ContextPackDocConsultOutcomeClass.Failure;
  }
  return undefined;
}

export function isContextPackBusinessValidationOutcome(
  outcome: unknown,
): outcome is ContextPackBusinessValidationOutcome {
  return (
    typeof outcome === "string" &&
    CONTEXT_PACK_BUSINESS_VALIDATION_OUTCOMES.has(outcome as ContextPackBusinessValidationOutcome)
  );
}

export function contextPackDocConsultOutcomeStampForQualityGate(
  evaluation: QualityGateEvaluation,
): ContextPackDocConsultOutcomeStamp {
  return {
    organizationId: evaluation.organizationId,
    agentId: evaluation.evaluatedBy.agentId,
    hatAssignmentId: evaluation.evaluatedBy.hatAssignmentId,
    ...(evaluation.projectId === undefined ? {} : { projectId: evaluation.projectId }),
    ...(evaluation.teamId === undefined ? {} : { teamId: evaluation.teamId }),
    workItemId: evaluation.workItemId,
    outcome: evaluation.outcome,
    outcomeRef: `${ContextPackDocConsultOutcomeRefPrefix.QualityGate}:${evaluation.qualityGateEvaluationId}`,
    outcomeRecordedAt: evaluation.evaluatedAt,
  };
}

export type ContextPackDocConsultLifecycleOutcomeInput = {
  organizationId: string;
  actor: AgenticActor;
  workItemId: string;
  workStateTransitionId: string;
  outcome: string;
  outcomeRecordedAt: string;
  projectId?: string | undefined;
  teamId?: string | undefined;
};

export function contextPackDocConsultOutcomeStampForLifecycleTransition(
  input: ContextPackDocConsultLifecycleOutcomeInput,
): ContextPackDocConsultOutcomeStamp {
  return {
    organizationId: input.organizationId,
    agentId: input.actor.agentId,
    hatAssignmentId: input.actor.hatAssignmentId,
    ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
    ...(input.teamId === undefined ? {} : { teamId: input.teamId }),
    workItemId: input.workItemId,
    outcome: input.outcome,
    outcomeRef: `${ContextPackDocConsultOutcomeRefPrefix.WorkStateTransition}:${input.workStateTransitionId}`,
    outcomeRecordedAt: input.outcomeRecordedAt,
  };
}

export type ContextPackDocConsultBusinessValidationOutcomeInput = {
  organizationId: string;
  actor: AgenticActor;
  workItemId: string;
  businessValidationId: string;
  outcome: ContextPackBusinessValidationOutcome;
  outcomeRecordedAt: string;
  projectId?: string | undefined;
  teamId?: string | undefined;
};

export function contextPackDocConsultOutcomeStampForBusinessValidation(
  input: ContextPackDocConsultBusinessValidationOutcomeInput,
): ContextPackDocConsultOutcomeStamp {
  return {
    organizationId: input.organizationId,
    agentId: input.actor.agentId,
    hatAssignmentId: input.actor.hatAssignmentId,
    ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
    ...(input.teamId === undefined ? {} : { teamId: input.teamId }),
    workItemId: input.workItemId,
    outcome: input.outcome,
    outcomeRef: `${ContextPackDocConsultOutcomeRefPrefix.BusinessValidation}:${input.businessValidationId}`,
    outcomeRecordedAt: input.outcomeRecordedAt,
  };
}

export function contextPackDocConsultRecordsForSnapshot(
  snapshot: ContextPackSnapshotRecord,
): readonly ContextPackDocConsultRecord[] {
  const pack = snapshot.context.pack;
  const organizationId = pack.organizationId;
  const stageId = snapshot.phase;
  if (organizationId === undefined || stageId === undefined) return [];

  const recordsByKey = new Map<string, MutableContextPackDocConsultRecord>();
  for (const item of pack.items) {
    for (const pointer of docUnitPointersFor(item)) {
      const key = consultKey(pack.id, pointer);
      const existing = recordsByKey.get(key);
      if (existing === undefined) {
        recordsByKey.set(key, {
          docConsultId: key,
          organizationId,
          docUnitId: pointer.docUnitId,
          stageId,
          consultedAt: snapshot.recordedAt,
          contextPackId: pack.id,
          runId: String(pack.runId),
          scope: pack.scope,
          hatId: pack.hatId,
          hatAssignmentId: String(pack.hatAssignmentId),
          contextItemIds: [item.id],
          sourceRefs: [item.sourceRef],
          required: item.required,
          freshness: item.freshness,
          reasons: [...item.reasons],
          contentRef: pointer.contentRef,
          contentHash: pointer.contentHash,
          sourceId: pointer.sourceId,
          docVersion: pointer.version,
          trace: snapshot.trace,
          ...(pack.workItemId === undefined ? {} : { workItemId: pack.workItemId }),
          ...(pack.agentId === undefined ? {} : { agentId: pack.agentId }),
          ...(pack.projectId === undefined ? {} : { projectId: pack.projectId }),
          ...(pack.teamId === undefined ? {} : { teamId: pack.teamId }),
          ...(pointer.docType === undefined ? {} : { docType: pointer.docType }),
          ...(pointer.scopeKind === undefined ? {} : { docScopeKind: pointer.scopeKind }),
          ...(pointer.scopeId === undefined ? {} : { docScopeId: pointer.scopeId }),
        });
        continue;
      }
      existing.contextItemIds = uniqueStrings([...existing.contextItemIds, item.id]);
      existing.sourceRefs = uniqueStrings([...existing.sourceRefs, item.sourceRef]);
      existing.reasons = uniqueStrings([...existing.reasons, ...item.reasons]);
      existing.required = existing.required || item.required;
      existing.freshness = leastFresh(existing.freshness, item.freshness);
    }
  }
  return [...recordsByKey.values()].map((record) => ({ ...record }));
}

export function createContextPackSnapshotRecorder(input: {
  snapshots: { record: (snapshot: ContextPackSnapshotRecord) => Promise<void> };
  docConsultLedger?: ContextPackDocConsultLedgerPort | undefined;
  transaction?: ContextPackSnapshotRecorderTransactionPort | undefined;
}): (snapshot: ContextPackSnapshotRecord) => Promise<void> {
  return async (snapshot) => await recordContextPackSnapshotWithConsults(snapshot, input);
}

async function recordContextPackSnapshotWithConsults(
  snapshot: ContextPackSnapshotRecord,
  input: ContextPackSnapshotRecorderPorts & { transaction?: ContextPackSnapshotRecorderTransactionPort | undefined },
): Promise<void> {
  const operation = async (ports: ContextPackSnapshotRecorderPorts): Promise<void> => {
    const consultRecords = contextPackDocConsultRecordsForSnapshot(snapshot);
    await ports.snapshots.record(snapshot);
    if (ports.docConsultLedger !== undefined && consultRecords.length > 0) {
      await ports.docConsultLedger.recordMany(consultRecords);
    }
  };
  if (input.transaction !== undefined) {
    await input.transaction.run(operation);
    return;
  }
  await operation(input);
}

type MutableContextPackDocConsultRecord = {
  -readonly [Key in keyof ContextPackDocConsultRecord]: ContextPackDocConsultRecord[Key];
};

function docUnitPointersFor(
  item: ContextPackItem,
): readonly Extract<ContextPackSourcePointer, { kind: typeof ContextPackSourcePointerKind.DocUnit }>[] {
  return (item.sourcePointers ?? []).filter((pointer) => pointer.kind === ContextPackSourcePointerKind.DocUnit);
}

function consultKey(
  contextPackId: string,
  pointer: Extract<ContextPackSourcePointer, { kind: typeof ContextPackSourcePointerKind.DocUnit }>,
): string {
  const hash = createHash("sha256")
    .update(JSON.stringify([contextPackId, pointer.docUnitId, pointer.version, pointer.contentHash]))
    .digest("hex");
  return `context_pack_doc_consult:${hash}`;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function leastFresh(left: ContextPackFreshness, right: ContextPackFreshness): ContextPackFreshness {
  return freshnessRank(left) >= freshnessRank(right) ? left : right;
}

function freshnessRank(value: ContextPackFreshness): number {
  switch (value) {
    case ContextPackFreshness.Live:
      return 1;
    case ContextPackFreshness.Current:
      return 2;
    case ContextPackFreshness.Stale:
      return 3;
    case ContextPackFreshness.Archived:
      return 4;
  }
}

const SUCCESSFUL_CONTEXT_PACK_DOC_CONSULT_OUTCOMES: ReadonlySet<string> = new Set<string>([
  ContextPackBusinessValidationOutcome.Approved,
  ContextPackBusinessValidationOutcome.Waived,
  QualityGateOutcomeValue.Approved,
  QualityGateOutcomeValue.Waived,
  StageOutcomeValue.Approve,
]);

const FAILED_CONTEXT_PACK_DOC_CONSULT_OUTCOMES: ReadonlySet<string> = new Set<string>([
  ContextPackBusinessValidationOutcome.ChangesRequested,
  ContextPackBusinessValidationOutcome.Rejected,
  QualityGateOutcomeValue.ChangesRequested,
  QualityGateOutcomeValue.Rejected,
  StageOutcomeValue.RequestChanges,
  StageOutcomeValue.Reject,
]);

const CONTEXT_PACK_BUSINESS_VALIDATION_OUTCOMES: ReadonlySet<ContextPackBusinessValidationOutcome> =
  new Set<ContextPackBusinessValidationOutcome>(Object.values(ContextPackBusinessValidationOutcome));
