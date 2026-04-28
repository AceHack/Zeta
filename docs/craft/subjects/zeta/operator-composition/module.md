# Operator composition — snapping LEGO blocks into a pipeline

**Subject:** zeta
**Level:** applied (default) + theoretical (opt-in)
**Audience:** contributors building / reading Zeta
pipelines

**Prerequisites:**

- `subjects/zeta/zset-basics/` (forthcoming — Z-sets are
  what most operators consume and produce; until that
  module lands, see `docs/ARCHITECTURE.md` and
  `openspec/specs/operator-algebra/spec.md` for the
  Z-set definition)
- `subjects/zeta/retraction-intuition/` (operators must
  preserve retraction for IVM to work)

**Next suggested:** `subjects/zeta/semiring-basics/`
(forthcoming — pluggable algebras behind operators)

---

## The anchor — snapping LEGO blocks

A LEGO block has a fixed set of studs on top and a fixed
set of sockets on the bottom. Any block can snap onto any
other block *because the interface is standardised*. You
don't re-engineer the studs each time; you rely on them
being compatible.

A **Zeta operator** is a LEGO block for data pipelines.
Its *studs* are the typed inputs it accepts; its
*sockets* are the typed outputs it produces. Many core
operators transform `Stream<ZSet<_>>` to
`Stream<ZSet<_>>`, but composition is more general: one
operator can snap downstream of another whenever the
upstream operator's output type matches the downstream
operator's input type. Some operators (for example
`count`, `sum`) emit scalar streams (`Stream<int64>`)
rather than Z-set streams; these compose with operators
that accept scalars.

**Composition is the act of snapping blocks together.**
A pipeline is a stack of blocks; the stack computes the
same thing each time the input changes, because the
algebra guarantees the composition.

---

## Applied track — when / how / why composition matters

### Why it matters

In a retraction-native world, building pipelines *by
composition* (rather than one big hand-written query)
has three practical benefits:

1. **Each block is testable in isolation.** A `filter`
   block can be unit-tested on tiny inputs, without
   spinning up the full pipeline.
2. **Retraction flows through automatically.** If every
   block is retraction-preserving (per the prerequisite
   module), the whole stack is retraction-preserving
   by composition.
3. **Swaps are cheap.** If you need to replace a
   `count` block with a `sum` block, the socket above
   and stud below stay the same; only the middle
   changes.

This is the difference between a LEGO set and a carved
wooden model. Both can look the same; only one is
reconfigurable.

### The core operators — what snaps to what

Zeta ships a small core that covers most pipelines:

| Operator | What it does | Input | Output |
|---|---|---|---|
| `D` (delta) | Extract the change (insertions + retractions) from a Z-set stream | Z-set(t) | ΔZ-set(t) |
| `I` (integral) | Reconstruct state by accumulating changes | ΔZ-set(t) | Z-set(t) |
| `z⁻¹` (delay) | Hold last-tick value; one-step lookback | Z-set(t) | Z-set(t-1) |
| `H` (`distinct^Δ`) | Incremental-distinct boundary-crossing operator (per `openspec/specs/operator-algebra/spec.md`) | ΔZ-set(t) | ΔZ-set(t) (with multiplicities clamped to {0,1}) |
| `filter` | Keep only entries satisfying a predicate | Z-set(t) | Z-set(t) |
| `map` | Transform keys via a function | Z-set(t) | Z-set(t) |
| `count` | Sum weights to a scalar | Z-set(t) | ℤ |

