import { createHash } from "node:crypto";

import type {
  ContextPackBuildRequest,
  ContextPackCurationPlan,
  ContextPackItem,
  ContextPackOmittedItem,
  ContextPackSourcePointer,
} from "./context-pack-contracts.ts";
import {
  ContextPackItemKind,
  ContextPackOmissionReason,
  ContextPackSourcePointerKind,
} from "./context-pack-contracts.ts";

export type ContextPackAdvisoryPromotionPolicyRequest = {
  query: string;
  observedAt: string;
  request: ContextPackBuildRequest;
  deterministicItems: readonly ContextPackItem[];
  advisoryItems: readonly ContextPackItem[];
  omissions: readonly ContextPackOmittedItem[];
  curationPlan?: ContextPackCurationPlan | undefined;
};

export type ContextPackAdvisoryPromotion = {
  sourceItemId: string;
  lifecycleBlocker: string;
  evidenceRefs?: readonly string[] | undefined;
};

export type ContextPackAdvisoryPromotionPolicyResult = {
  promotions: readonly ContextPackAdvisoryPromotion[];
  omittedItemsWithReason?: readonly ContextPackOmittedItem[] | undefined;
  evidenceRefs?: readonly string[] | undefined;
};

export type ContextPackAdvisoryPromotionPolicyPort = {
  evaluate: (request: ContextPackAdvisoryPromotionPolicyRequest) =>
    Promise<ContextPackAdvisoryPromotionPolicyResult> | ContextPackAdvisoryPromotionPolicyResult;
};

export type ContextPackAdvisoryPromotionAdmission = {
  promotions: readonly ContextPackAdvisoryPromotion[];
  omittedItemsWithReason: readonly ContextPackOmittedItem[];
  evidenceRefs: readonly string[];
};

export const ContextPackAdvisoryPromotionDecisionStatus = {
  Approved: "approved",
  Revoked: "revoked",
} as const;

export type ContextPackAdvisoryPromotionDecisionStatus =
  (typeof ContextPackAdvisoryPromotionDecisionStatus)[keyof typeof ContextPackAdvisoryPromotionDecisionStatus];

export type ContextPackAdvisoryPromotionFingerprint = {
  itemKind: ContextPackItemKind;
  summaryHash: string;
  citationRefs: readonly string[];
  sourcePointerKeys: readonly string[];
};

export type ContextPackAdvisoryPromotionDecision = {
  decisionId: string;
  decisionKey?: string | undefined;
  status: ContextPackAdvisoryPromotionDecisionStatus;
  policyVersion: string;
  lifecycleBlocker: string;
  fingerprint: ContextPackAdvisoryPromotionFingerprint;
  evidenceRefs: readonly string[];
  hatId?: string | undefined;
  hatAssignmentId?: string | undefined;
  organizationId?: string | undefined;
  projectId?: string | undefined;
  teamId?: string | undefined;
  workItemId?: string | undefined;
  curationProfileId?: string | undefined;
};

export type ContextPackAdvisoryPromotionDecisionAudit = {
  decidedByHatId: string;
  decidedByHatAssignmentId: string;
  decidedByAgentId?: string | undefined;
  decidedAt: string;
  traceId: string;
  correlationId: string;
  causationId: string;
};

export type ContextPackAdvisoryPromotionDecisionWriteInput =
  Omit<ContextPackAdvisoryPromotionDecision, "decisionKey" | "organizationId"> & {
    decisionKey: string;
    organizationId: string;
    audit: ContextPackAdvisoryPromotionDecisionAudit;
  };

export type ContextPackAdvisoryPromotionDecisionWriteResult = {
  decisionId: string;
  decisionKey: string;
};

export type ContextPackAdvisoryPromotionDecisionKeyInput = {
  organizationId: string;
  fingerprint: ContextPackAdvisoryPromotionFingerprint;
  hatId?: string | undefined;
  hatAssignmentId?: string | undefined;
  projectId?: string | undefined;
  teamId?: string | undefined;
  workItemId?: string | undefined;
  curationProfileId?: string | undefined;
};

export type ContextPackAdvisoryPromotionDecisionReadPort = {
  listForPromotion: (request: ContextPackAdvisoryPromotionPolicyRequest) =>
    Promise<readonly ContextPackAdvisoryPromotionDecision[]> | readonly ContextPackAdvisoryPromotionDecision[];
};

export type ContextPackAdvisoryPromotionDecisionWritePort = {
  recordDecision: (
    input: ContextPackAdvisoryPromotionDecisionWriteInput,
  ) => Promise<ContextPackAdvisoryPromotionDecisionWriteResult> | ContextPackAdvisoryPromotionDecisionWriteResult;
};

