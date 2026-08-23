---
id: 081M0QWDDDV087G0R003HM0KYX
type: task
state: backlog
priority: P2
slug: positional-n-gram-index-for-phrase-and-proximity-queries-the
title: "Positional/n-gram index for phrase and proximity queries — the second index type the term index cannot be"
created: 2026-08-23T00:00:00.000Z
depends_on: []
composes_with: []
---

# Positional / n-gram index — phrase and proximity queries

## Why this is a SEPARATE index and not a missing feature

Aaron 2026-08-22, filing the term index:

> _"for this index we will ignore stop words, **stop words need a completely
> different kind of indexing**."_

That distinction is load-bearing and this row exists so it is not flattened
later into "why can't search find this exact sentence".

`src/Core.TypeScript/search/inverted/` stores **term → files**, with **no
positions**, and drops stop words. Both choices are correct for the job it does
and both make phrase search **structurally impossible**:

- The phrase _"the end of error"_ is almost entirely stop words. Its meaning is
  carried by their **order**, so a structure with no positions could not answer
  it even if the stop words were kept.
- Keeping positions is not a tweak. Postings go from `[docId, tf]` to
  `[docId, [p1, p2, …]]`, which multiplies the artifact by roughly the average
  term frequency — on a corpus where the term index is already 54.7 MiB raw.

So it is a **different artifact with a different size budget and a different
cadence**, and the term index's CLI **refuses** a multi-word query with that
explanation rather than silently ANDing it and presenting the result as a
phrase match.

## The two candidate structures (MRS 2008 §2.4)

1. **Positional index** — `term → [(docId, [positions])]`. Exact phrase and
   proximity (`within k`). Large; the stop-word problem returns in full, because
   `the` must now be indexed _with positions_ to answer the phrase above.
2. **Biword / shingle index** — index adjacent pairs (`"end of"`, `"of error"`)
   as single terms. Much smaller, answers two-word phrases exactly and longer
   ones approximately (with false positives that must be verified against
   source). Composes with the "index narrows, source is truth" discipline the
   parent backlog row already states.

A **hybrid** is the standard answer: shingles for the common case, verify
candidates against the blob at the target rev.

## Acceptance (firm up at start-gate)

- [ ] Structure chosen with a **measured** size comparison on this corpus, not
      an estimate — the term index's own sizing table is the precedent.
- [ ] Same non-negotiables as the term index: built from an **explicit git rev**,
      rev **recorded in the artifact**, **byte-identical** rebuild, no timestamp,
      culture-invariant ordering, refuses rather than answering stale.
- [ ] Stop words **kept** (that is the point) — and the size consequence measured.
- [ ] Candidate verification against the blob at the target rev for the
      approximate structures.
- [ ] The term index's phrase refusal updated to **point here** once it exists.

## Prior art

- Manning, Raghavan & Schütze, _Introduction to Information Retrieval_, CUP 2008
  — §2.4.1 biword indexes, §2.4.2 positional indexes, §2.4.3 the hybrid.
- Apache Lucene (Doug Cutting, 1999–) — `PhraseQuery` / `SpanQuery` over
  positional postings; `ShingleFilter` for the biword construction.
- Zobel & Moffat, _Inverted Files for Text Search Engines_, ACM CSUR 38(2), 2006
  — the compression tradeoffs a positional index makes unavoidable.
