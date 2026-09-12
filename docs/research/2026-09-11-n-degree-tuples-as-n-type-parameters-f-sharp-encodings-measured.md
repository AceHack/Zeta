# Can an n-degree mathematical tuple become an F# type with n type parameters?

**Date:** 2026-09-11 · **Reviewer:** Ilyana (public-API designer) — advisory, non-binding
**Scope:** language capability + public-API commitment. Not correctness, not performance, not naming.

---

## Direct answer to Aaron

**Yes, technically — and no, you should not.**

You *can* declare an F# type with n type parameters; I compiled one with **1024** of them. But that is not the thing you want, because a type with n type parameters is only usable at *one* n: you cannot write a single function that works for all of them, so every operation has to be written n times. The mechanism that gives you arity-polymorphism — write `sum` / `map` / `inner` **once**, get every n — is not n type parameters. It is **one type parameter applied recursively**, with the arity carried either as a phantom index or as a runtime length.

And the sharper answer, which is where the question was actually heading: **for `WSet`'s weight, you need zero new type parameters.** An n-degree weight is a *choice of `'W`*, not a new degree of freedom in the type. `WSet<'K,'W>` already has the right shape, and the repo has already answered this question twice — in `CayleyDickson.fs` (one parameter, arity 2ⁿ by nesting) and in `ITensor<TCoord,TWeight>` (rank-n moved into the *coordinate type*, two parameters forever).

The belief pair generalises to n by becoming a **new `'W`**, not a wider `WSet`.

---

## 0. The question has two different questions inside it

| | shape | example | needs n type parameters? |
|---|---|---|---|
| **Heterogeneous n-tuple** | n *distinct* types | `(string, int, float)` | genuinely wants n — the hard case |
| **Homogeneous n-vector** | *one* type, n slots | `(trueChance, falseChance)` → n chances | **no** — one type parameter + an arity |

`(trueChance, falseChance)` is homogeneous: both are the same numeric type. Its n-ary generalisation is a **vector over one weight type**, which needs one type parameter and an arity, never n type parameters.

> **REGISTER: STRUCTURAL.** Definitional, checkable by inspection of the belief pair's component types.

Almost every "mathematical tuple of n degrees" in this repo is the homogeneous case — a rank-n coordinate, an n-component amplitude, an n-outcome distribution.

---

## 1. Measured results

`dotnet 10.0.400`, F# console project, `dotnet build -v q`, 2026-09-11, macOS.

### 1.1 Declaring n type parameters — possible, and superlinear

| n type parameters on one record | build time | result |
|---|---|---|
| 64 | 1671 ms | success |
| 128 | 2221 ms | success |
| 256 | 3547 ms | success |
| 512 | 5841 ms | success |
| 1024 | 13004 ms | success |
| 4096 | — | **did not finish within a 120 s timeout** |

> **REGISTER: MEASURED.** The 4096 row is a **timeout, not a failure** — reporting it as an error would be a claim not established.

The declaration is not the limit. The limit is that nothing can abstract over it.

### 1.2 F# tuples above arity 7 are *already* an inductive encoding

