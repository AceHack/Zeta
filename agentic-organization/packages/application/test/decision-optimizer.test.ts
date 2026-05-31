import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  ChangeArtifactKind,
  ChangeSetPhase,
  ConfigLayerScopeKind,
  OrgEventKind,
  defaultTenantConfig,
  type OrgEvent,
  type TenantConfig,
} from "../../domain/src/index.ts";
import { ModelEvalCaseClass, type ModelEvalSummary } from "../../model-eval/src/model-eval.ts";
import { RecordingTelemetryQueryPort } from "../../observability/src/index.ts";
import {
  createContentAddressedEvidenceRef,
  changeSetDocumentKey,
  proposeDecisionOptimizerChangeSet,
  runDecisionOptimizerCycle,
  tenantConfigDocumentKey,
  type DecisionOptimizerStore,
} from "../src/index.ts";

const NOW = "2026-05-30T00:00:00.000Z";
const EvalEvidenceRef = createContentAddressedEvidenceRef("model-eval-report", { runId: "eval-run-1" });
const KpiEvidenceRef = createContentAddressedEvidenceRef("decision-kpi", { runId: "eval-run-1" });
const TelemetryEvidenceRef = createContentAddressedEvidenceRef("telemetry-regression", { runId: "eval-run-1" });
const ModelCostRank = { "qwen2:0.5b": 1, "gpt-5.5": 10 } as const;

test("proposes a safe model downgrade only when Class A clears threshold and KPI is non-negative", () => {
  const result = proposeDecisionOptimizerChangeSet({
    organizationId: "org-lfg",
    workItemId: "work-optimizer-1",
    proposerHatId: "decision_optimizer",
    targetHatId: "code_reviewer",
    targetRef: tenantConfigDocumentKey("org-lfg"),
    currentConfig: tenantConfigWithModel("gpt-5.5"),
    candidateModel: "qwen2:0.5b",
    budgetDeltaTokens: -512,
    evalSummary: summary({ classAAccuracy: 1, classBAccuracy: 0.5 }),
    evalEvidenceRef: EvalEvidenceRef,
    kpiSignal: { observedWorkItems: 12, successCount: 9, failureCount: 3, kpiDelta: 0 },
    kpiEvidenceRef: KpiEvidenceRef,
    modelCostRank: ModelCostRank,
    thresholds: { minClassAAccuracy: 0.99 },
    now: NOW,
  });

  equal(result.kind, "proposed");
  if (result.kind !== "proposed") throw new Error("expected proposal");
  equal(result.changeSet.phase, ChangeSetPhase.Drafted);
  equal(result.changeSet.proposerHatId, "decision_optimizer");
  equal(result.changeSet.artifacts.length, 1);
  equal(result.event.kind, OrgEventKind.DecisionOptimizationProposed);
  deepEqual(result.event.evidenceRefs, [EvalEvidenceRef, KpiEvidenceRef]);

  const artifact = result.changeSet.artifacts[0]!;
  equal(artifact.kind, ChangeArtifactKind.ConfigChange);
  if (artifact.kind !== ChangeArtifactKind.ConfigChange) throw new Error("expected config artifact");
  equal(artifact.key, "tenant-config/org-lfg.json");
  const before = JSON.parse(artifact.before) as TenantConfig;
  const after = JSON.parse(artifact.after) as TenantConfig;
  equal(before.organizationId, "org-lfg");
  equal(after.organizationId, "org-lfg");
  const layer = (after.layers ?? []).find((candidate) => {
    const scoped = candidate as { scope?: { kind?: string } };
    return scoped.scope?.kind === ConfigLayerScopeKind.Hat;
  }) as {
    layerId: string;
    scope: { kind: string; id: string };
    policy: { model: string; budgetDeltaTokens: number; directives: readonly string[] };
  };
  equal(layer.scope.kind, ConfigLayerScopeKind.Hat);
  equal(layer.scope.id, "code_reviewer");
  equal(layer.policy.model, "qwen2:0.5b");
  equal(layer.policy.budgetDeltaTokens, -512);
  ok(layer.policy.directives.includes("optimizer:model-downgrade:eval-run-1"));
});

