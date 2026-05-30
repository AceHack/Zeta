import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { DocType, DocScopeKind, DocLifecycleState, type DocEntity, type DocUnit } from "../../domain/src/index.ts";
import { runRetrieval, type RetrievalContext } from "../src/index.ts";

const billing: DocEntity = { docEntityId: "ent-billing", organizationId: "org-lfg", canonicalName: "Billing", kind: "service", aliases: ["the billing service", "services/billing"], createdAt: "t", updatedAt: "t" };

function u(over: Partial<DocUnit>): DocUnit {
  return {
    docUnitId: "u", organizationId: "org-lfg", sourceId: "s", type: DocType.Runbook, scopeKind: DocScopeKind.Department,
    scopeId: "eng", title: "t", summary: "", contentRef: "ref", contentHash: "h", status: DocLifecycleState.Active,
    freshnessAt: "2026-05-30T00:00:00Z", boundHatIds: [], boundStageIds: [], createdAt: "2026-05-01T00:00:00Z", updatedAt: "2026-05-01T00:00:00Z", version: 1, ...over,
  };
}

const ctx: RetrievalContext = { organizationId: "org-lfg", stageId: "release", scopes: [{ kind: DocScopeKind.Department, id: "eng" }] };

test("Stage 1 scope pre-filter: a wrong-team doc NEVER surfaces, even if lexically identical", () => {
  const corpus = [
    u({ docUnitId: "eng-deploy", scopeId: "eng", title: "Deploy guide", summary: "how to deploy the release" }),
    u({ docUnitId: "sales-deploy", scopeId: "sales", title: "Deploy guide", summary: "how to deploy the release" }),
  ];
  const r = runRetrieval("how to deploy", ctx, corpus, []);
  equal(r.diagnostics.corpusSize, 2);
  equal(r.diagnostics.afterScope, 1, "scope cut the corpus to the legal slice");
  ok(r.hits.every((h) => h.unit.docUnitId !== "sales-deploy"), "the wrong-team doc is unreachable");
});

test("Stage 2/3 entity anchoring: a unit about 'Billing' surfaces for 'the billing service' (RAG recall miss)", () => {
  const corpus = [
    u({ docUnitId: "billing-rb", title: "Billing runbook", summary: "restart the billing service workers" }),
    u({ docUnitId: "unrelated", title: "Coffee machine", summary: "descale monthly" }),
  ];
  const r = runRetrieval("the billing service is down", ctx, corpus, [billing]);
  ok(r.diagnostics.queryEntities.includes("ent-billing"), "the query resolved to the canonical entity node");
  equal(r.hits[0]!.unit.docUnitId, "billing-rb");
  ok(r.hits[0]!.reasons.includes("entity-anchored"));
});

test("Stage 4 summary-first: hits carry a summary + a drill pointer (contentRef), not raw chunks", () => {
  const corpus = [u({ docUnitId: "x", title: "Release checklist", summary: "tag, build, sign, ship", contentRef: "git:RELEASE.md#Release checklist" })];
  const r = runRetrieval("release checklist", ctx, corpus, []);
  equal(r.hits[0]!.unit.summary, "tag, build, sign, ship");
  equal(r.hits[0]!.unit.contentRef, "git:RELEASE.md#Release checklist");
});

test("Stage 6 KPI rerank: usefulness (consult outcomes) beats raw similarity", () => {
  const corpus = [
    u({ docUnitId: "useful", title: "Release runbook", summary: "the release process" }),
    u({ docUnitId: "useless", title: "Release runbook", summary: "the release process" }),
  ];
  const consultOutcomes = new Map([
    ["useful", { success: 9, failure: 0 }],
    ["useless", { success: 0, failure: 9 }],
  ]);
  const r = runRetrieval("release process", ctx, corpus, [], { consultOutcomes });
  equal(r.hits[0]!.unit.docUnitId, "useful", "the historically-helpful unit ranks first");
  ok(r.hits[0]!.reasons.some((x) => x.startsWith("kpi:")));
});

test("Stage 7 staleness: a stale unit is demoted below an equally-similar active one", () => {
  const corpus = [
    u({ docUnitId: "fresh", status: DocLifecycleState.Active, title: "Release runbook", summary: "release steps" }),
    u({ docUnitId: "old", status: DocLifecycleState.Stale, scopeId: "eng", title: "Release runbook", summary: "release steps" }),
  ];
  // stale units are not retrieval-eligible, so they are scoped out entirely (the strongest demotion)
  const r = runRetrieval("release steps", ctx, corpus, []);
  ok(r.hits.every((h) => h.unit.docUnitId !== "old"), "a stale unit does not surface in default retrieval");
  equal(r.hits[0]!.unit.docUnitId, "fresh");
});

test("Stage 7 conflict: two active load-bearing same-topic units that disagree are SURFACED", () => {
  const corpus = [
    u({ docUnitId: "p1", type: DocType.Policy, title: "Refund Policy", summary: "30 days", contentHash: "h1" }),
    u({ docUnitId: "p2", type: DocType.Policy, title: "refund policy", summary: "60 days", contentHash: "h2" }),
  ];
  const r = runRetrieval("refund policy", ctx, corpus, []);
  equal(r.diagnostics.conflictsSurfaced, 1, "the disagreement is surfaced, not averaged");
});

test("Stage 8 deterministic consult: a stage-bound handbook is ALWAYS injected regardless of the query", () => {
  const corpus = [
    u({ docUnitId: "bound", type: DocType.Handbook, scopeId: "docs", title: "Release Handbook", summary: "irrelevant to the query text", boundStageIds: ["release"] }),
    u({ docUnitId: "lexical", title: "Something else", summary: "matches the query words exactly" }),
  ];
  const r = runRetrieval("something else", ctx, corpus, []);
  ok(r.consulted.some((c) => c.docUnitId === "bound"), "the stage-bound handbook is consulted deterministically");
  equal(r.diagnostics.deterministicConsults, 1);
});
