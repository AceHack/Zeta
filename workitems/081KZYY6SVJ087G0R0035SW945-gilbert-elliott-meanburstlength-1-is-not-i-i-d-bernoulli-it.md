---
id: 081KZYY6SVJ087G0R0035SW945
type: bug
state: backlog
priority: P2
slug: gilbert-elliott-meanburstlength-1-is-not-i-i-d-bernoulli-it
title: "Gilbert-Elliott meanBurstLength=1 is not i.i.d. Bernoulli; it forbids consecutive losses, so every uniform-loss row is optimistic"
created: 2026-08-14T01:29:26.642Z
depends_on: []
composes_with: []
---

# Gilbert-Elliott meanBurstLength=1 is not i.i.d. Bernoulli; it forbids consecutive losses, so every uniform-loss row is optimistic

Found 2026-08-14 while fixing `081KZYN3B79087G0R0014ZKE3C`, in the course of checking whether
a binomial closed form could serve as a falsifier for the goodput numbers. It cannot, and the
reason is this.

## The claim in the harness — CHECKED false

`src/Core.TypeScript/discovery/udp-lossy-transport.chaos.ts`, `burstParams`:

> `meanBurstLength = 1` reduces to i.i.d. Bernoulli loss — the degenerate case, kept so the
> harness can show what a uniform injector would have reported.

and `UCH-5` pins it: _"meanBurstLength=1 degenerates to i.i.d. Bernoulli — every burst has
length 1"_.

"Every burst has length 1" is true and is exactly why the Bernoulli claim is false. With
`lossInGood = 0`, `lossInBad = 1` and `r = 1/L = 1`, the chain leaves BAD after **exactly** one
packet, always. Measured over 400,000 packets at a 10% target rate, seed `0xabcd`:

```
observed loss rate: 0.10016   target: 0.1
burst histogram:    [ [1, 40063] ]          ← no run of length 2 anywhere
P(drop | prev drop) = 0.00000               ← i.i.d. Bernoulli would give 0.1
```

Per block of 8, against `Binomial(8, 0.1)`:

| k   | observed | Binomial(8, 0.1) |
| --- | -------- | ---------------- |
| 0   | 0.392180 | 0.430467         |
| 1   | 0.434680 | 0.382638         |
| 2   | 0.153840 | 0.148803         |
| 3   | 0.018300 | 0.033067         |
| 4   | 0.001000 | 0.004593         |
| 5+  | 0.000000 | 0.000432         |

The tail — which is the only part an erasure code cares about — is understated by roughly 2x at
k=3, 4.6x at k=4, and infinitely at k≥5.

## Why L=1 cannot be Bernoulli, structurally

An i.i.d. Bernoulli(p) channel requires `P(bad next)` to be independent of the current state:
`pGoodToBad = 1 − pBadToGood`, i.e. `r = 1 − p`. Its mean burst length is then `1/(1−p) > 1`.
So **a mean burst length of exactly 1 is unattainable for any channel with nonzero loss** —
`L = 1` is not the uniform case, it is the maximally ANTI-correlated extremum, a channel that
actively spaces its losses out. Bernoulli sits at `L = 1/(1−p)` (1.11 at 10% loss, 1.25 at 20%).

## Why it matters

The harness exists to demonstrate that a uniform injector produces a **false green** by never
concentrating loss (`UCH-11`). The `L = 1` baseline is _more_ optimistic than the Bernoulli
injector it is standing in for — so the harness understates its own headline finding, and every
"uniform loss" row in the reports built on it (`UCH-12`, the delivery tables in
`081KZYN3B79087G0R0014ZKE3C`, and the crossover in the `udp-lossy-transport.ts` header) is
biased in the code's favour. Directionally safe, quantitatively wrong.

## Proposed fix — PROPOSED, not implemented here

Add an explicit Bernoulli parametrisation (`r = 1 − rate`) rather than overloading
`meanBurstLength = 1`, keep `L = 1` as the named anti-correlated extremum it actually is, and
correct `UCH-5`'s name and the `burstParams` docstring. Then re-derive the pinned rows in
`UCH-11`/`UCH-12`/`UCH-13` and re-run the crossover measurement.

NOT bundled into `081KZYN3B79087G0R0014ZKE3C` deliberately: that is a decoder fix, this is a
change to the measuring instrument, and landing them together would make it impossible to tell
which one moved a number.

## Pointers

- `src/Core.TypeScript/discovery/udp-lossy-transport.chaos.ts` — `burstParams`, `gilbertElliottTrace`
- `src/Core.TypeScript/discovery/udp-lossy-transport.chaos.test.ts` — `UCH-5`, `UCH-11`, `UCH-12`
- Anchors: Gilbert, _Capacity of a Burst-Noise Channel_, BSTJ 39(5) 1960; Elliott, BSTJ 42(5) 1963.