Note: nested / recursive composition (one pipeline as
an element of another's input) is provided via the
`Circuit.Nest` / `Circuit.NestWithHandle` extension
methods (implemented in `src/Core/NestedCircuit.fs`
under `NestedCircuitExtensions`) and the
`circuit-recursion` / `retraction-safe-recursion` specs,
not via `H`. See the "Nested / recursive circuits"
section in the theoretical track below.

Each input-type matches the previous operator's output-
type. Snap them.

### How to use composition in Zeta

A common pattern — "count the running total of apples
sold today, with retractions applied":

```fsharp
// Pipeline composition using the real F# surface
// (Pipeline is [<RequireQualifiedAccess>] and each
// function takes the Circuit as its first argument).
let c = circuit  // a Zeta.Core Circuit value

// Apples-only filter, integrated as a Z-set stream:
let applesOverTime =
    input
    |> Zeta.Core.Pipeline.filter c (fun k -> k.category = "fruit")
    |> Zeta.Core.Pipeline.filter c (fun k -> k.name = "apple")
    |> Zeta.Core.Pipeline.integrate c   // Z-set integral

// Running scalar count of the integrated apples Z-set:
let runningCount =
    applesOverTime
    |> Zeta.Core.Pipeline.count c       // Stream<int64>
```

Each `|>` is a LEGO snap. Each step's output type
becomes the next step's input type. Note the order:
`integrate` is a Z-set-to-Z-set operator
(`Stream<ZSet<_>> -> Stream<ZSet<_>>`), so it must run
*before* `count` collapses the Z-set to a scalar; once
you have a `Stream<int64>`, the Z-set-typed operators
no longer apply. No hand-written glue code; the
type-checker enforces the sockets line up.

**When retraction arrives**, each Z-set block forwards
the negative weight through. The `integrate` step folds
the deltas into running state correctly; downstream
scalar aggregations stay exact; the whole pipeline
"just works."

### Why composition — compared to alternatives

| Alternative | Problem |
|---|---|
| One big hand-written SQL query | Hard to test parts; impossible to swap a subsection; no guarantee about retraction semantics |
| Monolithic procedural code | Same as above, with less declarative reasoning available |
| Lambda architecture (speed + batch layers) | Maintains two separate pipelines that must agree; consistency bugs on their own |
| ETL pipeline frameworks | Composition is present but often retraction-unaware; stateful transforms need explicit re-processing logic |

Composition wins when (a) the operators are algebraically
well-defined, (b) retraction semantics are preserved by
each, and (c) you want pipeline fragments to be
swappable. Zeta is built for exactly this case.

### How to tell if your composition is right

Three self-check questions:

1. **Does each block's output type match the next
   block's input type?** The F# compiler catches this.
   If you hit a type error, the blocks don't snap —
   fix the mismatch; don't bolt on glue.
2. **Is each block retraction-preserving?** Check the
   operator's documentation against the
   retraction-safety constraints in the
   `retraction-intuition` module and
   `openspec/specs/operator-algebra/spec.md`. If the
   operator's documented semantics do not preserve
   retraction (or only preserve it under qualifications
   such as time-invariance or z-linearity), your
   pipeline needs explicit care.
3. **Would you be comfortable swapping any one block
   for its replacement?** If yes, the composition is
   honouring LEGO-style modularity. If you'd have to
   rewrite surrounding code, something is coupled
   that shouldn't be.

---

## Prerequisites check (self-assessment gate)

Before the next module, you should be able to answer:

- Why does the `|>` pipeline operator in F# work as a
  composition mechanism for Zeta operators? (Hint: each
  operator's output type is what the next one consumes.)
- Give an example pipeline where `filter` comes *before*
  `count`. Then explain why a `map` *after* `count`
  cannot type-check against the documented F# surface
  (`Pipeline.count` produces `Stream<int64>` while
  `Pipeline.map` consumes `Stream<ZSet<_>>`) — what
  does this tell you about the order in which scalar
  aggregations and Z-set transformations must appear?
- What happens downstream when an operator in the middle
  of a pipeline receives a retraction (negative-weight
  entry)? Do the downstream operators need to know they
  received a retraction, or does it "just flow"?

---

## Theoretical track — opt-in (for learners who really care)

*If applied is enough, stop here. The below is for those
going deep.*

### Operators as categorical arrows

In category-theoretic terms, a Zeta operator `Q : ZSet K
→ ZSet L` is an arrow in a category whose objects are
Z-set types. Composition `Q_2 ∘ Q_1` is arrow
composition. The LEGO anchor is literally categorical:
the *studs* and *sockets* are the types, the *blocks* are
the arrows, and *snapping* is composition.

### The DBSP operator signatures

From Budiu et al. VLDB 2023 §2:

- `D : Stream<ZSet K> → Stream<ZSet K>` (pointwise delta)
- `I : Stream<ZSet K> → Stream<ZSet K>` (pointwise
  cumulative integral)
- `z⁻¹ : Stream<ZSet K> → Stream<ZSet K>` (one-step
  delay)
- `lift(f) : Stream<ZSet K> → Stream<ZSet L>` where
  `f : ZSet K → ZSet L` is a function (the point-lift)
- Bilinear operator / join: `⋈ : Stream<ZSet K> ×
  Stream<ZSet L> → Stream<ZSet (K × L)>`

These compose via arrow composition. The DBSP paper
proves several identities that let us *rewrite* a
composition into an equivalent, often cheaper form — the
basis of Zeta's query-plan optimiser.

### Key identities

- **For causal streams with a declared zero at `t=0`,
  D ∘ I = I ∘ D = id** (integral and delta invert each
  other on that domain; the algebra's fundamental
  theorem — see `openspec/specs/operator-algebra/spec.md`
  for the precondition)
- **Q^Δ = D ∘ Q ∘ I** (the incremental form of any
  query `Q`; this is the rewrite the optimiser uses to
  turn a batch query into one whose work-per-tick is
  proportional to the change size — see
  `src/Core/Incremental.fs`)
- **D ∘ Q = Q ∘ D** when `Q` is a time-invariant linear
  operator (delta commutes with such `Q`; this is the
  non-trivial commutation law; bare associativity of
  composition is not what enables incrementalisation)
- **I ∘ (Q_1 + Q_2) = (I ∘ Q_1) + (I ∘ Q_2)** (integral
  is linear)

These identities enable incremental maintenance: given a
query `Q = Q_n ∘ ... ∘ Q_1`, its incremental version is
`D ∘ Q ∘ I`, which (by the identities) can be rewritten
into a form whose work-per-tick is proportional to the
change size, not the state size.

### Where composition fails

Not every Zeta operator composes trivially. Specifically:

1. **Non-z-linear operators** (per the retraction-
   intuition module): composing them may break
   retraction-preservation. Zeta flags these; compose
   with explicit care.
2. **Stateful operators with side channels** (e.g., some
   sketches that track auxiliary state): composition is
   sound only if the composition respects the
   operator's state semantics.
3. **Typing across semirings**: the same shape of
   operator may not compose when applied over different
   semirings; see the semiring-basics module
   (forthcoming) for the parameterised picture.

### Nested / recursive circuits

Zeta supports composing pipelines as values — one
pipeline becomes an element of another's input Z-set,
and circuits can refer to themselves through a feedback
loop. This is how Zeta handles nested aggregations,
group-by-of-group-by, and recursive queries. The
implementation lives behind `NestedCircuit.Nest` (see
`src/Core/NestedCircuit.fs`); the `H` symbol from the
operator table above is reserved for incremental
distinct (`distinct^Δ`) per
`openspec/specs/operator-algebra/spec.md`. The
theoretical treatment of nesting / recursion is in:

- `openspec/specs/circuit-recursion/spec.md`
- `openspec/specs/retraction-safe-recursion/spec.md`

### Theoretical prerequisites (if going deeper)

- Category theory — arrows, composition, functors,
  natural transformations
- Stream algebra — time-indexed values, lift / delay /
  integral / delta as stream operators
- DBSP paper — Budiu et al. VLDB 2023 is the primary
  reference

---

## Composes with

- `subjects/zeta/zset-basics/` — inputs and outputs
- `subjects/zeta/retraction-intuition/` — each block
  must preserve retraction for the composition to
  preserve retraction
- `docs/ALIGNMENT.md` HC-2 — retraction-native
  operations contract
- `docs/TECH-RADAR.md` — DBSP operator algebra Adopt
- `docs/ARCHITECTURE.md` §operator-algebra — full
  architectural treatment
- `src/Core/Circuit.fs` — reference implementation of
  composition
- `src/Core/NestedCircuit.fs` — nested / recursive
  composition via `Circuit.Nest` /
  `Circuit.NestWithHandle` extension methods (NOT the
  `H` operator; `H` = `distinct^Δ` per the operator-
  algebra spec)
- `openspec/specs/operator-algebra/spec.md` — formal
  spec of the composable operator substrate
- `openspec/specs/circuit-recursion/spec.md` — recursive
  composition

---

## Module-level discipline audit (bidirectional-alignment)

- **AI → human**: does this module help the AI explain
  operator composition clearly to a new contributor?
  YES — LEGO anchor, operator-table + type-match rule,
  F# pipeline example, alternative-comparison table,
  self-check gate.
- **Human → AI**: does this module help a human
  contributor understand what the AI treats as
  operator composition (semantically + categorically)?
  YES — arrows-in-a-category framing, DBSP identities,
  H operator nested-composition surfaced, where-
  composition-fails called out explicitly.

**Module passes both directions.**
