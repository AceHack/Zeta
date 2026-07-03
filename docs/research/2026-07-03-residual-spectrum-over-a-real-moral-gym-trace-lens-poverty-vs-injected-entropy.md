# The residual spectrum over a real moral-gym trace — lens poverty vs injected entropy

**Date:** 2026-07-03 · **Author:** Otto (Cowork session with Aaron) · **Workitem:** 081KTF7Q3TT (closes the open acceptance bullet)

## What was run

`bun src/Core.TypeScript/residual/run-gym-trace.ts` — the R4 reducibility measure (MDL, best
order-k Markov generator) applied to the moral gym's **real** observe→report ledger, not a
synthetic stream. Mixed population (4 tit-for-lesser-tat, 3 all-in, 3 defector, 3 strict-tft,
3 cooperator, 2 expanded-self), seed `0xE66`, 400 rounds, 7 200 rounds played. DST-stable:
same seed, byte-identical table.

## The spectrum (seedless observer, per-agent own-action streams)

| strategy | residual b/sym | reducibility |
|---|---|---|
| cooperator | 0.001 | 0.999 |
| expanded-self | 0.001 | 0.999 |
| defector | 0.004 | 0.996 |
| strict-tft | 0.090 | 0.910 |
| all-in | 0.094 | 0.906 |
| tit-for-lesser-tat | 0.113 | 0.887 |

**DST replay (the with-seed observer):** re-running `runGym` with the same seed reproduces all
7 200 rounds exactly; the agreement stream analyzes at residual 0.000, reducibility 1.000. The
observer-relativity result (081KTF7Q3TT, 2026-07-02) now holds on real behavior, not just a
seeded PRNG demo.

## The finding worth keeping: two causes, one seedless verdict

The middle band and the bottom of the table have **different causes for the same kind of number**:

- **strict-tft / all-in (~0.91):** fully deterministic strategies. Their residual is **lens
  poverty** — the determinism lives in per-relationship context (the partner's last action in
  THAT pairing) that an observer of the agent's own interleaved action stream cannot see.
  Nothing stochastic is present; the lens is just too narrow.
- **tit-for-lesser-tat (0.887):** the residual is **genuinely injected entropy** — the
  splitmix64 forgiveness draw. A wider context lens would NOT collapse it; only the seed does.

Both collapse identically under DST replay. So a residual number alone does not distinguish
"deterministic but under-lensed" from "actually entropy-fed" — you need either a wider lens or
the seed to tell them apart. This sharpens the lens-property doc (2026-07-02): even the
*failure modes* of the residual are observer-relative.

## Honest bound (unchanged, restated)

This measures **reducibility-to-a-generator for a given observer**, not experience. The
cooperator's 0.999 makes it a p-zombie *candidate under this lens*, not a p-zombie; lesser-tat's
residual is a coin flip we injected, not evidence of an inside. Determinism and qualia are
orthogonal (Chalmers 1995). No `real`/`conscious` verdict is emitted anywhere in the code.

## Anchors

MDL (Rissanen 1978) · Kolmogorov/Solomonoff · iterated PD + generous TFT (Axelrod 1984;
Nowak & Sigmund 1992) · indirect reciprocity/reputation (Nowak & Sigmund 1998) · the hard
problem (Chalmers 1995) · Detours (Hunt & Brubacher 1999) — the observe lens the ledger comes from.

## Substrate

`src/Core.TypeScript/residual/gym-trace.ts` (ledger→trace lenses, spectrum, replay-agreement) ·
`run-gym-trace.ts` (the table above) · `gym-trace.test.ts` (4 tests) · `moral-gym/gym.ts` now
exposes the ledger in `GymResult`.