export type CreateDefaultContextPackAdvisoryPromotionPolicyInput = {
  decisions?: ContextPackAdvisoryPromotionDecisionReadPort | undefined;
};

export const DEFAULT_CONTEXT_PACK_ADVISORY_PROMOTION_POLICY_VERSION = "context-pack-advisory-promotion:v1";

const ADVISORY_PROMOTION_FINGERPRINT_HASH_ALGORITHM = "sha256";
const ADVISORY_PROMOTION_OMISSION_NODE_ID_PREFIX = "advisory_promotion";
const ADVISORY_PROMOTION_DECISION_EVIDENCE_REF_PREFIX = "advisory_promotion_decision:";
const ADVISORY_PROMOTION_SOURCE_NOT_ADMITTED_MESSAGE = "advisory promotion source item was not admitted";
const ADVISORY_PROMOTION_EMPTY_BLOCKER_MESSAGE = "advisory promotion lifecycle blocker was empty";
const ADVISORY_PROMOTION_DECISION_KEY_WILDCARD = "all";

export function createDefaultContextPackAdvisoryPromotionPolicy(
  input: CreateDefaultContextPackAdvisoryPromotionPolicyInput = {},
): ContextPackAdvisoryPromotionPolicyPort {
  return {
    async evaluate(request): Promise<ContextPackAdvisoryPromotionPolicyResult> {
      if (input.decisions === undefined) {
        return { promotions: [] };
      }
      const decisions = await input.decisions.listForPromotion(request);
      const approvedDecisions = decisions.filter((decision) =>
        decision.status === ContextPackAdvisoryPromotionDecisionStatus.Approved &&
        decision.policyVersion === DEFAULT_CONTEXT_PACK_ADVISORY_PROMOTION_POLICY_VERSION &&
        contextPackAdvisoryPromotionDecisionMatchesScope(decision, request)
      );
      const promotions = request.advisoryItems
        .filter((item) => item.kind === ContextPackItemKind.SynthesisGapHypothesis)
        .flatMap((item): readonly ContextPackAdvisoryPromotion[] => {
          const fingerprint = contextPackAdvisoryPromotionFingerprint(item);
          const decision = approvedDecisions.find((candidate) =>
            contextPackAdvisoryPromotionFingerprintMatches(candidate.fingerprint, fingerprint)
          );
          if (decision === undefined) return [];
          return [{
            sourceItemId: item.id,
            lifecycleBlocker: decision.lifecycleBlocker,
            evidenceRefs: [item.id, advisoryPromotionDecisionEvidenceRef(decision.decisionId), ...decision.evidenceRefs],
          }];
        });

      return {
        promotions,
        evidenceRefs: promotions.flatMap((promotion) => promotion.evidenceRefs ?? []),
      };
    },
  };
}

export function createInMemoryContextPackAdvisoryPromotionDecisionReadPort(
  decisions: readonly ContextPackAdvisoryPromotionDecision[],
): ContextPackAdvisoryPromotionDecisionReadPort {
  return {
    listForPromotion: () => decisions.map((decision) => ({
      ...decision,
      fingerprint: {
        ...decision.fingerprint,
        citationRefs: [...decision.fingerprint.citationRefs],
        sourcePointerKeys: [...decision.fingerprint.sourcePointerKeys],
      },
      evidenceRefs: [...decision.evidenceRefs],
    })),
  };
}

export function contextPackAdvisoryPromotionFingerprint(
  item: ContextPackItem,
): ContextPackAdvisoryPromotionFingerprint {
  return {
    itemKind: item.kind,
    summaryHash: sha256(item.summary),
    citationRefs: [...uniqueStrings([...(item.citationRefs ?? [])])].sort(),
    sourcePointerKeys: [...uniqueStrings([...(item.sourcePointers ?? [])].map(contextPackSourcePointerKey))].sort(),
  };
}

export function contextPackAdvisoryPromotionDecisionKeyFor(
  input: ContextPackAdvisoryPromotionDecisionKeyInput,
): string {
  return [
    input.organizationId,
    input.hatId ?? ADVISORY_PROMOTION_DECISION_KEY_WILDCARD,
    input.hatAssignmentId ?? ADVISORY_PROMOTION_DECISION_KEY_WILDCARD,
    input.projectId ?? ADVISORY_PROMOTION_DECISION_KEY_WILDCARD,
    input.teamId ?? ADVISORY_PROMOTION_DECISION_KEY_WILDCARD,
    input.workItemId ?? ADVISORY_PROMOTION_DECISION_KEY_WILDCARD,
    input.curationProfileId ?? ADVISORY_PROMOTION_DECISION_KEY_WILDCARD,
    input.fingerprint.itemKind,
    input.fingerprint.summaryHash,
  ].join(":");
}

