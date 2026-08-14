---
id: 081M00EZXN2087G0R003AY3WSJ
type: task
state: backlog
priority: P2
slug: meno-instantiate-the-balanced-structure-on-v-braid-groupoid
title: "Meno: instantiate the balanced structure on <V> (braid groupoid + Artin faithfulness in Lean)"
created: 2026-08-14T15:42:01.378Z
depends_on: [081KZZVC3DD087G0R0035SZN58]
composes_with: [081KZZVC6SE087G0R001SXE8BV]
---

# Meno: instantiate the balanced structure on <V> (braid groupoid + Artin faithfulness in Lean)

## The gap this closes (named by Soraya, 2026-08-14)

`src/Core.Lean4/Lean4/MenoBalancedTwist.lean` (work-item 081KZZVC3DD087G0R0035SZN58)
machine-checks, `sorry`-free and for ALL `n`, in an ARBITRARY braided monoidal category:

- `dbl_cocycle` — the coherence obstruction to a balanced structure vanishes (the
  general-`n` content of Garside's full twist, from the hexagon axioms alone)
- `twist_assoc_consistent` — the balanced axiom is associatively consistent
- `twist_eq_on_Vpow` / `twist_eq_of_eq_on_gen` — uniqueness on every tensor power
- `twist_Vpow_succ` — the forcing recursion `theta_{n+1} = (theta_n (x) theta_1) . c . c`
- `symmetricTwist` — the `Twist` structure is inhabited, so none of the above is vacuous

What it does NOT do: exhibit a `Twist` INSTANCE on `<V>` itself. Two ingredients are
missing and neither is in Mathlib:

1. **`<V>` as a Lean braided monoidal category** with `Hom(V^n, V^n) = rho(B_n)`. The
   clean route is the braid groupoid as the FREE braided monoidal category on one object
   (Joyal-Street 1993 §2), not a port of the ZSet monoidal category — the standing
   boundary of `MenoBraidedRMatrix` ("we do NOT port the ZSet monoidal category into
   Lean") stays in force.
2. **Faithfulness of the Artin action** (Artin 1925) — what makes `Hom` exactly `rho(B_n)`
   rather than a quotient, and therefore what turns `theta`'s NATURALITY into centrality of
   `Delta_n^2` in `B_n` (Chow 1948). Today naturality is a FIELD of `Zeta.MenoBalanced.Twist`,
   assumed rather than derived.

## Scope note — this may not be worth it

Mathlib carries no braid groups. Building `B_n` by presentation plus a faithfulness proof
is a large, self-contained formalization effort with no other consumer in this repo. The
honest options, in order of cost:

- **(a) Leave it.** The verdict is already carried by a general-`n` `sorry`-free artifact
  plus a literature anchor for the two missing ingredients. This is a defensible stopping
  point and the current state.
- **(b) Bounded instance.** Instantiate `Twist` on a concrete small braided category to
  witness a NON-symmetric twist (today's `symmetricTwist` witness is symmetric, so the
  inhabitation guard does not exercise `dbl != id`). Cheaper, and it closes the sharper
  vacuity question.
- **(c) Full.** Braid groupoid + Artin faithfulness. Weeks, not days.

**(b) is the recommended next move**; (c) needs a second consumer before it earns its cost.

## Anchors

- Joyal & Street 1993, *Braided Tensor Categories* (Adv. Math. 102) — braid groupoid as the
  free braided monoidal category on one object
- Artin 1925 — faithfulness of the action on `F_n`
- Chow 1948 — `Z(B_n) = <Delta^2>` for `n >= 3`
- Garside 1969 — the full twist `Delta^2`
