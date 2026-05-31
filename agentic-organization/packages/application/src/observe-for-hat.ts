/**
 * observeForHat — the ORGANIZATIONAL observe, scoped to a hat's authority
 * (WORK_OS_OVERHAUL §C2). Distinct from the per-run observe() in observe.ts
 * (which advances a single execution): this read answers "what does THIS hat see
 * and may prioritize", and it is DIFFERENT for every level of the hierarchy.
 *
 *   IndividualContributor → its own items          (individual scope)
 *   Lead / Manager        → its team's batches      (team scope, supervises subtree)
 *   Director              → its department's batches (department scope)
 *   C-suite / Board       → all batches             (organization scope)
 *
 * Each higher scope sees a higher-level rolled-up metric (aggregateMetrics), so
 * prioritization genuinely rolls up the hierarchy. The legal priority classes a
 * hat may set stay clamped by level (the P3 mechanism); what changes here is the
 * SCOPE of the objects being ordered.
 */

import { HatLevel, type ChangeSet, type HatDefinition, type OrgEvent, type WorkBatch, type WorkItem } from "../../domain/src/index.ts";
import { legalPriorityClassesFor, type PriorityClass } from "./prioritization.ts";
import {
  aggregateMetrics,
  rollUpBatchMetrics,
  type ScopeMetrics,
  type TestSummary,
  type WorkBatchMetrics,
} from "../../observability/src/work-batch-metrics.ts";
import { recordDoraMetricsTelemetry } from "../../observability/src/dora-metrics.ts";
import type { TelemetryPort } from "../../observability/src/telemetry-port.ts";

export const AuthorityScope = {
  Individual: "individual",
  Team: "team",
  Department: "department",
  Organization: "organization",
} as const;
export type AuthorityScope = (typeof AuthorityScope)[keyof typeof AuthorityScope];

export function authorityScopeOf(level: HatLevel): AuthorityScope {
  switch (level) {
    case HatLevel.ExecutiveBoard:
    case HatLevel.CSuite:
      return AuthorityScope.Organization;
    case HatLevel.Director:
      return AuthorityScope.Department;
    case HatLevel.Manager:
    case HatLevel.Lead:
      return AuthorityScope.Team;
    case HatLevel.IndividualContributor:
      return AuthorityScope.Individual;
    default: {
      const unhandled: never = level;
      return unhandled;
    }
  }
}

/** The set of hat ids at or below a hat (itself + transitive supervisees). */
export function authoritySubtree(hatId: string, byId: ReadonlyMap<string, HatDefinition>): ReadonlySet<string> {
  const out = new Set<string>();
  const stack = [hatId];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (out.has(cur)) continue;
    out.add(cur);
    for (const child of byId.get(cur)?.supervisesHatIds ?? []) stack.push(child);
  }
  return out;
}

/** The batches a hat may see + prioritize, by its authority scope. */
export function batchesInAuthorityScope(
  hat: HatDefinition,
  batches: readonly WorkBatch[],
  byId: ReadonlyMap<string, HatDefinition>,
): readonly WorkBatch[] {
  const scope = authorityScopeOf(hat.level);
  if (scope === AuthorityScope.Organization) return batches;
  const subtree = authoritySubtree(hat.id, byId);
  if (scope === AuthorityScope.Department) {
    return batches.filter((b) => subtree.has(b.ownerHatId) || byId.get(b.ownerHatId)?.departmentId === hat.departmentId);
  }
  if (scope === AuthorityScope.Team) {
    return batches.filter((b) => subtree.has(b.ownerHatId));
  }
  // individual
  return batches.filter((b) => b.ownerHatId === hat.id);
}

export type HatReadout = {
  hatId: string;
  level: HatLevel;
  authorityScope: AuthorityScope;
  batches: readonly { batch: WorkBatch; metrics: WorkBatchMetrics }[];
  scopeRollup: ScopeMetrics;
  /** the priority classes this hat may set (clamped by level) — the legal prioritization set */
  legalPriorityClasses: readonly PriorityClass[];
};

export type OrgWorkState = {
  hats: ReadonlyMap<string, HatDefinition>;
  batches: readonly WorkBatch[];
  itemsByBatch: ReadonlyMap<string, readonly WorkItem[]>;
  events: readonly OrgEvent[];
  changeSets?: readonly ChangeSet[];
  telemetry?: TelemetryPort;
  /** optional QA test summary per batch (W3 supplies it; absent → zeros) */
  testsByBatch?: ReadonlyMap<string, TestSummary>;
};

export function observeForHat(hat: HatDefinition, state: OrgWorkState): HatReadout {
  const inScope = batchesInAuthorityScope(hat, state.batches, state.hats);
  const batchViews = inScope.map((batch) => {
    const tests = state.testsByBatch?.get(batch.batchId);
    return {
      batch,
      metrics: rollUpBatchMetrics({
        batchId: batch.batchId,
        items: state.itemsByBatch.get(batch.batchId) ?? [],
        events: state.events,
        ...(tests !== undefined ? { tests } : {}),
        ...(state.changeSets !== undefined ? { changeSets: state.changeSets } : {}),
      }),
    };
  });
  const scopeRollup = aggregateMetrics(batchViews.map((b) => b.metrics));
  if (state.telemetry !== undefined) {
    for (const batchView of batchViews) {
      recordDoraMetricsTelemetry(state.telemetry, batchView.metrics.dora);
    }
    recordDoraMetricsTelemetry(state.telemetry, scopeRollup.dora);
  }
  return {
    hatId: hat.id,
    level: hat.level,
    authorityScope: authorityScopeOf(hat.level),
    batches: batchViews,
    scopeRollup,
    legalPriorityClasses: legalPriorityClassesFor(hat.level),
  };
}
