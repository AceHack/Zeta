---
id: B-1022
title: Fuse the arrow/four-corner/feedback/scheduler fragments into one four-corner harmonic Kleisli arrow; graduate FourCornerOwnership tools→src + port TS→F#/C#/Rust
priority: P2
status: open
tier: substrate-consolidation
tags: [fusion, accidental-complexity, rodney-razor, kleisli-arrow, isr, four-corner, fourcornerownership, feedback, harmonic, cayley-dickson, scheduler, ferrythrottler, policy, linguistic-seed, tools-to-src, markov-boundary, four-oracle, b-0917, b-1017, b-0204, b-0867]
created: 2026-06-10
owner: Aaron (drives) / Rodney (razor) / Kenji (integrate)
---

# B-1022 — Fuse the four-corner harmonic Kleisli arrow + graduate FourCornerOwnership tools→src

Aaron 2026-06-10: *"we need to fuse all these together — this is accidental complexity, and fine, cause
we are moving fast. Let's not lose this fusion, it's a nice cleanup."* + *"it should not be under tools but
source ... tools is really what closes over our dependencies before we use our own source ... it's our
host bootstrap / install.sh, our shield."*

Moving fast spawned many primitives that are **facets of one shape** (the arrow + its bidirectional-feedback
I/O object + the tick that runs it, oscillating in the rotation algebra). This item is the **consolidation**
(reduce accidental complexity — expected at speed) + the **tools→src graduation** of the four-corner type.

## Full design + rationale

`docs/research/2026-06-10-fusion-plan-four-corner-harmonic-kleisli-arrow-and-tools-to-src-graduation.md`
(the fragment table, the fused target, the tools=shield principle, the build order). Companion:
`docs/research/2026-06-10-boundary-flow-architecture-...` (bidirectional feedback = harmonic; NSEW = C₄ = i;
FourCornerOwnership found in TS).

## The fragments to fuse

`ISR<'A,'B>`+`>=>` (`IntrCtx.fs`, the morphism) · `FourCornerOwnership<TIn,TOut,TOutFeedback,TInFeedback>`
(`tools/workflow-engine/types.ts`, the typed bidirectional-feedback I/O object) · `Policy`/`StreamPolicy`
(decision-arrow case) · `FeedbackThrottle` (harmonic coupling) · `FerryThrottler` (DoP runner) ·
`SoftScheduler` (the tick) · `LinguisticSeed` (kernel payload) · `CayleyDickson`/`Cl3`/`AmplitudeEmu`
(oscillator algebra) · `SoftTie`/`FingerprintPrism` (soft optics).

## Acceptance (the fused target)

1. **Graduate `FourCornerOwnership` `tools → src`** + port TS→F#/C#/Rust (4-oracle, golden-vectored). The
   shield (`tools/`) houses dep-closure, not our-own primitives.
2. **Fuse the arrow:** `ISR`'s feedback channel becomes the four-corner-ownership object; `Policy` = a
   decision-arrow over it; `FeedbackThrottle` = its harmonic-coupling parameter.
3. **One runner:** `SoftScheduler` over `FerryThrottler` (DoP knob) ticks the fused arrow; CHIP-8 re-homed
   onto it, **DST-verified behaviorally equal** (no regression — fusion is cleanup, not a behavior change).
4. **Oscillator:** feedback wired onto Cayley-Dickson (`AmplitudeEmu` phasor) so the four corners rotate
   (NSEW = i).

## Notes

- **Run with Rodney first** (essential-vs-accidental cut) before the refactor lands; **large** change →
  Architect/human sign-off. The fragments all WORK today (CHIP-8 runs on the ISR arrow; FourCornerOwnership
  runs the observe loop) — this removes *accidental* complexity, it does not fix a bug.
- Subsumes/relates: B-0917 (IntrCtx interrupt substrate), B-1017 (Policy), B-0204 (LinguisticSeed),
  B-0867 (workflow engine / FourCornerOwnership).
