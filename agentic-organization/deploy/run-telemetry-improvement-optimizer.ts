/**
 * Phase 2.9 KIND proof: query telemetry, turn a regression into an
 * ImprovementHypothesis-backed ChangeSet, and persist the proposal plus org_event
 * evidence into live Cockroach.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26259:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26259/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/run-telemetry-improvement-optimizer.ts
 */

import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { Pool } from "pg";

import { ChangeSetPhase, OrgEventKind } from "../packages/domain/src/index.ts";
import { RecordingTelemetryQueryPort, createLgtmTelemetryQueryPort, type TelemetryTimeRange } from "../packages/observability/src/index.ts";
import {
  TelemetryImprovementMetricKind,
  createContentAddressedEvidenceArtifact,
  runTelemetryImprovementOptimizer,
} from "../packages/application/src/index.ts";
import { evaluateSimulationRisk, runOrgPolicySimulation } from "../packages/simulator/src/index.ts";
import {
  createCockroachChangeSetStore,
  createCockroachCoreStateMigrations,
  createCockroachOrgEventStore,
  createCockroachSqlExecutor,
  splitSqlStatements,
} from "../packages/state-cockroach/src/index.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";
const proofRunId = randomUUID().slice(0, 8);
const organizationId = `org-telemetry-improvement-${proofRunId}`;
const workItemId = `work-telemetry-improvement-${proofRunId}`;
const now = new Date().toISOString();
const telemetryEvidence = createContentAddressedEvidenceArtifact("telemetry-regression", { proofRunId, metric: "review_p95_ms" });

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

    const telemetry = new RecordingTelemetryQueryPort({
      metrics: [{
        labels: { organizationId, hat: "code_reviewer", metric: "review_p95_ms" },
        points: [
          { timestamp: "2026-05-31T17:45:00.000Z", value: 90 },
          { timestamp: "2026-05-31T18:00:00.000Z", value: 100 },
          { timestamp: "2026-05-31T18:30:00.000Z", value: 310 },
          { timestamp: "2026-05-31T18:45:00.000Z", value: 330 },
        ],
      }],
      logs: [{ timestamp: now, line: "review p95 rose 3x in telemetry proof", labels: { organizationId } }],
      traces: [{ traceId: `trace-${proofRunId}`, rootName: "org.review", spanCount: 8 }],
    });
    const simulationReport = runOrgPolicySimulation({
      organizationId,
      seed: `telemetry-improvement-${proofRunId}`,
      stream: [
        { eventId: `sim-intake-${proofRunId}`, kind: "work_intake", occurredAt: now, workItemId, priority: 80 },
        { eventId: `sim-complete-${proofRunId}`, kind: "work_completed", occurredAt: now, workItemId, leadTimeMs: 900_000 },
        { eventId: `sim-review-${proofRunId}`, kind: "review_lag", occurredAt: now, workItemId, lagMs: 400_000 },
      ],
      baseline: {
        overlayId: "static-review-capacity",
        autonomyLevel: "proposal",
        modelMapping: { code_reviewer: "gpt-5.5" },
        modelCostPerWorkItem: 10,
        reviewLagMultiplier: 1,
        gateQuorum: 2,
      },
      candidate: {
        overlayId: "pressure-aware-review-capacity",
        autonomyLevel: "proposal",
        modelMapping: { code_reviewer: "gpt-5.5" },
        modelCostPerWorkItem: 10,
        reviewLagMultiplier: 0.5,
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
    const simulationEvidence = createContentAddressedEvidenceArtifact("simulation-report", {
      report: simulationReport,
      decision: simulationDecision,
    });
    if (simulationDecision.status !== "accepted") {
      console.log(JSON.stringify({ track: "Phase 2.9 telemetry improvement optimizer", organizationId, simulationDecision, PROOF: "FAIL" }, null, 2));
      process.exitCode = 1;
      return;
    }
    const liveTelemetryPreflight = await runLiveTelemetryPreflight({
      start: "2026-05-31T17:45:00.000Z",
      end: "2026-05-31T18:45:00.000Z",
    });

    const proposal = await runTelemetryImprovementOptimizer({
      organizationId,
      workItemId,
      proposerHatId: "decision_optimizer",
      targetRef: `tenant-config/${organizationId}.json`,
      now,
      queryPort: telemetry,
      range: { start: "2026-05-31T17:45:00.000Z", end: "2026-05-31T18:45:00.000Z" },
      telemetryEvidenceRef: telemetryEvidence.ref,
      simulationEvidenceRef: simulationEvidence.ref,
      simulationDecision,
      trigger: {
        metricKind: TelemetryImprovementMetricKind.ReviewP95Ms,
        metricQuery: "histogram_quantile(0.95, org_review_duration_ms)",
        logQuery: "{app=\"agentic-org-worker\"} |= \"review p95\"",
        traceQuery: "{ name = \"org.review\" }",
        minimumRelativeChange: 1,
        direction: "increase_bad",
        suspectedCause: "review bottleneck",
        proposedChange: {
          kind: "policy",
          summary: "rebalance reviewer capacity when review p95 doubles",
          before: "static reviewer allocation",
          after: "pressure-aware reviewer allocation",
        },
        expectedMetricMovement: { metric: "review_p95_ms", direction: "decrease", minimumRelativeChange: 0.25 },
        rollbackCondition: "review_p95_ms remains above baseline by 50% for two windows",
      },
    });

    const changeSets = createCockroachChangeSetStore({ executor });
    const orgEvents = createCockroachOrgEventStore({ executor });
    if (proposal.kind === "proposed") {
      const txPgClient = await pool.connect();
      try {
        await txPgClient.query("BEGIN");
        const txClient: CockroachSqlClient = {
          query: async (sql, parameters) => ({ rows: (await txPgClient.query(sql, parameters as unknown[])).rows }),
          transaction: async (operation) => operation(txClient),
        };
        const txExecutor = createCockroachSqlExecutor({ client: txClient });
        await createCockroachChangeSetStore({ executor: txExecutor }).upsert(proposal.changeSet);
        await createCockroachOrgEventStore({ executor: txExecutor }).append(proposal.event);
        await txPgClient.query("COMMIT");
      } catch (error) {
        await txPgClient.query("ROLLBACK");
        throw error;
      } finally {
        txPgClient.release();
      }
    }

    const persistedChangeSet = proposal.kind === "proposed"
      ? await changeSets.get(proposal.changeSet.changeSetId)
      : null;
    const events = await orgEvents.listByOrganization(organizationId, 100);
    const optimizationEvents = events.filter((event) => event.kind === OrgEventKind.DecisionOptimizationProposed);
    const ok =
      proposal.kind === "proposed" &&
      persistedChangeSet?.phase === ChangeSetPhase.Drafted &&
      persistedChangeSet.artifacts.length === 1 &&
      optimizationEvents.length === 1 &&
      optimizationEvents[0]?.evidenceRefs.includes(telemetryEvidence.ref) === true &&
      optimizationEvents[0]?.evidenceRefs.includes(simulationEvidence.ref) === true &&
      liveTelemetryPreflight.status === "ok";

    console.log(JSON.stringify({
      track: "Phase 2.9 telemetry improvement optimizer",
      organizationId,
      proposal: proposal.kind === "proposed"
        ? {
          changeSetId: proposal.changeSet.changeSetId,
          hypothesisId: proposal.hypothesis.hypothesisId,
          relativeChange: proposal.hypothesis.symptom.relativeChange,
          proposedChange: proposal.hypothesis.proposedChange.kind,
        }
        : proposal,
      persisted: persistedChangeSet === null ? null : {
        changeSetId: persistedChangeSet.changeSetId,
        phase: persistedChangeSet.phase,
        artifactCount: persistedChangeSet.artifacts.length,
      },
      events: {
        decisionOptimizationProposed: optimizationEvents.length,
      },
      simulationDecision,
      liveTelemetryPreflight,
      telemetryCalls: telemetry.calls.map((call) => call.kind),
      PROOF: ok ? "PASS" : "FAIL",
    }, null, 2));
    process.exitCode = ok ? 0 : 1;
  } finally {
    await pool.end();
  }
}

type LiveTelemetryPreflight =
  | { status: "missing_config"; requiredEnv: readonly string[] }
  | { status: "ok"; calls: readonly string[] }
  | { status: "degraded"; degraded: readonly string[] };

async function runLiveTelemetryPreflight(range: TelemetryTimeRange): Promise<LiveTelemetryPreflight> {
  const mimirBaseUrl = env.AGENTIC_ORG_MIMIR_BASE_URL;
  const mimirTenantId = env.AGENTIC_ORG_MIMIR_TENANT_ID ?? "anonymous";
  const tempoBaseUrl = env.AGENTIC_ORG_TEMPO_BASE_URL;
  const lokiBaseUrl = env.AGENTIC_ORG_LOKI_BASE_URL;
  if (mimirBaseUrl === undefined || tempoBaseUrl === undefined || lokiBaseUrl === undefined) {
    return {
      status: "missing_config",
      requiredEnv: [
        "AGENTIC_ORG_MIMIR_BASE_URL",
        "AGENTIC_ORG_TEMPO_BASE_URL",
        "AGENTIC_ORG_LOKI_BASE_URL",
      ],
    };
  }
  const port = createLgtmTelemetryQueryPort({ mimirBaseUrl, mimirTenantId, tempoBaseUrl, lokiBaseUrl });
  const [metrics, logs, traces] = await Promise.all([
    port.queryMetrics("up", range),
    port.queryLogs('{app=~".+"}', range),
    port.queryTraces("{}", range),
  ]);
  const degraded = [metrics, logs, traces].flatMap((result) =>
    result.status === "degraded" ? [`${result.source}:${result.reason}`] : [],
  );
  return degraded.length === 0
    ? { status: "ok", calls: ["metrics", "logs", "traces"] }
    : { status: "degraded", degraded };
}

await main();
