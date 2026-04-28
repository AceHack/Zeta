# Semirings — the recipe template Zeta plugs different "arithmetics" into

**Subject:** zeta
**Level:** applied (default) + theoretical (opt-in)
**Audience:** contributors curious why Zeta claims
"multiple algebras in one database"
**Prerequisites:**

- `subjects/zeta/zset-basics/` (forthcoming — ℤ-with-
  retraction is the signed-integer case; this module shows
  why it's just one of many. Until that module lands, the
  retraction-intuition module at `subjects/zeta/retraction-intuition/`
  covers the prereq material.)
- [`subjects/zeta/operator-composition/`](../operator-composition/module.md)
  (operators compose the same way across different
  arithmetics)

**Next suggested:** `subjects/cs/databases/` (forthcoming —
where Zeta fits among database paradigms; the `subjects/cs/`
tree itself is not yet present, so this is a forward
reference to a planned-but-not-landed module)

---

## The anchor — a recipe template

A recipe template says: *"combine A and B to make
something; combine something and something-else to make
a final thing."* The shape is fixed (combine, combine,
combine). What you plug in — flour and water? paint and
canvas? two votes? — is different each time, and the
*meaning* of "combine" is different each time too.

In baking, "combine" means mix. In mixing paint, it means
blend. In counting votes, it means add. In finding the
shortest path between cities, it means *take the minimum*.
Same recipe template, different arithmetics.

**A semiring is a recipe template for "arithmetics."**
Zeta's operators are written once against the template;
plugging in a different arithmetic gives you a different
pipeline behaviour without rewriting the operators.

---

## Applied track — when / how / why semirings matter

### The claim

Zeta's operators (D, I, z⁻¹, H, filter, map, count, etc.)
don't care which arithmetic you're using underneath.
Swap the arithmetic, and your pipeline computes a
different thing — but with the same structure.

This is what lets Zeta be "one algebra to map the
others": the pipeline shape stays; the *meaning* of
combine + zero + one + multiply changes depending on the
semiring you choose.

### When to reach for a different semiring

You've been using Z-sets (the **signed-integer semiring**
ℤ with ordinary + and ×). Common alternatives:

| Semiring | "Combine" means | "Multiply" means | What it computes |
|---|---|---|---|
| **ℤ (signed integers)** — Zeta default | Add (with negatives for retraction) | Multiply | Retractable counts |
| **ℕ (counting)** | Add (no negatives) | Multiply | Plain multisets; no retraction |
| **𝔹 (Boolean)** | OR (either-or) | AND (both-and) | Plain sets; presence/absence only |
| **Tropical (min-plus)** | Take minimum | Add | Shortest paths between nodes |
| **Max-plus** | Take maximum | Add | Longest / critical-path times |
| **Possibilistic / fuzzy ([0,1])** | Take maximum | Multiply | Possibility distributions (max-times; not probability accumulation) |
| **Provenance** | Join witnesses | Combine witnesses | Which source contributed |

### Real-world examples — when each fits

- **Counting pages on a website** → ℕ (you never un-count)
- **Tracking order submissions with returns** → ℤ (Z-sets; returns are negatives)
- **"Is this user in the group?"** → 𝔹 (yes/no, no counts)
- **"What's the cheapest route?"** → Tropical (cheapest = min; combining routes = add costs)
- **"What's the fastest project finish?"** → Max-plus (finish time = max of dependencies)
- **"Which source is this fact from?"** → Provenance (tracks which input tuples contributed)

You use Zeta's same operator library for all of these;
only the semiring parameter changes.

### How to use semirings in Zeta (conceptually)

F# signature (sketch — actual APIs are an active-
development surface):

```text
// SHAPE SKETCH (pseudocode, not valid F# — uses
// mathematical type names ℤ/ℕ/𝔹 and a hypothetical
// `ISemiring` interface that does not exist in `src/`
// today; see the research memory for the actual
// proposed API surface):

// Instead of hard-coding ℤ:
type ZSet<'K> = ...

// Parameterise over semiring S:
type SemiringSet<'K, 'S when 'S :> ISemiring> = ...

// Same operators, different arithmetic:
count : SemiringSet<'K, ℤ> -> int64          // retractable count
count : SemiringSet<'K, ℕ> -> uint64         // plain count
count : SemiringSet<'K, 𝔹> -> bool           // is-any-present

// Note: in Zeta's actual NovelMath.fs, Tropical results
// would be `TropicalWeight` (backed by int64 with
// Int64.MaxValue as +∞), not `float`:
count : SemiringSet<'K, Tropical> -> TropicalWeight   // minimum cost
```

