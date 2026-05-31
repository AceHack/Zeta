/**
 * G2/M3/M5 KIND proof: run deterministic model eval, let the optimizer propose
 * a tenant-config layer as a ChangeSet artifact through the generic optimizer
 * store interface, and resolve config before/after the proposed overlay against
 * live Cockroach as one adapter implementation.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26260:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26260/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/run-model-eval-optimizer.ts
 */

import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { Pool } from "pg";

import {
  ChangeArtifactKind,
  ConfigLayerScopeKind,
  OrgEventKind,
  defaultTenantConfig,
  resolveLayeredTenantConfig,
  type ChangeSet,
  type OrgEvent,
  type TenantConfig,
  type TenantConfigLayer,
} from "../packages/domain/src/index.ts";
import {
  changeSetDocumentKey,
  createContentAddressedEvidenceArtifact,
  orgEventStreamKey,
  runDecisionOptimizerCycle,
  tenantConfigDocumentKey,
  type DecisionOptimizerStore,
} from "../packages/application/src/index.ts";
import {
  ModelEvalCaseClass,
  modelEvalReportToOrgEvent,
  runModelEval,
  summarizeModelEvalReport,
  type ModelEvalCase,
} from "../packages/model-eval/src/model-eval.ts";
import {
  createCockroachChangeSetStore,
  createCockroachCoreStateMigrations,
  createCockroachOrgEventStore,
  createCockroachSqlExecutor,
  createCockroachTenantConfigStore,
  splitSqlStatements,
} from "../packages/state-cockroach/src/index.ts";
import {
  evaluateSimulationRisk,
  runOrgPolicySimulation,
} from "../packages/simulator/src/index.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";
const proofRunId = randomUUID().slice(0, 8);
const organizationId = `org-model-eval-optimizer-${proofRunId}`;
const nowIso = new Date().toISOString();
const targetHatId = "code_reviewer";
const candidateModel = "qwen2:0.5b";
const kpiSignal = { observedWorkItems: 16, successCount: 12, failureCount: 4, kpiDelta: 0 };
const modelCostRank = { "qwen2:0.5b": 1, "gpt-5.5": 10 } as const;

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  try {
    const client: CockroachSqlClient = {
      query: async (sql, parameters) => ({ rows: (await pool.query(sql, parameters as unknown[])).rows }),
      transaction: async (operation) => operation(client),
    };
    const executor = createCockroachSqlExecutor({ client });

    for (const migration of createCockroachCoreStateMigrations()) {
      for (const statement of splitSqlStatements(migration.sql)) {
        await pool.query(statement);
      }
    }

    const tenantConfigs = createCockroachTenantConfigStore({ executor });
    const changeSets = createCockroachChangeSetStore({ executor });
    const orgEvents = createCockroachOrgEventStore({ executor });
    const currentConfig = seededTenantConfig();
    await tenantConfigs.upsert(currentConfig);

    const beforeResolved = resolveLayeredTenantConfig({
      organizationId,
      hatId: targetHatId,
      layers: currentConfig.layers ?? [],
    });
    const report = await runModelEval({
      runId: `eval-${proofRunId}`,
      model: candidateModel,
      evaluatedAt: nowIso,
      cases: evalCases,
      decide: async (testCase) =>
        testCase.class === ModelEvalCaseClass.NeutralEvidence ? "approve" : "assign",
    });
    const summary = summarizeModelEvalReport(report);
    const evalEvidence = createContentAddressedEvidenceArtifact("model-eval-report", summary);
    const kpiEvidence = createContentAddressedEvidenceArtifact("decision-kpi", {
      organizationId,
      targetHatId,
      kpiSignal,
      source: "proof-seeded-realized-outcome-summary",
    });
    const simulationReport = runOrgPolicySimulation({
      organizationId,
      seed: `model-eval-optimizer-${proofRunId}`,
      stream: [
        { eventId: `sim-intake-${proofRunId}`, kind: "work_intake", occurredAt: nowIso, workItemId: `work-optimizer-${proofRunId}`, priority: 80 },
        { eventId: `sim-complete-${proofRunId}`, kind: "work_completed", occurredAt: nowIso, workItemId: `work-optimizer-${proofRunId}`, leadTimeMs: 600_000 },
        { eventId: `sim-review-${proofRunId}`, kind: "review_lag", occurredAt: nowIso, workItemId: `work-optimizer-${proofRunId}`, lagMs: 120_000 },
      ],
      baseline: {
        overlayId: "current-frontier-reviewer",
        autonomyLevel: "assisted",
        modelMapping: { [targetHatId]: "gpt-5.5" },
        modelCostPerWorkItem: modelCostRank["gpt-5.5"],
        gateQuorum: 2,
      },
      candidate: {
        overlayId: "candidate-local-reviewer",
        autonomyLevel: "assisted",
        modelMapping: { [targetHatId]: candidateModel },
        modelCostPerWorkItem: modelCostRank[candidateModel],
        gateQuorum: 2,
      },
    });
    const simulationDecision = evaluateSimulationRisk(simulationReport, {
      maxEscapedDefectRegression: 0,
      maxClassBEscapedDefectRegression: 0,
      maxIncidentRegression: 0,
      maxConformanceFailureRegression: 0,
      minThroughputDelta: 0,
    });
    if (simulationDecision.status !== "accepted") {
      console.log(JSON.stringify({ track: "G2/M3/M5 model eval optimizer", organizationId, simulationDecision, PROOF: "FAIL" }, null, 2));
      process.exitCode = 1;
      return;
    }
    const simulationEvidence = createContentAddressedEvidenceArtifact("simulation-report", {
      report: simulationReport,
      decision: simulationDecision,
    });
    const proposal = await runDecisionOptimizerCycle({
      store: cockroachGenericStore({ tenantConfigs, changeSets, orgEvents }),
      modelEvalEvent: modelEvalReportToOrgEvent({
        report,
        organizationId,
        eventId: `evt-model-eval-${proofRunId}`,
        evidenceRef: evalEvidence.ref,
        correlationId: `corr-${proofRunId}`,
      }),
      organizationId,
      workItemId: `work-optimizer-${proofRunId}`,
      proposerHatId: "decision_optimizer",
      targetHatId,
      targetRef: tenantConfigDocumentKey(organizationId),
      candidateModel,
      budgetDeltaTokens: -512,
      evalSummary: summary,
      evalEvidenceRef: evalEvidence.ref,
      kpiSignal,
      kpiEvidenceRef: kpiEvidence.ref,
      simulationEvidenceRef: simulationEvidence.ref,
      simulationDecision,
      modelCostRank,
      thresholds: { minClassAAccuracy: 1 },
      now: nowIso,
    });

    if (proposal.kind !== "proposed") {
      console.log(JSON.stringify({ track: "G2/M3/M5 model eval optimizer", organizationId, proposal, PROOF: "FAIL" }, null, 2));
      process.exitCode = 1;
      return;
    }

    const artifact = proposal.changeSet.artifacts[0];
    if (artifact?.kind !== ChangeArtifactKind.ConfigChange) {
      console.log(JSON.stringify({ track: "G2/M3/M5 model eval optimizer", organizationId, reason: "missing config artifact", PROOF: "FAIL" }, null, 2));
      process.exitCode = 1;
      return;
    }

    const afterConfig = JSON.parse(artifact.after) as Pick<TenantConfig, "layers">;
    const afterResolved = resolveLayeredTenantConfig({
      organizationId,
      hatId: targetHatId,
      layers: afterConfig.layers ?? [],
    });
    const persistedConfig = await tenantConfigs.get(organizationId);
    const persistedChangeSet = await changeSets.get(proposal.changeSet.changeSetId);
    const events = await orgEvents.listByOrganization(organizationId, 100);
    const ok =
      persistedConfig?.layers?.length === 1 &&
      persistedChangeSet?.changeSetId === proposal.changeSet.changeSetId &&
      beforeResolved.model === "gpt-5.5" &&
      afterResolved.model === candidateModel &&
      afterResolved.budgetDeltaTokens === -512 &&
      afterResolved.directives.includes(`optimizer:model-downgrade:${summary.runId}`) &&
      events.some((event) => event.kind === OrgEventKind.ModelEvalCompleted) &&
      events.some((event) =>
        event.kind === OrgEventKind.DecisionOptimizationProposed &&
        event.evidenceRefs.includes(evalEvidence.ref) &&
        event.evidenceRefs.includes(kpiEvidence.ref) &&
        event.evidenceRefs.includes(simulationEvidence.ref)
      );

    console.log(JSON.stringify({
      track: "G2/M3/M5 model eval optimizer",
      organizationId,
      evalEvidenceRef: evalEvidence.ref,
      kpiEvidenceRef: kpiEvidence.ref,
      simulationEvidenceRef: simulationEvidence.ref,
      simulationDecision,
      evalSummary: summary,
      changeSet: {
        changeSetId: proposal.changeSet.changeSetId,
        phase: proposal.changeSet.phase,
        artifactCount: proposal.changeSet.artifacts.length,
      },
      resolved: {
        before: beforeResolved,
        after: afterResolved,
      },
      events: {
        modelEvalCompleted: events.filter((event) => event.kind === OrgEventKind.ModelEvalCompleted).length,
        decisionOptimizationProposed: events.filter((event) => event.kind === OrgEventKind.DecisionOptimizationProposed).length,
      },
      PROOF: ok ? "PASS" : "FAIL",
    }, null, 2));
    process.exitCode = ok ? 0 : 1;
  } finally {
    await pool.end();
  }
}

