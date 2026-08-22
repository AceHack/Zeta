---
id: 081M00WD6GM087G0R000ZC8S3K
type: task
state: backlog
priority: P2
slug: formalize-the-twisted-group-algebra-separation-of-the-cliffo
title: "Formalize the twisted-group-algebra separation of the Clifford and Cayley-Dickson towers: associativity is the 2-cocycle condition"
created: 2026-08-14T19:36:27.924Z
depends_on: []
composes_with: []
---

# Formalize the twisted-group-algebra separation of the Clifford and Cayley-Dickson towers: associativity is the 2-cocycle condition

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00WD6GM087G0R000ZC8S3K-*.md` glob. -->

Lumen's analysis: `docs/research/2026-08-14-adinkra-minimal-homoiconicity-the-half-rotation-tower-and-where-the-obstruction-actually-lives-lumen.md` §3.2, §4.3.

## The claim (Z-hom-3, §B tier)

Both towers Aaron names are the same kind of object: a `(Z/2)^n`-grading plus a 2-cochain
`F : (Z/2)^n x (Z/2)^n -> {+1,-1}` defining `e_a . e_b = F(a,b) e_{a+b}`. The **single invariant** that
separates them:

- `dF = 1` (F is a 2-**cocycle**) => **associative** => the Clifford tower, at every rung, forever.
- `dF != 1` (F is only a 2-**cochain**) => **non-associative**, and `dF` IS the associator => the
  Cayley-Dickson tower from the octonions on.

Anchors to check by entailment, not to cite decoratively: Albuquerque & Majid, *Quasialgebra structure
of the octonions*, J. Algebra 220 (1999) 188-224; *Clifford algebras obtained by twisting of group
algebras*, JPAA 171 (2002) 133-148.

## Why it matters to this repo

1. It settles that "clifford and then e8" and "repeat over imaginary space" are **two different
   towers**, agreeing through H and diverging at rung 3 (`Cl(0,3) = H (+) H`, not O).
2. It places the **adinkra dashing = F**, a degree-2 object, while the octonionic associator is
   degree-3 — so the dashing and the non-associativity are provably NOT the same obstruction.
3. It converts "you can never avoid the tangle, it might be a force of nature" into a theorem-shaped
   statement: the obstruction is a **nontrivial cohomology class**, i.e. precisely the kind of thing
   no change of representative removes. Mac Lane coherence says it is *relocatable* into the ambient
   category's associator and *not deletable*.
4. Genericity, honestly argued: `Z^2` is a **proper subgroup** of `C^2` for n >= 3, so
   non-associativity is generic and associativity is the special case. That is a subgroup-index
   argument, not a matching count.

## The diagnostic this yields (worth landing even if the formalization slips)

> **Is your non-associativity a representation defect or a cohomology class?**
> Representation defect (IEEE-754 rounding) => **removable**; change the carrier. `QuorumAlgebra`'s
> named exit to a cyclotomic carrier is exactly this and will work.
> Cohomology class (`dF != 1`) => **not removable**; only relocatable.

`src/Core/QuorumAlgebra.fs` already documents a live instance of the first kind: the `EPS = 1e-12`
drop "breaks associativity structurally (measured: two groupings differ by 1.6e-6)", which is why the
interference half cannot be byte-locked today.

## Falsifier

Exhibit a Cayley-Dickson algebra at rung >= 3 whose twisting cochain is a 2-cocycle. That would
contradict Albuquerque-Majid, so this doubles as the **entailment check on the anchor** rather than
an open question — which is the point: the anchor must be checked, not cited.

Route: Soraya (Lean/formal). Pairs with `081M00WD2KG087G0R0038MX9HW`.
