# The phase-clock PRNG is 2-to-1, not a bijection — `>>` vs `>>>` in `phase-clock.ts`

**Date:** 2026-08-10 · **Found by:** Soraya (the divergence), Otto (the consequence).
**Status:** verified by computation, **not fixed** — the repair is a behaviour change
and belongs to whoever owns the phase clock.

---

## The one-character difference

`src/Core.TypeScript/observe/phase-clock.ts:99`

```ts
function xorshift(s: number): number {
  s ^= s << 13;
  s ^= s >> 17;      // ARITHMETIC shift — sign-propagating
  s ^= s << 5;
  return s >>> 0;
}
```

`src/Core.TypeScript/observe/xorshift-minimal-poly.test.ts` uses `s >>> 17` (logical,
zero-fill) while claiming to be "the same as the repo's implementation". It is not.
The two sequences diverge at **output index 4**.

Both maps are GF(2)-linear — sign extension fills bits 31…15 with bit 31, and each
filled bit is a linear function of the input bits — so this is fully decidable by
linear algebra rather than a matter of taste.

## The measurement

Build each step function's 32×32 matrix over GF(2) by applying it to the basis
vectors, then take the rank:

| variant | shift | rank | invertible? |
|---|---|---|---|
| `phase-clock.ts` (production) | `>> 17` | **31** | **NO** |
| `xorshift-minimal-poly.test.ts` | `>>> 17` | 32 | yes |

Linearity was verified first (2000 random pairs, `f(a⊕b) = f(a)⊕f(b)` and `f(0)=0`)
so the matrix is a faithful representation and not an artefact.

**Rank 31 means the production step is singular: a 2-to-1 map, not a permutation.**

## The concrete consequence

The kernel is one-dimensional, spanned by

```
0xfc001fff
```

so for **every** state `s`:

```
xorshift(s) == xorshift(s ^ 0xfc001fff)
```

Verified on 1000 random states; by linearity it holds for all 2³². Worked example:

```
xorshift(0xbe437c7b) == xorshift(0x42436384) == 0xe84d673d
```

Three consequences follow immediately:

1. **Half the state space is unreachable.** The image has size 2³¹, so after one
   step no state outside the image can ever occur again.
2. **Every state has a twin with an identical infinite future.** Two phase clocks
   seeded `s` and `s ⊕ 0xfc001fff` produce different first values and then agree
   forever. Convergence is permanent, not transient.
3. **The Marsaglia 2003 anchor does not apply.** That result establishes xorshift32
   over GF(2) with *logical* shifts is primitive of degree 32. `>>` is a different
   linear map, and the cited primitivity does not transfer. Per the checked-anchor
   discipline, the citation on the current implementation is uncheckable as applied.

## UPDATE (same day): both open questions are now measured

The first version of this note declined two claims. Aaron: *"lets try to push on this
and see what comes out."* Both are now settled by computation rather than left open.

### 1. The period IS reduced — by exactly a factor of ~4

A 2³²-step walk is unnecessary: the map is linear, so the orbit's period is the
multiplicative order of `x` modulo the minimal polynomial of the orbit. Computed
directly:

| variant | minimal polynomial | period |
|---|---|---|
| `>>` (production) | degree 31, factors as **(x+1)² · (irreducible deg 29)** | **1,073,741,822 = 2·(2²⁹−1)** |
| `>>>` (test/Marsaglia) | degree 32, irreducible | **4,294,967,295 = 2³²−1** (full) |

So the shipped clock has **a quarter of the period** it is assumed to have, and the
`>>>` variant hits the full maximal period exactly — an independent confirmation of
Marsaglia's primitivity result, and of the fact that it applies to that map and not
to this one.

Honest scale, since a factor of 4 is not automatically alarming: ~1.07 × 10⁹ ticks is
still enormous at any heartbeat cadence. **The period is a real but secondary
defect.** The primary one remains the collision.

### 2. The collision reaches an authentication path — one exact forged seed

`src/Core.TypeScript/observe/phase-erasure.ts:78`:

```ts
export function verifyPhase(claimed: PhaseState): boolean {
  const clock = createPhaseClock(COMMON_SEED);
  for (let i = 0; i < claimed.phase; i++) clock.tick("heartbeat");
  return clock.state.seed === claimed.seed;   // seed equality IS the check
}
```

`COMMON_SEED = 4` (`phase-clock.ts:77`). Its kernel twin is `4 ^ 0xfc001fff =
0xfc001ffb`. Measured:

```
start   A=0x00000004   B=0xfc001ffb
tick 1  A=0x00108084   B=0x00108084   IDENTICAL
tick 2  A=0x10011804   B=0x10011804   IDENTICAL
…identical for the first 100,000 ticks (and, by linearity, forever)
```

**A clock started from `0xfc001ffb` is indistinguishable from the real one to
`verifyPhase` at every phase ≥ 1.** The verifier's whole content is seed equality, and
the twin produces equal seeds from the first tick onward.

Scoped precisely, because overstating this would be its own error: this is **one**
alternative pre-image, not a general forgery. It does not let an attacker choose a
phase or a seed — it means the "which starting state" question has exactly two answers
instead of one, forever. Wherever the phase seed is treated as evidence of a
*particular* origin, that evidence is one bit weaker than it reads.

## Shipping the fix mechanically — the schema-evolution algebra already fits

