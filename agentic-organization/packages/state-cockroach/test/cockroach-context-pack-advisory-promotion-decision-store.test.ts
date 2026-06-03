import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  type ContextPackAdvisoryPromotionDecisionWriteInput,
  ContextPackAdvisoryPromotionDecisionStatus,
  ContextPackCurationProfileId,
  ContextPackFreshness,
  ContextPackItemKind,
  ContextPackSourcePointerKind,
  DEFAULT_CONTEXT_PACK_ADVISORY_PROMOTION_POLICY_VERSION,
  RunLifecyclePhase,
  RunScope,
  asZetaIdDecimal,
  buildHatDefinitions,
  contextPackAdvisoryPromotionFingerprint,
  type ContextPackAdvisoryPromotionPolicyRequest,
} from "../../application/src/index.ts";
import {
  CockroachContextPackAdvisoryPromotionDecisionStoreStatement,
  createCockroachContextPackAdvisoryPromotionDecisionStore,
} from "../src/cockroach-context-pack-advisory-promotion-decision-store.ts";
import type { CockroachAnySqlStatement, CockroachGenericSqlExecutor } from "../src/cockroach-sql-executor.ts";

test("Cockroach context-pack advisory promotion decision store reads scoped approved decisions", async () => {
  const request = promotionRequest();
  const fingerprint = contextPackAdvisoryPromotionFingerprint(request.advisoryItems[0]!);
  const executor = fakeExecutor([
    row({
      decision_id: "decision-approved",
      status: ContextPackAdvisoryPromotionDecisionStatus.Approved,
      lifecycle_blocker: "approved blocker text",
      item_kind: fingerprint.itemKind,
      summary_hash: fingerprint.summaryHash,
      citation_refs: fingerprint.citationRefs,
      source_pointer_keys: fingerprint.sourcePointerKeys,
      evidence_refs: ["doc:billing-brd", "context_requirement:owner"],
    }),
  ]);
  const store = createCockroachContextPackAdvisoryPromotionDecisionStore({ executor });

  const decisions = await store.listForPromotion(request);

  equal(decisions.length, 1);
  equal(decisions[0]?.decisionId, "decision-approved");
  equal(decisions[0]?.lifecycleBlocker, "approved blocker text");
  deepEqual(decisions[0]?.fingerprint, fingerprint);
  deepEqual(decisions[0]?.evidenceRefs, ["doc:billing-brd", "context_requirement:owner"]);
  equal(executor.statements[0]?.name, CockroachContextPackAdvisoryPromotionDecisionStoreStatement.ListForPromotion);
  deepEqual(executor.statements[0]?.parameters, [
    "org-lfg",
    "engineering_director",
    "99",
    "project-billing",
    "team-platform",
    "work-billing",
    ContextPackCurationProfileId.ManagementBlocker,
    DEFAULT_CONTEXT_PACK_ADVISORY_PROMOTION_POLICY_VERSION,
  ]);
});

test("Cockroach context-pack advisory promotion decision store drops malformed durable rows", async () => {
  const request = promotionRequest();
  const fingerprint = contextPackAdvisoryPromotionFingerprint(request.advisoryItems[0]!);
  const executor = fakeExecutor([
    row({
      decision_id: "decision-good",
      item_kind: fingerprint.itemKind,
      summary_hash: fingerprint.summaryHash,
      citation_refs: fingerprint.citationRefs,
      source_pointer_keys: fingerprint.sourcePointerKeys,
    }),
    row({
      decision_id: "decision-bad-status",
      status: "maybe",
      item_kind: fingerprint.itemKind,
      summary_hash: fingerprint.summaryHash,
      citation_refs: fingerprint.citationRefs,
      source_pointer_keys: fingerprint.sourcePointerKeys,
    }),
    row({
      decision_id: "decision-bad-json",
      item_kind: fingerprint.itemKind,
      summary_hash: fingerprint.summaryHash,
      citation_refs: "not-json-array",
      source_pointer_keys: fingerprint.sourcePointerKeys,
    }),
  ]);
  const store = createCockroachContextPackAdvisoryPromotionDecisionStore({ executor });

  const decisions = await store.listForPromotion(request);

  deepEqual(decisions.map((decision) => decision.decisionId), ["decision-good"]);
});

