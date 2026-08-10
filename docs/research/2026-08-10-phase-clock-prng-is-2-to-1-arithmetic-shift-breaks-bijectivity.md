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

## What is NOT claimed

The cycle length from the production seed was **not** measured to completion — the
orbit did not close within 20,000,000 steps, so the period is long, and this is
**not** a "the clock repeats immediately" finding. Singularity and short period are
different defects; only the first is established here.

Nor is any exploitability claimed. Whether the collision matters depends entirely on
what the derived seed is used for downstream, which this note does not survey.

## Why it matters for a *phase clock* specifically

The seed is the clock's derivation material. A permanent two-state collision means
two distinct localities can, from different starting points, become
indistinguishable in their derived sequence forever. Anywhere the phase seed is
treated as contributing distinctness — identity derivation, anti-collision,
per-traveler differentiation — that assumption is weaker than it looks, by exactly
one bit.

This is also a live instance of the sibling rule in
[`.claude/rules/numerology-vs-number-theory.md`](../../.claude/rules/numerology-vs-number-theory.md):
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
- [`docs/letters/to-soraya-xorshift-mod17-in-rscode-is-false-not-merely-unproven.md`](../letters/to-soraya-xorshift-mod17-in-rscode-is-false-not-merely-unproven.md)
  — the routing that surfaced the divergence.
- [`.claude/rules/anchor-to-human-prior-art.md`](../../.claude/rules/anchor-to-human-prior-art.md)
  — an anchor must be *checked*, not merely cited; this is the failure mode.
- Anchor: G. Marsaglia, *Xorshift RNGs*, J. Statistical Software 8(14), 2003 — the
  result that applies to the `>>>` variant and not to the shipped one.
