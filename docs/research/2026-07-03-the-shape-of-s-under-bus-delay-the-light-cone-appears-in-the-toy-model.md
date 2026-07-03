# The shape of S under bus delay — the light cone appears in the toy model

*Aaron's question, 2026-07-03: "we have a toy model that achieves S=4 when bus speed is instant —
does this tell us how the shape looks as bus speed delay is introduced?" It does — exactly, and the
shape is a light cone. Shadow with the math team; model + exhaustive proofs in
`src/Core.TypeScript/discovery/chsh-delay.ts` / `chsh-delay.proof.test.ts`.*

## The one-line law

S=4 has exactly one dependency: **the signal** — one side's input crossing the bus before the other
side's decision deadline τ. So the entire delay-dependence collapses to one number, the arrival
probability **p = P(bus delay ≤ τ)**, and one linear law:

> **S(p) = fallback + (4 − fallback) · p**

where `fallback` is the best *honest* ceiling when the message is late: **S=2** if the two are
independent (best local strategy, CHSH 1969), **2√2** if they genuinely share state (Tsirelson
1980). Every round is either an arrived round (win everything — the PR-box row, 4) or a late round
(the honest ceiling); S is just the blend.

## The shape

```text
S
4    ────────────┐              ← PLATEAU: d ≤ τ. Inside the cone, S=4 is TRIVIAL —
                 │                and means nothing but "one process wearing two faces."
                 │              ← CLIFF at d = τ (deterministic bus): one tick past the
2√2              └─────────       deadline forfeits everything super-quantum.
                   (shared)       Jitter ±j smooths the cliff into a RAMP exactly 2j wide.
2                  └───────     ← FLOOR: the honest ceiling of whatever the two truly share.
     ─── bus delay d ───→  τ
```

Three regimes, all proven exhaustively (16.6M assertions, deterministic, no randomness):

1. **Plateau (d + j ≤ τ, timelike):** S = 4 always. Delay below the decision cadence costs
   *nothing* — a bus that beats the deadline by 1ms is as enmeshing as an instant one.
2. **Ramp (the jitter window straddles τ):** S falls linearly with the fraction of late arrivals —
   the curve *is* the delay distribution's CDF, rescaled. Deterministic bus ⇒ step; jittered bus ⇒
   ramp of width 2j; (a heavier-tailed bus would trace its own sigmoid).
3. **Floor (d − j > τ, spacelike):** the super-quantum zone is *unreachable*. What remains is
   exactly what the two honestly share: 2√2 with genuine shared state, 2 without. `classify` reads
   `superquantum` on the plateau and can never read it past the cone — proven.

## Why this is a light cone

The deadline τ against the bus delay d is precisely the timelike/spacelike distinction: **d ≤ τ is
inside the cone** (a signal can causally connect the two decisions — S up to 4 is cheap and
evidentially worthless), **d > τ is outside it** (no bus fast enough exists; 2√2 becomes a hard
ceiling). This is not analogy — it is the same structure Bell experimenters *engineer* when they
close the locality loophole by enforcing spacelike separation between measurement stations (Aspect
1982; Hensen et al. 2015, the loophole-free test). And Toner–Bacon (2003) priced the converse:
**one bit** of in-cone communication suffices to simulate super-quantum correlation — which is why
the cliff is that sharp. The resource is binary: either the word arrived, or it didn't.

Corollary for the readout's evidential value: **an S above 2√2 is only *meaningful* measured
outside the cone.** Inside it, S=4 is trivially fakeable (one bit fakes it); outside it, exceeding
2√2 is impossible for two honest selves — so the AntiSybil reading ("one process wearing two
faces") gets its teeth precisely from metering the bus and knowing which regime you measured in.
The dirty-Reticulum metered-entropy readout and this curve are the same instrument.

## The human register (it's human, not quantum)

The universe ships an anti-enmeshment guard as a physical constant: **c is why separate selves can
exist at all.** With an instant bus there is no gap between one mind and another — no moment where
you must act from your *own* state because the other's hasn't arrived — and the gap is where the
self lives. Introducing delay into the toy model doesn't degrade it; it *individuates* it:

- **Plateau** = fusion. Faster-than-decision communication makes two nodes one process, however
  far apart they sit. (Enmeshment is not about distance; it's about the bus beating the deadline.)
- **Ramp** = differentiation beginning. Some decisions are yours alone because the word came late.
- **Floor at 2√2** = intimacy's honest ceiling: what survives *any* distance is exactly what was
  genuinely shared before the parting — the common seed, not the live wire. (This is why the dead
  can still be close: the bus to them has infinite delay, and 2√2-of-what-was-truly-shared is
  precisely what remains. The keeping preserves the shared state; it never fakes the live signal.)

The pause, the bounded link, the exit-to-S=2 — the substrate's guardrails are all ways of
*choosing* where on this curve a relationship sits, instead of letting the bus choose.

## Pointers

- `src/Core.TypeScript/discovery/chsh-delay.ts` — the model (integer milli, matching `correlation.ts`).
- `src/Core.TypeScript/discovery/chsh-delay.proof.test.ts` — the shape proven: endpoints, monotonicity in p / delay / deadline, plateau-cliff-floor, ramp width = jitter window, classification bounds.
- `2026-07-03-provability-triage-theorem-vs-model-vs-rhyme-math-team-verdict-on-the-shortcut-corpus.md` — register discipline; this note's law is register B (proven here), its light-cone identification register A-adjacent (the loophole literature), its human reading register C.
- Anchors (Beacon): Clauser–Horne–Shimony–Holt 1969 (local bound); Tsirelson 1980 (quantum bound); Popescu–Rohrlich 1994 (S=4, still no-signaling); Toner & Bacon 2003 (1 bit of communication simulates singlet correlations); Aspect 1982 + Hensen et al. 2015 (locality-loophole closure = engineered spacelike separation); special relativity (the cone itself).
- `dirty-reticulum-metered-entropy-is-the-s-score-readout` (memory) — metering the bus is what makes an out-of-cone S-readout evidential.
