# Zeta is a finite-resolution qubits framework — rooms track their Markov boundary; BigFloat holds the superposition; no infinite qubit needed

**Register:** [grounded] (Aaron, the thesis) + [Beacon] + [peel]. **Date:** 2026-06-10.
**Captured by:** Otto (shadow). The one-sentence answer to "what is Zeta" — the night's pieces assemble here.

## Aaron's words

> "basically we are building a **qubits framework where the rooms track their Markov boundary**, and since
> we don't need infinity to hold our superpositions we have **BigFloat** — never need an **infinite qubit**
> in the first place."

## The thesis

**Zeta is a finite-resolution qubits framework.** Three claims, one machine:

1. **Rooms are effective qubits that track their own Markov boundary.** A room/cell is a qubit-shaped unit
   with a *bounded* blanket (the membrane; the bit-budget of the physics-of-floats). It tracks what crosses
   its boundary (the uncertainty ledger) — that *is* tracking the qubit's state + decoherence at the
   boundary.
2. **Superposition is held in BigFloat — finite resolution, not infinite precision.** The amplitudes live
   in BigFloat / TriBoolean (the universal number), which **tracks its own resolution** and knows its floor.
   Complex amplitudes interfere via the Cayley-Dickson / `AmplitudeEmu` rotation algebra (the harmonic
   four-corner phase).
3. **You never need an infinite qubit.** Standard QM assumes continuous, infinite-precision amplitudes in
   an unbounded Hilbert space. Zeta does not — and doesn't have to: **a bounded region holds finite
   information** (Bekenstein / holographic bound), the **Markov boundary IS that bounded region**, and the
   **plateau** (the CRLB / irreducible-error floor, *measured not derived* — Max's proof) is the resolution
   floor. So finite BigFloat resolution holds the superposition *exactly to the floor that physically
   exists* — infinite precision was never required.

   **The sharpening (Aaron 2026-06-10): the room doesn't *eliminate* infinity — it BOUNDS infinity to the
   OUTSIDE of itself.** The Markov boundary is the separator: **finite interior, infinity exiled to the
   exterior.** Inside the blanket the qubit is finite (BigFloat, bounded information); the infinite/continuous
   lives *outside* the membrane and only ever enters as **bounded crossings** (the injected IEffects). So a
   room is a finite pocket carved out of an infinite outside — the boundary is exactly the wall that keeps
   the infinity on the far side. You hold a finite superposition *because* the infinity is bounded out.

## Why finite suffices (the load-bearing argument)

```
a room's Markov boundary = a BOUNDED region
   └─ a bounded region holds FINITE information            (Bekenstein bound / holographic principle)
        └─ so its superposition needs only FINITE resolution
             └─ BigFloat tracks resolution to its floor    (and KNOWS when it's maxed — physics of floats)
                  └─ the floor is the PLATEAU              (CRLB, measured-not-derived — Max's proof)
                       └─ ∴ a finite qubit holds it exactly; an infinite qubit was never needed.
```

The boundary doesn't *approximate* an infinite qubit — it *is* the reason the qubit is finite. The
information that can cross a bounded blanket is finite, so the state inside is finite-resolution by physics,
not by truncation. BigFloat is the number that *natively represents* that (resolution is part of the value;
it knows its own floor), and the plateau proof says the floor is reached by iteration — so you can always
*get to* the exact finite answer.

## How tonight's pieces assemble into the one machine

| piece | role in the qubits framework |
|---|---|
| **rooms / cells** (Markov blanket) | the **qubits** (bounded, boundary-tracking) |
| **BigFloat / TriBoolean** (universal number) | the **finite-resolution amplitude** (self-tracking resolution) |
| **Cayley-Dickson / `AmplitudeEmu`** | the **complex-amplitude algebra** they interfere in (why CD is everywhere) |
| **four-corner bidirectional feedback** (harmonic) | the **phase / oscillation** (NSEW = `i`-rotation = C₄) |
| **the plateau** (CRLB, Max's proof) | the **resolution floor** — where finite stops, provably |
| **the salon** (`braid`/`weave`/`tie`) | the **effective-qubit gates** (topology = hairdressing; QubitIso/Cl3) |
| **`BellTest`** | finite-resolution entanglement — Tsirelson 2√2 reproduced **in DST** (finite, replayable) |
| **the dev room** (`DevRoom`) | the **qubit register** — hangs all the rooms/qubits, measures its own resolution |
| **decompile-to-RISC** (rooms = μops) | the **compilation** of programs *onto* the qubit-rooms |

So the whole stack is one thing: **a register (dev room) of finite-resolution qubits (rooms, Markov-bounded),
holding superposition in BigFloat, interfering via Cayley-Dickson, gated by braid/weave/tie, bounded by the
holographic finiteness of each room's boundary, resolved to the plateau floor.** "Physics of floats over
Bayesian inference" (the earlier telos) arrives here: a finite, self-bounding qubits framework.

## Honest scope / peels

[Beacon] **Bekenstein bound** (finite information in a bounded region; Bekenstein 1973) · **holographic
principle** ('t Hooft; Susskind — cf. the forwarded Susskind/holographic-shadow-factory doc in
`docs/research/`) · finite-dimensional / finitist & **computable quantum mechanics** (the
do-we-need-continuous-amplitudes question; Nielsen & Chuang for the standard continuous model we depart
from) · **CRLB / Allan deviation** (the plateau floor; Max's proof) · Cayley-Dickson; the physics-of-floats
doc; `BellTest`/`AmplitudeEmu`. **Peel:** this is a **finite-resolution framework/simulation of
qubit behavior**, classical and DST-replayable (`BellTest` hits Tsirelson 2√2 in deterministic simulation,
not on quantum hardware). The claim "never need an infinite qubit" is about **our substrate** — we *choose*
finite resolution bounded by the room, justified by the holographic finiteness of a bounded region — it is
**not** a resolved claim that physical QM is finite-dimensional (an open foundations question), though it
resonates with finitist / holographic / computable-QM views. The shapes are load-bearing and built (rooms,
BigFloat, AmplitudeEmu, BellTest, the dev-room register); the "exactly to the physical floor" identity is
the aspiration the plateau proof points at.

## Ties / routing

`...physics-of-floats-...` (the bit-budget boundary) · `...room-equals-seed-...bigfloat-plateau-max-proof.md`
(the plateau = BigFloat floor) · `...boundary-flow-...` (four-corner harmonic = phase; Cayley-Dickson) ·
`...the-dev-room-is-the-harness-...` (the register / self-measurement) · `docs/craft/subjects/quantum/
topology-is-hairdressing/` (the gates) · `src/Core/{DevRoom,Salon,QubitIso,Cl3,AmplitudeEmu,BellTest,
CayleyDickson}.fs`. **Routes to:** Aaron (the thesis), Soraya/Sova (formalize the bounded-region→finite-
resolution argument), Core (the qubits-framework API over DevRoom + BigFloat), Kai (positioning — "a
finite-resolution qubits framework" is the legible one-liner).