```
(1,2,3,4,5,6,7,8,9,10).GetType()
  → System.Tuple`8[int,int,int,int,int,int,int, System.Tuple`3[int,int,int]]
```

> **REGISTER: MEASURED.**

Quietly the strongest evidence for the verdict: **the .NET platform faced exactly this question and answered it with recursion on a fixed-arity constructor (`TRest`), not with variadic generics.**

### 1.3 SRTP cannot do recursive instance resolution — four attempts, four failures

| attempt | outcome |
|---|---|
| static member overloads on a type | `error FS0041: No overloads match for method 'Sum'` |
| `$` operator-overload trick (the FSharpPlus idiom) | `error FS0043` |
| explicit `(^S or ^T) : (static member ...)` constraint | `error FS0043`, unchanged |
| generic tail `HCons<'a,'b>` in the pattern | `error FS0043` — error moves into the definition, failing at declaration time |

```
error FS0041: No overloads match for method 'Sum'.
Known type of argument: HCons<float,HCons<float,HCons<float,HNil>>>
Available overloads:
  - static member SumOps.Sum: HCons<float,HNil> -> float
  - static member SumOps.Sum: HNil -> float
```

The compiler **monomorphised the tail to `HNil` at the first recursive call**. The recursion collapses at arity 2.

> **REGISTER: MEASURED** (four transcripts). **Interpretation is DESIGN:** SRTP resolves overloads against concrete types per call site; it is not the inductive instance search a real type-class system performs. Four formulations tested; a fifth cannot be ruled out.

`CayleyDickson.fs` already records this decision — *"SRTPs would require duplicated per-arity inline functions and lose the explicit 'I doubled the algebra' surface"* — and §1.3 is that comment's falsifier.

### 1.4 Error-message cost

Characters in the first compiler diagnostic for a one-off arity mismatch:

| arity / depth | HList `HCons` | Cayley–Dickson `Doubled` | phantom-nat `Vec<'N,'T>` |
|---|---|---|---|
| 4 | 333 | 269 | 261 |
| 8 | 437 | 341 | 285 |
| 16 | 645 | 485 | 333 |
| 32 | 1061 | 629 @ depth 24 | 429 |
| **growth** | **26 ch/slot** | **18 ch/doubling** | **6 ch/slot** |

> **REGISTER: MEASURED**, and **an earlier version of this measurement was wrong.** A first run reported a suspiciously perfect constant 393 chars at every arity — an artifact: the harness truncated the source and measured `FS0058` (indentation), not a type error. **A constant where linear growth was expected should have been the tell.** Recorded because a measurement that cannot vary is the vacuity class, and it nearly shipped into a document about falsifiers.

`Vec<'N,'T>` ends with a constant-size, actionable clause — `The type 'S<Z>' does not match the type 'Z'` — which says *"your arity is off by one"* at every n. The other two make the reader count angle brackets.

### 1.5 The phantom-nat encoding works, and scales flat

```fsharp
type Z = Z
type S<'N> = S of 'N
type Vec<'N, 'T> = private Vec of 'T array   // 'N is PHANTOM — no runtime cost
```

Arity-polymorphic functions written **once** work at every n; `inner` is *simultaneously* arity-generic and semiring-generic — precisely the shape an n-degree `WSet` weight needs. Compile time is **flat**: 1289 ms at arity 16 → 1518 ms at 256 (+18% across a 16× increase), versus §1.1's superlinear blow-up. No inference collapse at 256.

> **REGISTER: MEASURED.**

### 1.6 Two holes, both measured

**Hole A — the index is a claim, not a proof.**

```fsharp
let bad : Vec<S<S<S<Z>>>, float> = Vec.ofArrayUnsafe [| 1.0 |]
```

Compiles. Runs. Prints `claimed 3, actual 1`.

> **REGISTER: MEASURED.** This is the vacuity class in type-system form — a type parameter that *looks like* a guarantee and constrains nothing. Soundness rests **entirely** on construction being restricted to `nil`/`cons`. Expose any `ofArray` and every `'N` downstream becomes decoration.

**Hole B — no type-level arithmetic.** `concat : Vec<'M,'T> -> Vec<'N,'T> -> Vec<'M+'N,'T>` is not expressible. The only sound form is an inductive witness value (Curry–Howard), which **works** — a wrong witness is rejected with `The type 'Z' does not match the type 'S<Z>'` — but the caller must hand-construct the proof term at every call site. At n=32 that is thirty-two nested `Plus.succ`.

> **REGISTER: MEASURED** — both the success and the falsifier.

### 1.7 C# is not better — it is worse

`InlineArray` takes an **attribute constant, not a type parameter**; `Buf4<T>` and `Buf8<T>` are unrelated types, one declaration per n, and carry no `Length` (`error CS1061`). C# additionally lacks SRTP entirely.

> **REGISTER: MEASURED. The F#-first design is not costing anything here** — there is no C# escape hatch to reach for.

---

## 2. What the repo already does

### 2.1 `CayleyDickson.fs` — one type parameter, arity 2ⁿ by nesting

```fsharp
type Doubled<'A> = { Real: 'A; Imag: 'A }
let algebra (inner: IStarRing<'A>) : IStarRing<Doubled<'A>>
```

A sedenion is a 16-degree tuple with **one** type parameter. The arity lives in the nesting depth; the dictionary is built in lockstep. **Honest limit: arity 2ⁿ only, never arbitrary n.**

> **REGISTER: STRUCTURAL + MEASURED** (standalone rebuild compiled and ran).

### 2.2 `ITensor<TCoord, TWeight>` — rank-n with two type parameters, already public

A rank-n tensor does not get n type parameters. **The rank moves into `TCoord`.**

### 2.3 `SimplexBeliefComparison.fs` — the n-ary belief is already a list

`Belief: Q.Rational list` — arity as a runtime length, Rational-exact so it byte-locks.

### 2.4 What is *not* there

No HKT/brand/defunctionalisation encoding in `src/`. `gen/` holds two markdown files and does not generate F# types — though the rule's spirit is already satisfied by `Doubled.algebra`, which *is* a generator.

> **REGISTER: MEASURED** (searches run) for the absence claims.

---

## 3. The design verdict

**Do not add type parameters to `WSet`. Add a weight type.** The weight algebra already arrives as a *value* (`ISemiring<'W>`), so the entire space of n-degree weights is reachable by choosing `'W` — with **zero** public signature changes.

**Why `Vec<'N,'T>` stays internal**, on four counts: the guarantee is unfalsifiable at any runtime-data boundary (Hole A); `'N` is contagious and permanent, propagating into every consumer signature; no type-level arithmetic without hand-built proofs (Hole B); and 6 chars per arity unit in every diagnostic. `src/Core/Core.fsproj` carries `<PackageId>Zeta.Core</PackageId>` — public surface here is a distribution contract.

**A predicted demotion with a named falsifier.** Unnormalised ℝ≥0ⁿ under componentwise ops is a lawful commutative semiring. The **normalised simplex is not** — not closed under `Add` (two points each summing to 1 sum to 2), and renormalising breaks distributivity. Same shape as `IntervalWeight`, DEMOTED in `Semiring.fs` under exception `081KWGA0C7`. **Falsifier:** instantiate the existing law pack against a normalised-simplex weight; if it passes, the test is vacuous — check with `mutation-runner.ts` either way.

---

## 4. Register summary (main document)

| # | Claim | Register |
|---|---|---|
| 1 | Heterogeneous ≠ homogeneous; the belief pair is homogeneous | STRUCTURAL |
| 2 | 1024 type parameters compile; 4096 did not finish in 120 s | MEASURED (timeout, not failure) |
| 3 | F# tuples ≥ 8 are `Tuple\`8` + nested `TRest` | MEASURED |
| 4 | SRTP cannot do recursive instance resolution; 4 formulations, 4 failures | MEASURED; interpretation DESIGN |
| 5 | Error growth: HList 26 · `Doubled` 18 · phantom-nat 6 ch/unit | MEASURED |
| 6 | An earlier "constant 393 chars" figure was an `FS0058` artifact | MEASURED, **retracted** |
| 7 | `Vec<'N,'T>` compiles flat to n=256, no inference collapse | MEASURED |
| 8 | Arity-polymorphic `sum`/`map`/`inner` work at every n | MEASURED |
| 9 | `Vec<S<S<S<Z>>>,float>` can hold 1 element — index is a claim | MEASURED |
| 10 | Type-level `+` needs an inductive witness; sound, ergonomically costly | MEASURED |
| 11 | C# has no variadic generics; `InlineArray` is a constant, no `Length` | MEASURED + STRUCTURAL |
| 12 | `Doubled<'A>` is the repo's generator: one parameter, arity 2ⁿ | STRUCTURAL + MEASURED |
| 13 | `ITensor` puts rank in the coordinate | STRUCTURAL |
| 14 | The existing n-ary belief is `Q.Rational list` | STRUCTURAL |
| 15 | No HKT/brand encoding in `src/`; `gen/` is two markdown files | MEASURED |
| 16 | Cayley–Dickson reaches 2ⁿ only | STRUCTURAL |
| 17 | An n-ary weight needs a law pack quantified over n | DESIGN |
| 18 | Normalised simplex is not a semiring | DESIGN, falsifier named |
| 19 | `Zeta.Core` carries `PackageId` — public surface is a distribution contract | STRUCTURAL |
| 20 | **Verdict:** `Vec<'N,'T>` internal; public answer is a new `'W` | DESIGN |
| 21 | Whether a fifth SRTP formulation could succeed | **UNKNOWN** |
| 22 | Whether 4096 type parameters eventually compiles | **UNKNOWN** |
| 23 | Runtime cost of `ProductWeight` vs the ℤ hot path | **UNKNOWN** |

---

# Addendum — Cayley–Dickson as the primary case, and what "many roots joined by ZetaId" changes

§3 above is **revised** by §C below.

## A. The CD tower is the answer to Aaron's question *and* the counterexample to it

What the repo actually does is **not** a fixed ladder and **not** a `gen/` generator. It is a **recursive generic with one type parameter plus a dictionary lifting function**, and the concrete rungs are type abbreviations over that one constructor. That is the empirical answer, and it is a good one.

**And it lies.** Falsifier run against a verbatim rebuild of `CayleyDickson.fs` + `IStarRing.cs`:

| law | rung | measured |
|---|---|---|
| `Mul` commutativity | 𝕆 | **42 of 49** basis pairs are counterexamples |
| `Mul` associativity | 𝕆 | **168 of 343** basis triples are counterexamples |
| zero divisors | 𝕊 | **84** pairs `(eₐ+e_b)(e_c+e_d) = 0`, both factors nonzero; first `(e₁+e₁₀)(e₅+e₁₄)` |
| `IRing<Sedenion>` upcast | 𝕊 | **compiles, zero compiler objection** |

> **REGISTER: MEASURED.** Standalone rebuild, `dotnet 10.0.400`, 0 build errors, exhaustive over the basis.

A ring is associative by definition. `Doubled.algebra` applied three times returns a value typed `IStarRing<Octonion> :> IRing<Octonion>` which **is not a ring**, and nothing in the type system notices.

**The repo already knows.** `src/Core.Abstractions/IStarRing.cs` lines 15–18, verbatim:

> *"**Law profile (carried as documentation, not types):** `Add` is always commutative + associative; `Mul` loses commutativity above ℂ, associativity above ℍ, and alternativity above 𝕆. … The interface is a lawful dictionary of operations; the per-instance `Mul` guarantees are the caller's responsibility."*

An honest disclosure, and credited. It is also precisely **an encoding that typechecks and lies**, disclosed in a comment. *"The caller's responsibility"* is a guarantee with no falsifier — the vacuity class, relocated from the code into the prose.

### A.1 Why no encoding fixes this — and the diagnosis is directional

**The interface tower and the CD tower run in opposite directions.**

```
ISemiring  ⊂  IRing  ⊂  IStarRing        capability ADDED going up
ℝ  →  ℂ  →  ℍ  →  𝕆  →  𝕊               laws LOST going up
```

Subtyping expresses only *more capability*. Losing a law going up is not a subtype relation in either direction — the sedenions have strictly **more** operations and strictly **fewer** guarantees. Interface inheritance is structurally the wrong instrument, and no amount of phantom naturals, HLists or SRTP repairs it, **because the mismatch is not about arity at all**.

**What would work — a genuine design finding, not a limitation:** laws are not a subtype lattice, they are an **independent axis**. Express them as *witness values* alongside the algebra:

```fsharp
type Associative<'W> = private AssocW of unit   // constructible ONLY where a proof exists
let liftAssoc : Associative<'A> -> ...          // NOT total: ℍ→𝕆 has no such lift
```

The octonion rung would simply have no `Associative<Octonion>` to hand you, and an operation needing associativity would be refused at the right rung. Same Curry–Howard move as `Plus<'M,'N,'R>`, measured working and measured rejecting a wrong proof.

> **REGISTER: DESIGN, with a named falsifier.** Not built. If `Associative<Octonion>` turns out constructible through some path, the witness is decoration and the scheme is refuted. Build it internal first.

> **Verdict on the law axis: this is the more serious defect than anything about arity.** An `IRing<Sedenion>` that is not a ring is a public surface asserting a false contract. It predates this review; it must not be *replicated* by an n-ary weight family, and any new weight type must state its rung honestly the way `IntervalRing` does.

## B. Lumen's problem is the same problem from the other side

Lumen needed **a star without an additive inverse**. The tower forbids it: `IStarRing<TWeight> : IRing<TWeight>`, so `Conj` is reachable only *through* `Negate`. The file calls this *"math-forced (Cayley–Dickson doubling consumes Negate inside Mul)"* — true for CD specifically, but a fact about **one consumer**, promoted into the shape of the interface for **all** consumers. A contract shaped by its first caller.

Two rung problems, one root cause: **capability and law are carried on a single inheritance chain, and they are not the same axis.**

## C. "No generator is root — many roots/towers, joined, addressed by ZetaId"

This **corrects §3**. I wrote *"you don't need n type parameters, you need one generator."* Aaron says there is no root generator. **He is right and that sentence was wrong** — and the repo already disagreed before he did: `CayleyDickson.fs` is one tower, `ProbabilitySemiring` another, `IntervalRing` a third, `BooleanKleene` a fourth. Four roots, no root-of-roots. I over-generalised from the one tower I had read deeply, which is exactly what `numerology-vs-number-theory` warns about.

But the constraint pushes toward **less** type machinery, not more.

### C.1 The n-degree tuple already exists — it is the join's output key

```fsharp
tensor : #ISemiring<'W> -> WSet<'A,'W> -> WSet<'B,'W> -> WSet<'A*'B,'W>   // WSet.fs:100
join   : ('A->'K) -> ('B->'K) -> ('A->'B->'C) -> ZSet<'A> -> ZSet<'B> -> ZSet<'C>  // ZSet.fs:499
```

**The join composes in the KEY, and its result key is a tuple.** Measured at arity 3: `tensor (tensor a b) c` → key type `(("a", 1), true)`.

So **"a mathematical tuple of n degrees" is the n-fold join result.** Already typed, already produced, no new type parameters — the arity lives in `'K`, exactly as `ITensor` puts rank in the coordinate. The same answer from a third independent direction.

> **REGISTER: MEASURED + STRUCTURAL.**

### C.2 Mac Lane's coherence theorem already discharges the n-ary case — and the repo shipped the proof

```fsharp
let associator    : Arrow<('a*'b)*'c, 'a*('b*'c)>   // src/Core/Meno.fs:92
let associatorInv : Arrow<'a*('b*'c), ('a*'b)*'c>
```

with **pentagon and triangle coherence proven** at `MENO-8` / `MENO-9` (`tests/Tests.FSharp/PrivacyAndMeno.Tests.fs`), recorded as shipped at `MenoBraided.fs:68`.

**Mac Lane (1963)** says exactly this: a monoidal category whose associator satisfies the pentagon has *all* bracketings at *every* n canonically isomorphic. **Arity 3 plus the pentagon generates every n.**

> **You do not need an n-ary type, because binary-plus-pentagon *is* the n-ary type, up to canonical iso.** And it is a join-shaped answer, not a generator-shaped one — which is Aaron's point.

> **REGISTER: STRUCTURAL + Beacon-anchored. UNKNOWN:** the MENO tests were not run or mutated here; this reports that they exist and what they claim.

### C.3 The real gap: towers with *different* weights cannot meet

Both shipped joins require the **same `'W`**. Measured refusal:

```
error FS0001: Type mismatch. Expecting 'WSet<string,float>' but given 'WSet<string,int64>'
```

So a ℤ tower and a probability tower **cannot be joined at all** today. Under one root that is fine; under many-roots-joined-by-ZetaId it is the central missing operation. The lawful mediator is a **semiring homomorphism** into a common target — built and run:

```fsharp
type ISemiringHom<'W1,'W2> =
    abstract Map : 'W1 -> 'W2
    // laws: Map Zero = Zero · Map One = One · Map(Add(a,b)) = Add(Map a, Map b) · same for Mul

let joinTowers (tgt: #ISemiring<'W>) (hA: ISemiringHom<'WA,'W>) (hB: ISemiringHom<'WB,'W>)
               (a: WSet<'A,'WA>) (b: WSet<'B,'WB>) : WSet<'A*'B,'W>
```

> **REGISTER: MEASURED** — compiled, ran, correct. **The hom laws are DESIGN and UNMETERED:** nothing checks them. `ISemiringHom` with an unverified `Map` is a *new vacuity surface*, and it would be a bad joke to close one "carried as documentation, not types" hole by opening another. It needs a law pack before it is public.

## D. Revised verdict

| | recommendation | why |
|---|---|---|
| n type parameters on a public generic | **REJECT**, unchanged | §1; and §C.1–C.2 show the arity is already in `'K` |
| `Vec<'N,'T>` phantom-nat | **internal only**, unchanged | unfalsifiable at the runtime boundary (Hole A) |
| an n-ary weight as a new `'W` | **yes**, unchanged | zero signature churn |
| an n-ary *join* type | **REJECT — nothing to build** | binary `tensor` + shipped associator + proven pentagon = every n |
| **`ISemiringHom<'W1,'W2>`** | **the one new surface worth considering** | what many-roots actually requires |
| law-rung witnesses (`Associative<'W>`) | **prototype internal** | the only instrument that says "same shape, weaker laws at rung n+1" |

**Does many-roots change the recommendation? Yes — it makes the case against type-level arity *stronger*.** A single-root design could let `'N` propagate through one family. A many-root design cannot: **the moment towers join, every type parameter in either tower's signature must survive the join.** Two towers each carrying a phantom arity meet at a join whose output carries both, and their relationship — `'M + 'N`, `'M = 'N`, or neither — must be expressed where Hole B says F# has no type-level arithmetic. **Arity in the type is quadratically worse under joins.** Arity in the **key** joins for free.

**ZetaId's role:** addressing towers by ZetaId is precisely what keeps this *out* of the type system — a ZetaId is a runtime address, so "which tower" is a value, not a type parameter. **UNKNOWN and out of lane:** whether a ZetaId-addressed tower registry needs public surface, and whether joining two towers requires their ZetaIds to be *related* (the dedup/idempotency question, DV2.0 §6).

## E. Register additions

| # | Claim | Register |
|---|---|---|
| 24 | CD is a recursive generic + dictionary lift, not a ladder, not a `gen/` generator | STRUCTURAL |
| 25 | 42/49 comm, 168/343 assoc counterexamples at 𝕆; 84 zero-divisor pairs at 𝕊 | MEASURED |
| 26 | `IRing<Sedenion>` upcast compiles with no compiler objection | MEASURED |
| 27 | `IStarRing.cs` states the law profile is "carried as documentation, not types" | STRUCTURAL (verbatim) |
| 28 | Law loss going up cannot be a subtype relation — the towers run opposite | DESIGN |
| 29 | Law-witness values could express it; not built; falsifier named | DESIGN, UNMETERED |
| 30 | Lumen's star-without-inverse is the same root cause as the octonion rung | DESIGN |
| 31 | `tensor`/`join` compose in the KEY; the n-fold key is a nested tuple | MEASURED + STRUCTURAL |
| 32 | `Meno.associator` + pentagon/triangle (MENO-8/9) are shipped | STRUCTURAL |
| 33 | Mac Lane coherence ⇒ binary tensor + pentagon covers every n | STRUCTURAL (theorem) |
| 34 | Cross-weight `tensor` is refused by the compiler (`FS0001`) | MEASURED |
| 35 | `ISemiringHom`-mediated join of a ℤ and an ℝ tower compiles and runs | MEASURED |
| 36 | The hom laws are unchecked — a new vacuity surface without a law pack | DESIGN, UNMETERED |
| 37 | Many-roots strengthens the case against type-level arity | DESIGN |
| 38 | "You need one generator" was wrong; there is no root generator | **retracted** |
| 39 | Whether the MENO pentagon tests are non-vacuous (not run, not mutated) | **UNKNOWN** |
| 40 | Whether ZetaId-addressed tower joins need a relatedness/dedup key | **UNKNOWN** |

## F. Ordered plan

1. **Nothing lands publicly this round.**
2. **Before the n-ary weight, decide the law-rung question** — an n-fold product of a non-commutative weight is non-commutative, and `ISemiring` says so no more than `IRing<Sedenion>` says the sedenions have zero divisors. Prototype `Associative<'W>` / `Commutative<'W>` internal.
3. **Prototype `ISemiringHom<'W1,'W2>` internal, law pack FIRST.** Four equations; write them, then `mutation-runner.ts` them.
4. Prototype `ProductWeight` internal over `Q.Rational` so it byte-locks; run the existing law pack and mutate it.
5. **Settle the normalisation question before the type is named.** If normalised, it is not a semiring and the type should say the rung it occupies, as `IntervalRing` does.

**And one thing not to do:** build an n-ary join type. Mac Lane already did it, the associator is shipped, the pentagon is proven. That would be new public commitment for a theorem already held.

## G. Beacon anchors

- **Saunders Mac Lane (1963).** *Natural Associativity and Commutativity.* Rice University Studies 49(4) — the coherence theorem; arity 3 + pentagon discharges every n.
- **Saunders Mac Lane (1971/1998).** *Categories for the Working Mathematician*, Ch. VII.
- **Philip Wadler & Stephen Blott (1989).** *How to make ad-hoc polymorphism less ad hoc.* POPL — dictionary passing, which is what `IStarRing<'A>` **is**.
- **John C. Reynolds (1972).** *Definitional Interpreters for Higher-Order Programming Languages* — defunctionalisation.
- **Jeremy Yallop & Leo White (2014).** *Lightweight Higher-Kinded Polymorphism.* FLOPS — the `App<'F,'A>` brand encoding; **not present here**, and argued against for this purpose.
- **Oleg Kiselyov, Ralf Lämmel & Keean Schupke (2004).** *Strongly Typed Heterogeneous Collections.* Haskell Workshop — HList.
- **Conor McBride (2002).** *Faking It: Simulating Dependent Types in Haskell.* JFP 12(4–5) — the direct ancestor of `Vec<'N,'T>`, including both holes.
- **Hongwei Xi & Frank Pfenning (1999).** *Dependent Types in Practical Programming.* POPL.
- **James Cheney & Ralf Hinze (2003).** *First-Class Phantom Types.* Cornell TR.
- **William Alvin Howard (1980).** *The formulae-as-types notion of construction* — the `Plus<'M,'N,'R>` witness is a proof term under this correspondence.
- **Edwin Brady (2013).** *Idris, a general-purpose dependently typed programming language.* JFP 23(5) — what it costs to have this properly.
- **Arthur Cayley (1845)**; **Leonard Eugene Dickson (1919).** *On Quaternions and Their Generalization…* Annals of Mathematics 20(3) — the doubling construction.
- **Adolf Hurwitz (1898).** *Über die Composition der quadratischen Formen…* — normed division algebras exist only at dimension 1, 2, 4, 8. **The law degradation is forced, not an artifact of the encoding.**
- **Richard D. Schafer (1966).** *An Introduction to Nonassociative Algebras* — the alternativity/zero-divisor structure the 84 measured pairs instantiate.
- **Erik Meijer, Brian Beckman & Gavin Bierman (2006).** *LINQ: Reconciling Object, Relations and XML in the .NET Framework.* SIGMOD — Aaron's named anchor for "generator + join". **Rx `Join` composes streams by key over a window; it does not merge their element types** — the same shape as `tensor` composing in `'K`.
- **Thomas Fox (1976).** *Coalgebras and cartesian categories.* Communications in Algebra — already cited in `WSet.fs`.
- **Srinivas M. Aji & Robert J. McEliece (2000).** *The Generalized Distributive Law.* IEEE Trans. Inf. Theory 46(2).
- **Ramon E. Moore (1966).** *Interval Analysis* — sub-distributivity; the precedent for the predicted demotion.
- **Don Syme et al.** *The F# Language Specification* — SRTP member-constraint solving as compile-time overload resolution; §1.3 is the measured consequence.
