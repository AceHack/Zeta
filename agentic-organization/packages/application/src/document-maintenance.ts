/**
 * Document maintenance cycle (D4) — owned by the Documentation and Project Skills department,
 * the SAME observe->decide shape as the memory maintenance cycle. It computes the LEGAL
 * lifecycle moves and applies the deterministic ones automatically; the human/hat-gated ones
 * (promoting a load-bearing doc to canonical) are SURFACED for review, never auto-applied.
 *
 *   - freshness below the floor             -> active -> stale          (system, auto)
 *   - an older active unit on a topic that  -> active -> superseded     (steward, auto by recency)
 *     a newer canonical replaced
 *   - stale/superseded past the archive floor -> archived               (system, auto)
 *   - two active load-bearing units disagree -> flagged conflict        (hat triages; not auto)
 *
 * Every applied transition is checked against legalDocTransitions and emits a doc_* org_event;
 * the cycle ends with one doc_maintenance_cycle summary event.
 */

import {
  DocLifecycleState,
  OrgEventKind,
  isLegalDocTransition,
  isLoadBearing,
  type DocUnit,
  type OrgEvent,
} from "../../domain/src/index.ts";
import { canonicalizeByTopic } from "./document-entity-resolution.ts";

export type DocMaintenanceConfig = {
  organizationId: string;
  now: number; // ms
  createId: (prefix: string) => string;
  stalenessFloorMs: number; // freshness older than this -> stale
  archiveFloorMs: number; // stale/superseded older than this (by updatedAt) -> archived
};

export type DocStatusUpdate = {
  docUnitId: string;
  fromStatus: DocLifecycleState;
  nextStatus: DocLifecycleState;
};

export type DocMaintenanceResult = {
  updates: readonly DocStatusUpdate[];
  events: readonly OrgEvent[];
  staleFlagged: number;
  superseded: number;
  archived: number;
  conflicts: readonly { a: DocUnit; b: DocUnit }[];
};

function evt(config: DocMaintenanceConfig, kind: OrgEventKind, unit: DocUnit, from: DocLifecycleState, to: DocLifecycleState, decision: string): OrgEvent {
  return {
    id: config.createId("evt"),
    kind,
    occurredAt: new Date(config.now).toISOString(),
    organizationId: config.organizationId,
    subjectId: unit.docUnitId,
    fromState: from,
    toState: to,
    decision,
    supervisorChain: ["ceo", "documentation_systems_director"],
    evidenceRefs: [unit.contentRef],
    correlationId: unit.docUnitId,
    causationId: unit.docUnitId,
    traceId: unit.docUnitId,
  };
}

/**
 * Run one maintenance pass over the org's doc units. Pure: returns the status updates +
 * events to persist (the caller writes them), so it is deterministic + unit-testable.
 */
export function runDocMaintenanceCycle(units: readonly DocUnit[], config: DocMaintenanceConfig): DocMaintenanceResult {
  const updates: DocStatusUpdate[] = [];
  const events: OrgEvent[] = [];
  let staleFlagged = 0;
  let superseded = 0;
  let archived = 0;

  // index the next status we decide per unit, so archive sees the post-stale/supersede status
  const nextStatusOf = new Map<string, DocLifecycleState>(units.map((u) => [u.docUnitId, u.status]));
  const byId = new Map(units.map((u) => [u.docUnitId, u]));

  const move = (unit: DocUnit, to: DocLifecycleState, kind: OrgEventKind, decision: string): boolean => {
    const from = nextStatusOf.get(unit.docUnitId)!;
    if (from === to) return false;
    if (!isLegalDocTransition(from, to, isLoadBearing(unit.type))) return false;
    nextStatusOf.set(unit.docUnitId, to);
    updates.push({ docUnitId: unit.docUnitId, fromStatus: from, nextStatus: to });
    events.push(evt(config, kind, unit, from, to, decision));
    return true;
  };

  // 1) staleness — active units whose freshness is below the floor
  for (const unit of units) {
    if (unit.status !== DocLifecycleState.Active) continue;
    if (config.now - Date.parse(unit.freshnessAt) > config.stalenessFloorMs) {
      if (move(unit, DocLifecycleState.Stale, OrgEventKind.DocStaleFlagged, "freshness below floor -> stale")) staleFlagged += 1;
    }
  }

  // 2) supersession — within a topic group, older active units the newer canonical replaced.
  // A unit caught in a flagged CONFLICT (two active load-bearing units that DISAGREE) is NOT
  // auto-superseded by recency — a human/hat decides which wins; we only flag it.
  const groups = canonicalizeByTopic(units);
  const conflictIds = new Set(groups.flatMap((g) => g.conflicts).flatMap((c) => [c.a.docUnitId, c.b.docUnitId]));
  for (const g of groups) {
    for (const old of g.superseded) {
      if (conflictIds.has(old.docUnitId)) continue; // load-bearing disagreement → human decides
      const cur = byId.get(old.docUnitId)!;
      if (nextStatusOf.get(old.docUnitId) !== DocLifecycleState.Active) continue;
      if (move(cur, DocLifecycleState.Superseded, OrgEventKind.DocSuperseded, `superseded by canonical ${g.canonical.docUnitId}`)) superseded += 1;
    }
  }

  // 3) archive — stale/superseded units past the archive floor (by updatedAt)
  for (const unit of units) {
    const status = nextStatusOf.get(unit.docUnitId)!;
    if (status !== DocLifecycleState.Stale && status !== DocLifecycleState.Superseded) continue;
    if (config.now - Date.parse(unit.updatedAt) > config.archiveFloorMs) {
      if (move(unit, DocLifecycleState.Archived, OrgEventKind.DocArchived, `${status} past archive floor -> archived`)) archived += 1;
    }
  }

  const conflicts = groups.flatMap((g) => g.conflicts);
  for (const c of conflicts) {
    events.push(evt(config, OrgEventKind.DocLifecycleTransition, c.a, c.a.status, c.a.status, `conflict with ${c.b.docUnitId} on the same topic — flagged for documentation_reviewer (not auto-resolved)`));
  }

  events.push({
    id: config.createId("evt"),
    kind: OrgEventKind.DocMaintenanceCycle,
    occurredAt: new Date(config.now).toISOString(),
    organizationId: config.organizationId,
    subjectId: config.organizationId,
    decision: `doc maintenance: ${staleFlagged} stale, ${superseded} superseded, ${archived} archived, ${conflicts.length} conflicts flagged`,
    supervisorChain: ["ceo", "documentation_systems_director"],
    evidenceRefs: [],
    correlationId: config.organizationId,
    causationId: config.organizationId,
    traceId: config.organizationId,
  });

  return { updates, events, staleFlagged, superseded, archived, conflicts };
}
