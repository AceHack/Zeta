# Numerical / algebra-shaped → into the generic-math interface (per-language idiom)

Carved sentence (operator 2026-05-31):

> **Anything numerical or algebra-shaped, try to get it into the generic-math
> interface** — implement the *subset of the structure it actually has*
> (additive monoid / group / ring / field / `INumber`), in **each language's own
> generic-math idiom**: C# `System.Numerics` IWSAM (`IAdditiveIdentity` /
> `IAdditionOperators` / `IMultiplyOperators` / `INumber<T>`), F# native `Zero` +
> `(+)` (SRTP / `List.sum` / `GenericZero`). Own the interface per language; don't
> fight the language.

> **Whys-first** (per `a-rule-without-a-why-is-dogma`): each clause carries its
> reasoning so a newcomer can challenge the *logic*, not just the conclusion.

## Operational content

When a type is **numerical or algebra-shaped** — it has an identity + an
associative operation (a monoid), or richer (group: + inverse; ring/field: + a
second operation; or full `INumber`-family arithmetic) — make it implement the
platform's **generic-math interface** for the structure it genuinely has.

### The per-language idiom (own the interface in each language's own terms)

| Language | Generic-math idiom | Example (additive monoid) |
|---|---|---|
| **C# / .NET** | `System.Numerics` **IWSAM** (interfaces with static abstract members; .NET 7+) | `: IAdditiveIdentity<T,T>, IAdditionOperators<T,T,T>` |
| **F#** | **native** `static member Zero` + `static member (+)` (recognized by SRTP / `List.sum` / `LanguagePrimitives.GenericZero`) | `static member Zero` + `static member (+)` |
| **Rust** | `std::ops` traits + `num-traits`-style (`Add`, `Zero`) | `impl Add` + a `Zero`-style assoc const |
| **TS** | a small `Monoid<T>`/`Semigroup<T>` record (no native generic-math) | `{ empty, concat }` |

**WHY per-language-idiom, not one transplanted interface** (challenge it): C#
generic-math is IWSAM; F# generic-math is SRTP `Zero`/`(+)`. Forcing C#'s IWSAM
*into* F# trips the **FS3535 "advanced feature" advisory**, which fails under our
`TreatWarningsAsErrors` — i.e. fighting the language. "Own the interface in each
language's own idiom" (the BCL-interface-boundary rule) means using the platform's
*native* generic-math surface, not transplanting one platform's into another.
Empirically: this is exactly why the 081KSXN940008QG0R0002287MP observe-fold monoid used C# IWSAM
*and* F# `Zero`/`(+)` — and the F# side was the cleaner of the two.

### Implement only the structure that is TRUE (additive-monoidal only, etc.)

**WHY** (challenge it): implementing `INumber<T>` on a type that is only an
additive monoid invents arithmetic that doesn't exist (multiplication, ordering,
negatives). Implement the *subset* the type genuinely has — additive-monoid
interfaces for a free monoid (the event log), full `INumber` only for an actual
number. (This is the 081KSXN940008QG0R0002287MP "additive-monoidal only, not `INumber<T>`"
decision for the tri-state/held-capable TriFloat + the event-log.)

### Why get it into the generic-math interface at all

1. **Composability with generic numeric code** — `List.sum`, SRTP-constrained
   helpers, generic-math algorithms all work on a type that declares the interface.
   The structure becomes *reusable* instead of bespoke. **WHY load-bearing:** it's
   the difference between "a number with a name" and "a value the whole numeric
   ecosystem can fold/aggregate/compose."
2. **The interface IS the algebraic contract, machine-recognized + testable** —
   additive identity + associativity ARE the monoid laws; declaring them surfaces
   the laws to the compiler + to property tests (the laws hold through `==`/`+`,
   not just in prose). **WHY:** an asserted-in-docs law decays; a law on the
   generic-math interface is checkable.
3. **C# IWSAM is powerful for a WASM runtime** (operator 2026-05-31: *"i love the
   c# IWSAM stuff that will be powerful for a wasm runtime"*) — static-abstract
   generic-math monomorphizes to efficient, allocation-light code that compiles
   well to WASM (the Rust low-level + WASM target lane). **WHY note this:** it
   makes generic-math a forward investment for the WASM runtime, not just an
   in-process niceness.
4. **Cross-language parity** — the same algebra declared in each language's
   generic-math idiom feeds the 4-language compiler-BFT (081KSV2WD0008QG0R00051XS0N): the structure is
   checked against the same golden vectors in all four (per the governance ADR).

