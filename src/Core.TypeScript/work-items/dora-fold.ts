/**
 * DORA Bag-folds over the work-item event G-Set (081KSXN940008QG0R002FWR9B2 slice 3).
 *
 * Metrics ride the same append-only log as the Z-set open-backlog view — no separate store.
 */
import { ofArray, stringCompare } from "../bag/bag";
import type { WorkItemType } from "../backlog/new-workitem";
import { eventOrder, foldWorkItemEvents, openWorkItems } from "./fold";
import type { WorkItemEvent } from "./types";

export interface WorkItemTimeline {
  readonly workItemId: string;
  readonly type: WorkItemType;
  readonly createdAt: string;
  readonly doneAt?: string;
  readonly closedAt?: string;
}

export interface LeadTimeSample {
  readonly workItemId: string;
  readonly type: WorkItemType;
  readonly createdAt: string;
  readonly completedAt: string;
  readonly leadTimeMs: number;
}

export interface OpenCountByType {
  readonly task: number;
  readonly bug: number;
  readonly total: number;
}

export interface ThroughputWeekRow {
  /** UTC Monday of the completion week (`YYYY-MM-DD`). */
  readonly weekStart: string;
  readonly taskCompletions: number;
  readonly bugCompletions: number;
  readonly totalCompletions: number;
}

export interface WorkItemDoraMetrics {
  readonly openByType: OpenCountByType;
  readonly leadTime: {
    readonly samples: readonly LeadTimeSample[];
    readonly averageMs: number | null;
    readonly count: number;
  };
  readonly throughputByWeek: readonly ThroughputWeekRow[];
}

/** UTC Monday `YYYY-MM-DD` for the week containing `iso`. */
export function utcWeekStart(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new Error(`dora-fold: invalid ISO timestamp ${JSON.stringify(iso)}`);
  }
  const d = new Date(ms);
  const dow = d.getUTCDay() || 7; // Mon=1 .. Sun=7
  d.setUTCDate(d.getUTCDate() - dow + 1);
  return d.toISOString().slice(0, 10);
}

/** Per-item lifecycle timestamps for DORA lead-time and throughput. */
export function foldWorkItemTimelines(events: readonly WorkItemEvent[]): Map<string, WorkItemTimeline> {
  const sorted = [...events].sort(eventOrder);
  const byId = new Map<string, WorkItemTimeline>();

  for (const event of sorted) {
    if (event.kind === "created") {
      byId.set(event.payload.workItemId, {
        workItemId: event.payload.workItemId,
        type: event.payload.type,
        createdAt: event.at,
      });
      continue;
    }
    if (event.kind === "state-changed" && event.payload.to === "done") {
      const prev = byId.get(event.payload.workItemId);
      if (prev) {
        byId.set(event.payload.workItemId, { ...prev, doneAt: event.at });
      }
      continue;
    }
    if (event.kind === "closed") {
      const prev = byId.get(event.payload.workItemId);
      if (prev) {
        byId.set(event.payload.workItemId, { ...prev, closedAt: event.at });
      }
    }
  }

  return byId;
}

export function leadTimeSamples(timelines: ReadonlyMap<string, WorkItemTimeline>): LeadTimeSample[] {
  const out: LeadTimeSample[] = [];
  for (const t of timelines.values()) {
    if (!t.doneAt) continue;
    const leadTimeMs = Date.parse(t.doneAt) - Date.parse(t.createdAt);
    if (leadTimeMs < 0) continue;
    out.push({
      workItemId: t.workItemId,
      type: t.type,
      createdAt: t.createdAt,
      completedAt: t.doneAt,
      leadTimeMs,
    });
  }
  return out.sort((a, b) => stringCompare(a.workItemId, b.workItemId));
}

export function averageLeadTimeMs(samples: readonly LeadTimeSample[]): number | null {
  if (samples.length === 0) return null;
  const sum = samples.reduce((acc, s) => acc + s.leadTimeMs, 0);
  return sum / samples.length;
}

export function openCountsByType(events: readonly WorkItemEvent[]): OpenCountByType {
  const timelines = foldWorkItemTimelines(events);
  const projections = foldWorkItemEvents(events);
  const open = openWorkItems(projections);
  let task = 0;
  let bug = 0;
  for (const p of open) {
    const type = timelines.get(p.workItemId)?.type;
    if (type === "task") task += 1;
    else if (type === "bug") bug += 1;
  }
  return { task, bug, total: task + bug };
}

type WeekTypeKey = `${string}\t${WorkItemType}`;

/** Bag-fold: count `state-changed → done` completions per UTC week and type. */
export function throughputByUtcWeek(events: readonly WorkItemEvent[]): ThroughputWeekRow[] {
  const timelines = foldWorkItemTimelines(events);
  const keys: WeekTypeKey[] = [];

  for (const event of events) {
    if (event.kind !== "state-changed" || event.payload.to !== "done") continue;
    const type = timelines.get(event.payload.workItemId)?.type;
    if (!type) continue;
    keys.push(`${utcWeekStart(event.at)}\t${type}`);
  }

  const bag = ofArray(stringCompare, keys);
  const byWeek = new Map<string, { task: number; bug: number }>();

  for (const entry of bag) {
    const tab = entry.e.lastIndexOf("\t");
    const weekStart = entry.e.slice(0, tab);
    const type = entry.e.slice(tab + 1) as WorkItemType;
    const row = byWeek.get(weekStart) ?? { task: 0, bug: 0 };
    if (type === "task") row.task += entry.n;
    else if (type === "bug") row.bug += entry.n;
    byWeek.set(weekStart, row);
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => stringCompare(a, b))
    .map(([weekStart, counts]) => ({
      weekStart,
      taskCompletions: counts.task,
      bugCompletions: counts.bug,
      totalCompletions: counts.task + counts.bug,
    }));
}

export function computeDoraMetrics(events: readonly WorkItemEvent[]): WorkItemDoraMetrics {
  const timelines = foldWorkItemTimelines(events);
  const samples = leadTimeSamples(timelines);
  return {
    openByType: openCountsByType(events),
    leadTime: {
      samples,
      averageMs: averageLeadTimeMs(samples),
      count: samples.length,
    },
    throughputByWeek: throughputByUtcWeek(events),
  };
}
