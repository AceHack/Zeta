/**
 * grooming.ts — the phase that reads before it judges.
 *
 * ── WHAT `business_context_grooming` WAS ─────────────────────────────────────
 * The first gate of the thirteen, and a judgement-only phase: no producer, so nothing was read and
 * the reviewer was shown whatever had accumulated — which, at phase one, is nothing. An approval
 * there meant "somebody said yes about a title".
 *
 * That is the shape this register keeps finding: a step that LOOKS like diligence and consults
 * nothing. The lifecycle asks for agents that *"groom the business context using some form of a
 * data source"*, and until `DataSourcePort` existed there was no source to groom from.
 *
 * ── WHAT THE ARTIFACT IS ─────────────────────────────────────────────────────
 * Not a summary. A summary is a claim about documents, and a reviewer cannot check a claim without
 * the documents. The artifact is a set of CITATIONS — `<source>:<sha>:<path>` — so the reviewer can
 * open exactly what the agent read, at the revision it read. That makes grooming falsifiable: a
 * cited file that does not contain what the grooming says it does is a defect somebody can find.
 *
 * ── AND FINDING NOTHING IS A RESULT ──────────────────────────────────────────
 * A search of a real repository that matches nothing is a genuine, useful answer: the domain has no
 * prior art for this work. So it produces an artifact saying so, rather than refusing. What DOES
 * refuse is a source that could not be read — because "the repository is unreachable" and "the
 * repository has nothing on this" are the two sentences that must never be confused, and only one
 * of them means it is safe to proceed.
 */

import type { CascadeNode } from "./goal-cascade";
import type { DataSourcePort, SourceDocument } from "./providers";
import type { ProducerPort } from "./pipeline";

/** How many documents a grooming artifact cites. Enough to be useful, few enough to be read. */
export const MAX_CITATIONS = 12;

/**
 * The terms a work item is groomed BY.
 *
 * Derived from the item's own title, because that is the only description the organization has of
 * it that a human wrote. Words of three characters or fewer are dropped: "the", "a" and "of" match
 * every document in any repository, and a search that matches everything discriminates nothing —
 * the same vacuity as a check that cannot fail, wearing a search box.
 */
export function groomingTerms(node: CascadeNode): readonly string[] {
  return [
    ...new Set(
      node.title
        .split(/[^A-Za-z0-9]+/)
        .map((w) => w.toLowerCase())
        .filter((w) => w.length > 3),
    ),
  ];
}

export interface GroomingResult {
  readonly terms: readonly string[];
  readonly documents: readonly SourceDocument[];
  /** Terms that matched nothing — the honest half of a search, and usually the more informative one. */
  readonly termsWithNoMatch: readonly string[];
  readonly summary: string;
}

/**
 * Search the source for what the organization already knows about this item.
 *
 * Every term is queried SEPARATELY rather than as one string, because a single query for
 * "checkout coupon double-charge" finds documents containing that phrase, and what grooming needs
 * is documents about checkout, about coupons, and about double-charging. Which terms found nothing
 * is then a fact worth reporting: it is the map of what this organization has never written down.
 */
export async function groom(
  node: CascadeNode,
  source: DataSourcePort,
): Promise<{ readonly ok: true; readonly value: GroomingResult } | { readonly ok: false; readonly reason: string }> {
  const terms = groomingTerms(node);
  const byRef = new Map<string, SourceDocument>();
  const termsWithNoMatch: string[] = [];

  for (const term of terms) {
    const hit = await source.query(term);
    if (!hit.ok) {
      // A SOURCE THAT COULD NOT BE READ REFUSES THE PHASE. Continuing with the terms that did
      // answer would produce an artifact that looks like a search and silently omits a repository.
      return { ok: false, reason: `grooming '${node.workId}' on '${term}': ${hit.reason}` };
    }
    if (hit.value.length === 0) termsWithNoMatch.push(term);
    // Keyed by ref — idempotent, so a document matching three terms is cited once. The ref carries
    // the revision, so this is the same G-Set keying the union uses.
    for (const d of hit.value) if (!byRef.has(d.ref)) byRef.set(d.ref, d);
  }

  const documents = [...byRef.values()]
    // ORDINAL, so two machines grooming the same item cite the same documents in the same order.
    .sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0))
    .slice(0, MAX_CITATIONS);

  return {
    ok: true,
    value: {
      terms,
      documents,
      termsWithNoMatch,
      summary:
        terms.length === 0
          ? `'${node.title}' yielded no searchable terms; nothing was groomed`
          : `${String(documents.length)} document(s) for ${String(terms.length - termsWithNoMatch.length)} of ` +
            `${String(terms.length)} term(s)` +
            (termsWithNoMatch.length === 0 ? "" : `; nothing found for: ${termsWithNoMatch.join(", ")}`),
    },
  };
}

/**
 * The producer for `business_context_grooming`.
 *
 * Its `meta` is the SOURCE'S meta, so the phase inherits the source's fidelity: grooming against a
 * fixture appears in the run's fidelity report as simulated, and a reviewer approving that phase
 * can see that nothing real was read. Copying the fidelity would let a fixture-backed grooming
 * report itself as real work.
 */
export function groomingProducer(source: DataSourcePort): ProducerPort {
  return {
    meta: source.meta,
    produce: async (node) => {
      const result = await groom(node, source);
      if (!result.ok) return { ok: false, reason: result.reason };
      return {
        ok: true,
        // THE CITATIONS ARE THE ARTIFACT. `runPipeline` turns these into the gate's `evidenceRefs`,
        // so the reviewer of this phase is shown exactly what was read, at the revision it was read
        // — and an empty list is visibly an empty list rather than an approval with nothing behind
        // it.
        value: {
          refs: result.value.documents.map((d) => d.ref),
          summary: result.value.summary,
        },
        evidence: result.value.documents.map((d) => ({ kind: "document" as const, ref: d.ref })),
      };
    },
  };
}