test("does not downgrade when Class A fails even if Class B passes", () => {
  const result = proposeDecisionOptimizerChangeSet({
    organizationId: "org-lfg",
    workItemId: "work-optimizer-2",
    proposerHatId: "decision_optimizer",
    targetHatId: "code_reviewer",
    targetRef: tenantConfigDocumentKey("org-lfg"),
    currentConfig: tenantConfigWithModel("gpt-5.5"),
    candidateModel: "qwen2:0.5b",
    budgetDeltaTokens: -512,
    evalSummary: summary({ classAAccuracy: 0.98, classBAccuracy: 1 }),
    evalEvidenceRef: EvalEvidenceRef,
    kpiSignal: { observedWorkItems: 12, successCount: 9, failureCount: 3, kpiDelta: 1 },
    kpiEvidenceRef: KpiEvidenceRef,
    modelCostRank: ModelCostRank,
    thresholds: { minClassAAccuracy: 0.99 },
    now: NOW,
  });

  deepEqual(result, { kind: "no_proposal", reason: "class_a_accuracy_below_threshold" });
});

test("does not mutate tenant config directly", () => {
  const currentConfig = tenantConfigWithModel("gpt-5.5");

  const result = proposeDecisionOptimizerChangeSet({
    organizationId: "org-lfg",
    workItemId: "work-optimizer-3",
    proposerHatId: "decision_optimizer",
    targetHatId: "code_reviewer",
    targetRef: tenantConfigDocumentKey("org-lfg"),
    currentConfig,
    candidateModel: "qwen2:0.5b",
    budgetDeltaTokens: -512,
    evalSummary: summary({ classAAccuracy: 1, classBAccuracy: 1 }),
    evalEvidenceRef: EvalEvidenceRef,
    kpiSignal: { observedWorkItems: 12, successCount: 9, failureCount: 3, kpiDelta: 0 },
    kpiEvidenceRef: KpiEvidenceRef,
    modelCostRank: ModelCostRank,
    thresholds: { minClassAAccuracy: 0.99 },
    now: NOW,
  });

  equal(result.kind, "proposed");
  deepEqual(currentConfig.layers, tenantConfigWithModel("gpt-5.5").layers);
});

test("does not propose when the candidate is not a cheaper downgrade", () => {
  const result = proposeDecisionOptimizerChangeSet({
    organizationId: "org-lfg",
    workItemId: "work-optimizer-4",
    proposerHatId: "decision_optimizer",
    targetHatId: "code_reviewer",
    targetRef: tenantConfigDocumentKey("org-lfg"),
    currentConfig: tenantConfigWithModel("qwen2:0.5b"),
    candidateModel: "gpt-5.5",
    budgetDeltaTokens: -512,
    evalSummary: summary({ classAAccuracy: 1, classBAccuracy: 1, model: "gpt-5.5" }),
    evalEvidenceRef: EvalEvidenceRef,
    kpiSignal: { observedWorkItems: 12, successCount: 9, failureCount: 3, kpiDelta: 0 },
    kpiEvidenceRef: KpiEvidenceRef,
    modelCostRank: ModelCostRank,
    thresholds: { minClassAAccuracy: 0.99 },
    now: NOW,
  });

  deepEqual(result, { kind: "no_proposal", reason: "candidate_not_lower_cost" });
});

