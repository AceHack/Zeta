import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { DocType, DocScopeKind, DocLifecycleState, type DocEntity, type DocUnit } from "../../domain/src/index.ts";
import { entityKey, resolveMention, extractEntities, canonicalizeByTopic } from "../src/index.ts";

const billing: DocEntity = {
  docEntityId: "ent-billing", organizationId: "org-lfg", canonicalName: "Billing", kind: "service",
  aliases: ["the billing service", "services/billing", "billing system"],
  createdAt: "2026-05-30T00:00:00Z", updatedAt: "2026-05-30T00:00:00Z",
};
const auth: DocEntity = { ...billing, docEntityId: "ent-auth", canonicalName: "Auth", aliases: ["services/auth", "the auth service"] };

test("the recall RAG cannot match: 'the billing service', 'Billing', 'services/billing' all resolve to ONE node", () => {
  equal(resolveMention("the billing service", [billing, auth])?.docEntityId, "ent-billing");
  equal(resolveMention("Billing", [billing, auth])?.docEntityId, "ent-billing");
  equal(resolveMention("services/billing", [billing, auth])?.docEntityId, "ent-billing");
  equal(resolveMention("billing system", [billing, auth])?.docEntityId, "ent-billing");
  // a different entity resolves to its own node, and noise resolves to nothing
  equal(resolveMention("the auth service", [billing, auth])?.docEntityId, "ent-auth");
  equal(resolveMention("the service", [billing, auth]), null);
});

test("entityKey collapses phrasing/stopwords/punctuation deterministically", () => {
  equal(entityKey("the Billing service"), "billing");
  equal(entityKey("services/billing"), "billing");
  equal(entityKey("Billing"), "billing");
});

test("extractEntities finds known entities mentioned in free text (graph-anchoring)", () => {
  const text = "When the billing service fails, page the on-call; auth is unaffected.";
  const found = extractEntities(text, [billing, auth]).map((e) => e.docEntityId).sort();
  ok(found.includes("ent-billing"));
  ok(found.includes("ent-auth"));
});

function unit(over: Partial<DocUnit>): DocUnit {
  return {
    docUnitId: "u", organizationId: "org-lfg", sourceId: "s", type: DocType.Handbook, scopeKind: DocScopeKind.Department,
    scopeId: "eng", title: "System Architecture", summary: "", contentRef: "r", contentHash: "h", status: DocLifecycleState.Active,
    freshnessAt: "2026-05-30T00:00:00Z", boundHatIds: [], boundStageIds: [], createdAt: "2026-05-30T00:00:00Z", updatedAt: "2026-05-30T00:00:00Z", version: 1, ...over,
  };
}

test("canonicalize picks one source of truth per topic (active + most recent) and supersedes the rest", () => {
  const groups = canonicalizeByTopic([
    unit({ docUnitId: "old", title: "System Architecture", status: DocLifecycleState.Active, contentHash: "x", updatedAt: "2026-05-01T00:00:00Z" }),
    unit({ docUnitId: "new", title: "system architecture", status: DocLifecycleState.Active, contentHash: "x", updatedAt: "2026-05-29T00:00:00Z" }),
    unit({ docUnitId: "draft", title: "System  Architecture", status: DocLifecycleState.Draft, contentHash: "x", updatedAt: "2026-05-30T00:00:00Z" }),
    unit({ docUnitId: "other", title: "How We Write BRDs", contentHash: "y" }),
  ]);
  const arch = groups.find((g) => g.topicKey === "architecture");
  ok(arch !== undefined, "differently-phrased titles collapse to one topic");
  equal(arch!.canonical.docUnitId, "new", "active + most recent wins (a draft never beats an active canonical)");
  equal(arch!.superseded.length, 2);
  // the unrelated topic is its own group
  ok(groups.some((g) => g.canonical.docUnitId === "other"));
});

test("same-titled docs in DIFFERENT scopes do NOT compete — no false supersede or conflict (scope-partitioned)", () => {
  const groups = canonicalizeByTopic([
    unit({ docUnitId: "eng-overview", scopeId: "eng", type: DocType.Policy, title: "Overview", contentHash: "h1" }),
    unit({ docUnitId: "sales-overview", scopeId: "sales", type: DocType.Policy, title: "Overview", contentHash: "h2" }),
  ]);
  // two separate single-member groups — neither supersedes the other, no cross-scope conflict
  equal(groups.length, 2);
  ok(groups.every((g) => g.superseded.length === 0));
  ok(groups.every((g) => g.conflicts.length === 0));
});

test("two BOTH-active load-bearing units on one topic that DISAGREE are FLAGGED, never averaged", () => {
  const groups = canonicalizeByTopic([
    unit({ docUnitId: "a", title: "Security Policy", type: DocType.Policy, status: DocLifecycleState.Active, contentHash: "h-a" }),
    unit({ docUnitId: "b", title: "security policy", type: DocType.Policy, status: DocLifecycleState.Active, contentHash: "h-b" }),
  ]);
  const sec = groups.find((g) => g.conflicts.length > 0);
  ok(sec !== undefined, "a conflict is recorded — not silently reconciled");
  equal(sec!.conflicts.length, 1);
});
