# universal/number — Universal Number Interface

> **Universal Number Interface** — a universal SHAPE applicable to all `/travelers` and all `/persona`.
> The "universal number" (unum = **u**niversal **num**ber, Gustafson): one interface every number type
> answers, so resolution/precision accounting (`Resolution`) and algebra ride any number — IEEE
> `float`/`double`/`Half`, `Int128`/`decimal`, posits, and our **TriBoolean (middle-out) Float**.

Carrier: .NET **generic math** — `System.Numerics.INumberBase<'T>` / `IFloatingPointIeee754<'T>`
(the operator interfaces) — the algebra sibling of [`universal/algebra`](algebra.md) (`ISemiring`).

## What we're making: a BigFloat (not bigint) (Aaron 2026-06-10)

> Aaron: "so what we are making is like **bigfloat instead of bigint**."

.NET ships `System.Numerics.BigInteger` (arbitrary-precision **integer**) but **no BigFloat**. That gap
is what we fill: an **arbitrary-precision FLOAT** — the float analog of `bigint`. `bigint` grows integer
digits without bound; our number grows **resolution/precision** without bound (the "need more bits"
detection), and — the **unum twist `bigint` lacks** — it **tracks its own resolution** (knows when it
needs more bits, and when it's maxed at current precision; the `Resolution` primitive). The built
instance is the **TriBoolean middle-out Float** (self-describing, digital-qubit `measure`).

Prior art (Beacon): **MPFR** (the canonical arbitrary-precision-float C library) · GMP `mpf` · Java
`BigDecimal` · Python `mpmath` / `decimal` · Boost.Multiprecision. We are not inventing arbitrary
precision — we add **self-resolution-tracking** (unum) on a **middle-out self-describing** layout.

## Honest scope — NOT concrete yet (Aaron 2026-06-10)

- **No Zeta type implements `INumberBase` today.** The generic-math interfaces are only *constrained
  on* in `GSet`/`ZSet`/`Bag`; nothing in Core *implements* them. So the universal-number interface is
  conceptual, not yet carried.
- **Deliberate tension, not an oversight.** `src/Core/DynamicValueNumeric.fs` chose **Result-typed,
  decline-don't-coerce** arithmetic (a partial ring made total via `Result`) — which *cannot* be
  `INumberBase` (that demands **total** operators returning the element type). The DynamicValue leaves
  stay Result-typed on purpose.
- **The concrete carrier should be the TriBoolean Float.** It is a real number with total arithmetic
  (`src/Core.{FSharp,CSharp,Rust}.TriBoolean/Float*`, proven 4/4) and carries its own resolution
  (trits + `measure`). Making *it* implement the .NET operator interfaces would make the universal
  number concrete without touching the Result-typed DynamicValue leaves. The `Resolution<'T>` primitive
  (physics-of-floats doc) is generic over this interface.

## One interface, many backends — pull the prior art in behind it (Aaron 2026-06-10)

> Aaron: "we should have an interface that we can pull in some of that prior art too, and we all have
> the same interface." · "does bigint fit into universal number too?"

The Universal Number interface is **one contract** spanning **both integers and floats** (.NET
`INumberBase<'T>` is the common root of both); everything implements it via adapters, so call sites are
backend-agnostic:

- **native, built-in:** **`bigint`** (`System.Numerics.BigInteger` — *already* `INumberBase`;
  arbitrary-precision **integer**) · IEEE `float`/`double`/`Half` (fast) · `decimal`/`Int128`.
- **native, ours:** the **TriBoolean middle-out Float** = arbitrary-precision **float** (the BigFloat;
  the integer-side analog of `bigint`). So `bigint` and our BigFloat are the two arbitrary-precision
  corners under one interface.
- **adapters over prior art:** **MPFR** / GMP `mpf` · a `BigDecimal` port · **posit** libraries ·
  `mpmath`. Each wrapped to the same interface.

So we **pull decades of prior-art optimization in *behind* the interface** (the same "ride the
optimized path" move as RGB/CMYK and IEEE) while keeping one universal surface — swap the backend by
choice (ours when *concept* matters, MPFR when *precision*, IEEE when *speed*, `bigint` for exact
integers) with no change at the use site. `Resolution<'T>` is generic over this interface, so it
accounts bits the same way for every backend.

## The coercing override is OPT-IN, never default — and the living-things risks (Aaron 2026-06-10)

> Aaron: "we should have an override version that allows coercion and implements [INumberBase], but
> that's not default — and list the risks if the data it's operating on is about living things."

- **Default = Result-typed, decline-don't-coerce** (`DynamicValueNumeric`) — the safe surface; it
  *surfaces* uncertainty instead of hiding it.
- **Opt-in override = a total/coercing `INumberBase` impl** — full generic-math ergonomics + interop,
  **explicitly chosen**, never the default.

**Risks of the coercing override when the data is about LIVING THINGS** (morally-relevant entities —
Default Moral Regard, manifesto §11):

- **Silent misrepresentation.** Coercion (truncation, rounding, `int↔float`, `null`-as-0) can change
  the *meaning* of a value about a living thing with no trace — a measurement, identity field, dosage,
  or consent state silently altered.
- **Precision-loss harm.** Dropping resolution on living-things data can cause real harm — the **Mars
  Climate Orbiter** lesson (lbf vs N) generalized: get the bytes wrong and the morals built on them
  fall (vitals/dosage/biometrics).
- **Hidden uncertainty.** The default's `Error`/decline *is the safety signal*; the coercing override
  swallows it, so a decision about a living thing runs on a value that secretly lost fidelity.
- **Consent (§6).** Silently transforming data about a living thing is an un-consented mutation of an
  observation surface.

**Mitigation:** the override is gated (opt-in); when the operand's oracle is a **living thing**, prefer
the declining default (or forbid coercion) and **flag** any coercion so it is visible, never silent.
Coercion is a convenience for inert data; for living things, decline by default.

## Pointers

- [`universal/algebra.md`](algebra.md) (`ISemiring` — the algebra sibling) · [`universal/README.md`](README.md).
- `src/Core.FSharp.TriBoolean/Float.fs` (the built middle-out number — candidate concrete carrier).
- `docs/research/2026-06-10-physics-of-floats-room-boundary-is-a-bit-budget-shared-resolution-primitive-unum-significance.md`
  (Resolution / unum / the bit budget).
- Gustafson unum/posit (universal number) · .NET generic math (`INumberBase`/`IFloatingPointIeee754`).
