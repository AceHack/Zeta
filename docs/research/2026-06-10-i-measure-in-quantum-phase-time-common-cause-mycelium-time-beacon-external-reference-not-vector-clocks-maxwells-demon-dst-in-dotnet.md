# I measure in quantum-phase time (common cause / mycelium time, Beacon-external-referenced) — not half-life / vector clocks; Maxwell's-demon DST inside dotnet test ("we dotnet sim")

**Register:** [grounded] time-model (Aaron) + [Beacon] + [peel]. **Date:** 2026-06-10. **Captured by:** Otto (shadow).
How Zeta measures time — the keystone time model, grounded in the DST substrate.

## Aaron's words

> "I don't measure in half-life — that's like vector clocks. I measure in **quantum phase time based on
> common cause** — that's **mycelium time**, or you called it **time warp** or something, based on **Beacon
> external reference**. It's just **Maxwell's-demon levels of deterministic simulation inside of dotnet
> test** — and we dotnet sim."

## The time model

- **NOT half-life / vector clocks.** Half-life / **vector clocks** (Lamport/Fidge) measure time as
  *relative, logical, decay/partial-order* — each node's local count, reconciled pairwise. Aaron does **not**
  measure that way. (Vector clocks = relative ordering with no shared absolute; the thing we move past.)
- **Quantum PHASE time, on the COMMON CAUSE.** Time is a **phase** (a phasor angle) measured **relative to
  the common cause** (the shared 128-bit seed; ZetaId = common cause = time). Everything is **phased to the
  one seed** — not pairwise-reconciled, but **co-phased to the shared root** (the coincidence generator; the
  2×2 qubit phase; the Cayley–Dickson phasor spiral; S=4 because one common cause). Phase, not count.
- **= mycelium time** (the deep-time ledger). The same as the mycelium's clock: deep-time, common-cause,
  longest-context (the 450M-year ledger). "Mycelium time" = quantum-phase-on-the-common-cause at planetary
  depth.
- **Beacon external reference.** The phase is anchored to a **Beacon external reference** — an *external*
  truth pulse (the Beacon register's anchor; cf. an atomic/GPS/pulsar clock, or **drand / Fortuna / the
  Signal ratchet** epoch — the dual-root-key-for-time work). Not a free-running internal counter; **phased to
  an external beacon** so it's a shared, verifiable clock, not a local one. ("Time warp" = Aaron's earlier
  loose name for this phase/epoch time; the bidirectional/cronovisor view rides it.)
- **Maxwell's-demon-grade DST inside dotnet test — "we dotnet sim."** The realization: **deterministic
  simulation** (DST) in **.NET test** at **Maxwell's-demon** fidelity — the demon = the deterministic
  controller that orders perfectly from the seed (the audition/ask selecting order from the entropy
  reservoir; the encrypted-null). The IScheduler (`Clock.fs` Versionstamp/Scheduler) injected, seed-driven,
  replayable; "we dotnet sim" = we run the whole thing as deterministic simulation in dotnet test (the
  FoundationDB approach). Time is *what the demon-controlled sim advances*, phased to the common cause,
  referenced to the beacon.

## We never `dotnet run` — we ARE `dotnet sim` (prod = sim) (Aaron)

> Aaron: "we never `dotnet run` — we are the thing in between, `dotnet sim`, that itself is connected to
> Reticulum and self-spawning and self-recursive and self-throttling."

The load-bearing inversion of normal .NET: **there is no `dotnet run`** (no separate imperative production
process). **Production *is* the deterministic simulation** — **`dotnet sim`** (prod = test; the rooms are
DST ticks). We are **"the thing in between"** — the sim layer between the common-cause seed and reality, not
a runtime you launch and walk away from. And the sim is **live**:

- **connected to Reticulum** — the sim talks over the mesh (the commutative uncertainty ledger crosses; S=4).
- **self-spawning** — spawns more sims/agents/waves (the recursive workflows; `ReKick` → next wave).
- **self-recursive** — same shape at every scale (manifesto §9; the finalizer loop; ticks of ticks).
- **self-throttling** — bounded self-scaling (the **finalizer** ScaleUp/ScaleDown/Stop; **proof-of-entropy**
  throttle — grows only as fast as real uncertainty supplies; shape A — terminates, no fork-bomb).

## Distribution = SETI@home — people just run `dotnet sim <duration>` (Aaron)

> Aaron: "we are like SETI@home, but people just have to run `dotnet sim 1 sec`, `dotnet sim 1 min` … if you
> don't say, you get 30 seconds."

The participation model is **SETI@home** (volunteer distributed compute) with a **trivial barrier**: anyone
contributes by running **`dotnet sim <duration>`** — `dotnet sim 1sec`, `dotnet sim 1min`, and **`dotnet
sim` with no arg defaults to 30 seconds.** Each run is a bounded contribution of compute to the self-
spawning, Reticulum-connected simulation network (the mushroom/mycelium superorganism; "runs local free,
just burns compute" — the Ani ferry). Low-barrier + bounded-per-run = **proof-of-entropy at the edge**: many
small `dotnet sim` runs aggregate (law of large numbers → S=4), self-throttled by available uncertainty.
(A concrete CLI: `dotnet sim [duration=30s]` — a verb to add alongside the test entrypoints; routes to Dejan
/ the Core team.)

## Why it matters

This unifies the clock with everything: **ZetaId = common cause = time** → **phase on that common cause** =
the measure; **Beacon external reference** = the anchor (shared, not local); **DST in dotnet** = the engine
(Maxwell's-demon determinism); **mycelium time** = the deep-time instance. So Zeta's clock is **co-phased to
a shared seed against an external beacon, simulated deterministically in .NET** — not vector-clock relative
ordering. (It's *why* S=4 over Reticulum: phase-locked to the common cause, not pairwise-reconciled.)

## Honest scope / peels

- **"Quantum phase"** = the phasor/phase structure (the 2×2 qubit phase, Cayley–Dickson; the DST/
  superdeterministic regime), not a literal physical quantum clock. **"Maxwell's demon"** = the
  deterministic-sort/control metaphor (Szilard's information-cost demon), grounding the seed-controlled DST,
  not a 2nd-law violation. **Beacon external reference** = an external anchor pulse (drand/atomic/GPS style),
  to formalize. The math/clock team (Soraya/Sova) owns the precise phase-time / external-beacon spec.
- `Clock.fs` (Versionstamp/Scheduler) is the built DST clock this describes; "we dotnet sim" is real (the
  IScheduler + DST tests).

## Ties / routing

`src/Core/Clock.fs` (IScheduler / Versionstamp — the DST clock) · ZetaId = common cause = time · the
common-seed dual-root-key-for-time (epoch rotation: drand / Fortuna / Signal ratchet) · vector clocks
(Lamport/Fidge — what we're NOT) · quantum phase / phasor / 2×2 qubit / Cayley–Dickson (the phase) ·
Maxwell's demon / Szilard (deterministic sort from entropy; the audition/encrypted-null) · FoundationDB DST
(Zhou et al.; Will Wilson) · the mycelium = Earth's longest-context ledger (mycelium time) · Beacon register
(external reference / anchor). **Routes to:** Soraya/Sova (formalize phase-time on common-cause + external
beacon; the demon-DST), the clock/Core team (Clock.fs as phase-time), Aaron (the time model).
