/**
 * Onboarding-as-work + self-healing (C2/C6) — the org adapts by emitting WORK for itself, which
 * flows through the same work loop as everything else. Onboarding a tenant is not a special
 * script: it is a set of work items (ingest the docs, build the codebase graph, seed the
 * handbooks, confirm the autonomy dial) the org executes. Self-healing is the same shape in
 * reverse: drift signals (stale docs, failing gates, low-confidence edges, doc conflicts) become
 * corrective work items. Both are pure planners — deterministic, testable — returning the work to
 * create + the org_events that record the decision.
 */

import { WorkItemType, OrgEventKind, type OrgEvent, type TenantConfig } from "../../domain/src/index.ts";

export type PlannedWork = {
  workItemType: WorkItemType;
  title: string;
  description: string;
};

export type AdaptationDeps = {
  organizationId: string;
  now: () => number;
  createId: (prefix: string) => string;
};

function event(deps: AdaptationDeps, kind: OrgEventKind, subjectId: string, decision: string): OrgEvent {
  return {
    id: deps.createId("evt"), kind, occurredAt: new Date(deps.now()).toISOString(), organizationId: deps.organizationId,
    subjectId, decision, supervisorChain: ["ceo"], evidenceRefs: [], correlationId: subjectId, causationId: subjectId, traceId: subjectId,
  };
}

/**
 * Plan a tenant's onboarding as work. Each connector becomes an ingest task; the codebase graph,
 * handbook seeding, and autonomy confirmation are tasks too — so onboarding is the org doing its
 * own bootstrap through the normal loop, not a one-off migration.
 */
export function planOnboarding(config: TenantConfig, deps: AdaptationDeps): { work: readonly PlannedWork[]; events: readonly OrgEvent[] } {
  const work: PlannedWork[] = [
    { workItemType: WorkItemType.Task, title: "Ingest the tenant's existing documentation", description: "Run the doc connectors → structural units at draft; load-bearing docs route to review." },
    { workItemType: WorkItemType.Task, title: "Build the codebase knowledge graph", description: "Deterministic extraction of services/deps/endpoints; enrichment adds ownership/risk as inferred." },
    { workItemType: WorkItemType.Task, title: "Seed canonical handbooks from ingested docs", description: "Canonicalize per topic; bind handbooks to their workflow stages." },
    { workItemType: WorkItemType.Task, title: `Confirm the autonomy dial (${config.autonomy.level})`, description: `Review which stages require humans: ${config.autonomy.humanGatedStageIds.join(", ") || "none pinned"}.` },
  ];
  const events = work.map((w) => event(deps, OrgEventKind.IntakeReceived, deps.createId("onboard"), `onboarding work planned: ${w.title}`));
  return { work, events };
}

/** Drift signals the org watches; each non-zero signal becomes corrective work. */
export type DriftSignal = {
  staleDocCount: number;
  failingGateCount: number;
  lowConfidenceEdgeCount: number;
  docConflictCount: number;
};

/**
 * Plan self-healing work from drift signals. Only non-zero signals produce work (no busy-work), and
 * each correction is a normal work item the org executes — the platform heals by doing work, not by
 * a privileged side-channel.
 */
export function planSelfHealing(signal: DriftSignal, deps: AdaptationDeps): { work: readonly PlannedWork[]; events: readonly OrgEvent[] } {
  const work: PlannedWork[] = [];
  if (signal.staleDocCount > 0) work.push({ workItemType: WorkItemType.Task, title: `Re-review ${signal.staleDocCount} stale documents`, description: "Freshness fell below floor; the Documentation department re-verifies or archives." });
  if (signal.failingGateCount > 0) work.push({ workItemType: WorkItemType.Defect, title: `Investigate ${signal.failingGateCount} failing quality gate(s)`, description: "A gate regressed; open a defect and route to the owning hat." });
  if (signal.lowConfidenceEdgeCount > 0) work.push({ workItemType: WorkItemType.Task, title: `Verify ${signal.lowConfidenceEdgeCount} low-confidence graph edge(s)`, description: "Inferred edges await confirmation; a hat verifies or retracts them." });
  if (signal.docConflictCount > 0) work.push({ workItemType: WorkItemType.Task, title: `Resolve ${signal.docConflictCount} document conflict(s)`, description: "Two active load-bearing docs disagree on a topic; documentation_reviewer decides — never auto-averaged." });
  const events = work.map((w) => event(deps, OrgEventKind.ChurnDetected, deps.createId("heal"), `self-healing work planned: ${w.title}`));
  return { work, events };
}
