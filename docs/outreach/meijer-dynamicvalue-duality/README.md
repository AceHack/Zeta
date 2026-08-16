# DynamicValue: data ⇄ behaviour as a self-representable duality

*A one-page idea, told small. Illustrative code: [`Dv.kt`](./Dv.kt) (paste into a Kotlin playground).*

**Status, up front.** One half of this is shipped and machine-checked; the other half is a
design we have not built. This page marks which is which in every section, because the
distinction is the interesting part and you would find it in five minutes anyway.

## The one idea

There is a single typed value tree, `DynamicValue`. It is the **canonical semantic core**
that JSON / YAML / CBOR / XML / Arrow all serialize to and from — the meaning, without each
format's syntax. Its leaves are the usual poles (`Null | Bool | Int | Float | String | Bytes`)
and its branches are `Array` / `Object` (order-significant). That much is shipped.

The move we are after: **a behaviour AST (an Rx/Bonsai-style expression) and the value tree
each contain the other.** A value can hold a program; a program node holds a value. The
sealed-type tag is the discriminator — the little dot in each half of the yin-yang.

Today that containment is **asymmetric**, and the asymmetry is the honest headline:

* **behaviour → data is shipped and total.** `Bonsai.reify : Expr → DynamicValue` encodes any
  expression as kind-tagged `Object` nodes; `Bonsai.apply : DynamicValue → Result<Expr,_>`
  decodes it. Round-trip proven (below).
* **data → behaviour is not shipped.** `DynamicValue` has no `Expr`/`Quote` constructor. The
  embedding is an **encoding into existing `Object` nodes**, not a peer node type in the sum.

So code is representable as data. Data is not yet a first-class node of code.

## What ships today (measured on `main`)

| Claim | Status | Evidence |
|---|---|---|
| `reify : Expr → DynamicValue` | **ships** | `src/Core/Bonsai.fs` |
| `apply : DynamicValue → Result<Expr,_>` (the inverse) | **ships** | `src/Core/Bonsai.fs` |
| `apply ∘ reify = id` on `Expr` | **machine-checked, all 6 constructors** | `src/Core.Lean4/Lean4/Bonsai.lean` — `theorem apply_reify_eq_self`, strong induction on term size, no `sorry` |
| same law, executable oracle | **property-based test** | `tests/Tests.FSharp/Bonsai.Property.Tests.fs` (FsCheck) |
| four-oracle byte-lock of the *wire format* | **ships** | `serialize`/`parse` in F#, C#, Rust, TypeScript against shared `golden-vectors.json` |
| `Expr` as a peer node type inside `DynamicValue` | **design** | no such constructor exists |
| `quote : DynamicValue → Expr` | **design** | no such function |
| `run` executing embedded behaviour | **partial** | `src/Core/BonsaiSoft.fs` `evalSoft` — F#-only, covers `Const`/`Param`/`Binary`/`Cond`, declines `Lambda`/`Call`, and returns a *distribution* over values, not a value |

Two corrections to how we have described this before, both of which cut against us:

1. The four oracles are **serializers/parsers, not executors.** They agree byte-for-byte on the
   canonical wire encoding. They do not execute anything.
2. **`reify`/`apply` are not four-oracle.** They exist in F# and in Lean. The byte-lock covers
   the wire format, not the reification. Extending reification to all four oracles is real work
   we have not done and are not claiming.

## The two laws, which are different laws

This is the correction that matters most, and it is the one we got wrong in an earlier draft of
this page.

```text
(1)  apply (reify e) == e        for every Expr e        -- an ENCODING round-trip
(2)  run (quote d)   == d        for every value d       -- the REFLECTION fixpoint
```

They are not two phrasings of one law. **(1)** is an isomorphism between two *inductive* trees:
no evaluation happens, nothing is executed, both sides are finite data. **(2)** requires `run` to
*execute* embedded behaviour, and quantifies over values rather than expressions. Different
domain, different operator, different content.

We have **(1)**, proven. We do not have **(2)**.

And a caution about **(2)** that we would rather state than have you point out: in `Dv.kt`,
`run(quote(d)) == d` holds **by construction and cannot fail.** `quote` wraps `d` in
`Node.Quote(d)`, and `eval` of `Node.Quote` returns the stored value verbatim. It is
`unwrap(wrap(d))`. A check that cannot fail is not a check, so the `check(...)` line in that
file demonstrates the *shape* of the law and provides no evidence for it. The non-trivial law is
**(1)** — where the encoding is structurally recursive, the decoder is written independently, and
the composite could genuinely fail on any constructor. That is precisely the one we proved.

A further register note on the μF/νF framing we have used loosely: **both `Expr` and
`DynamicValue` are least fixed points (μ).** They are finite, strict, inductive trees; there is
no laziness and no infinite unfolding anywhere in the shipped code. Calling the behaviour half
νF is a conceptual gesture at your duality, not a claim licensed by our types — our domains are
finite, and we take yours to be the infinite ones. The forward direction, stated as a trajectory
rather than a result (Aaron Stainback): a ν is reached by a **generator**, not by a larger
inductive type — an anamorphism with no terminating condition, codata rather than a bigger tree —
so growing `Expr` never approaches it. Our nearest live instance is **Cayley–Dickson doubling**
(ℝ → ℂ → ℍ → 𝕆 → 𝕊 → …), already load-bearing here as the "imaginary stack"
(`src/Core/CayleyDickson.fs`): the lift `IStarRing<'A> → IStarRing<Doubled<'A>>` has no
terminating condition and unfolds without a fixed point. Two bounds on that, both of which we
would rather state than have you supply. Every *rung* one can actually materialize is still
finite — the coinductive object is the unfold, not any level. And the well-behaved prefix has a
hard cliff: the doubling degrades lawfully (ℂ loses order, ℍ commutativity, 𝕆 associativity, 𝕊
alternativity and with it division), and by **Hurwitz's theorem (1898)** the normed division
algebras over ℝ are exactly ℝ, ℂ, ℍ, 𝕆 — dimensions 1, 2, 4, 8, a complete list. So the
generator is genuinely infinite while its useful part stops at 8, which is where our own
octonion/E8 work already sits. That ladder and that bound are recorded in
`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md`, not invented for this page.

