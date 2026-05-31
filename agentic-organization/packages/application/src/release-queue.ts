import { type ChangeSet } from "../../domain/src/index.ts";
import { type ContentAddressedEvidenceArtifact } from "./content-addressed-evidence.ts";

export const ReleaseQueueState = {
  Idle: "idle",
  BatchGreen: "batch_green",
  BatchBisected: "batch_bisected",
} as const;

export type ReleaseQueueState = (typeof ReleaseQueueState)[keyof typeof ReleaseQueueState];

export const ReleaseQueueActionKind = {
  Apply: "apply",
  RequestChanges: "request_changes",
  Requeue: "requeue",
} as const;

export type ReleaseQueueActionKind =
  (typeof ReleaseQueueActionKind)[keyof typeof ReleaseQueueActionKind];

export type ReleaseBatchEvaluation = {
  green: boolean;
  evidenceRefs: readonly string[];
  evidenceArtifacts?: readonly ContentAddressedEvidenceArtifact[];
};

export type ReleaseQueueAction = {
  kind: ReleaseQueueActionKind;
  changeSetId: string;
  evidenceRefs: readonly string[];
  evidenceArtifacts?: readonly ContentAddressedEvidenceArtifact[];
};

export type ReleaseQueuePlan = {
  state: ReleaseQueueState;
  batch: readonly ChangeSet[];
  actions: readonly ReleaseQueueAction[];
};

export type PlanReleaseQueueInput = {
  approvedChangeSets: readonly ChangeSet[];
  maxBatchSize: number;
  evaluateBatch: (batch: readonly ChangeSet[]) => ReleaseBatchEvaluation;
};

type BisectResult = {
  actions: readonly ReleaseQueueAction[];
  accepted: readonly ChangeSet[];
};

export function planReleaseQueue(input: PlanReleaseQueueInput): ReleaseQueuePlan {
  const batch = prioritize(input.approvedChangeSets).slice(0, Math.max(0, input.maxBatchSize));
  if (batch.length === 0) {
    return { state: ReleaseQueueState.Idle, batch, actions: [] };
  }

  const evaluation = input.evaluateBatch(batch);
  if (evaluation.green) {
    return {
      state: ReleaseQueueState.BatchGreen,
      batch,
      actions: batch.map((cs) => applyAction(cs, evaluation)),
    };
  }

  return {
    state: ReleaseQueueState.BatchBisected,
    batch,
    actions: bisect(batch, [], input.evaluateBatch, evaluation).actions,
  };
}

function prioritize(changeSets: readonly ChangeSet[]): ChangeSet[] {
  return [...changeSets].sort((a, b) => {
    const retryPressure = b.revision - a.revision;
    if (retryPressure !== 0) return retryPressure;

    const age = Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
    if (age !== 0) return age;

    return a.changeSetId.localeCompare(b.changeSetId);
  });
}

function bisect(
  batch: readonly ChangeSet[],
  accepted: readonly ChangeSet[],
  evaluateBatch: (batch: readonly ChangeSet[]) => ReleaseBatchEvaluation,
  knownEvaluation?: ReleaseBatchEvaluation,
): BisectResult {
  const evaluation = knownEvaluation ?? evaluateBatch([...accepted, ...batch]);
  if (evaluation.green) {
    return {
      actions: batch.map((cs) => applyAction(cs, evaluation)),
      accepted: [...accepted, ...batch],
    };
  }

  if (batch.length === 1) {
    return {
      actions: [requestChangesAction(batch[0]!, evaluation)],
      accepted,
    };
  }

  const midpoint = Math.floor(batch.length / 2);
  const left = batch.slice(0, midpoint);
  const right = batch.slice(midpoint);
  const leftResult = bisect(left, accepted, evaluateBatch);
  const rightKnownEvaluation = acceptedAll(leftResult.accepted, accepted, left)
    ? evaluation
    : undefined;
  const rightResult = bisect(right, leftResult.accepted, evaluateBatch, rightKnownEvaluation);
  return {
    actions: [...leftResult.actions, ...rightResult.actions],
    accepted: rightResult.accepted,
  };
}

function acceptedAll(
  nextAccepted: readonly ChangeSet[],
  previousAccepted: readonly ChangeSet[],
  candidate: readonly ChangeSet[],
): boolean {
  if (nextAccepted.length !== previousAccepted.length + candidate.length) {
    return false;
  }

  return candidate.every(
    (cs, index) => nextAccepted[previousAccepted.length + index]?.changeSetId === cs.changeSetId,
  );
}

function applyAction(cs: ChangeSet, evaluation: ReleaseBatchEvaluation): ReleaseQueueAction {
  return {
    kind: ReleaseQueueActionKind.Apply,
    changeSetId: cs.changeSetId,
    evidenceRefs: evaluation.evidenceRefs,
    ...(evaluation.evidenceArtifacts !== undefined ? { evidenceArtifacts: evaluation.evidenceArtifacts } : {}),
  };
}

function requestChangesAction(cs: ChangeSet, evaluation: ReleaseBatchEvaluation): ReleaseQueueAction {
  return {
    kind: ReleaseQueueActionKind.RequestChanges,
    changeSetId: cs.changeSetId,
    evidenceRefs: evaluation.evidenceRefs,
    ...(evaluation.evidenceArtifacts !== undefined ? { evidenceArtifacts: evaluation.evidenceArtifacts } : {}),
  };
}