function seededTenantConfig(): TenantConfig {
  return {
    ...defaultTenantConfig(organizationId, nowIso),
    layers: [baseModelLayer()],
  };
}

function baseModelLayer(): TenantConfigLayer {
  return {
    layerId: `org-base-model-${proofRunId}`,
    scope: { kind: ConfigLayerScopeKind.Organization, id: organizationId },
    policy: {
      model: "gpt-5.5",
      directives: ["baseline:use-frontier-model"],
    },
    updatedAt: nowIso,
    version: 1,
  };
}

const evalCases: readonly ModelEvalCase[] = [
  {
    caseId: "class-a-review",
    class: ModelEvalCaseClass.NeutralEvidence,
    hatId: targetHatId,
    evidence: "tests passed; no blocking findings",
    allowedActions: ["approve", "request_changes"],
    expectedAction: "approve",
  },
  {
    caseId: "class-b-directive",
    class: ModelEvalCaseClass.DirectiveContext,
    hatId: "engineering_manager",
    directive: "Prefer unblocking ready work.",
    evidence: "work item is ready and unassigned",
    allowedActions: ["assign", "hold"],
    expectedAction: "assign",
  },
];

function cockroachGenericStore(input: {
  tenantConfigs: ReturnType<typeof createCockroachTenantConfigStore>;
  changeSets: ReturnType<typeof createCockroachChangeSetStore>;
  orgEvents: ReturnType<typeof createCockroachOrgEventStore>;
}): DecisionOptimizerStore {
  return {
    async getJson<T>(key: string): Promise<T | null> {
      const tenantPrefix = "tenant-config/";
      if (key.startsWith(tenantPrefix) && key.endsWith(".json")) {
        const organizationId = key.slice(tenantPrefix.length, -".json".length);
        return await input.tenantConfigs.get(organizationId) as T | null;
      }
      throw new Error(`unsupported optimizer get key: ${key}`);
    },
    async putJson<T>(key: string, value: T): Promise<void> {
      if (key === changeSetDocumentKey((value as ChangeSet).changeSetId)) {
        await input.changeSets.upsert(value as ChangeSet);
        return;
      }
      throw new Error(`unsupported optimizer put key: ${key}`);
    },
    async appendJson<T>(key: string, value: T): Promise<void> {
      if (key === orgEventStreamKey((value as OrgEvent).organizationId)) {
        await input.orgEvents.append(value as OrgEvent);
        return;
      }
      throw new Error(`unsupported optimizer append key: ${key}`);
    },
  };
}

await main();
