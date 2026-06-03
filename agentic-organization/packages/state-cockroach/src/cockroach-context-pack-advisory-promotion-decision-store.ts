import {
  ContextPackAdvisoryPromotionDecisionStatus,
  ContextPackItemKind,
  DEFAULT_CONTEXT_PACK_ADVISORY_PROMOTION_POLICY_VERSION,
  type ContextPackAdvisoryPromotionDecision,
  type ContextPackAdvisoryPromotionDecisionReadPort,
  type ContextPackAdvisoryPromotionDecisionWriteInput,
  type ContextPackAdvisoryPromotionDecisionWritePort,
  type ContextPackAdvisoryPromotionDecisionWriteResult,
  type ContextPackAdvisoryPromotionFingerprint,
  type ContextPackAdvisoryPromotionPolicyRequest,
} from "../../application/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";
import type { CockroachGenericSqlExecutor } from "./cockroach-sql-executor.ts";

export const CockroachContextPackAdvisoryPromotionDecisionStoreStatement = {
  ListForPromotion: "list_context_pack_advisory_promotion_decisions_for_promotion",
  UpsertDecision: "upsert_context_pack_advisory_promotion_decision",
} as const;

export type CockroachContextPackAdvisoryPromotionDecisionStoreStatement =
  (typeof CockroachContextPackAdvisoryPromotionDecisionStoreStatement)[keyof typeof CockroachContextPackAdvisoryPromotionDecisionStoreStatement];

export type CreateCockroachContextPackAdvisoryPromotionDecisionStoreInput = {
  executor: CockroachGenericSqlExecutor;
};

type ContextPackAdvisoryPromotionDecisionRow = {
  decision_id: unknown;
  decision_key: unknown;
  organization_id: unknown;
  status: unknown;
  policy_version: unknown;
  lifecycle_blocker: unknown;
  item_kind: unknown;
  summary_hash: unknown;
  citation_refs: unknown;
  source_pointer_keys: unknown;
  evidence_refs: unknown;
  hat_id: unknown;
  hat_assignment_id: unknown;
  project_id: unknown;
  team_id: unknown;
  work_item_id: unknown;
  curation_profile_id: unknown;
};

type DurableContextPackAdvisoryPromotionDecision = ContextPackAdvisoryPromotionDecision & {
  decisionKey: string;
};

export function createCockroachContextPackAdvisoryPromotionDecisionStore(
  input: CreateCockroachContextPackAdvisoryPromotionDecisionStoreInput,
): ContextPackAdvisoryPromotionDecisionReadPort & ContextPackAdvisoryPromotionDecisionWritePort {
  return {
    async listForPromotion(request): Promise<readonly ContextPackAdvisoryPromotionDecision[]> {
      const organizationId = request.request.snapshot.organizationId;
      if (!isNonEmptyString(organizationId)) return [];

      const result = await input.executor.execute<ContextPackAdvisoryPromotionDecisionRow>({
        name: CockroachContextPackAdvisoryPromotionDecisionStoreStatement.ListForPromotion,
        sql: `
          SELECT decision_id, decision_key, organization_id, status, policy_version,
                 lifecycle_blocker, item_kind, summary_hash, citation_refs,
                 source_pointer_keys, evidence_refs, hat_id, hat_assignment_id,
                 project_id, team_id, work_item_id, curation_profile_id
          FROM ${CockroachTableName.ContextPackAdvisoryPromotionDecisions}
          WHERE organization_id = $1
            AND (hat_id IS NULL OR hat_id = $2)
            AND (hat_assignment_id IS NULL OR hat_assignment_id = $3)
            AND (project_id IS NULL OR project_id = $4)
            AND (team_id IS NULL OR team_id = $5)
            AND (work_item_id IS NULL OR work_item_id = $6)
            AND (curation_profile_id IS NULL OR curation_profile_id = $7)
            AND policy_version = $8
          ORDER BY updated_at DESC, decision_id ASC`,
        parameters: parametersFor(request, organizationId),
      });

      return currentApprovedDecisions(result.rows);
    },
    async recordDecision(
      decision: ContextPackAdvisoryPromotionDecisionWriteInput,
    ): Promise<ContextPackAdvisoryPromotionDecisionWriteResult> {
      await input.executor.execute({
        name: CockroachContextPackAdvisoryPromotionDecisionStoreStatement.UpsertDecision,
        sql: `
          UPSERT INTO ${CockroachTableName.ContextPackAdvisoryPromotionDecisions} (
            decision_id,
            decision_key,
            organization_id,
            status,
            policy_version,
            lifecycle_blocker,
            item_kind,
            summary_hash,
            citation_refs,
            source_pointer_keys,
            evidence_refs,
            hat_id,
            hat_assignment_id,
            project_id,
            team_id,
            work_item_id,
            curation_profile_id,
            decided_by_hat_id,
            decided_by_hat_assignment_id,
            decided_by_agent_id,
            decided_at,
            updated_at,
            trace_id,
            correlation_id,
            causation_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9::JSONB, $10::JSONB,
            $11::JSONB, $12, $13, $14, $15, $16, $17, $18, $19,
            $20, $21::TIMESTAMPTZ, $22::TIMESTAMPTZ, $23, $24, $25
          )`,
        parameters: decisionWriteParameters(decision),
      });

      return {
        decisionId: decision.decisionId,
        decisionKey: decision.decisionKey,
      };
    },
  };
}

function parametersFor(
  request: ContextPackAdvisoryPromotionPolicyRequest,
  organizationId: string,
): readonly unknown[] {
  return [
    organizationId,
    request.request.snapshot.hat.id,
    request.request.snapshot.hatAssignmentId,
    request.request.snapshot.projectId ?? null,
    request.request.snapshot.teamId ?? null,
    request.request.snapshot.workItemId ?? null,
    request.curationPlan?.profileId ?? null,
    DEFAULT_CONTEXT_PACK_ADVISORY_PROMOTION_POLICY_VERSION,
  ];
}