test("Cockroach context-pack advisory promotion decision store suppresses older approvals after newer revocation", async () => {
  const request = promotionRequest();
  const fingerprint = contextPackAdvisoryPromotionFingerprint(request.advisoryItems[0]!);
  const executor = fakeExecutor([
    row({
      decision_id: "decision-revoked",
      decision_key: "org-lfg:owner-gap",
      status: ContextPackAdvisoryPromotionDecisionStatus.Revoked,
      item_kind: fingerprint.itemKind,
      summary_hash: fingerprint.summaryHash,
      citation_refs: fingerprint.citationRefs,
      source_pointer_keys: fingerprint.sourcePointerKeys,
    }),
    row({
      decision_id: "decision-old-approval",
      decision_key: "org-lfg:owner-gap",
      status: ContextPackAdvisoryPromotionDecisionStatus.Approved,
      item_kind: fingerprint.itemKind,
      summary_hash: fingerprint.summaryHash,
      citation_refs: fingerprint.citationRefs,
      source_pointer_keys: fingerprint.sourcePointerKeys,
    }),
  ]);
  const store = createCockroachContextPackAdvisoryPromotionDecisionStore({ executor });

  const decisions = await store.listForPromotion(request);

  deepEqual(decisions, []);
});

test("Cockroach context-pack advisory promotion decision store upserts audited decisions by decision key", async () => {
  const request = promotionRequest();
  const fingerprint = contextPackAdvisoryPromotionFingerprint(request.advisoryItems[0]!);
  const executor = fakeExecutor([]);
  const store = createCockroachContextPackAdvisoryPromotionDecisionStore({ executor });

  await store.recordDecision(writeDecisionInput({ fingerprint }));

  equal(executor.statements[0]?.name, CockroachContextPackAdvisoryPromotionDecisionStoreStatement.UpsertDecision);
  ok(executor.statements[0]?.sql.includes("UPSERT INTO agentic_org_context_pack_advisory_promotion_decisions"));
  deepEqual(executor.statements[0]?.parameters, [
    "decision-promote-owner-gap",
    "org-lfg:engineering_director:99:project-billing:team-platform:work-billing:management_blocker:synthesis_gap_hypothesis:" +
      fingerprint.summaryHash,
    "org-lfg",
    ContextPackAdvisoryPromotionDecisionStatus.Approved,
    DEFAULT_CONTEXT_PACK_ADVISORY_PROMOTION_POLICY_VERSION,
    "ownership gap blocks execution",
    fingerprint.itemKind,
    fingerprint.summaryHash,
    JSON.stringify(fingerprint.citationRefs),
    JSON.stringify(fingerprint.sourcePointerKeys),
    JSON.stringify(["doc:billing-brd", "context_requirement:owner"]),
    "engineering_director",
    "99",
    "project-billing",
    "team-platform",
    "work-billing",
    ContextPackCurationProfileId.ManagementBlocker,
    "engineering_director",
    "99",
    "agent-director",
    "2026-06-03T18:00:00.000Z",
    "2026-06-03T18:00:00.000Z",
    "trace-promote-owner-gap",
    "corr-promote-owner-gap",
    "cause-promote-owner-gap",
  ]);
});

function fakeExecutor(
  rows: readonly Record<string, unknown>[],
): CockroachGenericSqlExecutor & { statements: CockroachAnySqlStatement[] } {
  const statements: CockroachAnySqlStatement[] = [];
  return {
    statements,
    execute: async <Row = Record<string, unknown>>(statement: CockroachAnySqlStatement) => {
      statements.push(statement);
      return { rows: rows as Row[] };
    },
    executeTransaction: async (operation) => await operation({
      execute: async <Row = Record<string, unknown>>(statement: CockroachAnySqlStatement) => {
        statements.push(statement);
        return { rows: rows as Row[] };
      },
    }),
  };
}

function row(overrides: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    decision_id: "decision-default",
    decision_key: "org-lfg:decision-default",
    organization_id: "org-lfg",
    status: ContextPackAdvisoryPromotionDecisionStatus.Approved,
    policy_version: "context-pack-advisory-promotion:v1",
    lifecycle_blocker: "approved blocker",
    item_kind: ContextPackItemKind.SynthesisGapHypothesis,
    summary_hash: "hash",
    citation_refs: [],
    source_pointer_keys: [],
    evidence_refs: [],
    hat_id: "engineering_director",
    hat_assignment_id: "99",
    project_id: "project-billing",
    team_id: "team-platform",
    work_item_id: "work-billing",
    curation_profile_id: ContextPackCurationProfileId.ManagementBlocker,
    ...overrides,
  };
}

