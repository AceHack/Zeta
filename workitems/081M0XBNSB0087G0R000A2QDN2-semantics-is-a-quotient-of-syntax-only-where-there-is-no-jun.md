---
id: 081M0XBNSB0087G0R000A2QDN2
type: task
state: backlog
priority: P2
slug: semantics-is-a-quotient-of-syntax-only-where-there-is-no-jun
title: "Semantics is a quotient of syntax only where there is no junk: homoiconicity is that condition, and plurality of representation is the congruence lattice"
created: 2026-08-25T21:02:02.080Z
depends_on: []
composes_with: []
---

# Semantics is a quotient of syntax only where there is no junk: homoiconicity is that condition, and plurality of representation is the congruence lattice

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0XBNSB0087G0R000A2QDN2-*.md` glob. -->

**Scope:** `docs/research/2026-08-25-is-semantics-a-quotient-of-syntax-homoiconicity-is-the-no-junk-condition-and-many-representations-is-the-congruence-lattice.md`,
with `src/Core.TypeScript/research/free-quotient-semantics-closure.{ts,test.ts}` as its falsifiers.

Adjudication doc + probe. Landed together; this row exists so the commit and PR carry a
`Task:` id and so the two named follow-ons below have somewhere to hang.

**Open follow-ons named by the doc, NOT done here:**

1. **Check the literature anchors** (`missing-citations`). Plotkin 1977, Milner 1977,
   AJM/Hyland-Ong 2000, Kuroda 1964, Post/Markov 1947, Newman 1942, Knuth-Bendix 1970,
   Birkhoff 1935, GTWW 1977, Doran et al. 2008 are **cited from standing knowledge and not
   page-checked**. Until checked they keep the anchored claims at `toy` per
   `anchor-to-human-prior-art.md` (anchors must be *checked*, not cited).
2. **Sweep the tree for junk.** "Zeta's representations stay in the no-junk regime" is an
   `unmetered` design invariant: no audit of in-tree representations was performed. The
   falsifier is any representation with junk that is nonetheless treated as a quotient.

**Not in scope:** making `Sppf` semiring-generic (2026-08-23 §4); the
`Gaussian`/`WeightedSet` `toWeightedSet` implementation (`081M0QRPY6W087G0R001K4TE3M`);
building any dual BNN — the doc's §8 conclusion is that only the non-homomorphic branch
is a second object at all, and that branch is a fitted approximation.