## What `Dv.kt` is

A **standalone demonstrator of the intended shape** — not a port of `DynamicValue.fs`, and not a
reduced version of it. It differs from the shipped type in exactly the way that matters: `Dv.kt`
*has* the `Dv.Expr` peer node and the `Quote` constructor; the shipped `DynamicValue` has
neither. Read it as the design sketch, which is what it is.

## Why we still think "canonical" is earned

Not by the reflection law — by the boring part. The value tree has four independent
implementations that must agree byte-for-byte on the canonical encoding of every value, pinned
by golden vectors, with round-trip and injectivity properties, plus the Lean proof above for the
reification law. Most homoiconic value trees are one interpreter and a prayer; this one is a
differential proof harness. The evolution of the tree itself rides an incremental (DBSP) stream.

A smaller aside that may amuse you. The substrate is append-only and immutable
(content-addressed, no force-push), so the past is never *rewritten* — only **re-illuminated**: a
present reading (a new generator, schema version, or query) re-reads the same fixed record and a
different *meaning* falls out. The past artifact and the present reading interfere into a new
value. That is the whole of "the future affecting the past" here — interference, not time travel —
and it is safe *because* the bytes are immutable. The golden vectors are the cleanest instance:
written once, then a later check reaches back and certifies the very generator that produced
them, by re-reading what it wrote.

## An open question we have not resolved

If **(2)** is ever built, should it be exact identity, or identity advanced by one tick?

Our own adinkra work uses this vocabulary already — "what acts" (Q) against the remains-half,
with `{Q,Q} = ∂_τ`, and `src/Core/AdinkraClock.fs` makes the tick operational as one
`VirtualTimeScheduler.AdvanceBy(1)`. Under the obvious mapping (remains = data, acts = behaviour,
Q = quote/run), `run ∘ quote = id` is the `∂_τ = 1` *quotient* — the collapsed, symmetric case —
and `run ∘ quote = ∂_τ` is the version that keeps the tick.

Where we have got to, stated carefully:

* At the level **(1)** operates on, **the question does not arise** — and for a structural
  reason, not a shrug. `apply ∘ reify` is a total function `Expr → Expr` with no injected
  channel and no state. For a tick to be *observable* it needs somewhere to be written, and
  `Expr` has no temporal coordinate: no constructor carries a height, generation, or clock
  reading. A `∂_τ` there would either be `id` (no observable) or would have to leave the type.
  Note this is the same fact twice: what makes the encoding law byte-lockable and
  deterministically replayable is that it has **no ambient channel** — and that is exactly what
  leaves no room for a tick. In `AdinkraClock.fs` the tick is observable precisely *because* the
  clock is not in the state; it is an injected scheduler.
* At the level **(2)** would operate on, the question becomes askable but is not yet live: even
  there, `quote` of pure data reduces in zero steps, so the tick would be **0 on data** and the
  two laws would agree on exactly the domain the README states ("for every value `d`"). They
  could differ only on the behaviour half, where evaluation actually takes steps.
* The separating experiment, if we build it: give `run` a second output channel (a step count,
  or an injected scheduler) and check whether `run(quote(p))` for a *reducible* `p` reports a
  nonzero tick. Under `= id` the tick is always 0; under `= ∂_τ` it is not. Without that channel
  the two laws are not merely hard to tell apart — they are indistinguishable in principle.

Register, marked: the shape-match between evaluation's decreasing step measure and the adinkra
down-edge is a **resonance, not a shared mechanism**. The adinkra `∂_τ` comes from a Z₂-graded
SUSY algebra (`{Q_I,Q_J} = 2δ_IJ ∂_τ`); a reduction order has no parity and no anticommutator.
We are treating it as a source of hypotheses, which is what it is good for, and not as a result.

## What this is *not* (named honestly)

It is **not Lisp**. The homoiconicity is Lisp's idea (McCarthy, 1960); Lisp's core is the
untyped cons cell. This is a **typed** descendant — a strongly-typed, canonical intermediate
representation you can mechanically write a faithful executor for in any host language. Lisp
could *host* it (as Lisp can host anything); that does not make it Lisp. The proper algebraic
home is a **Cartesian closed category** (Lambek; and Conal Elliott's *Compiling to Categories*,
ICFP 2017), not a numeric algebra.

## The frontier (research, not built)

The sharp constructor tag becomes a **distribution over tags** that sharpens with context — a
*soft* `DynamicValue` — so a value can be ambiguous and resolve the way English does. The
intended invariant is not "always certain" (impossible) but **"always knows its own
uncertainty"** — calibration; the middle value is never silently collapsed. It is the value-axis
generalization of a three-valued (Kleene) logic. Nearest prior art: **Church** (Goodman,
Mansinghka, Roy, Bonawitz, Tenenbaum) — a probabilistic Lisp. `BonsaiSoft.evalSoft` is the first
concrete step toward it and is deliberately partial.

***

The duality we are gesturing at is of course yours — observer/iterator, coSQL/SQL, μF/νF,
bananas and lenses (Meijer, Fokkinga & Paterson, 1991). What we have built so far is one
direction of it, encoded and proven; what we have written down is the other direction. We would
rather show you the seam than paper over it.
