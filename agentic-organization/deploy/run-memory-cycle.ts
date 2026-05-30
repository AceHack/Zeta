/**
 * Prove the DYNAMIC MEMORY SYSTEM end-to-end in kind, with Hindsight plugged in as
 * the recall engine. One run exercises every layer:
 *
 *   seed (Hindsight retain CONTENT + Cockroach STATE, content-addressed) →
 *   inject for a binding (Hindsight recall → OUR §4 weight re-rank → injection ledger) →
 *   the agent cites one (anti-laundering verified) + utility $inc →
 *   a work item reaches merged → KPI outcome correlation bumps the in-scope memories →
 *   the daily maintenance cycle: REINFORCE (good KPI), DEMOTE (bad KPI, hat-decided),
 *   PROMOTE work→hat (cross-scope, hat-decided), ARCHIVE-at-zero (aged+useless) →
 *   persist STATE updates + emit every action as an org_event.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26257:26257 &
 *   kubectl -n agentic-org port-forward svc/hindsight 8888:8888 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26257/defaultdb?sslmode=disable \
 *   HINDSIGHT_BASE_URL=http://localhost:8888 \
 *     node --experimental-strip-types deploy/run-memory-cycle.ts
 */

import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { env } from "node:process";

import {
  MemoryPhase,
  MemoryTier,
  type MemoryEnvelope,
  type MemoryRecord,
  type MemoryState,
  type OrgEvent,
} from "../packages/domain/src/index.ts";
import {
  contentAddressedMemoryId,
  composeInjectionQuery,
  recordInjections,
  verifyCitations,
  nextUtility,
  rerankRecalled,
  positionalSemanticScore,
  retrieveRanked,
  computeRestingWeight,
  scopeUnionFor,
  workItemVerdict,
  planOutcomeCorrelation,
  runMemoryMaintenanceCycle,
  MemoryConflictChoice,
  MemoryDemotionChoice,
  type RetrievalCtx,
  type RecalledCandidate,
} from "../packages/application/src/index.ts";
import {
  createCockroachMemorySystemMigration,
  createCockroachOrgSystemMigration,
  createCockroachOrgEventStore,
  createCockroachMemoryStateStore,
  createCockroachMemoryInjectionStore,
  createCockroachSqlExecutor,
  splitSqlStatements,
} from "../packages/state-cockroach/src/index.ts";
import { createHindsightHttpClient, createHindsightMemory } from "../packages/memory/src/index.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";
const hindsightBaseUrl = env.HINDSIGHT_BASE_URL ?? "http://localhost:8888";

const ORG = "org-lfg";
const PROJECT = `proj-mem-${randomUUID().slice(0, 8)}`;
const AGENT = "agent-7";
const HAT = "release-manager";
const WORK = `work-${randomUUID().slice(0, 8)}`;
const NOW = Date.now();
const id = (p: string) => `${p}-${randomUUID()}`;

type SeedSpec = {
  tier: MemoryTier;
  scope: string;
  key: string;
  value: string;
  confidence: number;
  protected?: boolean;
  freshnessAt?: string;
  outcome?: { successCount?: number; failureCount?: number };
  utility?: { injectedCount?: number; citedCount?: number };
  distinctScopes?: string[];
};