See the semiring-parameterised-Zeta research memory
(PR #164) for the current regime-change exploration.
Today's Zeta implementation pins ℤ; the research arc is
about lifting the pin.

### Why semirings — compared to alternatives

| Alternative | Problem |
|---|---|
| Separate library per arithmetic (e.g., graph library for shortest-path; OLAP engine for counts; vote tally for sets) | Can't share operator semantics; re-derive IVM properties per library; no composition across |
| One library, case-matching on what-arithmetic internally | Operators grow with-every-new-arithmetic; no formal guarantee of correctness |
| One library, pick-one-arithmetic forever | Misses the generalisation Zeta's algebra actually supports |

Semirings win when the underlying query shape is the same
but the *meaning* of the numbers differs. That's common
in DB / streaming / planning / graph contexts.

### How to tell if semiring-parameterisation is right

Three self-check questions:

1. **Does your query use `+`, `×`, `0`, `1` (or minimum,
   maximum, or other binary combinators)?** If yes, a
   semiring framing likely applies.
2. **Could you run the same query over different
   interpretations of those operators?** If yes
   (shortest-path vs. counting vs. presence), semirings
   are the mechanism.
3. **Do you want retraction / IVM guarantees to hold
   across all interpretations?** Only some semirings
   (notably ℤ) have the additive-inverse property that
   makes retraction lossless. Others (ℕ, 𝔹, Tropical)
   are retract-free or retract-constrained — document
   the tradeoff.

---

## Prerequisites check (self-assessment gate)

Before the next module, you should be able to answer:

- What's the difference between a semiring (has 0, 1, +,
  ×, distributivity) and a ring (has all that, plus
  additive inverses)? Why does retraction need a ring,
  not just a semiring?
- Name two real-world problems where the same pipeline
  shape applies but the underlying arithmetic differs.
- Why would you choose the tropical semiring (min-plus)
  instead of ordinary arithmetic (plus-times) for a
  shortest-path problem?

---

## Theoretical track — opt-in (for learners who really care)

*If applied is enough, stop here. The below is for those
going deep.*

### Formal definition

A **semiring** `(R, +, ×, 0, 1)` is a set `R` with two
binary operations `+` and `×` and two distinguished
elements `0` and `1`, satisfying:

1. `(R, +, 0)` is a commutative monoid
2. `(R, ×, 1)` is a monoid
3. `×` distributes over `+`:
   `a × (b + c) = (a × b) + (a × c)`
   `(a + b) × c = (a × c) + (b × c)`
4. `0` annihilates: `0 × a = a × 0 = 0`

A **commutative semiring** additionally has
`a × b = b × a`.

A **ring** is a semiring with additive inverses — for
every `a ∈ R`, there exists `-a ∈ R` such that
`a + (-a) = 0`.

Retraction in Z-sets depends on ℤ being a ring, not
just a semiring. K-relations (per Green-Karvounarakis-
Tannen PODS 2007) over a semiring **without additive
inverses** (ℕ, 𝔹, lineage, ℕ[X] provenance, tropical,
max-plus, possibilistic) support lineage / provenance /
counting but not retraction. K-relations over a
**ring** (ℤ — additive inverses available) DO support
retraction; this is exactly what Zeta uses. Rings are
semirings, so the distinction is "pure-semiring-without-
additive-inverses" vs "ring".

### Canonical semirings in data systems