test("does not propose without negative budget delta and durable KPI evidence", () => {
  const nonSaving = proposeDecisionOptimizerChangeSet({
    organizationId: "org-lfg",
    workItemId: "work-optimizer-5",
    proposerHatId: "decision_optimizer",
    targetHatId: "code_reviewer",
    targetRef: tenantConfigDocumentKey("org-lfg"),
    currentConfig: tenantConfigWithModel("gpt-5.5"),
    candidateModel: "qwen2:0.5b",
    budgetDeltaTokens: 0,
    evalSummary: summary({ classAAccuracy: 1, classBAccuracy: 1 }),
    evalEvidenceRef: EvalEvidenceRef,
    kpiSignal: { observedWorkItems: 12, successCount: 9, failureCount: 3, kpiDelta: 0 },
    kpiEvidenceRef: KpiEvidenceRef,
    modelCostRank: ModelCostRank,
    thresholds: { minClassAAccuracy: 0.99 },
    now: NOW,
  });

  const missingKpiEvidence = proposeDecisionOptimizerChangeSet({
    organizationId: "org-lfg",
    workItemId: "work-optimizer-6",
    proposerHatId: "decision_optimizer",
    targetHatId: "code_reviewer",
    targetRef: tenantConfigDocumentKey("org-lfg"),
    currentConfig: tenantConfigWithModel("gpt-5.5"),
    candidateModel: "qwen2:0.5b",
    budgetDeltaTokens: -512,
    evalSummary: summary({ classAAccuracy: 1, classBAccuracy: 1 }),
    evalEvidenceRef: EvalEvidenceRef,
    kpiSignal: { observedWorkItems: 12, successCount: 9, failureCount: 3, kpiDelta: 0 },
    modelCostRank: ModelCostRank,
    thresholds: { minClassAAccuracy: 0.99 },
    now: NOW,
  });

  deepEqual(nonSaving, { kind: "no_proposal", reason: "budget_delta_not_negative" });
  deepEqual(missingKpiEvidence, { kind: "no_proposal", reason: "missing_kpi_evidence" });
});

test("does not let an eval summary authorize a different candidate model", () => {
  const result = proposeDecisionOptimizerChangeSet({
    organizationId: "org-lfg",
    workItemId: "work-optimizer-7",
    proposerHatId: "decision_optimizer",
    targetHatId: "code_reviewer",
    targetRef: tenantConfigDocumentKey("org-lfg"),
    currentConfig: tenantConfigWithModel("gpt-5.5"),
    candidateModel: "qwen2:1.5b",
    budgetDeltaTokens: -512,
    evalSummary: summary({ classAAccuracy: 1, classBAccuracy: 1 }),
    evalEvidenceRef: EvalEvidenceRef,
    kpiSignal: { observedWorkItems: 12, successCount: 9, failureCount: 3, kpiDelta: 0 },
    kpiEvidenceRef: KpiEvidenceRef,
    modelCostRank: { ...ModelCostRank, "qwen2:1.5b": 2 },
    thresholds: { minClassAAccuracy: 0.99 },
    now: NOW,
  });

  deepEqual(result, { kind: "no_proposal", reason: "candidate_model_mismatch" });
});

