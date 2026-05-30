import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { DocType, DocScopeKind, DocLifecycleState, OrgEventKind, type DocUnit } from "../../domain/src/index.ts";
import { runDocMaintenanceCycle, type DocMaintenanceConfig } from "../src/index.ts";

const NOW = Date.parse("2026-05-30T00:00:00Z");
const DAY = 86_400_000;
let seq = 0;
const config: DocMaintenanceConfig = { organizationId: "org-lfg", now: NOW, createId: (p) => `${p}-${++seq}`, stalenessFloorMs: 30 * DAY, archiveFloorMs: 180 * DAY };

function u(over: Partial<DocUnit>): DocUnit {
  return {
    docUnitId: "u", organizationId: "org-lfg", sourceId: "s", type: DocType.Runbook, scopeKind: DocScopeKind.Department,
    scopeId: "eng", title: "t", summary: "", contentRef: "ref", contentHash: "h", status: DocLifecycleState.Active,
    freshnessAt: new Date(NOW).toISOString(), boundHatIds: [], boundStageIds: [], createdAt: new Date(NOW).toISOString(), updatedAt: new Date(NOW).toISOString(), version: 1, ...over,
  };
}

test("active units with freshness below the floor are flagged stale (auto)", () => {
  const r = runDocMaintenanceCycle([u({ docUnitId: "fresh" }), u({ docUnitId: "old", freshnessAt: new Date(NOW - 90 * DAY).toISOString() })], config);
  equal(r.staleFlagged, 1);
  ok(r.updates.some((x) => x.docUnitId === "old" && x.nextStatus === DocLifecycleState.Stale));
  ok(r.events.some((e) => e.kind === OrgEventKind.DocStaleFlagged));
});

test("an older active unit on a topic a newer canonical replaced is superseded (auto by recency)", () => {
  const r = runDocMaintenanceCycle([
    u({ docUnitId: "new", title: "System Architecture", updatedAt: new Date(NOW - 1 * DAY).toISOString() }),
    u({ docUnitId: "old", title: "system architecture", updatedAt: new Date(NOW - 100 * DAY).toISOString() }),
  ], config);
  ok(r.updates.some((x) => x.docUnitId === "old" && x.nextStatus === DocLifecycleState.Superseded));
  equal(r.superseded, 1);
});

test("stale/superseded units past the archive floor are archived (auto)", () => {
  const r = runDocMaintenanceCycle([
    u({ docUnitId: "ancient", status: DocLifecycleState.Stale, updatedAt: new Date(NOW - 365 * DAY).toISOString() }),
  ], config);
  ok(r.updates.some((x) => x.docUnitId === "ancient" && x.nextStatus === DocLifecycleState.Archived));
  equal(r.archived, 1);
});

test("two active load-bearing units that disagree are flagged for hat triage — NOT auto-resolved", () => {
  const r = runDocMaintenanceCycle([
    u({ docUnitId: "a", type: DocType.Policy, title: "Security Policy", contentHash: "h1" }),
    u({ docUnitId: "b", type: DocType.Policy, title: "security policy", contentHash: "h2" }),
  ], config);
  equal(r.conflicts.length, 1);
  // a conflict does not by itself change either unit's status
  ok(!r.updates.some((x) => x.docUnitId === "a" || x.docUnitId === "b"));
});

test("every pass ends with one doc_maintenance_cycle summary event", () => {
  const r = runDocMaintenanceCycle([u({})], config);
  equal(r.events.filter((e) => e.kind === OrgEventKind.DocMaintenanceCycle).length, 1);
});
