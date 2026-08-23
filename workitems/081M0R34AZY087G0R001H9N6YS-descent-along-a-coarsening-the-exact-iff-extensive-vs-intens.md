---
id: 081M0R34AZY087G0R001H9N6YS
type: task
state: backlog
priority: P2
slug: descent-along-a-coarsening-the-exact-iff-extensive-vs-intens
title: "Descent along a coarsening: the exact iff, extensive vs intensive, and Pythagorean as within-fibre Bregman information"
created: 2026-08-23T19:56:29.566Z
depends_on: []
composes_with: []
---

# Descent along a coarsening: the exact iff, extensive vs intensive, and Pythagorean as within-fibre Bregman information

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0R34AZY087G0R001H9N6YS-*.md` glob. -->

**Route to:** `formal-verification-expert` (Soraya). **Lean 4** for the descent theorem;
**a computed witness** for the two-barycentre disambiguation (already written, see below).

**Analysis this comes from:** `docs/research/2026-08-23-geometry-as-the-root-of-the-soft-regime-five-questions-two-already-answered-in-tree-one-refuted-lumen.md` §10. Numbers reproduce from
`docs/research/scripts/2026-08-23-geometry-as-root-bregman-coarsening-verify.py` (`ALL PASS`, exit 0).

**Origin:** Aaron's addition after the first pass — the co/contravariance connection between C#
type theory and physics, and a parallel naming-registry design that arrived at *"measure DV2.0
change-rate over a **cluster** instead of an individual item."*

## Three obligations

**D1 — the exact descent condition (Lean 4, short).** For surjective `q : N → C` and any
`g : N → X`, a map `ḡ : C → X` with `ḡ ∘ q = g` exists **iff** `ker q ⊆ ker g` (constant on
fibres), and is then unique. Mathlib has this as the universal property of `Quot`/`Setoid`; the
value is in **stating it as the design's discharge condition** so the assertion becomes a theorem
with a hypothesis rather than a claim.

**D2 — the extensive/intensive split (the part the framing was missing).** There are **two**
pushforwards with **opposite** freedom, and which one the design means decides whether a hypothesis
is needed at all:

| carried object | pull back along `q` | push forward along `q` |
|---|---|---|
| **function** `N → X` (intensive — a per-item rate) | **free** | needs **constancy on fibres** |
| **measure** on `N` (extensive — a count) | needs a disintegration / section | **free** |

So "total changes per unit time across the cluster" is **already well-defined, no hypothesis**;
"the rate each member has" is **not**. State both, and state which one DV2.0 actually consumes —
§10.1 argues it is the intensive one, and that **within-fibre change-rate dispersion is not noise,
it is the measurement that the cluster is wrong** (a cluster that has merged a hub with a satellite).

**D3 — Pythagorean = within-fibre Bregman information.** Identify Amari & Nagaoka's generalised
Pythagorean theorem with the Bregman-information decomposition:

```
E_i[ KL(p_i ‖ q) ]  =  E_i[ KL(p_i ‖ p̄) ]  +  KL( p̄ ‖ q )     for every q in the family
                       └─ fibre-VARYING ─┘    └── DESCENDS ──┘