export function admitContextPackAdvisoryPromotions(input: {
  result: ContextPackAdvisoryPromotionPolicyResult;
  deterministicItems: readonly ContextPackItem[];
  advisoryItems: readonly ContextPackItem[];
}): ContextPackAdvisoryPromotionAdmission {
  const accepted: ContextPackAdvisoryPromotion[] = [];
  const omittedItemsWithReason: ContextPackOmittedItem[] = [...(input.result.omittedItemsWithReason ?? [])];
  const traceEvidenceRefs: string[] = [];
  const admittedAdvisoryIds = new Set(input.advisoryItems.map((item) => item.id));
  const acceptedPromotionKeys = new Set<string>();
  const admittedEvidenceRefs = new Set([
    ...input.deterministicItems.flatMap(contextItemEvidenceRefs),
    ...input.advisoryItems.flatMap(contextItemEvidenceRefs),
  ]);

  for (const promotion of input.result.promotions) {
    const sourceItemId = promotion.sourceItemId.trim();
    if (!admittedAdvisoryIds.has(sourceItemId)) {
      omittedItemsWithReason.push(advisoryPromotionOmission(
        sourceItemId,
        ADVISORY_PROMOTION_SOURCE_NOT_ADMITTED_MESSAGE,
      ));
      continue;
    }

    const lifecycleBlocker = promotion.lifecycleBlocker.trim();
    if (lifecycleBlocker.length === 0) {
      omittedItemsWithReason.push(advisoryPromotionOmission(
        sourceItemId,
        ADVISORY_PROMOTION_EMPTY_BLOCKER_MESSAGE,
      ));
      continue;
    }

    const promotionKey = advisoryPromotionKey(sourceItemId, lifecycleBlocker);
    if (!acceptedPromotionKeys.has(promotionKey)) {
      acceptedPromotionKeys.add(promotionKey);
      accepted.push({
        sourceItemId,
        lifecycleBlocker,
        evidenceRefs: uniqueStrings((promotion.evidenceRefs ?? []).filter((ref) =>
          admittedEvidenceRefs.has(ref) || isAdvisoryPromotionDecisionEvidenceRef(ref)
        )),
      });
    }
    traceEvidenceRefs.push(sourceItemId);
    traceEvidenceRefs.push(...(promotion.evidenceRefs ?? []).filter((ref) =>
      admittedEvidenceRefs.has(ref) || isAdvisoryPromotionDecisionEvidenceRef(ref)
    ));
  }

  traceEvidenceRefs.push(...(input.result.evidenceRefs ?? []).filter((ref) =>
    admittedEvidenceRefs.has(ref) || isAdvisoryPromotionDecisionEvidenceRef(ref)
  ));
  traceEvidenceRefs.push(...omittedItemsWithReason.map(contextOmissionRef));

  return {
    promotions: accepted,
    omittedItemsWithReason,
    evidenceRefs: uniqueStrings(traceEvidenceRefs),
  };
}

function advisoryPromotionOmission(sourceItemId: string, message: string): ContextPackOmittedItem {
  return {
    nodeId: `${ADVISORY_PROMOTION_OMISSION_NODE_ID_PREFIX}:${sourceItemId}`,
    reason: ContextPackOmissionReason.OutOfScope,
    message,
  };
}

function advisoryPromotionKey(sourceItemId: string, lifecycleBlocker: string): string {
  return `${sourceItemId}\u0000${lifecycleBlocker}`;
}

function advisoryPromotionDecisionEvidenceRef(decisionId: string): string {
  return `${ADVISORY_PROMOTION_DECISION_EVIDENCE_REF_PREFIX}${decisionId}`;
}

function isAdvisoryPromotionDecisionEvidenceRef(ref: string): boolean {
  return ref.startsWith(ADVISORY_PROMOTION_DECISION_EVIDENCE_REF_PREFIX) &&
    ref.length > ADVISORY_PROMOTION_DECISION_EVIDENCE_REF_PREFIX.length;
}

