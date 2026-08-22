---
id: 081M0FTPJ4X087G0R000E91P3Y
type: task
state: backlog
priority: P2
slug: pin-cl0-p-q-cl0-q-p-as-an-fscheck-property-the-guard-that-ke
title: "Pin Cl0(p,q) = Cl0(q,p) as an FsCheck property -- the guard that keeps the Cl(1,3)/Cl(3,1) split inert"
created: 2026-08-20T14:55:14.077Z
depends_on: []
composes_with: []
---

# Pin Cl0(p,q) = Cl0(q,p) as an FsCheck property -- the guard that keeps the Cl(1,3)/Cl(3,1) split inert

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0FTPJ4X087G0R000E91P3Y-*.md` glob. -->

## Why

`docs/research/2026-08-20-clifford-signature-audit-cl13-vs-cl31-is-inert-and-lorentzian-geometry-buys-only-the-conformal-factor.md`
audited every in-tree use of the two Minkowski conventions and found **no crossing** — so this is
a guard, not a bug fix. The reason there is no crossing is a theorem, and the theorem is
currently unpinned:

> `Cl0(p,q)` and `Cl0(q,p)` sit at clock positions summing to **2 mod 8**, and every such pair
> lands in the same row of the Lawson–Michelsohn table — same ground field, same split flag, same
> matrix dimension. Hence the even subalgebras of the two conventions are isomorphic for **all**
> `p,q`, which is why nothing in the tree (all of which lives in the even part or the Lorentz Lie
> algebra) can tell them apart.

Verified by computation against `src/Core/CliffordPeriodicity.fs` itself — 0 counterexamples over
196 signature pairs — but nothing in CI fails if a refactor breaks it.

## Scope

Add one property beside the existing ones in `tests/Tests.FSharp/CliffordPeriodicity.Tests.fs`:

- `classify p (q-1)` agrees with `classify q (p-1)` on `Ground`, `IsSplit` and `MatrixDim`, for all
  `p, q >= 1` in a bounded range.

It pairs with the existing line-59 test (`Cl(1,3)` is `M2(H)` and `Cl(3,1)` is `M4(R)` — the FULL
algebras differ). Together they state the whole disposition: **the conventions differ, and the
even part cannot see the difference.**

## Routing (Soraya)

- **Property class:** algebraic-law identity. **Primary tool:** FsCheck — the module is already
  property-tested there and this is a finite-table identity.
- **Cross-check:** none. **P1** under the triage table (a violation is noisy and reversible), so
  BP-16's two-tool floor does not fire. Reaching for Lean/Mathlib here would be human-weeks for a
  lemma FsCheck settles in an hour.
- **Effort:** S. **CI gate:** yes — it joins the existing gated F# test project.

## What it protects

The convention becomes load-bearing the moment anything derives a **spinor** quantity from
`spacetimeSignature` — a real module dimension, a chirality, a Majorana/reality condition. Those
live in the ODD part, where `M2(H)` and `M4(R)` genuinely disagree. This property does not stop
that; it makes the boundary explicit so the next author sees where the safe region ends.
