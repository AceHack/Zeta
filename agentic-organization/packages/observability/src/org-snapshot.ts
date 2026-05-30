/**
 * Org snapshot — the "what is happening right now" projection. A pure fold over
 * the hat catalog, current hat bindings, and the OrgEvent trace. It makes the
 * whole organization legible in one structure:
 *
 *   - activity at every hierarchy level (Executive Board → IC) — proof the whole
 *     hierarchy is working,
 *   - active wearers per department + per hat,
 *   - the pipeline stage of every work item,
 *   - bindings expiring soon,
 *   - the latest RMO supply + priority decisions,
 *   - the most recent decisions, in plain language.
 *
 * Everything is derived from the durable OrgEvent stream + binding rows, so the
 * snapshot can never drift from the trace.
 */

import { HatLevel, type DepartmentId, type HatDefinition } from "../../domain/src/index.ts";
import { OrgEventKind, type OrgEvent } from "../../domain/src/index.ts";
import { TerminalHatBindingPhases, type HatBinding } from "../../domain/src/index.ts";

const HIERARCHY_ORDER: readonly HatLevel[] = [
  HatLevel.ExecutiveBoard,
  HatLevel.CSuite,
  HatLevel.Director,
  HatLevel.Manager,
  HatLevel.Lead,
  HatLevel.IndividualContributor,
];

export type HatLevelActivity = {
  level: HatLevel;
  eventCount: number;
  actingHatIds: readonly string[];
};

export type ActiveBindingView = {
  hatId: string;
  hatName: string;
  departmentId: DepartmentId;
  level: HatLevel;
  wearerAgentId: string;
  phase: string;
  expiresInSeconds: number;
};

export type DepartmentSnapshot = {
  departmentId: DepartmentId;
  activeHatCount: number;
  activeWearerCount: number;
};

export type PipelineView = {
  workItemId: string;
  stage: string;
};

export type RecentEventView = {
  kind: OrgEventKind;
  occurredAt: string;
  actorHatId?: string;
  decision: string;
};

export type OrgSnapshot = {
  generatedAt: string;
  totalHats: number;
  totalActiveBindings: number;
  /** Executive Board → IC; eventCount/actingHatIds prove activity at each level */
  hierarchyActivity: readonly HatLevelActivity[];
  departments: readonly DepartmentSnapshot[];
  activeBindings: readonly ActiveBindingView[];
  expiringSoon: readonly ActiveBindingView[];
  pipeline: readonly PipelineView[];
  latestPriorityByWorkItem: Readonly<Record<string, string>>;
  latestSupplyByHat: Readonly<Record<string, string>>;
  recentEvents: readonly RecentEventView[];
};

export type BuildOrgSnapshotInput = {
  hats: readonly HatDefinition[];
  bindings: readonly HatBinding[];
  events: readonly OrgEvent[];
  nowMs: number;
  nowIso: string;
  /** bindings within this window are "expiring soon" (default 30s) */
  expiringWindowSeconds?: number;
  /** how many recent events to include (default 25) */
  recentEventLimit?: number;
};

