/**
 * Org runtime — the end-to-end org cycle that ties every layer together:
 * executive/director prioritization, RMO hat-supply voting, hat assignment +
 * binding, the 7-gate work pipeline (customer discovery → release), and the hat
 * binding lifecycle (warmup → active → expiry → succession).
 *
 * One run emits events attributed to actors at EVERY hierarchy level (Executive
 * Board → C-suite → Directors → Management → ICs), so observing the persisted
 * OrgEvent trace proves the whole hierarchy is working. Determinism drives which
 * gate/priority/supply/assignment is legal; agent choosers drive the outcomes.
 */

import {
  HatLevel,
  QualityGateKind,
  QualityGateOutcome,
  type HatBinding,
  type HatDefinition,
  type OrgEvent,
} from "../../domain/src/index.ts";
import { buildHatDefinitions } from "./org-seed.ts";
import { firstLegalChooser, type OrgChooser } from "./org-decision.ts";
import { computePriorityRecommendation, decidePriority, type PriorityInputs } from "./prioritization.ts";
import {
  computeRequiredHatSupply,
  decideHatSupply,
  decideRmoHatAssignment,
  rankRmoHatCandidates,
  type HatSupplyVote,
  type RankedRmoHatCandidate,
  type RmoHatCandidateReputation,
  type WorkloadItem,
} from "./rmo.ts";
import { assignHat, rankEligibleCandidates, type ActiveBindingSummary, type AgentCandidate } from "./assignment-engine.ts";
import { advanceBinding, beginBinding, planSuccession, successionEvent, type LifecycleContext } from "./hat-lifecycle.ts";
import { GateOwnerHats, evaluateGate, nextLegalGate, PipelineStage } from "./pipeline.ts";

export type OrgCycleDeps = {
  organizationId: string;
  workItemId: string;
  baseTimeMs: number;
  createId: (prefix: string) => string;
  appendEvent: (event: OrgEvent) => Promise<void>;
  upsertBinding: (binding: HatBinding) => Promise<void>;
  hats?: readonly HatDefinition[];
  rmoAssignmentChooser?: OrgChooser<RankedRmoHatCandidate>;
};

export type OrgCycleReport = {
  workItemId: string;
  finalStage: PipelineStage;
  totalEvents: number;
  eventsByLevel: Record<string, number>;
  bindingsCreated: number;
  gatesPassed: number;
  expiriesObserved: number;
  successionsPlanned: number;
  hotInputs: PriorityInputs;
};

/** root→hat supervisor chain (follows the single reportsTo edge up to the Executive Board). */
function chainFor(hatId: string, byId: ReadonlyMap<string, HatDefinition>): readonly string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = hatId;
  while (cur !== undefined && !seen.has(cur)) {
    chain.push(cur);
    seen.add(cur);
    cur = byId.get(cur)?.reportsToHatIds[0];
  }
  return chain.reverse();
}

const HOT: PriorityInputs = {
  executivePriority: 1, customerImpact: 1, severity: 0.8, releaseRisk: 0.6,
  blockedDownstreamCount: 3, dependencyFanOut: 2, queueAgeMs: 600_000, hatScarcity: 0.5, budgetBurn: 0.1, estimatedEffort: 0.4,
};

