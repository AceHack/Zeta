# SoftMix and the real/imaginary tree — what each rung costs, what it buys, and where the ImaginaryStack sits

> **Written again on request (Aaron 2026-08-20):** *"can you do the SoftMix compared to the
> imaginary and real tree again — this was very good at understanding the imaginary stack."*
> Given its own file this time, so it does not have to be reconstructed a third time.

## The one-line version

> **`SoftMix<TWeight>` has not decided what a weight is. The ring you hand it is a POSITION ON THE
> CAYLEY–DICKSON TREE, and every rung you climb costs an algebraic law and buys a physical
> capability. The interpreter never changes. The physics does.**

`src/Core.Abstractions/SoftMix.cs` says the beginning of this in its own header — *"Ring-generic
soft-mix interpreter… **The ring IS the physics** — swap it, change the behavior: real (double) →
Bayesian (no interference); complex → Quantum (interference/cancellation); quaternion → future
(non-commutative)."* What follows extends that past quaternions and says what each step *costs*.

## The tree, with the price of each rung

Cayley–Dickson doubling starts at `ℝ` and repeatedly doubles: one real part, and one more
imaginary direction each time. **Every doubling loses exactly one property.** That is not a
misfortune of the construction — it is the construction.

| rung | dim | real / imaginary | **law lost** | **capability gained** | what `SoftMix` does there |
|---|---|---|---|---|---|
| `ℝ` | 1 | 1 / 0 | — | — | **Bayesian.** Weights accumulate. Nothing cancels |
| `ℂ` | 2 | 1 / 1 | **ordering** | **interference** | **Quantum.** Opposite phases cancel, equal reinforce |
| `ℍ` | 4 | 1 / 3 | **commutativity** | **orientation** | `a·b ≠ b·a` — the *order* of a merge matters |
| `𝕆` | 8 | 1 / 7 | **associativity** | **the Fano plane** | `(a·b)·c ≠ a·(b·c)` — the *grouping* matters |
| `𝕊` | 16 | 1 / 15 | **division** (zero divisors appear) | **destruction is expressible** | `a·b = 0` with `a,b ≠ 0` — overwrite becomes possible |

Read the last two columns as one sentence and the tree stops being a curiosity:

> **You cannot buy interference without giving up order. You cannot buy orientation without
> giving up commutativity. You cannot buy the Fano plane — and therefore our code — without giving
> up associativity. And you cannot express destruction at all until you give up being a division
> algebra.