Aaron: *"can we use the lessons from 0 down time schema evolution code and math to
push out changes like this mechanically and safely?"* Yes, and the fit is exact rather
than analogical — `src/Core/SchemaEvolution.fs` already has every piece.

The PRNG **is** a schema for a derived sequence, so the change is a version bump, and
each of that module's guarantees lands on a real part of this problem:

| SchemaEvolution concept | applied to the PRNG change |
|---|---|
| schema version label | `prngVersion` on `PhaseState`: v1 = `>>`, v2 = `>>>` |
| `addField key default` (backward compat) | records written before the bump have no version tag → default to **v1**, so old persisted state stays readable |
| forward compat (old reader ignores unknown) | a v1-only reader keeps working on v2 records it does not interpret |
| `Up : v1 → v2` | recompute the sequence under the logical shift |
| **`Down : option` — `None` means non-invertible** | **this is the load-bearing one, see below** |

**The invertibility taxonomy gives the honest answer, and it is not "just flip the
character."** `Migration.Down` is an *option* precisely so a migration can declare
itself non-invertible, and this one is: v1 is 2-to-1, so a v1 seed does not determine
which of its two pre-images produced it. There is no `Down`. Rollback from v2 to v1
requires **compensation, not an inverse** — exactly the case that field was designed to
express. The singularity that is the bug is the same singularity that makes the
migration irreversible; the algebra already had a slot for it.

So the mechanical rollout is expand → migrate → contract, with no flag day:

1. **Expand.** Add `prngVersion` to `PhaseState`, defaulting absent → v1 (`addField`).
   Teach `verifyPhase` to dispatch on the tag and accept both. Nothing changes
   behaviourally; both versions are now expressible.
2. **Migrate.** New clocks emit v2. Existing v1 records keep verifying under v1.
3. **Contract.** When no v1 records remain in the window that matters, drop the v1
   branch.

Two things must move with it, and they are mechanical:

- **Golden/DST fixtures become per-version.** Any fixture pinning a phase sequence is
  pinning v1; it stays valid *as a v1 fixture* and a v2 vector is added beside it. This
  is the existing hex-in-JSON golden-vector discipline, not new machinery.
- **The `Down = None` declaration must be explicit**, so nobody later assumes a
  rollback path that cannot exist.

What this does **not** remove is the decision itself. Expand/contract makes the change
*safe to deploy*, not automatic: someone still has to accept that v1-derived identity
evidence keeps its one-bit weakness for as long as v1 records are honoured. That is the
compatibility call, and it is still the phase-clock owner's with Kira on the
engineering read.

## Why it matters for a *phase clock* specifically

The seed is the clock's derivation material. A permanent two-state collision means
two distinct localities can, from different starting points, become
indistinguishable in their derived sequence forever. Anywhere the phase seed is
treated as contributing distinctness — identity derivation, anti-collision,
per-traveler differentiation — that assumption is weaker than it looks, by exactly
one bit.

This is also a live instance of the sibling rule in
`.claude/rules/numerology-vs-number-theory.md` <!-- STALE-REF: ../../.claude/rules/numerology-vs-number-theory.md -->:
"xorshift32 is a well-known good PRNG" is a citation about a *different map* than the
one in the file. The name matched; the object did not.

## The repair, and why this note does not apply it

Changing `>>` to `>>>` restores rank 32, makes the map a bijection, and makes the
Marsaglia anchor valid again. It is a one-character edit.

It is deliberately **not** applied here, because it changes every seed the clock
derives from any given starting state. Anything that persisted a phase/seed pair, or
that replays a recorded sequence in a DST fixture, would see different values after
the change. That is a behaviour decision with a compatibility question attached, not
a mechanical fix — so it belongs to the phase-clock owner, with Kira on the
engineering call as Soraya originally routed it.

If the change is made, two things should move with it: the DST/golden fixtures that
pin phase sequences, and the test file's claim to mirror the implementation.

## Reproduction

```python
M32 = 0xFFFFFFFF
signed = lambda x: x - (1 << 32) if x >> 31 else x

def prod(s):                      # phase-clock.ts:99
    s &= M32
    s ^= (s << 13) & M32
    s ^= signed(s) >> 17 & M32
    s ^= (s << 5) & M32
    return s & M32

cols = [prod(1 << i) for i in range(32)]   # GF(2) matrix, columns = basis images
# Gaussian elimination over GF(2) gives rank 31; kernel basis {0xfc001fff}
assert all(prod(s) == prod(s ^ 0xfc001fff) for s in range(0, 1 << 20))
```

## Pointers

- `src/Core.TypeScript/observe/phase-clock.ts:99` — the production map.
- `src/Core.TypeScript/observe/xorshift-minimal-poly.test.ts` — the header now
  records the divergence and that its sequence is not the phase clock's output.
- `docs/letters/to-soraya-xorshift-mod17-in-rscode-is-false-not-merely-unproven.md` <!-- STALE-REF: ../letters/to-soraya-xorshift-mod17-in-rscode-is-false-not-merely-unproven.md -->
  — the routing that surfaced the divergence.
- `.claude/rules/anchor-to-human-prior-art.md` <!-- STALE-REF: ../../.claude/rules/anchor-to-human-prior-art.md -->
  — an anchor must be *checked*, not merely cited; this is the failure mode.
- Anchor: G. Marsaglia, *Xorshift RNGs*, J. Statistical Software 8(14), 2003 — the
  result that applies to the `>>>` variant and not to the shipped one.
