# Pre-registered YinYang reseed-threshold evaluation

> **Key recommendation:** retain `ρ_T = 1/(3√2)` only if it is the unique winner of the fixed protocol below. The present repository contains deterministic CHIP-8 orbit records, but no recorded learning episodes or reward traces. Therefore this document records a protocol and **no empirical winner**.

## Scope and scale discipline

The live `YinYangEnsemble.tsirelsonThreshold` is a reseed trigger on a correlation-like `ρ` quantity, which is restricted to `[0,1]`. Its value `1/(3√2) ≈ 0.2357` comes from the explicitly chosen map `ρ = S/12`; it is not a first-principles derivation and is not Tsirelson's bound.[1]

`2√2 ≈ 2.828` is the CHSH correlator ceiling, so it cannot be substituted as a `ρ` threshold. Supplying it to the evaluator is a declared negative control and must produce **no verdict**, not a conversion or an implicit clipping operation.[1]

## Fixed protocol

The candidate thresholds are frozen in `rho-threshold-sweep.ts` as `{0.10, 1/6, 1/(3√2), 0.28, 1/3, 0.45}`. They span a low-reseed baseline, the linear-map classical landmark, the current design value, an intermediate point, the documented groupthink horizon, and a post-horizon comparison. No threshold may be added or removed after episode outcomes are accepted.

Each input record must identify a seed, task, episode index, immutable trajectory artifact, action count, and solved/not-solved result. Every `(seed, task, episode)` cell must be run exactly once at each threshold. Missing, duplicated, unregistered, or out-of-domain records return `no-verdict`.

The primary statistic is **solved episodes per action** over all balanced recorded episodes. This measures acquisition efficiency while charging every interaction, including failed attempts. The current design value earns retention only if it is the unique maximum. A tie is a tie; another winner falsifies its retention; and insufficient records do not imply support.

## Current execution status

The committed CHIP-8 data consist of finite deterministic `Chip8Cow.step` orbits. They demonstrate emulator-state periodicity and input waiting, not an agent's attempt policy, action cost, or skill acquisition. Using those files as if they were learning outcomes would manufacture the metric the protocol is supposed to test.[2]

The sweep evaluator and six negative/positive conformance cases are therefore an **analysis harness**, not evidence for any threshold. The next permissible execution is to have the CHIP-8/ARC agent harness emit immutable per-episode records matching `RhoSweepEpisode`; only then may `evaluatePreregisteredRhoSweep` produce a winner or falsifier.

## References

[1] [ρ_T derivation attempt and scope correction](2026-07-04-rho-t-derivation-attempt-it-is-a-design-choice-chosen-for-homoiconicity.md)

[2] [CHIP-8 orbit record schema](../../db/emus/chip8/orbits/README.md)
