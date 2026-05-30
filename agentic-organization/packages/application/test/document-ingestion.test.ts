import { equal, ok, deepEqual } from "node:assert/strict";
import { test } from "node:test";

import { DocType, DocScopeKind, DocLifecycleState, OrgEventKind } from "../../domain/src/index.ts";
import { decomposeMarkdown, ingestDocument, ingestFromConnector, type RawDocument, type DocConnectorPort } from "../src/index.ts";

let seq = 0;
const deps = { organizationId: "org-lfg", now: () => Date.parse("2026-05-30T00:00:00Z"), createId: (p: string) => `${p}-${++seq}` };

const HANDBOOK = `Intro preamble line.

# Onboarding
Welcome to the team.

## Step 1
Do the first thing.

## Step 2
Do the second thing.

# Security
Rotate your keys.`;

function raw(markdown: string): RawDocument {
  return { sourceId: "src-1", externalRef: "wiki:onboarding", type: DocType.Handbook, scopeKind: DocScopeKind.Department, scopeId: "eng", title: "Eng Handbook", markdown };
}

test("decompose splits by STRUCTURE (headings) preserving the heading path — not fixed chunks", () => {
  const units = decomposeMarkdown(HANDBOOK, "Eng Handbook");
  const byTitle = new Map(units.map((u) => [u.title, u] as const));

  // preamble before the first heading is its own unit, titled by the doc
  ok(byTitle.has("Eng Handbook"));
  // Step 2 keeps its full heading path — it is NEVER retrieved without knowing it is under Onboarding
  deepEqual(byTitle.get("Step 2")!.headingPath, ["Onboarding", "Step 2"]);
  // Step 1's body is intact (a procedure step is not shredded across chunks)
  ok(byTitle.get("Step 1")!.body.includes("Do the first thing."));
  // a sibling top-level section resets the path
  deepEqual(byTitle.get("Security")!.headingPath, ["Security"]);
});

test("ingest produces content-addressed draft DocUnits with provenance + one doc_ingested event each", () => {
  const result = ingestDocument(raw(HANDBOOK), { ...deps, provenanceChangeSetId: "cs-42" });

  ok(result.units.length >= 4, "one unit per structural section");
  for (const u of result.units) {
    equal(u.status, DocLifecycleState.Draft);
    equal(u.type, DocType.Handbook);
    equal(u.scopeKind, DocScopeKind.Department);
    equal(u.scopeId, "eng");
    equal(u.provenanceChangeSetId, "cs-42", "each unit links to the ChangeSet that introduced it");
    equal(u.contentHash.length, 64, "content is sha256-addressed");
    ok(u.contentRef.startsWith("wiki:onboarding#"), "the ref is the structural address");
  }
  equal(result.events.length, result.units.length);
  ok(result.events.every((e) => e.kind === OrgEventKind.DocIngested));
});

test("ingest is content-addressed: identical bodies hash identically (re-ingest skip signal)", () => {
  const a = ingestDocument(raw(HANDBOOK), deps);
  const b = ingestDocument(raw(HANDBOOK), deps);
  const hashA = a.units.map((u) => u.contentHash).sort();
  const hashB = b.units.map((u) => u.contentHash).sort();
  // same content → same hashes across ingests (only changed units would differ)
  deepEqual(hashA, hashB);
});

test("ingestFromConnector ingests every document the connector yields", async () => {
  const connector: DocConnectorPort = {
    kind: "fake",
    pull: async () => [raw("# A\nalpha"), raw("# B\nbravo")],
  };
  const result = await ingestFromConnector(connector, deps);
  const titles = result.units.map((u) => u.title).sort();
  deepEqual(titles, ["A", "B"]);
});
