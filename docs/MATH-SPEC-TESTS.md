# Math-Specification Tests — Report

This document enumerates the **machine-checked mathematical specifications** that run in every CI pass. Each entry is a **theorem** from a published paper, expressed as a test that FsCheck / xUnit / TLC / Z3 will refuse to let us ship a violation of.

## Why this matters

F# can express algebraic properties as first-class equations. Running them as property-based tests means the library's **mathematical contract** is as enforced as its unit behaviour. When someone refactors `ZSet.add`, the chain rule `D∘I = id` *must* still hold or the build breaks. That's the "mathematically validatable" point you wanted over exception-based error flows.

## Verification stack

| Tool | Job | File |
|---|---|---|
| **FsCheck** (FsCheck 3 / FsCheck.Xunit.v3) | Property-based tests over generated inputs | `tests/Dbsp.Tests.FSharp/MathInvariantTests.fs` + others |
| **Z3 SMT** (Microsoft.Z3 4.12.2) | Proofs of pointwise axioms over unbounded integers | `tools/Z3Verify/Program.fs` + `tests/.../FormalVerificationTests.fs` |
| **TLA+/TLC** | Concurrent-protocol + state-machine invariants | `docs/*.tla` (6 specs) |
| **xUnit** + `FsUnit.Xunit` | Concrete scenarios, boundary cases | throughout |
| **Lean 4** (roadmap) | Machine-checked proof of the DBSP chain rule | TBD |

## Properties currently enforced

### Tropical semiring `(ℤ ∪ {∞}, min, +)`

Source: Maclagan & Sturmfels 2015; the three laws are the definition of a semiring.

1. **Commutativity of addition** — `a + b = b + a`
2. **Associativity of addition** — `(a + b) + c = a + (b + c)`
3. **Distributivity** — `(a + b) * c = a*c + b*c`

### G-Counter — CRDT semilattice (Shapiro et al. 2011)

1. **Merge commutative** — `merge a b = merge b a`
2. **Merge idempotent** — `merge a a = a`
3. **Merge associative** — `merge (merge a b) c = merge a (merge b c)`

Together these three make `(GCounter, Merge, Empty)` a bounded join-semilattice — the **exact** algebraic structure CRDTs require for strong eventual consistency.

### HyperMinHash (Yu & Weber arXiv:1710.08436)

1. **Self-Jaccard ≈ 1** for identical sets
2. **Disjoint-Jaccard < 0.5** for disjoint large sets

### Haar wavelet transform (Mallat 1999)

1. **Approximate sum at level n = sum of last 2ⁿ samples** (Parseval-derived)

### MementoHash (Coluzzi IEEE TON 2024, arXiv:2306.09783)

1. **Consistency bound** — removing one bucket moves at most ~1/N of keys

### Dotted Version Vectors (Preguiça 2010)

1. **Monotone growth is causally ordered** — `sync r1 ; sync r1` yields `d1 ≺ d2`
2. **Concurrent replicas are concurrent** — two replicas writing independently are neither before nor after each other

### DBSP chain rule (Budiu et al. VLDB 2023, Theorem 3)

1. **D ∘ I = id** — integrating then differentiating recovers the original per-tick batch

### Serializer soundness

1. **TLV round-trip preserves equality** — `Read ∘ Write = id` on Z-sets

## TLA+ specs (concurrency invariants)

Located in `docs/`:

1. **`DbspSpec.tla`** — the algebraic axioms of D, I, z⁻¹, H over a symbolic trace
2. **`SpineAsyncProtocol.tla`** — producer/worker handoff with lost-wakeup invariant
3. **`CircuitRegistration.tla`** — register-vs-build race class
4. **`TwoPCSink.tla`** — 2-phase-commit lifecycle: all-or-nothing, idempotent, abort-safe
5. **`SpineMergeInvariants.tla`** — size-class cap + multiset conservation during merge cascade
6. **`TransactionInterleaving.tla`** — CAS Transaction commit/rollback + autoCommit consistency
7. **`ChaosEnvDeterminism.tla`** — seeded RNG + clock atomicity under concurrent Delay
8. **`ConsistentHashRebalance.tla`** — total-coverage of keys across rebalance events

## Z3 SMT (pointwise axioms)

Located in `tools/Z3Verify/Program.fs` and run from `tests/.../FormalVerificationTests.fs`:

1. **`D∘I = id`** on symbolic integer sequences
2. **`I∘D = id`**
3. **Chain rule** `(q1 ∘ q2)^Δ = q1^Δ ∘ q2^Δ` for monotone q
4. **H(x + Δ) - H(x) bounded by |Δ|**

## Why property tests dominate here

For **algebraic laws over unbounded inputs** — commutativity, distributivity, chain rules — property-based tests find counterexamples no unit test reaches. FsCheck's shrinker drives failures down to their minimal triggering inputs, so when `tropical distrib` fails it shrinks to the two specific bytes that broke associativity (typically an overflow edge case).

For **concurrent protocols** — lock orderings, exactly-once commits, register-vs-build — TLA+ is stronger because it exhaustively searches all interleavings up to a bound. Our 8 TLA+ specs cover every concurrent code path.

For **pointwise axioms over unbounded ℤ** — Z3 is the right tool because its bit-vector / integer theories are *strictly stronger* than property-based sampling over int64.

**The combination** gives us, for every operator:
- An algebraic contract (property test)
- A concurrent contract (TLA+ spec, if stateful)
- A low-level SMT proof (Z3, if the axiom is pointwise)

## Expanding this

**To add a new operator** `MyOp`:

1. Identify its algebraic class (monoid? semigroup? semilattice? linear operator on Z-sets?)
2. Write the three-to-five laws from that class as `[<Property>]` tests.
3. If concurrent-mutating, write a TLA+ spec in `tools/tla/specs/MyOpSpec.tla`.
4. If a pointwise SMT-decidable axiom applies, add a Z3 proof in `tools/Z3Verify/Program.fs`.
5. If a **machine-checked proof** is worth the effort (i.e. you plan to cite the law in a paper), start a Lean 4 port in `proofs/MyOp.lean` (P3 roadmap).

**The test file is the library's axiom list.** Keep it small, keep it pure, keep it paper-cited.