```

The first term is exactly the approximation error of the pushforward; the second is the part that
descends. With `φ = ‖·‖²` the same identity is the **law of total variance**. Checked to
`5.7e-14` over 2000 random `q`; the within-cluster information is exactly `0` iff the fibre is
constant.

## The disambiguation this must land, because the tree already contains both

*"Measure over the cluster"* does not name one operation. The same members have **two** KL
barycentres, both already implemented in different files:

| barycentre | closed form | already in the tree as |
|---|---|---|
| `argmin_q E[KL(p_i ‖ q)]` (right-KL) | **moment average** — `(0.500000, 4.050000)` | **EP moment matching** (Minka 2001) |
| `argmin_q E[KL(q ‖ p_i)]` (left-KL) | **natural-parameter average** — `(0.947368, 1.052632)` | **NG4's `mix()`** — log-linear pooling (Genest 1984) |

This is the e-versus-m ambiguity of §3.3 arriving by a different door. **The variance route does
not dissolve Q3's ill-posedness; it re-derives it**, and names the missing datum: *fix which affine
structure is canonical for the purpose.*

## Falsifier

Exhibit a surjection `q` and a non-fibre-constant `g` that nevertheless descends (would refute
D1's iff), **or** a Bregman divergence and a cluster for which the D3 decomposition is inexact.

## Anchors (checked)

- Mac Lane, *Categories for the Working Mathematician* (2nd ed. 1998) I.2 — contravariant functor
  = functor on `C^op`; the definition both the C# and the physics conventions are measured
  against (§10.2 writes out the translation; the labels are swapped by exactly one `op`).
- Banerjee, Guo & Wang 2005, *On the optimality of conditional expectation as a Bregman predictor*,
  IEEE Trans. Inf. Theory 51 — the barycentre is the unique optimum.
- Banerjee, Merugu, Dhillon & Ghosh 2005, *Clustering with Bregman divergences*, JMLR 6 — the
  within-cluster Bregman information, which is **literally** the "cluster by distance in an
  embedding, then measure per cluster" design pattern that generated this item.
- Amari & Nagaoka 2000, Thm 3.8 / 3.9 — the Pythagorean and projection theorems D3 identifies with
  the above.

## Not in scope

Implementation. And the **Gärdenfors** half of Q3 — a coarsening yields a quotient, not a convex
region, so §3.3's problem is untouched by this item.

---

## D4 (added 2026-08-23, §11) — the descent condition IS the CmRDT/CvRDT condition

Aaron mapped §10's extensive/intensive split onto distributed primitives: *"a count is CRDT and a
condition is CASPaxos or CASRaft-ish."* Checking it produced a **two-tier `iff`** that is precise
enough for Lean and that answers the mapping's real question (equivalent, or merely co-extensive?).

> **D4.** An aggregation `⊕ : Multiset(X) → X` descends along **every** coarsening **iff** it
> factors through multiset equality — i.e. iff `(X, ⊕)` is a **commutative monoid**. It descends
> along every coarsening whose fibres arrive with **unknown multiplicity** **iff** it is
> additionally **idempotent** — i.e. iff `(X, ⊔)` is a **join-semilattice**.

The two tiers are **exactly** Shapiro et al.'s `CmRDT` and `CvRDT` conditions. So the mapping is a
**theorem** over commutative monoids and an **analogy that parts** over counts: `+` on counts is
commutative and associative and **not idempotent**, so a raw count is a `CmRDT` and **not** a
`CvRDT` state. The separator is **idempotence**, and idempotence is a property of the **delivery
channel**, not of the statistic.

**Lean 4, short.** Mathlib has `Multiset`, `Multiset.sum`, `Finset.sup`. The value is the `iff` in
both directions — the forward direction is routine; the **converse** (descent along *every*
coarsening forces commutativity) is what makes it a characterisation rather than a sufficient
condition, and it is the half worth machine-checking.

**Falsifier.** Exhibit a non-commutative `⊕` that nevertheless descends along every coarsening
(refutes tier 1), or a non-idempotent `⊕` that descends along every duplicating-channel coarsening
(refutes tier 2).

**Computed witnesses already written** —
`docs/research/scripts/2026-08-23-geometry-as-root-extensive-crdt-verify.py` (`ALL PASS`, exit 0):
count is commutative + associative + **not** idempotent; per-source keying + `max` **is** a
semilattice; redelivery double-counts under `+` and not under keyed-max; `(sum, count)` merges to
the exact global mean while average-of-averages is wrong by `1.414`; and a non-commutative pair
diverges under reordering.

**Anchors:** Shapiro, Preguiça, Baquero & Zawirski 2011 (CvRDT/CmRDT, the semilattice condition);
Rystsov 2018 (CASPaxos); Tolman 1917 (extensive/intensive, and the ratio-of-extensives repair);
FLP 1985 + Gilbert & Lynch 2002 (why the tier boundary is a computability class). Rows added to
`docs/PRIOR-ART-LIST.md`.

**Not in scope.** The architectural correspondence itself — CRDT/DBSP correlation and graceful
degradation on trust gradients is **recorded design** (208 files carry both terms; the L0–L4 ladder
dates to 2026-05-28), not a claim needing proof. What is new is the **criterion**, which §11.6
measured to be absent from the tree.

---

## D5 (added 2026-08-23, §12) — the strict containment, and what CALM already settles

Aaron: *"I'm almost certain **CALM theorem** is going to apply here."* It does — and it does most of
the work, so this item shrinks rather than grows.

**D5a — `B ⊊ A`, strictly (Lean 4, short).** With `A` = aggregations that push forward freely along
every coarsening (commutative monoid) and `B` = CvRDT state-merges (join-semilattice):
`B ⊆ A` because a join is commutative + associative with a bottom; and `(ℕ, +, 0) ∈ A \ B` because
`x + x = x` only at `0`, so no order on `ℕ` makes `+` a join. **The converse direction is empty:**
there is no statistic that is CvRDT-mergeable whose pushforward needs a condition, since idempotence
is an extra axiom rather than a weakening. That was the direction nobody had an intuition for.

**D5b — the free CvRDT representation, and its cost.** For any commutative monoid `(M, ⊕, 0)`, the
G-Set of uniquely-tagged operations merged by **union** is a CvRDT whose read is the freely
pushed-forward aggregate. So `A` and `B` are co-extensive **on what is constructible**, while
differing as conditions. The cost is unbounded state — measured at `O(#ops)` versus the G-Counter's
`O(#sources)` (500 ops → 500 entries vs 3). **The compression, not the construction, is what "a
count is CRDT" asserts.** A sufficient condition for compressibility is that per-source
contributions are monotone in an order with joins; **necessity is not established** — register that
as open, not as proved.

**NOT in scope — do not re-prove CALM.** *A program has a consistent, coordination-free
implementation **iff** it is monotone* is a borrowed theorem (Hellerstein 2010 conjecture; Ameloot,
Neven & Van den Bussche, JACM 2013; Hellerstein & Alvaro, CACM 2020). It is a **citation-check**
obligation, filed the same way as the Amari–Nagaoka results in §3.5.

**But the citation check is real and it bites.** The **set** form of CALM makes `COUNT`/`SUM`
**non-monotone** (a new fact retracts the old answer), which would say a counter needs coordination
— the opposite of what a G-Counter does. The form that applies is the **lattice** generalisation,
`Bloom^L` (**Conway, Marczak, Alvaro, Hellerstein & Maier**, *Logic and Lattices for Distributed
Programming*, SoCC 2012), where monotonicity is ascent in a bounded join-semilattice. Verify that
the statistics we actually carry meet **that** hypothesis, not the set one.

**D5c — idempotence ≡ monotonicity (record, do not litigate).** They are not competing candidates at
different depths: a commutative associative **idempotent** `⊔` is equivalent to a partial order with
joins via `x ≤ y ⟺ x ⊔ y = y`. Idempotence is the algebraic form, monotonicity the order-theoretic
form, of one condition.

**D5d — the one genuinely open statement, and it is ours.** *DBSP is not a third coordination-free
regime; it is an orthogonal axis.* Z-sets are non-monotone (`ZSet.fs:91`, the abelian-group
inverse), so CALM's necessity applies and DBSP is not coordination-free — but it never claimed to
be. Budiu et al. 2023 is a theorem about **incremental view maintenance** and takes the **agreed
input stream as a hypothesis**. So DBSP buys *exactness without recomputation*, not *consistency
without coordination*, and the coordination it needs is exactly the agreed logical order that
`.claude/rules/local-time-never-enters-the-shared-fold.md` already requires of the shared fold.
**Argued, not proved.** A precise statement would fix a formal notion of coordination-freedom
(Ameloot et al.'s transducer-network definition is the natural one) and show the Z-set fold is
coordination-free *relative to* an agreed phase order and not otherwise.

**Corollary worth keeping:** δ-CRDT deltas (Almeida, Shoker & Baquero, arXiv:1603.01529 — already
cited in `Crdt.fs`'s header) are join-irreducible **lattice** elements, hence monotone and
re-delivery-safe, and belong in the lattice regime; Z-set deltas are **group** elements and do not.
Two things called "delta", opposite re-delivery properties.

**Witnesses:** `docs/research/scripts/2026-08-23-geometry-as-root-pushforward-vs-crdt-verify.py`
(`ALL PASS`, exit 0) — T1 strict containment, T2 free representation, T3 compression, T4 the two
delta regimes, T5 an `OrSet` model, T6 converge-vs-act.
