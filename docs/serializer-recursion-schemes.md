# DynamicValue as μF — codecs & bridges as recursion schemes

> Grounding for the serializer layer (081KT5CF90008QG0R001P4CQ09) in proven math. Saved for further
> proofs (Aaron 2026-06-04): folds have **laws**, so serializer correctness can be
> proven via recursion-scheme algebra, not only example tests.

## DynamicValue is the fixpoint of the value functor

Define the value functor:

```
F(X) = Null | Bool | Int | Float | String | Bytes | List(X) | List(String × X)
```

Then **`DynamicValue = μX. F(X)`** — the least fixed point: scalar **leaves**
(`Null … Bytes`) plus **recursive nodes** (`Array = List(X)`, `Object =
List(String × X)`). This is the canonical value-tree / term algebra / **initial
F-algebra**. It is the **LCD** (lowest common denominator) every value-tree format
embeds into.

## Codecs and bridges are folds

- **A codec is a fold.** Each serializer is a **catamorphism**
  `cata(alg) : DynamicValue → Out` for an F-algebra `alg : F(Out) → Out`. Decode is
  the dual **anamorphism** `ana(coalg) : In → DynamicValue`. JSON / CBOR / YAML are
  different algebras over the **same** tree — which is *why* DynamicValue is the
  pivot: everything is a fold to/from one structure.
- **A type bridge is a fold.** Per the DynamicValue-LCD + bridge-per-type decision:
  - **lossless (1:1) type → the GENERIC base bridge** = the generic catamorphism
    (structural recursion, no custom code).
  - **lossy type → a CUSTOM per-type bridge** = a hand-written algebra for what the
    LCD cannot carry.
  So *base-vs-custom bridge* = *generic-fold-vs-custom-fold*.

## The proof payoff (why this is saved for proofs)

Recursion schemes come with **laws** we can prove against:

- **Universal property of `cata`** — `h = cata(alg)` iff `h ∘ in = alg ∘ F(h)`.
  A fold is the *unique* such morphism. (Lets us prove a codec/bridge *is* THE fold.)
- **Cata-fusion** — `g ∘ cata(alg) = cata(alg')` when `g ∘ alg = alg' ∘ F(g)`.
  (Compose/optimize codecs+bridges with a proof obligation, not a guess.)
- **Round-trip** — `cata(decodeAlg) ∘ ana(encodeCoalg) = id` is a hylomorphism
  identity; the format-agreement matrix's "every pair commutes" is a *theorem*
  about these (de)hylo compositions on the shared `μF`.

So the serializer layer's correctness reduces to algebra over `μF` — provable
(Z3/FsCheck/Lean tiers), not merely example-tested. This is the formal-proof-first
form of the make-or-break serializer surface.

## Generalization: `ValueTree<Leaf>`

`DynamicValue` is **closed** today (fixed scalar leaves). Parameterize the leaf
algebra → **`ValueTree<Leaf>`** (with `DynamicValue = ValueTree<StandardScalars>`).
Then the **polymorphic type system on top** reuses ONE recursion scheme (folds /
unfolds defined once over `ValueTree<_>`), and the lossless bridges are the generic
instance. Composes the recursive-type / HKT-hack theme.

## Lineage (Beacon)

- Meijer, Fokkinga, Paterson — *"Functional Programming with Bananas, Lenses,
  Envelopes and Barbed Wire"* (recursion schemes: cata/ana/hylo).
- Same "code follows from the types" (Erik Meijer) the program already pulls on.

## Pointers

- 081KT5CF90008QG0R001P4CQ09 — serializer roster + DOM-unify + LCD/bridge decisions (this is its math grounding)
- `docs/PROVEN-CORE-MAP.md` — serializers as a floor primitive (metric/aggregation + value)
- `src/Core/DynamicValue.fs` — the `μF` value tree itself

## Loss is first-class in the bridge API (Amara 2026-06-04)

DynamicValue is the **lossy** LCD pivot, so a bridge must make loss OBSERVABLE +
TYPED — never silent (silent lossy conversion is exactly what this proof core
prevents). The bridge API is `Result<_, TFeedback>`-shaped, not a bare function:

```
toDynamic   : T -> Result<DynamicValue, LossReport>      // confess what's dropped
fromDynamic : DynamicValue -> Result<T, BridgeFeedback>  // confess what can't be reconstructed
```

- **Lossless (1:1) type** → the generic base catamorphism; `LossReport` is empty
  (and round-trips exactly).