function writeDecisionInput(input: {
  fingerprint: ReturnType<typeof contextPackAdvisoryPromotionFingerprint>;
}): ContextPackAdvisoryPromotionDecisionWriteInput {
  return {
    decisionId: "decision-promote-owner-gap",
    decisionKey: "org-lfg:engineering_director:99:project-billing:team-platform:work-billing:management_blocker:synthesis_gap_hypothesis:" +
      input.fingerprint.summaryHash,
    organizationId: "org-lfg",
    status: ContextPackAdvisoryPromotionDecisionStatus.Approved,
    policyVersion: DEFAULT_CONTEXT_PACK_ADVISORY_PROMOTION_POLICY_VERSION,
    lifecycleBlocker: "ownership gap blocks execution",
    fingerprint: input.fingerprint,
    evidenceRefs: ["doc:billing-brd", "context_requirement:owner"],
    hatId: "engineering_director",
    hatAssignmentId: "99",
    projectId: "project-billing",
    teamId: "team-platform",
    workItemId: "work-billing",
    curationProfileId: ContextPackCurationProfileId.ManagementBlocker,
    audit: {
      decidedByHatId: "engineering_director",
      decidedByHatAssignmentId: "99",
      decidedByAgentId: "agent-director",
      decidedAt: "2026-06-03T18:00:00.000Z",
      traceId: "trace-promote-owner-gap",
      correlationId: "corr-promote-owner-gap",
      causationId: "cause-promote-owner-gap",
    },
  };
}

function promotionRequest(): ContextPackAdvisoryPromotionPolicyRequest {
  const hat = buildHatDefinitions().find((candidate) => candidate.id === "engineering_director");
  if (hat === undefined) throw new Error("engineering_director missing");
  return {
    query: "director billing blocker",
    observedAt: "2026-05-31T00:00:00.000Z",
    request: {
      observedAt: "2026-05-31T00:00:00.000Z",
      snapshot: {
        runId: asZetaIdDecimal("42"),
        scope: RunScope.Project,
        phase: RunLifecyclePhase.Blocked,
        trace: { traceId: "trace-1", correlationId: "corr-1", causationId: "cause-1" },
        hasGateApproval: false,
        hasEvidence: false,
        hatAssignmentId: asZetaIdDecimal("99"),
        hat,
        agentId: "agent-director",
        organizationId: "org-lfg",
        projectId: "project-billing",
        teamId: "team-platform",
        workItemId: "work-billing",
      },
      readout: {
        runId: asZetaIdDecimal("42"),
        scope: RunScope.Project,
        phase: RunLifecyclePhase.Blocked,
        trace: { traceId: "trace-1", correlationId: "corr-1", causationId: "cause-1" },
        observedAt: "2026-05-31T00:00:00.000Z",
        options: [],
        vetoedOptions: [],
        deterministicRulesApplied: [],
      },
      metrics: { scope: RunScope.Project, blocks: [] },
      promptFlows: { tasks: [], vetoedTasks: [] },
      hierarchy: {
        level: hat.level,
        projects: [],
        initiatives: [],
        metrics: [],
        policyViolations: [],
        priorityScope: "department_initiatives",
        priorityItems: [],
        scopedMetrics: [],
        actions: [],
        vetoedActions: [],
      },
    },
    deterministicItems: [],
    advisoryItems: [{
      id: "synthesis:engineering_director:42:99:gap:0",
      kind: ContextPackItemKind.SynthesisGapHypothesis,
      title: "Gap hypothesis",
      summary: "Ownership evidence may be missing.",
      sourceRef: "synthesis:engineering_director:42:gap:0",
      required: false,
      freshness: ContextPackFreshness.Live,
      confidence: 0.9,
      reasons: ["gap_hypothesis"],
      citationRefs: ["doc:billing-brd", "context_requirement:owner"],
      sourcePointers: [{
        kind: ContextPackSourcePointerKind.DocUnit,
        docUnitId: "billing-brd",
        contentRef: "git://docs/billing.md",
        contentHash: "hash",
        sourceId: "source-main",
        version: 1,
      }],
    }],
    omissions: [],
    curationPlan: {
      profileId: ContextPackCurationProfileId.ManagementBlocker,
      policyVersion: "context-pack-curation-profile:v1",
      lanes: [],
      deterministicInstructions: [],
    },
  };
}