test("runs the optimizer cycle against a generic document/log store", async () => {
  const currentConfig = tenantConfigWithModel("gpt-5.5");
  const modelEvalEvent: OrgEvent = {
    id: "evt-model-eval-generic-store",
    kind: OrgEventKind.ModelEvalCompleted,
    occurredAt: NOW,
    organizationId: "org-lfg",
    actorHatId: "decision_optimizer",
    subjectId: "eval-run-1",
    decision: "completed model eval",
    supervisorChain: ["executive_board", "coo", "decision_optimizer"],
    evidenceRefs: [EvalEvidenceRef],
    correlationId: "eval-run-1",
    causationId: "eval-run-1",
    traceId: "eval-run-1",
  };
  const store = createRecordingDecisionOptimizerStore(currentConfig);

  const result = await runDecisionOptimizerCycle({
    store,
    modelEvalEvent,
    organizationId: "org-lfg",
    workItemId: "work-optimizer-generic-store",
    proposerHatId: "decision_optimizer",
    targetHatId: "code_reviewer",
    targetRef: tenantConfigDocumentKey("org-lfg"),
    candidateModel: "qwen2:0.5b",
    budgetDeltaTokens: -512,
    evalSummary: summary({ classAAccuracy: 1, classBAccuracy: 1 }),
    evalEvidenceRef: EvalEvidenceRef,
    kpiSignal: { observedWorkItems: 12, successCount: 9, failureCount: 3, kpiDelta: 0 },
    kpiEvidenceRef: KpiEvidenceRef,
    modelCostRank: ModelCostRank,
    thresholds: { minClassAAccuracy: 0.99 },
    now: NOW,
  });

  equal(result.kind, "proposed");
  if (result.kind !== "proposed") throw new Error("expected generic store proposal");
  equal(result.persistedChangeSetKey, `change-sets/${result.changeSet.changeSetId}.json`);
  deepEqual(
    store.operations,
    [
      "getJson:tenant-config/org-lfg.json",
      "appendJson:org-events/org-lfg.jsonl:evt-model-eval-generic-store",
      `putJson:change-sets/${result.changeSet.changeSetId}.json:${result.changeSet.changeSetId}`,
      `appendJson:org-events/org-lfg.jsonl:evt-decision-optimizer-${result.changeSet.changeSetId}`,
    ],
  );
  equal(result.appendedEvents.some((event) => event.kind === OrgEventKind.ModelEvalCompleted), true);
  equal(result.appendedEvents.some((event) => event.kind === OrgEventKind.DecisionOptimizationProposed), true);
  equal(result.eventStreamKey, "org-events/org-lfg.jsonl");
});

test("reads telemetry before proposing and carries telemetry evidence into change-control", async () => {
  const currentConfig = tenantConfigWithModel("gpt-5.5");
  const store = createRecordingDecisionOptimizerStore(currentConfig);
  const telemetryQueryPort = new RecordingTelemetryQueryPort({
    metrics: [{ labels: { hat: "code_reviewer" }, points: [{ timestamp: NOW, value: 3 }] }],
    traces: [{ traceId: "trace-work-001", rootName: "org.command", spanCount: 9 }],
    logs: [{ timestamp: NOW, line: "p95 latency rose 3x", labels: { hat: "code_reviewer" } }],
  });

  const result = await runDecisionOptimizerCycle({
    store,
    organizationId: "org-lfg",
    workItemId: "work-optimizer-telemetry",
    proposerHatId: "decision_optimizer",
    targetHatId: "code_reviewer",
    targetRef: tenantConfigDocumentKey("org-lfg"),
    candidateModel: "qwen2:0.5b",
    budgetDeltaTokens: -512,
    evalSummary: summary({ classAAccuracy: 1, classBAccuracy: 1 }),
    evalEvidenceRef: EvalEvidenceRef,
    kpiSignal: { observedWorkItems: 12, successCount: 9, failureCount: 3, kpiDelta: 0 },
    kpiEvidenceRef: KpiEvidenceRef,
    modelCostRank: ModelCostRank,
    thresholds: { minClassAAccuracy: 0.99 },
    now: NOW,
    telemetryEvidence: {
      queryPort: telemetryQueryPort,
      evidenceRef: TelemetryEvidenceRef,
      range: { start: "2026-05-30T23:00:00.000Z", end: NOW },
      metricQueries: ["histogram_quantile(0.95, org_command_duration_ms{hat=\"code_reviewer\"})"],
      traceQueries: ['{ org.hat_id = "code_reviewer" }'],
      logQueries: ['{app="agentic-org-worker"} |= "latency"'],
    },
  });

  equal(result.kind, "proposed");
  if (result.kind !== "proposed") throw new Error("expected telemetry-backed proposal");
  deepEqual(result.event.evidenceRefs, [EvalEvidenceRef, KpiEvidenceRef, TelemetryEvidenceRef]);
  deepEqual(telemetryQueryPort.calls.map((call) => call.kind), ["metrics", "traces", "logs"]);
  deepEqual(result.telemetryObservations, {
    metricSeriesCount: 1,
    traceSummaryCount: 1,
    logLineCount: 1,
  });
});