- **Lossy / richer type** → a custom per-type bridge that EMITS the explicit
  `LossReport` for what the LCD can't carry. Composes the OPLE `Result<T,TFeedback>`
  substrate.

## Proof path (Amara) — the owed sequence

1. Define `DynamicValue = μF` (done — this doc).
2. Define fold/unfold (cata/ana) laws.
3. Prove codec round-trip per format: `decode (encode v) = v` (hylo identity).
4. Prove bridge laws: lossless bridge round-trips exactly; lossy bridge emits an
   explicit, typed `LossReport` (no silent loss).
5. Derive format agreement: YAML ↔ JSON ↔ CBOR commute through DynamicValue
   (follows from 3 + the shared μF — N² pairwise becomes N codec proofs).

Keeper: **DynamicValue is the foldable common body of value-tree data; codecs are
folds over it; bridges are folds into it; lossy bridges must confess what they lose.**

## Open base type: typed structs are LENSES into DynamicValue (Aaron 2026-06-04)

DynamicValue (`μF`) is an **open superset**. A compiled struct does not own the
data — it **projects out the subset of fields it knows** and leaves everything else
in the **extra-data / extensible region** of the same value. So a typed view is a
**lens / prism** into DynamicValue, and the bridge gains a provable obligation:

- **Round-trip preserves unknowns (get-put)** — `toDynamic (fromDynamic dv) ⊇ dv`,
  on the **representable subset**. The lossy bridge's `LossReport`/residual **IS** the
  extra-data region; that is *why* loss is first-class. Lossless ⟺ residual empty.
- **put-get** — reading back a field you just set yields what you set.
- **LossReport-completeness (the second, easy-to-forget obligation — Kestrel
  2026-06-04)** — get-put alone is INSUFFICIENT: a lens could silently shovel data
  into the residual and still pass a naive `⊇ dv` check while violating the honesty
  loss-first-class exists for. So the real obligation is *two* theorems: (1) get-put
  on the representable subset, AND (2) **the `LossReport` accounts for exactly what is
  dropped** — `dv = recombine (fromDynamic dv) (LossReport dv)` with NOTHING lost that
  isn't reported. Proving (1) without (2) is the over-claim to avoid: (2) is the whole
  point of the design (no silent loss), so a bridge proof that omits it is vacuous on
  the property that matters. Scope honestly: get-put holds on the lossless subset; the
  lossy edges (Bytes-in-YAML, float repr) are carried by the residual AND reported.

This makes data **version-independent at runtime**: decode against the open tree, a
newer/older schema's extra fields survive untouched, and the concrete type can be
**runtime-swapped via polymorphic deserialization** with no data loss. Open records
/ row polymorphism / protobuf unknown-field retention / Postel's robustness — made
provable (lens laws over `μF`).

The extra-data region is also the **cross-cutting metadata channel** (context,
span/tracing, uncertainty, structured-logging scope, claim/auth, "other passing")
— the W3C Trace-Context / OpenTelemetry baggage / gRPC-metadata pattern: metadata
rides alongside the value without the value's type knowing. `claim/auth` in baggage
mirrors `no-directives` (claim = source travels; authorization stays gated);
`uncertainty` in baggage carries proven-vs-asserted confidence with the value.

### The boundary holds the FULL type; languages are lossy renderers

The full **open recursive polymorphic generic** type lives at the
**boundary / serialization layer** — that is the canonical, maximally-expressive
form. Each *language* then gets a **lossy projection** when it can't represent the
whole thing (the lens, dumbed-down per target). This inverts the usual stance: the
**wire is canonical, the language type is the lossy view** — not "language type is
king, serialization is a dumbed-down transport." It is interfaces-are-the-asset /
seed-is-the-data taken to its end: the boundary type is the asset; languages are
lossy lenses over it. Consequence: C#/Rust being lossier than F#/TS is **expected
per-language capability**, not debt (composes the 4-oracle per-language roles).

**Sequencing:** zero-downtime **versioned schema-evolution proofs** grow ON TOP of
these lens laws — an expand-stage payoff, deferred until the primitives close. The
round-trip-preserves-unknowns law is the lemma they will stand on.

- Lineage (Beacon): lens laws — Foster et al. *"Combinators for Bidirectional Tree
  Transformations"* (get-put / put-get); row polymorphism — Wand / Rémy; unknown-
  field retention — Protocol Buffers; baggage — W3C Trace Context / OpenTelemetry.