> **CORRECTED 2026-08-20 (Aaron):** the last clause conflates two claims. *Total division inside the
> algebra* dies at `𝕊` (Hurwitz — stands). *Division as a partial operation completed by analytic
> continuation* does **not** die, and the repo specified that mechanism on 2026-05-13 (Geometric
> Inversion Check, Riemann sheets, L'Hôpital pole erasure). Read as:
> **`𝕊`'s division dies; Zeta's division is not `𝕊`'s division.** See
> [`2026-08-20-harmonious-division-is-our-unorthodox-division-pole-erasure-superposition-over-rungs-and-what-survives-the-climb.md`](2026-08-20-harmonious-division-is-our-unorthodox-division-pole-erasure-superposition-over-rungs-and-what-survives-the-climb.md).**

### Why `ℝ` is "no interference" specifically

Because in the probability semiring the weights are **non-negative**: two paths arriving at the
same state can only add. There is no `+1` and `−1` that annihilate. `AmplitudeEmu.fs` states the
same fact from the other side — drop the merge *and* use real weights ⇒ no interference; restore
the merge *with complex* weights ⇒ the two-slit falls out. **Cancellation needs a phase, and a
phase needs an imaginary direction.**

### Why `𝕆` is where our code comes from

The frozen-core register carries this derived end-to-end, not assumed: the octonion
multiplication table in `CayleyDickson.fs` is *proven* (from the actual product,
convention-independent) to form a **Fano plane** — 7 triples, every pair once, each unit in 3, a
Steiner system `S(2,3,7)`. The Fano triples span the `[7,4]` Hamming code over `GF(2)`; the parity
extension is **doubly-even**; and that is the `[8,4]` adinkra generator.

So: **octonion → Fano → Hamming → doubly-even.** Our error-correcting code is a shadow of the
octonion multiplication table. You get it at rung `𝕆` and not before, because the Fano plane is
what the seven imaginary units' product *is*.

### Why `𝕊` is the interesting cliff

Zero divisors appear at the sedenions — `a·b = 0` with neither factor zero. By Hurwitz (1898),
`ℝ, ℂ, ℍ, 𝕆` are the only normed division algebras, so this is exactly where it must happen.

And from the idempotent knot: **multiplication by a zero divisor is what collapse, erasure and
overwrite all are.** So the tree has a moral reading:

> **Below `𝕊`, destruction is not merely forbidden — it is inexpressible.** There is nothing to
> multiply by that annihilates. At `𝕊` the vocabulary acquires the ability to destroy.

Our adinkra generator sits at `𝕆` — **the last rung before that.**

## Where the ImaginaryStack sits

`src/Core.Lean4/ImaginaryStack/ToyModel.lean` proves the bulk-from-boundary property:

- the space is **16 coordinates, split `12 (boundary) ⊕ 4 (bulk)`**
- the code subspace is the **graph of a linear generator `G : boundary → bulk`** — the
  "multiplication-table-determined code"
- `reconstruct G = id.prod G` is a genuine linear map and recovers **every codeword from its 12
  boundary coordinates**

`ErasureDistance.lean` then strengthens fixed-boundary recovery to *arbitrary* erasure: distance
`d` ⇒ unique recovery from any `< d` erasures, with a concrete Reed–Solomon `[16,12]` at `d = 5`.
And `PhaseClockErasure.lean` applies it: missed heartbeat phases are erasures, and any 12 of 16
consecutive phases recover the rest.

### The pairing worth noticing — and the trap next to it

The ImaginaryStack works at **16 coordinates**, and 16 is also the sedenion dimension — the first
rung where zero divisors exist. Which would make a tidy story: *the level at which you can destroy
is the level at which you need the code.*

**That is a coincidence being used as a generator, not an identification** (per
`numerology-vs-number-theory.md`), and the honest position is explicit:

- The ToyModel's 16 is a **coordinate count over a field** with a `12 ⊕ 4` split; the sedenions
  are a **16-dimensional real algebra**. Same number, different objects, and matching cardinality
  identifies nothing.
- The ToyModel *itself* names the gap: *"which specific `G` the imaginary-stack multiplication
  table induces … is NOT proven here."* **The link from the multiplication table to the code
  generator is open by the file's own admission**, and that link is precisely what would have to
  hold for the tidy story to be a result.

So the pairing is a good place to look and not a thing we know. What *is* proven is the
reconstruction skeleton and the erasure principle; what is open is which rung's multiplication
table supplies `G`.

## Putting the two together

| | `SoftMix` | `ImaginaryStack` |
|---|---|---|
| what it is | one interpreter, ring as a parameter | a code and a reconstruction proof |
| what varies | **which rung** you stand on | held fixed at 16 coordinates |
| what it buys | interference, orientation, grouping, destruction — one per rung | bulk recoverable from boundary; erasure below `d` recoverable |
| the honest gap | none — it is parametric by construction | which `G` the multiplication table induces |

The clean way to hold both: **`SoftMix` is the dial and `ImaginaryStack` is one setting studied in
depth.** Turning the dial changes what physics the same fold performs; the stack asks what
survives erasure once you have stopped turning it.

And the reason this is worth understanding as a pair — **the capability you gain at a rung is the
capability you then need protection from.** You climb to `𝕆` for the Fano plane and get the code;
you climb one more for expressible destruction and immediately need the code you just got. The
error-correction and the thing it corrects arrive one rung apart.

> **CORRECTED 2026-08-20 (Aaron):** *"the 'climbing' is a classical view."* The rungs are a
> filtration, not a trajectory, and a signature choice can hold two at once — `Cl(0,3) ≅ ℍ ⊕ ℍ`,
> split by the central idempotents `(1 ± ω)/2`, whose product is `0`. So **superposition over rungs
> and division-by-zero are the same purchase**, and the code and the destruction it corrects are
> *components of one multivector*, not events one rung apart. See
> [`2026-08-20-harmonious-division-is-our-unorthodox-division-pole-erasure-superposition-over-rungs-and-what-survives-the-climb.md`](2026-08-20-harmonious-division-is-our-unorthodox-division-pole-erasure-superposition-over-rungs-and-what-survives-the-climb.md) §4.

## Pointers

- `src/Core.Abstractions/SoftMix.cs` — "the ring IS the physics"; the dial
- `src/Core/AmplitudeEmu.fs` — the `ℂ` setting: `merge` is interference, `bornProb` is collapse
- `src/Core/CayleyDickson.fs` + `CayleyDicksonAdinkra.Tests` — octonion → Fano → Hamming, derived
- `src/Core.Lean4/ImaginaryStack/` — `ToyModel` (bulk-from-boundary), `ErasureDistance` (distance ⇒ recovery), `PhaseClockErasure` (applied to heartbeats)
- `docs/research/2026-08-20-the-idempotent-knot-...md` — why zero divisors are the destruction
- `docs/craft/subjects/zeta/free-object-and-the-cost-of-a-quotient/` — the same trade taught downward (quotients) rather than upward (doublings)
- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B, Adinkra-as-generator row — the proven/open split
