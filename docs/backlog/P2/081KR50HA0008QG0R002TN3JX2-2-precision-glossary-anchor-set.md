---
id: B-0004.2
zetaid: 081KR50HA0008QG0R002TN3JX2
priority: P2
status: open
title: "B-0004.2 — Precision glossary anchor set extraction (precondition for consistent translation)"
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [B-0004.1]
parent: B-0004
classification: buildable-now
type: research
effort: S

---

# B-0004.2 — Precision glossary anchor set extraction (precondition for consistent translation)

**Slice of:** [B-0004](B-0004-translate-repo-to-other-human-languages.md)  
**Depends on:** B-0004.1 (inventory provides the surface list)

## What

From the inventory manifest + manual curation of high-precision terms in ALIGNMENT.md, VISION.md, GLOSSARY.md, extract a canonical "precision anchor set" (50-80 terms) that MUST translate consistently across languages.

Produce `docs/precision-dictionary/anchors-en.json` (term, definition, example usages, translation notes).

This composes directly with B-0003 (matrix-pill ALIGNMENT rewrite) and the precision-dictionary vision.

## Why

Without a controlled anchor set, translations will drift on core concepts (e.g. "retraction", "Z-set", "glass halo", "bidirectional alignment"). The bidirectional-alignment contract requires precision; Otto-286 definitional precision transfers only when anchors are stable. This is the smallest gate before any bulk translation work.

## Acceptance criteria

1. `docs/precision-dictionary/anchors-en.json` committed with ≥50 high-value terms extracted from P0 substrate.
2. Each term has: canonical English, formal def, 2-3 usage citations, "do-not-translate" or "context-sensitive" flag.
3. B-0004.1 scanner updated to flag any new term usage that misses the anchor set.
4. `bun test` (if added) + build gate green.
5. PR body includes focused check output: term count, top-5 anchors, cross-ref to B-0003.

## Out of scope

- Multi-language translations of the anchors (later child).
- Full dictionary product (B-0003 adjacent, separate row).