export function buildOrgSnapshot(input: BuildOrgSnapshotInput): OrgSnapshot {
  const byHatId = new Map(input.hats.map((h) => [h.id, h]));
  const expiringWindow = (input.expiringWindowSeconds ?? 30) * 1000;
  const recentLimit = input.recentEventLimit ?? 25;

  const activeBindings = input.bindings.filter((b) => !TerminalHatBindingPhases.has(b.phase));

  const activeViews: ActiveBindingView[] = activeBindings.map((b) => {
    const hat = byHatId.get(b.hatId);
    return {
      hatId: b.hatId,
      hatName: hat?.name ?? b.hatId,
      departmentId: (hat?.departmentId ?? "unknown") as DepartmentId,
      level: hat?.level ?? HatLevel.IndividualContributor,
      wearerAgentId: b.wearerAgentId,
      phase: b.phase,
      expiresInSeconds: Math.max(0, Math.round((Date.parse(b.expiresAt) - input.nowMs) / 1000)),
    };
  });

  // department rollup
  const deptMap = new Map<DepartmentId, { hats: Set<string>; wearers: number }>();
  for (const v of activeViews) {
    const entry = deptMap.get(v.departmentId) ?? { hats: new Set<string>(), wearers: 0 };
    entry.hats.add(v.hatId);
    entry.wearers += 1;
    deptMap.set(v.departmentId, entry);
  }
  const departments: DepartmentSnapshot[] = [...deptMap.entries()].map(([departmentId, e]) => ({
    departmentId,
    activeHatCount: e.hats.size,
    activeWearerCount: e.wearers,
  }));

  // hierarchy activity from the event stream (by the level of the acting hat)
  const levelEvents = new Map<HatLevel, { count: number; hats: Set<string> }>(
    HIERARCHY_ORDER.map((l) => [l, { count: 0, hats: new Set<string>() }]),
  );
  for (const e of input.events) {
    if (e.actorHatId === undefined) continue;
    const hat = byHatId.get(e.actorHatId);
    if (hat === undefined) continue;
    const entry = levelEvents.get(hat.level);
    if (entry === undefined) continue;
    entry.count += 1;
    entry.hats.add(hat.id);
  }
  const hierarchyActivity: HatLevelActivity[] = HIERARCHY_ORDER.map((level) => {
    const e = levelEvents.get(level)!;
    return { level, eventCount: e.count, actingHatIds: [...e.hats] };
  });

  // latest-state-per-subject, computed order-independently so the snapshot is
  // correct regardless of whether the event store returns rows ASC or DESC.
  // We keep the winning event's occurredAt and only overwrite on a strictly
  // newer (or equal — last-seen breaks ties) timestamp.
  const pipelineMap = new Map<string, string>();
  const priorityMap = new Map<string, string>();
  const supplyMap = new Map<string, string>();
  const latestAt = new Map<string, number>(); // key = `${kind}:${subjectId}`
  const keepLatest = (map: Map<string, string>, kind: string, e: { subjectId: string; toState?: string; occurredAt: string }): void => {
    if (e.toState === undefined) return;
    const key = `${kind}:${e.subjectId}`;
    const at = Date.parse(e.occurredAt);
    const prior = latestAt.get(key);
    if (prior === undefined || at >= prior) {
      latestAt.set(key, at);
      map.set(e.subjectId, e.toState);
    }
  };
  for (const e of input.events) {
    if (e.kind === OrgEventKind.PipelineStageTransition) {
      keepLatest(pipelineMap, "pipeline", e);
    } else if (e.kind === OrgEventKind.PriorityDecision) {
      keepLatest(priorityMap, "priority", e);
    } else if (e.kind === OrgEventKind.HatSupplyDecision) {
      keepLatest(supplyMap, "supply", e);
    }
  }

  const recentEvents: RecentEventView[] = [...input.events]
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, recentLimit)
    .map((e) => ({ kind: e.kind, occurredAt: e.occurredAt, ...(e.actorHatId !== undefined ? { actorHatId: e.actorHatId } : {}), decision: e.decision }));

  return {
    generatedAt: input.nowIso,
    totalHats: input.hats.length,
    totalActiveBindings: activeBindings.length,
    hierarchyActivity,
    departments,
    activeBindings: activeViews,
    expiringSoon: activeViews.filter((v) => v.expiresInSeconds * 1000 <= expiringWindow),
    pipeline: [...pipelineMap.entries()].map(([workItemId, stage]) => ({ workItemId, stage })),
    latestPriorityByWorkItem: Object.fromEntries(priorityMap),
    latestSupplyByHat: Object.fromEntries(supplyMap),
    recentEvents,
  };
}

/** Render the snapshot as a compact human-readable report (the in-cluster "what's happening"). */
export function renderOrgSnapshot(snapshot: OrgSnapshot): string {
  const lines: string[] = [];
  lines.push(`ORG SNAPSHOT @ ${snapshot.generatedAt}`);
  lines.push(`hats=${snapshot.totalHats} active_bindings=${snapshot.totalActiveBindings}`);
  lines.push("HIERARCHY ACTIVITY (events by acting-hat level):");
  for (const h of snapshot.hierarchyActivity) {
    lines.push(`  ${h.level.padEnd(22)} events=${h.eventCount} hats=[${h.actingHatIds.join(", ")}]`);
  }
  lines.push(`DEPARTMENTS active: ${snapshot.departments.length}`);
  lines.push("PIPELINE:");
  for (const p of snapshot.pipeline) {
    lines.push(`  ${p.workItemId} → ${p.stage}`);
  }
  lines.push(`EXPIRING SOON: ${snapshot.expiringSoon.map((b) => `${b.hatId}(${b.expiresInSeconds}s)`).join(", ")}`);
  return lines.join("\n");
}
