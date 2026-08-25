---
id: 081M0X3T0X7087G0R0030966WV
type: task
state: backlog
priority: P2
slug: adjudicate-the-triforce-hexagon-doubling-synthesis-which-leg
title: "Adjudicate the triforce-hexagon-doubling synthesis: which legs are structural, which are name collisions"
created: 2026-08-25T18:44:32.295Z
depends_on: []
composes_with: []
---

# Adjudicate the triforce-hexagon-doubling synthesis: which legs are structural, which are name collisions

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0X3T0X7087G0R0030966WV-*.md` glob. -->

Aaron 2026-08-25 speculated that the triforce/hexagon shape, the Cayley–Dickson
imaginary stack, and the repo's several adinkras are one object. Adjudicated per
`.claude/rules/numerology-vs-number-theory.md`: a matching count is not an
identification, so each leg gets a named theorem or two named different mechanisms.

**Verdict doc:** `docs/research/2026-08-25-triforce-hexagon-doubling-verdict-two-ladders-one-endpoint-and-four-legs-cut-lumen.md`

**Outcome:** 4 legs structural, 3 refuted, 3 name collisions, 1 theorem with no
in-tree instance, 1 generator-only. The load-bearing correction: there are **two**
ladders from dim 1 to dim 8 (Cayley–Dickson maximal orders; laminated/densest),
they coincide at dims 1,2,4,8 because those are the normed-division-algebra
dimensions (Hurwitz 1898), and they pass through **different** dim-2 rungs —
Gaussian (square, 4 units) vs Eisenstein (hexagon, 6 units). Aaron's hexagon is on
the laminated ladder, not the Cayley–Dickson one.

## Follow-ups this filed (in value order)

1. **The 48 identification — CONJECTURE (Z-N), route to Soraya.** Computed today:
   `[E8 : D4⊕D4] = 4` and exactly 48 of E8's 240 roots lie in the doubled-Hurwitz
   sublattice. RC-3 (`CliffordE8BladeMask`) independently measured 48 = D₄⊕D₄ from
   versor-normed reflection closure. **Are they the same 48?** Falsifier: compute
   both sets in one frame, test set-equality up to a Weyl element. Not run.
2. **`src/Core/FourCorner.fs` line 10 asserts a group structure no code provides.**
   The docstring claims `N S E W = {1, i, −1, −i} = C₄ = i-rotation … why
   Cayley-Dickson is everywhere`. The type is a record with three **idempotent**
   field setters; there is no transition function, no element of order 4, and the
   reachable-state structure is a join-semilattice with no inverses. Not C₄, not
   V₄, not a group. Either add `t` with `t⁴ = id` / `t² = neg` plus a failing test,
   or delete the sentence. The strings `C₄` / `i-rotation` occur nowhere else in
   the repo.
3. **`vocab/shapes/hexagon.md` fuses two unrelated hexagons** in a carved sentence
   every agent loads: "Geometry: hexagon — ports & adapters (Cockburn hexagonal)".
   Cockburn picked six for drawing room (already established in-tree 2026-06-02);
   the geometric hexagon's six is `|μ₆| = 6` from `φ(6) = 2`. Separate them.