export async function runOrgCycle(deps: OrgCycleDeps): Promise<OrgCycleReport> {
  const hats = deps.hats ?? buildHatDefinitions();
  const byId = new Map(hats.map((h) => [h.id, h]));
  const eventsByLevel: Record<string, number> = Object.fromEntries(Object.values(HatLevel).map((l) => [l, 0]));
  let total = 0;

  const emit = async (event: OrgEvent): Promise<void> => {
    await deps.appendEvent(event);
    total += 1;
    const lvl = event.actorHatId !== undefined ? byId.get(event.actorHatId)?.level : undefined;
    if (lvl !== undefined) eventsByLevel[lvl] = (eventsByLevel[lvl] ?? 0) + 1;
  };

  const iso = (ms: number): string => new Date(ms).toISOString();
  const t0 = deps.baseTimeMs;
  const corr = deps.workItemId;
  // strictly-monotonic recording clock so the trace (and the snapshot fold) is
  // unambiguously ordered even when many events are produced in one cycle.
  let tick = 0;
  const nextIso = (): string => iso(t0 + tick++ * 1000);

  const priorityCtx = (hatId: string) => ({
    createEventId: () => deps.createId("evt"),
    nowIso: nextIso,
    organizationId: deps.organizationId,
    supervisorChain: chainFor(hatId, byId),
    correlationId: corr, causationId: corr, traceId: corr,
  });

  // ── 1. Executive Board + C-suite set strategic priority (top of the hierarchy acts) ──
  const rec = computePriorityRecommendation(deps.workItemId, HOT, []);
  for (const execHatId of ["executive_board_member", "ceo"]) {
    const hat = byId.get(execHatId)!;
    const r = decidePriority({ recommendation: rec, deciderHat: hat, chooser: firstLegalChooser() }, priorityCtx(execHatId));
    if (r.outcome === "decided") await emit(r.event);
  }

  // ── 2. A Director sets the work-item priority ──
  const director = byId.get("engineering_director")!;
  const dirDecision = decidePriority({ recommendation: rec, deciderHat: director, chooser: firstLegalChooser() }, priorityCtx("engineering_director"));
  const priorityClass = dirDecision.outcome === "decided" ? dirDecision.decision.priorityClass : rec.priorityClass;
  if (dirDecision.outcome === "decided") await emit(dirDecision.event);

  // ── 3. RMO: required supply for the gate-owner hats → supervisors vote → supply decisions ──
  const ownerHatIds = [...new Set(Object.values(GateOwnerHats).flat()), "team_lead"];
  const workload: WorkloadItem[] = [{ workItemId: deps.workItemId, priorityClass, requiredHats: ownerHatIds }];
  const required = computeRequiredHatSupply(workload);
  const supplyVoters = ["engineering_director", "cfo", "cost_controller"];
  const supplyTargets = new Map<string, number>();
  for (const hatId of ownerHatIds) {
    const requiredCount = required.get(hatId) ?? 1;
    const votes: HatSupplyVote[] = supplyVoters.map((v) => ({ voterHatId: v, approve: true, proposedTarget: requiredCount }));
    const { decision, event } = decideHatSupply(
      { hatId, hatName: byId.get(hatId)?.name ?? hatId, requiredCount, currentCount: 0, votes },
      { ...priorityCtx("cfo") },
    );
    await emit(event);
    supplyTargets.set(hatId, Math.max(1, decision.targetCount));
  }

  // ── 4. Assign + bind each owner hat (managers + leads + ICs get staffed) ──
  const activeBindings: ActiveBindingSummary[] = [];
  const bindings: HatBinding[] = [];
  let agentSeq = 0;
  for (const hatId of ownerHatIds) {
    const hat = byId.get(hatId)!;
    const candidates: AgentCandidate[] = [0, 1].map((i) => ({ agentId: `agent-${hatId}-${i}`, reputationByHat: { [hatId]: 10 - i } }));
    const ranked = rankEligibleCandidates({ hat, candidates, activeBindings, nowMs: t0 });
    const rmoRanked = rankRmoHatCandidates({
      hatId,
      candidates: ranked.map((candidate, index): RmoHatCandidateReputation => {
        const reputation = (candidate.reputationByHat[hatId] ?? 0) / 10;
        return {
          agentId: candidate.agentId,
          hatId,
          agentHatReputation: reputation,
          recentOutcomeScore: Math.max(0.4, reputation - index * 0.05),
          scheduleReliability: index === 0 ? 0.85 : 0.75,
          reviewQuality: 0.75,
          qaPassRate: 0.75,
          completionRate: 0.8,
          contextFit: 0.8,
          currentLoad: 0,
          freshness: index === 0 ? 0.45 : 0.8,
          explorationBonus: index === 0 ? 0 : 0.25,
          consecutiveAssignmentCount: 0,
          recentSameHatAssignments: 0,
        };
      }),
    });
    const rmoAssignment = decideRmoHatAssignment(
      {
        hatId,
        hatName: hat.name,
        rankedCandidates: rmoRanked,
        chooser: deps.rmoAssignmentChooser ?? firstLegalChooser(),
      },
      { createEventId: () => deps.createId("evt"), nowIso: nextIso, organizationId: deps.organizationId, supervisorChain: chainFor(hatId, byId), correlationId: corr, causationId: corr, traceId: corr },
    );
    if (rmoAssignment.outcome === "no_legal_candidate") continue;
    await emit(rmoAssignment.event);
    const selectedAgentId = rmoAssignment.selected.agentId;
    const assignment = assignHat(
      {
        hat,
        eligibleRanked: ranked,
        activeWearerCount: 0,
        supplyTarget: supplyTargets.get(hatId) ?? 1,
        chooser: (legal) => ({
          index: Math.max(0, legal.findIndex((candidate) => candidate.agentId === selectedAgentId)),
          reason: `RMO office selected ${selectedAgentId}`,
        }),
      },
      { createEventId: () => deps.createId("evt"), nowIso: nextIso, organizationId: deps.organizationId, supervisorChain: chainFor(hatId, byId), correlationId: corr, causationId: corr, traceId: corr },
    );
    if (assignment.outcome === "no_eligible_candidate") continue;
    await emit(assignment.event);
    if (assignment.outcome !== "assigned") continue;

    const ctx: LifecycleContext = {
      clock: { nowMs: () => t0, nowIso: nextIso },
      createEventId: () => deps.createId("evt"),
      supervisorChain: chainFor(hatId, byId),
      correlationId: corr, causationId: corr, traceId: corr,
    };
    const { binding, event } = beginBinding(
      { bindingId: deps.createId("binding"), hat, wearerAgentId: assignment.agentId, organizationId: deps.organizationId },
      ctx,
    );
    await emit(event);
    await deps.upsertBinding(binding);
    bindings.push(binding);
    activeBindings.push({ hatId, wearerAgentId: assignment.agentId, phase: binding.phase });
    agentSeq += 1;
  }

  // ── 5. Drive the work item through all 7 gates (owner hats approve; ICs + managers act) ──
  const passed = new Set<QualityGateKind>();
  let gatesPassed = 0;
  let guard = 0;
  for (let gate = nextLegalGate(passed); gate !== undefined && guard < 10; gate = nextLegalGate(passed), guard += 1) {
    const ownerId = GateOwnerHats[gate].find((id) => byId.get(id)?.approvalScopes.includes(gate));
    if (ownerId === undefined) break;
    const ownerHat = byId.get(ownerId)!;
    const result = evaluateGate(
      { workItemId: deps.workItemId, gateKind: gate, evaluatorHat: ownerHat, passedGateKinds: passed, outcomeChooser: () => ({ index: 0, reason: "owner approves on evidence" }) },
      { createEventId: () => deps.createId("evt"), nowIso: nextIso, organizationId: deps.organizationId, supervisorChain: chainFor(ownerId, byId), correlationId: corr, causationId: corr, traceId: corr },
    );
    if (result.outcome !== "evaluated") break;
    for (const e of result.events) await emit(e);
    if (result.evaluation.outcome === QualityGateOutcome.Approved) {
      passed.add(gate);
      gatesPassed += 1;
    } else {
      break;
    }
  }
  const finalStage = nextLegalGate(passed) === undefined ? PipelineStage.Merged : PipelineStage.Intake;

  // ── 6. Hat binding lifecycle: warm up → active → expire → succession (observable) ──
  let expiriesObserved = 0;
  let successionsPlanned = 0;
  const leadBinding = bindings.find((b) => byId.get(b.hatId)?.level === HatLevel.Lead) ?? bindings[0];
  if (leadBinding !== undefined) {
    const hat = byId.get(leadBinding.hatId)!;
    // advance past warmup → Active
    const tActive = Date.parse(leadBinding.warmupEndsAt) + 1000;
    const activeCtx: LifecycleContext = { clock: { nowMs: () => tActive, nowIso: nextIso }, createEventId: () => deps.createId("evt"), supervisorChain: chainFor(hat.id, byId), correlationId: corr, causationId: corr, traceId: corr };
    const active = advanceBinding(leadBinding, hat, activeCtx);
    if (active.event !== undefined) { await emit(active.event); await deps.upsertBinding(active.binding); }
    // advance past TTL → Expired
    const tExpire = Date.parse(leadBinding.expiresAt) + 1000;
    const expireCtx: LifecycleContext = { clock: { nowMs: () => tExpire, nowIso: nextIso }, createEventId: () => deps.createId("evt"), supervisorChain: chainFor(hat.id, byId), correlationId: corr, causationId: corr, traceId: corr };
    const expired = advanceBinding(active.binding, hat, expireCtx);
    if (expired.event !== undefined) { await emit(expired.event); await deps.upsertBinding(expired.binding); expiriesObserved += 1; }
    // plan succession for the now-vacant hat
    const plan = planSuccession({ hat, candidateAgentIds: [`agent-${hat.id}-0`, `agent-${hat.id}-1`], lastWearerAgentId: leadBinding.wearerAgentId });
    await emit(successionEvent(plan, hat, deps.organizationId, expireCtx));
    successionsPlanned += 1;
  }

  return {
    workItemId: deps.workItemId,
    finalStage,
    totalEvents: total,
    eventsByLevel,
    bindingsCreated: bindings.length,
    gatesPassed,
    expiriesObserved,
    successionsPlanned,
    hotInputs: HOT,
  };
}