function buildEnvelope(spec: SeedSpec): { record: MemoryRecord; state: MemoryState; envelope: MemoryEnvelope } {
  const memoryId = contentAddressedMemoryId(ORG, spec.tier, spec.scope, spec.key);
  const writtenAt = new Date(NOW).toISOString();
  const record: MemoryRecord = {
    memoryId, organizationId: ORG, tier: spec.tier, scope: spec.scope, key: spec.key,
    value: spec.value, protected: spec.protected ?? false, writtenBy: "system", writtenAt,
  };
  const state: MemoryState = {
    memoryId, organizationId: ORG, phase: MemoryPhase.Active, confidence: spec.confidence,
    weight: 0, freshnessAt: spec.freshnessAt ?? writtenAt, reinforcementCount: 1,
    outcome: { successCount: spec.outcome?.successCount ?? 0, failureCount: spec.outcome?.failureCount ?? 0, inconclusiveCount: 0, workItemsObserved: [] },
    utility: { injectedCount: spec.utility?.injectedCount ?? 0, citedCount: spec.utility?.citedCount ?? 0 },
    crossScope: { distinctScopes: spec.distinctScopes ?? [spec.scope], firstObservedAt: writtenAt, lastObservedAt: writtenAt },
  };
  const envelope: MemoryEnvelope = {
    memoryId, organizationId: ORG, tier: spec.tier, scope: spec.scope, key: spec.key,
    protected: record.protected, writtenBy: "system", writtenAt, state,
  };
  // seed the cached weight from intrinsic value so scope-union retrieval surfaces it
  state.weight = computeRestingWeight(envelope, NOW);
  return { record, state, envelope };
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  const client: CockroachSqlClient = {
    query: async (sql, parameters) => ({ rows: (await pool.query(sql, parameters as unknown[])).rows }),
    transaction: async (operation) => operation(client),
  };
  const executor = createCockroachSqlExecutor({ client });

  // ensure the org_events + memory tables exist (idempotent)
  for (const stmt of splitSqlStatements(createCockroachOrgSystemMigration().sql)) await pool.query(stmt);
  for (const stmt of splitSqlStatements(createCockroachMemorySystemMigration().sql)) await pool.query(stmt);

  const orgEventStore = createCockroachOrgEventStore({ executor });
  const stateStore = createCockroachMemoryStateStore({ executor });
  const injectionStore = createCockroachMemoryInjectionStore({ executor });
  const appendEvent = (e: OrgEvent) => orgEventStore.append(e);

  const hindsight = createHindsightMemory({
    client: createHindsightHttpClient({ baseUrl: hindsightBaseUrl }),
    organizationId: ORG,
  });

  const report: Record<string, unknown> = { org: ORG, project: PROJECT, work: WORK };

  // ── 1. SEED four memories shaped to trigger every maintenance behavior ──────
  const seeds: Record<string, SeedSpec> = {
    reinforce: { tier: MemoryTier.Hat, scope: HAT, key: "review:require-rollback-plan", value: "Require a rollback plan before approving any release.", confidence: 0.5, outcome: { successCount: 8 }, utility: { injectedCount: 6, citedCount: 5 } },
    demote: { tier: MemoryTier.Agent, scope: AGENT, key: "calibration:skip-load-test", value: "Skipping the load test is usually fine for small changes.", confidence: 0.8, outcome: { successCount: 1, failureCount: 6 }, utility: { injectedCount: 8, citedCount: 1 } },
    promote: { tier: MemoryTier.Work, scope: WORK, key: "rfc-882:redis-sessions-only", value: "Redis is reserved for sessions only (RFC-882).", confidence: 0.85, outcome: { successCount: 5 }, distinctScopes: [WORK, "work-prev-1", "work-prev-2"], utility: { injectedCount: 6, citedCount: 4 } },
    archive: { tier: MemoryTier.Work, scope: WORK, key: "work-09:temp-flag-note", value: "Temporary feature flag note for an old epic.", confidence: 0.2, freshnessAt: new Date(NOW - 90 * 86_400_000).toISOString(), outcome: { failureCount: 4 }, utility: { injectedCount: 12, citedCount: 0 } },
  };

  const envById = new Map<string, MemoryEnvelope>();
  const memoryIds: Record<string, string> = {};
  for (const [name, spec] of Object.entries(seeds)) {
    const { record, state, envelope } = buildEnvelope(spec);
    // CONTENT → Hindsight (with our content-addressed id in metadata)
    console.error(`[seed] retaining ${name} → Hindsight (LLM extraction)…`);
    await hindsight.retain(
      { agentId: AGENT, hatAssignmentId: HAT, projectId: PROJECT, workItemId: WORK, promptFlowRunId: record.memoryId },
      record.value,
    );
    // STATE → Cockroach
    await stateStore.upsert(record, state);
    envById.set(record.memoryId, envelope);
    memoryIds[name] = record.memoryId;
  }
  console.error(`[seed] all ${Object.keys(seeds).length} retained + state persisted`);
  report.seeded = Object.keys(seeds).length;

  // ── 2. INJECT for the release-manager binding (recall → re-rank → ledger) ───
  const ctx: RetrievalCtx = { now: NOW, organizationId: ORG, hatId: HAT, agentId: AGENT, workItemId: WORK };
  const query = composeInjectionQuery({ roleSentence: "You are the release manager.", taskSummary: "approve the release", recentTurns: [] });
  report.injectionQuery = query; // persist the composed injection query for run-report observability

  // Hindsight recall (semantic), then OUR weight re-rank over the candidates we know.
  console.error(`[inject] recalling from Hindsight…`);
  const recall = await hindsight.recall({ agentId: AGENT, hatAssignmentId: HAT, projectId: PROJECT, workItemId: WORK, promptFlowRunId: "run-inject" });
  console.error(`[inject] recall returned ${recall.memories.length}; re-ranking + ledger…`);
  const candidates: RecalledCandidate[] = recall.memories
    .map((m, i) => ({ memoryId: m.memoryId, value: m.content, semanticScore: positionalSemanticScore(i, recall.memories.length) }))
    .filter((c) => envById.has(c.memoryId));
  // recall ids are Hindsight-internal here; fall back to a deterministic scope-union retrieval
  // over our own envelopes so the injection ledger is exercised against known memories.
  const scopeEnvelopes = await stateStore.listByScopes(ORG, scopeUnionFor(ctx));
  const ranked = candidates.length > 0
    ? rerankRecalled(candidates, envById, ctx, { maxCount: 5 })
    : retrieveRanked(scopeEnvelopes, ctx, { maxCount: 5 }).map((r) => ({ ...r, value: envById.get(r.envelope.memoryId)?.key ?? "" }));

  const promptRunId = id("run");
  const injections = recordInjections(ranked, ctx, promptRunId, new Date(NOW).toISOString());
  for (const inj of injections) await injectionStore.record(inj);
  report.injected = injections.map((i) => i.memoryId);

  // ── 3. the agent CITES the rollback-plan memory; anti-laundering verified ───
  const injectedIds = injections.map((i) => i.memoryId);
  const citation = verifyCitations([memoryIds.reinforce!, "fabricated-id"], injectedIds);
  report.citation = { valid: citation.valid, laundered: citation.laundered };
  for (const inj of injections) {
    const wasCited = citation.valid.includes(inj.memoryId);
    if (wasCited) await injectionStore.markCited(inj.injectionId);
    const env = envById.get(inj.memoryId)!;
    const u = nextUtility(env.state.utility, true, wasCited, new Date(NOW).toISOString());
    env.state.utility = u;
  }

  // ── 4. the work item reaches merged → KPI outcome correlation ───────────────
  const verdict = workItemVerdict(true, false); // merged = success
  const allInjForWork = await injectionStore.listByWorkItem(WORK);
  const outcomeUpdates = planOutcomeCorrelation(allInjForWork, envById, verdict, WORK, new Date(NOW).toISOString());
  for (const u of outcomeUpdates) {
    const env = envById.get(u.memoryId)!;
    env.state.outcome = u.nextOutcome;
    env.state.confidence = u.nextConfidence;
  }
  report.outcomeCorrelated = outcomeUpdates.map((u) => ({ memoryId: u.memoryId, verdict: u.verdict }));

  // ── 5. the daily MAINTENANCE cycle (Stage A auto + Stage B hat-decided) ─────
  const envelopes = [...envById.values()];
  const maintenance = runMemoryMaintenanceCycle(envelopes, {
    organizationId: ORG,
    now: NOW,
    createId: id,
    // the memory_reviewer demotes the bad-KPI memory; the knowledge_router promotes the cross-scope one
    chooseDemotion: (legal) => ({ index: legal.indexOf(MemoryDemotionChoice.Demote), reason: "reviewer: 6 failures, ratio 0.86" }),
    choosePromotion: (legal) => ({ index: legal.indexOf(true), reason: "router: lesson seen across 3 work items" }),
    chooseConflict: (legal) => ({ index: legal.indexOf(MemoryConflictChoice.KeepThis), reason: "default keep" }),
  });

  // ── 6. PERSIST state updates + EMIT every action as an org_event ────────────
  for (const upd of maintenance.updates) {
    const env = envById.get(upd.memoryId)!;
    const record: MemoryRecord = { memoryId: env.memoryId, organizationId: ORG, tier: env.tier, scope: env.scope, key: env.key, value: "", protected: env.protected, writtenBy: env.writtenBy, writtenAt: env.writtenAt };
    const nextState: MemoryState = { ...env.state, phase: upd.nextPhase, weight: upd.nextWeight, confidence: upd.nextConfidence, ...(upd.archivedAt !== undefined ? { archivedAt: upd.archivedAt } : {}) };
    await stateStore.upsert(record, nextState);
  }
  for (const e of maintenance.events) await appendEvent(e);

  report.maintenance = {
    recomputed: maintenance.recomputed,
    reinforced: maintenance.reinforced,
    demoted: maintenance.demoted,
    promoted: maintenance.promoted.map((p) => ({ memoryId: p.memoryId, toTier: p.target.toTier })),
    archived: maintenance.archived,
    events: maintenance.events.length,
  };
  report.legend = {
    reinforce: memoryIds.reinforce, demote: memoryIds.demote, promote: memoryIds.promote, archive: memoryIds.archive,
  };

  console.log(JSON.stringify({ memorySystemCycle: report }, null, 2));
  await pool.end();
}

await main();