| Semiring | R | + | × | 0 | 1 | Retraction? |
|---|---|---|---|---|---|---|
| Signed integers | ℤ | + | × | 0 | 1 | Yes (ring) |
| Counting | ℕ | + | × | 0 | 1 | No (no negatives) |
| Boolean | {T, F} | ∨ | ∧ | F | T | N/A (can't "retract") |
| Tropical (Zeta) | ℤ ∪ {+∞} | min | + | +∞ | 0 | No (min has no additive inverse). Note: Zeta's `TropicalWeight` in `src/Core/NovelMath.fs` is backed by `int64` with `Int64.MaxValue` as +∞; the math definition extends to ℝ ∪ {+∞}, but Zeta's implementation uses ℤ. |
| Max-plus | ℝ ∪ {-∞} | max | + | -∞ | 0 | No |
| Possibilistic / fuzzy | [0, 1] | max | × | 0 | 1 | No |
| Lineage (Boolean witness sets, GKT form) | 2^X (subsets of source tuples) | ∪ | ∪ | ∅ | X | N/A — both addition (union of relations) and multiplication (join: combine evidence from both input tuples) use set-union; the multiplicative identity X is the "all-source-tuples" universe so multiplying by 1 is a no-op. (An alternative formulation uses ∩ for multiplication; that's `Why(X)` provenance, distinct from Boolean lineage. The choice depends on whether you want "any source contributing" or "all sources contributing" tracked downstream.) |
| Provenance | N[X] (polynomials over ℕ) | + | × | 0 | 1 | No (N[X] coefficients are ℕ — non-negative; no additive inverses available). For retractable provenance, use ℤ[X] (polynomials over ℤ) instead. |

### The K-relations framework (Green-Karvounarakis-Tannen 2007)

The formal basis for semiring-parameterised database
queries. A **K-relation** is a relation `R → K` where
`K` is a commutative semiring. Relational-algebra
operators (select / project / join / union) are defined
in terms of semiring `+` and `×`:

- **union** uses `+` (disjunction of evidence)
- **join** uses `×` (conjunction of evidence)
- **projection** uses `+` (aggregate / marginalise)
- **selection** uses multiplication-by-0-or-1 (mask)

GKT proved that every **positive** relational-algebra
result (selection, projection, union, natural join, where
the operators are sums and products of input weights) over
K-relations is **semiring-homomorphic** — changing the
semiring gives a systematic reinterpretation of the query.
The homomorphism does NOT extend to relational difference /
set-difference, which requires additive inverses
(rings, not pure semirings); negative tuple-handling on
those operators must be re-derived per ring.

### Zeta's regime-change claim (Otto-session memory)

Per the semiring-parameterised-Zeta memory (Otto-17-era):

> Zeta's retraction-native operator algebra (D / I / z⁻¹
> / H) is the stable meta-layer. The semiring becomes a
> pluggable parameter. All other DB algebras (tropical
> / Boolean / probabilistic / lineage / provenance /
> Bayesian) host within the one Zeta algebra by
> semiring-swap.

The regime-change framing: Zeta doesn't replace
shortest-path libraries / Boolean set logic / lineage
tools — it provides the operator-algebra substrate that
all of them can slot into as semiring-parameterised
instances.

### What requires care

- **Non-ring semirings lose retraction.** If you use
  tropical or Boolean as the base, pipelines can't
  retract losslessly. Operator documentation must call
  this out.
- **Some operators require additional structure**
  (e.g., **idempotence** for Boolean; **convergence** for
  fixpoint queries). Not all semirings satisfy these.
- **Type-system shape**: parameterising F# types over
  semirings requires careful interface design; see
  `src/Core/Algebra.fs` for the current state and the
  regime-change memory for research-direction.

### Theoretical prerequisites (if going deeper)

- Abstract algebra — monoids / semirings / rings /
  distributivity
- Category theory — semiring-valued functors; Kan
  extensions
- Database theory — K-relations (GKT 2007); provenance
  polynomials
- Graph algorithms — shortest-path via tropical
  semirings (Kleene stars; matrix-semiring powers)

---

## Composes with

- `subjects/zeta/zset-basics/` — ℤ-semiring as one
  instance
- `subjects/zeta/retraction-intuition/` — retraction
  requires ring-structure, not just semiring
- `subjects/zeta/operator-composition/` — same operators
  compose across different semirings
- `docs/TECH-RADAR.md` — Tropical semiring Adopt (round
  11); residuated lattices Adopt. (Note: tech-radar table
  columns are Technique | Ring | Round | Notes; the "11" is
  the Round column. Provenance does not yet have a tech-
  radar row; if/when it lands, the row will join the
  Tropical / residuated-lattices entries. For now, treat
  provenance as not-yet-on-tech-radar rather than
  "deferred".)
- `docs/ALIGNMENT.md` HC-2 — retraction-native
  operations (strictly applies to ring-based; documented
  for other semirings)
- `src/Core/Algebra.fs` — `Weight = int64` pins ℤ
  today
- `src/Core/NovelMath.fs` — tropical semiring
  implementation
- `src/Core/NovelMathExt.fs` — research-grade extensions
- In-repo memory
  [`memory/project_semiring_parameterized_zeta_regime_change_one_algebra_to_map_others_2026_04_22.md`](../../../../../memory/project_semiring_parameterized_zeta_regime_change_one_algebra_to_map_others_2026_04_22.md)
  — semiring-parameterised-Zeta regime-change framing
  (in-repo per Otto-114 forward-mirror, not per-user
  Anthropic AutoMemory).
  — full regime-change research framing

---

## Module-level discipline audit (bidirectional-alignment)

- **AI → human**: does this module help the AI explain
  semirings clearly to a new contributor? YES —
  recipe-template anchor, real-world examples table,
  F# signature sketch, alternative comparison, self-
  check gate.
- **Human → AI**: does this module help a human
  contributor understand what the AI treats as
  semiring-parameterisation? YES — K-relations
  reference, GKT 2007 citation, Zeta regime-change
  framing, retraction-ring-vs-semiring distinction
  surfaced.

**Module passes both directions.**

---

## Attribution

Otto (loop-agent PM hat) authored v0. Fourth Craft
module (after zset-basics / retraction-intuition /
operator-composition). Content accuracy: future Soraya
(formal-verification) review on formal definitions;
Hiroshi (complexity-theory) on shortest-path /
idempotence / Kleene-star claims; Kira (harsh-critic)
normal pass.