test("returns a store-level no-op when generic storage has no tenant config", async () => {
  const store = createRecordingDecisionOptimizerStore(null);

  const result = await runDecisionOptimizerCycle({
    store,
    organizationId: "org-lfg",
    workItemId: "work-optimizer-missing-config",
    proposerHatId: "decision_optimizer",
    targetHatId: "code_reviewer",
    targetRef: tenantConfigDocumentKey("org-lfg"),
    candidateModel: "qwen2:0.5b",
    budgetDeltaTokens: -512,
    evalSummary: summary({ classAAccuracy: 1, classBAccuracy: 1 }),
    evalEvidenceRef: EvalEvidenceRef,
    kpiSignal: { observedWorkItems: 12, successCount: 9, failureCount: 3, kpiDelta: 0 },
    kpiEvidenceRef: KpiEvidenceRef,
    modelCostRank: ModelCostRank,
    thresholds: { minClassAAccuracy: 0.99 },
    now: NOW,
  });

  deepEqual(result, { kind: "no_proposal", reason: "missing_current_config" });
  deepEqual(store.operations, ["getJson:tenant-config/org-lfg.json"]);
});

test("exposes deterministic store keys for git-backed document stores", () => {
  equal(tenantConfigDocumentKey("org-lfg"), "tenant-config/org-lfg.json");
});

test("encodes path-significant ids before using them as store keys", () => {
  equal(tenantConfigDocumentKey("../org/lfg"), "tenant-config/encoded-2e2e2f6f72672f6c6667.json");
  equal(changeSetDocumentKey("cs/../1"), "change-sets/encoded-63732f2e2e2f31.json");
});

function tenantConfigWithModel(model: string) {
  return {
    ...defaultTenantConfig("org-lfg", NOW),
    layers: [{
      layerId: "org-base-model",
      scope: { kind: ConfigLayerScopeKind.Organization, id: "org-lfg" },
      policy: { model },
      updatedAt: NOW,
      version: 1,
    }],
  };
}

function summary(input: { classAAccuracy: number; classBAccuracy: number; model?: string }): ModelEvalSummary {
  return {
    runId: "eval-run-1",
    model: input.model ?? "qwen2:0.5b",
    evaluatedAt: NOW,
    overall: { total: 2, correct: input.classAAccuracy + input.classBAccuracy, accuracy: (input.classAAccuracy + input.classBAccuracy) / 2 },
    byClass: {
      [ModelEvalCaseClass.NeutralEvidence]: { total: 1, correct: input.classAAccuracy, accuracy: input.classAAccuracy },
      [ModelEvalCaseClass.DirectiveContext]: { total: 1, correct: input.classBAccuracy, accuracy: input.classBAccuracy },
    },
    failedCaseIds: [],
    illegalCaseIds: [],
  };
}

function createRecordingDecisionOptimizerStore(initialConfig: TenantConfig | null): DecisionOptimizerStore & {
  operations: string[];
} {
  const operations: string[] = [];
  const documents = new Map<string, unknown>();
  if (initialConfig !== null) {
    documents.set(tenantConfigDocumentKey(initialConfig.organizationId), initialConfig);
  }
  return {
    operations,
    async getJson(key) {
      operations.push(`getJson:${key}`);
      return (documents.get(key) ?? null) as never;
    },
    async putJson(key, value) {
      const id = typeof value === "object" && value !== null && "changeSetId" in value
        ? String(value.changeSetId)
        : key;
      operations.push(`putJson:${key}:${id}`);
      documents.set(key, value);
    },
    async appendJson(key, value) {
      const id = typeof value === "object" && value !== null && "id" in value
        ? String(value.id)
        : key;
      operations.push(`appendJson:${key}:${id}`);
    },
  };
}
