# DynamicValue as μF — codecs & bridges as recursion schemes

> Grounding for the serializer layer (B-1011) in proven math. Saved for further
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

- B-1011 — serializer roster + DOM-unify + LCD/bridge decisions (this is its math grounding)
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