function decisionWriteParameters(
  decision: ContextPackAdvisoryPromotionDecisionWriteInput,
): readonly unknown[] {
  return [
    decision.decisionId,
    decision.decisionKey,
    decision.organizationId,
    decision.status,
    decision.policyVersion,
    decision.lifecycleBlocker,
    decision.fingerprint.itemKind,
    decision.fingerprint.summaryHash,
    jsonArrayParameter(decision.fingerprint.citationRefs),
    jsonArrayParameter(decision.fingerprint.sourcePointerKeys),
    jsonArrayParameter(decision.evidenceRefs),
    decision.hatId ?? null,
    decision.hatAssignmentId ?? null,
    decision.projectId ?? null,
    decision.teamId ?? null,
    decision.workItemId ?? null,
    decision.curationProfileId ?? null,
    decision.audit.decidedByHatId,
    decision.audit.decidedByHatAssignmentId,
    decision.audit.decidedByAgentId ?? null,
    decision.audit.decidedAt,
    decision.audit.decidedAt,
    decision.audit.traceId,
    decision.audit.correlationId,
    decision.audit.causationId,
  ];
}

function currentApprovedDecisions(
  rows: readonly ContextPackAdvisoryPromotionDecisionRow[],
): readonly ContextPackAdvisoryPromotionDecision[] {
  const currentByDecisionKey = new Map<string, DurableContextPackAdvisoryPromotionDecision>();
  for (const row of rows) {
    const decision = rowToDecision(row);
    if (decision === null) continue;
    if (currentByDecisionKey.has(decision.decisionKey)) continue;
    currentByDecisionKey.set(decision.decisionKey, decision);
  }
  return [...currentByDecisionKey.values()].filter((decision) =>
    decision.status === ContextPackAdvisoryPromotionDecisionStatus.Approved
  );
}

function rowToDecision(row: ContextPackAdvisoryPromotionDecisionRow): DurableContextPackAdvisoryPromotionDecision | null {
  const decisionId = requiredString(row.decision_id);
  const decisionKey = requiredString(row.decision_key);
  const organizationId = requiredString(row.organization_id);
  const status = promotionDecisionStatus(row.status);
  const policyVersion = requiredString(row.policy_version);
  const lifecycleBlocker = requiredString(row.lifecycle_blocker);
  const fingerprint = fingerprintFrom(row);
  const evidenceRefs = stringArray(row.evidence_refs, { normalizeOrder: false });
  if (
    decisionId === null ||
    decisionKey === null ||
    organizationId === null ||
    status === null ||
    policyVersion === null ||
    lifecycleBlocker === null ||
    fingerprint === null ||
    evidenceRefs === null
  ) {
    return null;
  }
  return {
    decisionId,
    decisionKey,
    status,
    policyVersion,
    lifecycleBlocker,
    fingerprint,
    evidenceRefs,
    organizationId,
    ...optionalScope("hatId", row.hat_id),
    ...optionalScope("hatAssignmentId", row.hat_assignment_id),
    ...optionalScope("projectId", row.project_id),
    ...optionalScope("teamId", row.team_id),
    ...optionalScope("workItemId", row.work_item_id),
    ...optionalScope("curationProfileId", row.curation_profile_id),
  };
}

function fingerprintFrom(
  row: ContextPackAdvisoryPromotionDecisionRow,
): ContextPackAdvisoryPromotionFingerprint | null {
  const itemKind = promotionItemKind(row.item_kind);
  const summaryHash = requiredString(row.summary_hash);
  const citationRefs = stringArray(row.citation_refs, { normalizeOrder: true });
  const sourcePointerKeys = stringArray(row.source_pointer_keys, { normalizeOrder: true });
  if (itemKind === null || summaryHash === null || citationRefs === null || sourcePointerKeys === null) return null;
  return {
    itemKind,
    summaryHash,
    citationRefs,
    sourcePointerKeys,
  };
}

function promotionDecisionStatus(value: unknown): ContextPackAdvisoryPromotionDecisionStatus | null {
  return Object.values(ContextPackAdvisoryPromotionDecisionStatus).includes(
    value as ContextPackAdvisoryPromotionDecisionStatus,
  )
    ? value as ContextPackAdvisoryPromotionDecisionStatus
    : null;
}

function promotionItemKind(value: unknown): ContextPackItemKind | null {
  return value === ContextPackItemKind.SynthesisGapHypothesis ? ContextPackItemKind.SynthesisGapHypothesis : null;
}

function optionalScope<Name extends keyof ContextPackAdvisoryPromotionDecision>(
  name: Name,
  value: unknown,
): Partial<Pick<ContextPackAdvisoryPromotionDecision, Name>> {
  const normalized = optionalString(value);
  return normalized === undefined ? {} : { [name]: normalized } as Partial<Pick<ContextPackAdvisoryPromotionDecision, Name>>;
}

function requiredString(value: unknown): string | null {
  return isNonEmptyString(value) ? value.trim() : null;
}

function optionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return isNonEmptyString(value) ? value.trim() : undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stringArray(
  value: unknown,
  options: { normalizeOrder: boolean },
): readonly string[] | null {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === "string")) return null;
  const values = [...new Set(parsed.map((entry) => entry.trim()).filter((entry) => entry.length > 0))];
  return options.normalizeOrder ? values.sort() : values;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function jsonArrayParameter(values: readonly string[]): string {
  return JSON.stringify(values);
}
