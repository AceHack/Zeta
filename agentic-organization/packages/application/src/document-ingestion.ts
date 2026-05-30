/**
 * Document ingestion (D1) — the FIRST place this beats naive RAG. Instead of splitting a
 * document into fixed-size chunks, it decomposes by STRUCTURE (markdown headings) into
 * semantic units that each keep their heading PATH — so a procedure's step 3 is never
 * retrieved without steps 1–2, and a unit knows the section it lives in. Each unit is
 * content-addressed (sha256 of its body) so re-ingestion only updates what changed, and
 * each unit carries provenance: the ChangeSet that introduced it.
 *
 * A connector (the source seam) yields RawDocuments; `ingestDocument` turns one raw doc
 * into typed/scoped DocUnit records at `draft`, plus a `doc_ingested` org_event per unit.
 * Storage + the Hindsight retain ride on top at the composition layer.
 */

import { createHash } from "node:crypto";
import {
  DocLifecycleState,
  OrgEventKind,
  type DocType,
  type DocScopeKind,
  type DocUnit,
  type OrgEvent,
} from "../../domain/src/index.ts";

/** A raw document as pulled from a source connector (before structural decomposition). */
export type RawDocument = {
  sourceId: string;
  externalRef: string; // stable upstream id (path / page id) — de-dup + trace
  type: DocType;
  scopeKind: DocScopeKind;
  scopeId: string;
  title: string;
  markdown: string;
  boundHatIds?: readonly string[];
  boundStageIds?: readonly string[];
};

/** The source seam: a connector pulls raw documents for an organization. */
export type DocConnectorPort = {
  kind: string;
  pull: (organizationId: string) => Promise<readonly RawDocument[]>;
};

/** A structural unit of a document — a section with its heading path preserved. */
export type StructuralUnit = {
  headingPath: readonly string[]; // ["Onboarding", "Step 3"] — the unit's place in the doc
  title: string;
  body: string;
};

const HEADING = /^(#{1,6})\s+(.*)$/;

/**
 * Decompose markdown into structural units by heading. Each heading starts a new unit
 * whose body runs until the next heading; the heading path is the trail of enclosing
 * headings, so nested structure (and procedures) stay intact. Preamble before the first
 * heading becomes a unit titled by the document itself (caller passes docTitle).
 */
export function decomposeMarkdown(markdown: string, docTitle: string): readonly StructuralUnit[] {
  const lines = markdown.split("\n");
  const units: StructuralUnit[] = [];
  const stack: { depth: number; title: string }[] = []; // enclosing headings
  let current: { headingPath: string[]; title: string; bodyLines: string[] } | null = null;

  const flush = (): void => {
    if (current === null) return;
    const body = current.bodyLines.join("\n").trim();
    if (body.length > 0 || current.headingPath.length > 0) {
      units.push({ headingPath: current.headingPath, title: current.title, body });
    }
    current = null;
  };

  for (const line of lines) {
    const m = line.match(HEADING);
    if (m === null) {
      if (current === null) current = { headingPath: [], title: docTitle, bodyLines: [] };
      current.bodyLines.push(line);
      continue;
    }
    flush();
    const depth = m[1]!.length;
    const title = m[2]!.trim();
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= depth) stack.pop();
    const headingPath = [...stack.map((s) => s.title), title];
    stack.push({ depth, title });
    current = { headingPath, title, bodyLines: [] };
  }
  flush();
  return units;
}

function sha256Hex(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/** First non-empty line, trimmed to a summary length — the summary-first retrieval surface. */
function summarize(body: string): string {
  const firstLine = body.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  return firstLine.length > 280 ? `${firstLine.slice(0, 277)}...` : firstLine;
}

export type IngestDocumentDeps = {
  organizationId: string;
  now: () => number;
  createId: (prefix: string) => string;
  /** the ChangeSet that introduced this document (provenance), when the doc came from work. */
  provenanceChangeSetId?: string;
};

export type IngestDocumentResult = {
  units: readonly DocUnit[];
  events: readonly OrgEvent[];
};

/**
 * Ingest ONE raw document: decompose structurally, then map each structural unit to a
 * content-addressed DocUnit at `draft` with the source's type/scope/binding + provenance.
 * Emits one `doc_ingested` org_event per unit.
 */
export function ingestDocument(raw: RawDocument, deps: IngestDocumentDeps): IngestDocumentResult {
  const nowIso = new Date(deps.now()).toISOString();
  const structural = decomposeMarkdown(raw.markdown, raw.title);
  const units: DocUnit[] = [];
  const events: OrgEvent[] = [];

  for (const s of structural) {
    const contentHash = sha256Hex(s.body);
    const docUnitId = deps.createId("docunit");
    const unit: DocUnit = {
      docUnitId,
      organizationId: deps.organizationId,
      sourceId: raw.sourceId,
      type: raw.type,
      scopeKind: raw.scopeKind,
      scopeId: raw.scopeId,
      title: s.title,
      summary: summarize(s.body),
      // content lives in git/Hindsight; the ref is the structural address (de-dup + drill)
      contentRef: `${raw.externalRef}#${s.headingPath.join(" / ")}`,
      contentHash,
      status: DocLifecycleState.Draft,
      freshnessAt: nowIso,
      boundHatIds: raw.boundHatIds ?? [],
      boundStageIds: raw.boundStageIds ?? [],
      ...(deps.provenanceChangeSetId !== undefined ? { provenanceChangeSetId: deps.provenanceChangeSetId } : {}),
      createdAt: nowIso,
      updatedAt: nowIso,
      version: 1,
    };
    units.push(unit);
    events.push({
      id: deps.createId("evt"),
      kind: OrgEventKind.DocIngested,
      occurredAt: nowIso,
      organizationId: deps.organizationId,
      subjectId: docUnitId,
      toState: DocLifecycleState.Draft,
      decision: `ingested ${raw.type} unit "${s.title}" (${s.headingPath.join(" / ") || raw.title}) → draft`,
      supervisorChain: [],
      evidenceRefs: [unit.contentRef],
      correlationId: raw.externalRef,
      causationId: raw.externalRef,
      traceId: raw.externalRef,
    });
  }
  return { units, events };
}

/** Ingest every document a connector yields (the onboarding/bulk + incremental entry points). */
export async function ingestFromConnector(connector: DocConnectorPort, deps: IngestDocumentDeps): Promise<IngestDocumentResult> {
  const raws = await connector.pull(deps.organizationId);
  const units: DocUnit[] = [];
  const events: OrgEvent[] = [];
  for (const raw of raws) {
    const result = ingestDocument(raw, deps);
    units.push(...result.units);
    events.push(...result.events);
  }
  return { units, events };
}
