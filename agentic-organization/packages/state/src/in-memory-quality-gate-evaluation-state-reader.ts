import type {
  QualityGateEvaluationStateReaderPort,
  QualityGateEvaluationWorkItemLookup,
} from "../../application/src/ports.ts";
import type { QualityGateEvaluation } from "../../domain/src/index.ts";

export type CreateInMemoryQualityGateEvaluationStateReaderInput = {
  getQualityGateEvaluations: () => readonly QualityGateEvaluation[];
};

export function createInMemoryQualityGateEvaluationStateReader(
  input: CreateInMemoryQualityGateEvaluationStateReaderInput,
): QualityGateEvaluationStateReaderPort {
  return {
    listQualityGateEvaluationsForWorkItem: async (lookup) =>
      listQualityGateEvaluationsForWorkItem(input.getQualityGateEvaluations(), lookup),
  };
}

function listQualityGateEvaluationsForWorkItem(
  qualityGateEvaluations: readonly QualityGateEvaluation[],
  lookup: QualityGateEvaluationWorkItemLookup,
): readonly QualityGateEvaluation[] {
  return qualityGateEvaluations
    .filter((evaluation) => hasMatchingWorkItemScope(evaluation, lookup))
    .sort(compareQualityGateEvaluationOrder)
    .map(cloneQualityGateEvaluation);
}

function hasMatchingWorkItemScope(
  evaluation: QualityGateEvaluation,
  lookup: QualityGateEvaluationWorkItemLookup,
): boolean {
  return (
    evaluation.organizationId === lookup.organizationId &&
    evaluation.projectId === lookup.projectId &&
    evaluation.workItemId === lookup.workItemId &&
    (lookup.teamId === undefined || evaluation.teamId === lookup.teamId)
  );
}

function compareQualityGateEvaluationOrder(
  left: QualityGateEvaluation,
  right: QualityGateEvaluation,
): number {
  const evaluatedAtOrder = left.evaluatedAt.localeCompare(right.evaluatedAt);

  return evaluatedAtOrder === 0
    ? left.qualityGateEvaluationId.localeCompare(right.qualityGateEvaluationId)
    : evaluatedAtOrder;
}

function cloneQualityGateEvaluation(evaluation: QualityGateEvaluation): QualityGateEvaluation {
  return {
    ...evaluation,
    evaluatedArtifactIds: [...evaluation.evaluatedArtifactIds],
    businessRuleResults: evaluation.businessRuleResults.map((result) => ({
      ...result,
      evidenceArtifactIds: [...result.evidenceArtifactIds],
    })),
    evaluatedBy: {
      ...evaluation.evaluatedBy,
    },
    metadata: {
      ...evaluation.metadata,
    },
  };
}
