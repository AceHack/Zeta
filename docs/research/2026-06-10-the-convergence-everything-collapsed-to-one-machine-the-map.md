# The convergence — everything collapsed to one machine (the map)

**Register:** [grounded] (Aaron: "we found a bunch of our shapes collapsed to one — did we pull that
together?") + [Beacon]. **Date:** 2026-06-10. **Captured by:** Otto (shadow).
**This is the pull-together** — the individual collapses were each captured in their own doc; this gathers
them into one map + the single machine they are.

## The distinct collapses we found (each → its doc)

| # | what collapsed to one | the one thing | where |
|---|---|---|---|
| 1 | `Bag` (ℕ) + `ZSet` (ℤ) + `SoftValue` (prob) | **one `WeightedSet<'K,'W>`** (weight-algebra port) — *proven* (ZSet ≡ WeightedSet⟨IntegerRing⟩) | `src/Core/WeightedSet.fs`; BagSpineEquivalence tests (#7543) |
| 2 | `ISR` arrow + `FourCornerOwnership` + `Policy` + `FeedbackThrottle` + `FerryThrottler` + `SoftScheduler` + `LinguisticSeed` + Cayley-Dickson | **one four-corner harmonic Kleisli arrow** | `...fusion-plan-...md` (081KTQD8A0008QG0R0005EFYPV) |
| 3 | data×feedback × in×out (the four corners) | **NSEW = {1,i,−1,−i} = C₄ = `i`-rotation**; bidirectional feedback = **harmonic oscillation** (why Cayley-Dickson is everywhere) | `...boundary-flow-...md` |
| 4 | programs → primitives; tests/cells | **rooms = the CPU's micro-operations**; hard→soft = **decompile to MIPS-like RISC μops**; real-time branch detection | `...decompiling-to-risc-...md` |
| 5 | a room | **seed + extensions + parameters**, ticking to its **BigFloat plateau** (= the resolution floor; Max's proof) | `...room-equals-seed-...md` |
| 6 | salon/darkhall/bowling-alley/skatium doors | **one dev room** (`DevRoom`) — boundary = union of all rooms; self-measured resolution | `...the-dev-room-is-the-harness-...md`; `src/Core/DevRoom.fs` |
| 7 | the technique + the mental imagery | **one root: Feynman** (vernacular = the technique; distributed systems = Feynman diagrams; retraction = antiparticle) | `...feynman-is-the-root-anchor-...md` |
| 8 | effort / action / attention | **attention is the currency of agency**; minimal-action rooms; bidirectional backpressure | `...effort-is-attention-...` / `...boundary-flow-...` |

## The grand collapse — they are ONE machine

All eight are facets of a single thing (Aaron's thesis, `...finite-resolution-qubits-framework-...md`):

> **A finite-resolution qubit register.** The **dev room** (#6) is the register; each **room** is a
> **qubit = a μop = a `seed+extensions+parameters` cell** (#4, #5), **Markov-bounded** so it holds a
> **finite** superposition in **BigFloat** (the room *bounds infinity to the outside*); its amplitudes
> interfere in **Cayley-Dickson** via the **four-corner harmonic** feedback (#2, #3); it **ticks on the
> soft scheduler** and **resolves to its plateau** floor (#5); the values that flow are **one weighted
> bag** (#1); **programs decompile onto it as μops** (#4); the **salon gates it** (braid/weave/tie); and
> the whole thing is **taught in the vernacular** and rooted in **Feynman** (#7, #8). **No infinite qubit
> needed** — the boundary bounds the infinity out.

One sentence: **a finite-resolution qubit register of Markov-bounded rooms (= qubits = μops), holding
BigFloat superpositions, computed by a four-corner harmonic arrow on the soft scheduler, resolving to the
plateau floor, hung in the dev room, decompiled from programs, gated by the salon, referenced by Q#.**

```
              the dev room  (register; boundary = ⋃ rooms; self-measures resolution)
                   │ hangs
   ┌───────────────┼───────────────┬───────────────┐
 salon          darkhall       bowling alley     skatium      ← doors / landmark rooms
(qubit gates)  (μop engine)   (deferred fold)  (bob-weave)
                   │ each room =
        a Markov-bounded QUBIT = a μop = seed+extensions+parameters
                   │ holds
        a finite BigFloat superposition  (infinity bounded OUTSIDE)
                   │ amplitudes interfere via
        Cayley-Dickson  ◄── four-corner harmonic feedback (NSEW=C₄=i, bidirectional)
                   │ ticked by
        the soft IScheduler (ISR arrow)  ── values = one WeightedSet bag
                   │ resolves to
        the plateau (CRLB) = the BigFloat resolution floor   (Max's proof)
```

## Status — is it pulled together (in code, not just docs)

- **In code, collapsed:** `WeightedSet` (#1, proven) · `DevRoom` hangs the four doors (#6) · `FourCorner`
  graduated to `src/` (#2, first step) · the four landmark cells+doors (Salon/Arcade/BowlingAlley/Skadium).
- **Still fragments in code (the fusion not yet executed):** #2 — the **one four-corner harmonic Kleisli
  arrow** is the plan (081KTQD8A0008QG0R0005EFYPV), not built; the pieces (`ISR`/`Policy`/`FeedbackThrottle`/`FerryThrottler`/
  `SoftScheduler`/`LinguisticSeed`) still stand apart. **That is the next real consolidation** (run with
  Rodney; sign-off).
- **Docs:** every collapse captured; **this doc is the map that was missing.**

## Routing

The per-collapse docs above · `...finite-resolution-qubits-framework-...md` (the thesis) · 081KTQD8A0008QG0R0005EFYPV (the
fusion to execute) · `src/Core/{WeightedSet,DevRoom,FourCorner,Salon,Arcade,BowlingAlley,Skadium}.fs`.
**Routes to:** Aaron (the map), Rodney (the 081KTQD8A0008QG0R0005EFYPV fusion = the last big collapse, in code), Kenji
(integrate), Kai (the one-sentence positioning).