## Discriminator — what counts as "numerical / algebra-shaped"

| Shape | Interface to implement |
|---|---|
| Has identity + associative op (monoid) | additive-monoid interfaces (`IAdditiveIdentity` + `IAdditionOperators` / `Zero` + `(+)`) |
| + inverse (group) | + subtraction / negation operators |
| + second operation distributing over the first (ring/field) | + multiply operators / `IMultiplicativeIdentity` |
| Full field-like number (total order, etc.) | `INumber<T>` family |
| NOT algebra-shaped (stateful machinery, I/O, effects) | **does not apply** — use `Result<T, TFeedback>` / ports (monad-propagation + asymmetric-authorship), not generic-math |

**WHY the negative case:** generic-math is for *values with algebraic structure*,
not for effectful machinery. Stateful/effectful types belong in the
`Result<T, TFeedback>` / ports-and-adapters substrate, not the numeric interface.

## When this rule fires

- Authoring a NEW type that has algebraic structure (a number, a fold-accumulator,
  a vector/matrix/tensor, a Z-set, a Clifford multivector, a UoM-carrying quantity).
- Retrofitting an existing algebra-shaped type (per 081KSXN940008QG0R0002287MP's monoid retrofit).
- Reviewing such a type: does it declare the generic-math interface for the
  structure it has, in the right per-language idiom?

## Composes with

- `bcl-interface-boundary-own-your-interfaces-hexagonal.md` — own the interface per
  language; generic-math is BCL-tier (`System.Numerics` / F# core / Rust `std`)
- `monad-propagation-pattern-cross-language-substrate-shape.md` — the *non*-algebra
  (effectful) counterpart: `Result<T, TFeedback>`; this rule is the algebra side
- `attention-as-currency-...-fsharp-uom-...md` — F# UoM is the units layer that
  composes with generic-math (a unit-carrying number is still a number)
- `a-rule-without-a-why-is-dogma` (via this rule's whys-first construction)
- `razor-discipline.md` — operational claims only; "did the type get the interface?"
  is compiler-checkable
- `implicit-not-explicit-in-dus-is-class-error-...md` — declaring the algebraic
  interface makes the structure EXPLICIT (the muscle-memory), not implicit
- the 4-language compiler-BFT governance ADR (2026-05-31) — generic-math interfaces
  feed the cross-language parity check
- 081KSV2WD0008QG0R00051XS0N (tri-boolean / TriFloat) + 081KRFA460008QG0R0018SN61J (F# fork, HKT over Clifford) +
  081KSNY2Z0008QG0R002BNQVE1 (Clifford on dotnet-numerics/SIMD) + 081KQTPYE0008QG0R0004H9ZB8 (F# UoM + BigInteger upstream)

## Empirical anchor

081KSXN940008QG0R0002287MP (observe-fold additive monoid, PR #6259): the C# `EventLog` implements
`IAdditiveIdentity` plus `IAdditionOperators` (IWSAM), and the F# `EventLog` uses
`Zero` plus `(+)` — the *same* monoid in *each* language's native generic-math
idiom; additive-monoidal only (not `INumber`, because the log/TriFloat is a free
monoid, not a field). The F# native idiom was the cleaner side (no IWSAM advisory
to fight). The governance ADR records
F# as the correctness/spec layer.

## Why this rule auto-loads

Per `wake-time-substrate.md`: this is a cross-cutting authoring discipline that
fires at *type-design time* (every time a numerical/algebra-shaped type is written
or reviewed, in any language). Auto-loading puts the "into the generic-math
interface, per-language idiom, only-the-true-structure" decision in working memory
before the type is written without it.

## Substrate-honest framing

This rule does NOT: mandate generic-math on effectful/stateful types (those use
`Result<T, TFeedback>` / ports); force `INumber<T>` on partial-algebra types
(implement only the true subset); or override per-language idiom (no IWSAM-in-F#
when it fights the language).

This rule DOES: make "numerical/algebra-shaped → generic-math interface" the
default; name the per-language idioms; carry the WASM-runtime forward-investment
why; compose with the BCL-boundary + monad-propagation + governance-ADR substrate.

## Full reasoning

Operator 2026-05-31: *"general meta rule anyting numerica/algerba shaped we want to
try to get in into that interface and i love the c# IWASM [IWSAM] stuff that will
be powerfull for a wasm runtime."* Generalizes the 081KSXN940008QG0R0002287MP monoid retrofit (the
"don't fight the language" / own-the-interface-per-language lesson) into a standing
authoring discipline, with the C#-IWSAM-for-WASM forward note recorded.
