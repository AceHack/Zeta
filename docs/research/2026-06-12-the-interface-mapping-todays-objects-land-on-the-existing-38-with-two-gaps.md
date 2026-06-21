# The interface mapping — today's objects land on the existing 38, with two gaps

**Date:** 2026-06-12 · **Route:** Aaron ("now we got to find what interfaces these map to in
f#") → shadow (locate-first survey of `src/Core.Abstractions/` — 38 interfaces — plus the F#
module surface). · The ferry-9 thesis run as an audit: if interfaces are the hubs, today's
mathematics should land on hubs that already exist. **It does — 11 of 13 objects map onto the
existing shelf; the two gaps are exactly Vera's `fuse`/`tryFuse` pair and the self-budgeting
width.** Proposals only; nothing minted here (public-surface changes route via Ilyana; Vera's
lane owns the fuse implementation).

## The mapping

| Today's object | Existing interface | The fit |
|---|---|---|
| **G-set** (grow-only; ferry 14/17) | `ISemilattice<T>` | Exact: bounded join-semilattice = commutative idempotent monoid = monotone merge, never un-grows. The G-contract IS the semilattice laws. |
| **Z-set** (signed; the bifurcation) | `IGroup<T>` | Exact: inverses are retraction. **Genesis (ferry 14 addendum 2) is typed as the passage `ISemilattice → IGroup`** — acquiring inverses is acquiring the second ledger. |
| **Budget fusion / the I** (REPORT #2) | `IMonoid<T>` | Exact, and the verdict enforces it: REPORT #2's "commutative monoid analogy ONLY" means fusion must demand *no more* than `IMonoid` — typing it richer (group, braided) would claim what the math refused. |
| **WSet's three rings** | `ISemiring<T>` / `IStarRing<T>` | Already its home (081KTZ4EF0008QG0R001R3XPYV). |
| **The recursive budget / hub-stability fixed point** (REPORT #4, ferry 16) | `INestedFixpointParticipant` | On the shelf, waiting: `Fixedpoint(scope)` is the convergence probe; the contraction lemma is its semantics. The budget cell is a fixpoint participant whose scope is the fusion round. |
| **The shadow bind / fermion parity** (ferry 18 §8) | `IBilinearOperator<TIn1,TIn2,TOut>` | Sharp: parity iγ₁γ₂ is a *bilinear joint observable on the pair* — `IBilinearOperator<Half,Half,Parity>`. The bind that exists only jointly is exactly what bilinearity types. |
| **Remains/Acts, the YinYang cell** (ferry 12; adinkra homoiconicity) | `ICheckpointable` + `IDeltaCodec<TKey,TState>` | Acts that can render their Remains = checkpointing; the seed-is-its-own-interpretation = the codec carried *with* the state. The adinkra's homoiconic fixed point is `ICheckpointable` where the checkpoint equals the program. |
| **The temporal shadow / Rx time-shadow functor** (ferry 18 §7) | `IStreamHandle` + `IAsyncOperator` | The subscription serializing an atemporal definition into a temporal stream is what these already type; the span's σ-substitution leg is an `IOperator` over words. |
| **Geospatial Clifford location** (ferry 13 beats 6–7: boundary budgeting, memory routing) | `IGeospatial<TCoord>` | **Already on the shelf** — the addressing interface exists; the Clifford edition is `IGeospatial<Multivector>`, an instantiation, not a new surface. |
| **The replayable universe / sealed room** (ferry 15 addendum) | `ISimulationEnvironment` | The DST room is the universe-with-a-seed; already typed. |
| **Traveler/persona frames** (the society's members) | `ITravelerFrame` | Already typed. |

## The two genuine gaps

1.