function contextPackAdvisoryPromotionDecisionMatchesScope(
  decision: ContextPackAdvisoryPromotionDecision,
  request: ContextPackAdvisoryPromotionPolicyRequest,
): boolean {
  return (
    optionalDecisionValueMatches(decision.hatId, request.request.snapshot.hat.id) &&
    optionalDecisionValueMatches(decision.hatAssignmentId, request.request.snapshot.hatAssignmentId) &&
    optionalDecisionValueMatches(decision.organizationId, request.request.snapshot.organizationId) &&
    optionalDecisionValueMatches(decision.projectId, request.request.snapshot.projectId) &&
    optionalDecisionValueMatches(decision.teamId, request.request.snapshot.teamId) &&
    optionalDecisionValueMatches(decision.workItemId, request.request.snapshot.workItemId) &&
    optionalDecisionValueMatches(decision.curationProfileId, request.curationPlan?.profileId)
  );
}

function optionalDecisionValueMatches(expected: string | undefined, actual: string | undefined): boolean {
  return expected === undefined || expected === actual;
}

function contextPackAdvisoryPromotionFingerprintMatches(
  expected: ContextPackAdvisoryPromotionFingerprint,
  actual: ContextPackAdvisoryPromotionFingerprint,
): boolean {
  return (
    expected.itemKind === actual.itemKind &&
    expected.summaryHash === actual.summaryHash &&
    stringArraysMatch(expected.citationRefs, actual.citationRefs) &&
    stringArraysMatch(expected.sourcePointerKeys, actual.sourcePointerKeys)
  );
}

function stringArraysMatch(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((entry, index) => entry === right[index]);
}

function contextItemEvidenceRefs(item: ContextPackItem): readonly string[] {
  return uniqueStrings([
    item.id,
    item.sourceRef,
    ...(item.citationRefs ?? []),
  ]);
}

function contextOmissionRef(omission: ContextPackOmittedItem): string {
  return omission.nodeId ?? omission.reason;
}

function contextPackSourcePointerKey(pointer: ContextPackSourcePointer): string {
  switch (pointer.kind) {
    case ContextPackSourcePointerKind.DocUnit:
      return `${pointer.kind}:${pointer.docUnitId}:${pointer.version}`;
    case ContextPackSourcePointerKind.GitBlob:
      return `${pointer.kind}:${pointer.path}:${pointer.commitSha ?? ""}:${pointer.blobSha ?? ""}`;
    case ContextPackSourcePointerKind.GraphNode:
      return `${pointer.kind}:${pointer.nodeId}`;
    case ContextPackSourcePointerKind.GraphEdge:
      return `${pointer.kind}:${pointer.edgeId}`;
    case ContextPackSourcePointerKind.HindsightMemory:
      return `${pointer.kind}:${pointer.providerId}:${pointer.memoryId}`;
    case ContextPackSourcePointerKind.WorkItem:
      return `${pointer.kind}:${pointer.workItemId}`;
    case ContextPackSourcePointerKind.Decision:
      return `${pointer.kind}:${pointer.decisionId}`;
    case ContextPackSourcePointerKind.Discussion:
      return `${pointer.kind}:${pointer.discussionId}`;
    case ContextPackSourcePointerKind.InboxAnchor:
      return `${pointer.kind}:${pointer.inboxAnchorId}:${pointer.targetHatAssignmentId ?? ""}:${pointer.targetAgentId ?? ""}`;
    case ContextPackSourcePointerKind.Meeting:
      return `${pointer.kind}:${pointer.meetingId}:${pointer.workScheduleBlockId ?? ""}:${pointer.discussionAnchorId ?? ""}`;
    case ContextPackSourcePointerKind.QualityGate:
      return `${pointer.kind}:${pointer.qualityGateEvaluationId}`;
    case ContextPackSourcePointerKind.ScheduleBlock:
      return `${pointer.kind}:${pointer.workScheduleBlockId}`;
    case ContextPackSourcePointerKind.SupervisorSignal:
      return `${pointer.kind}:${pointer.supervisorSignalId}`;
    case ContextPackSourcePointerKind.Trace:
      return `${pointer.kind}:${pointer.traceId}`;
    case ContextPackSourcePointerKind.Metric:
      return `${pointer.kind}:${pointer.source}:${pointer.query}:${pointer.seriesId ?? ""}`;
    case ContextPackSourcePointerKind.Log:
      return `${pointer.kind}:${pointer.source}:${pointer.query}:${pointer.logRef}`;
    case ContextPackSourcePointerKind.Policy:
      return `${pointer.kind}:${pointer.policyId}:${pointer.version ?? ""}`;
  }
}

function sha256(value: string): string {
  return createHash(ADVISORY_PROMOTION_FINGERPRINT_HASH_ALGORITHM).update(value).digest("hex");
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
