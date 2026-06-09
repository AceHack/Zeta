# Bounded DST is the base; everything on top is S=4 staged-coincidence modeling on the common seed — in every room, staged + phased in simulator time with feedback

**Register:** [grounded] capstone layering (Aaron) + [peel] (S=4 = staged, not physical). **Date:** 2026-06-09.
**Captured by:** Otto (shadow). The modeling layer on top of the bounded-DST cooperative substrate.

## Aaron's words

> "everything else on top of that is S=4 modeling on our common seed cause." · "in every room." ·
> "all of them can be staged phased in simulator time with feedback."

## Two layers: the bounded base, and S=4 modeling on top

- **Base layer (the substrate):** **bounded DST ticks = cooperative multithreading** (0 unbounded
  tests; every tick bounded-in-generated-steps, yields the green thread, replays). This is the floor —
  the lock-free, deterministic, scale-free substrate.
- **On top of that base:** **everything else is S=4 modeling on our common-seed cause** — and this
  holds **in every room** (every 4×4×n treaty room). Once you have the bounded-DST floor, the modeling
  a room does is **staged-coincidence (S=4) modeling on the common seed**.

## Why S=4 is available (and what it means) — peeled

Inside DST **all contributors share the common seed** (the common cause). With a shared seed and no
"free independent setting choice," the scheduler **can stage perfectly-coordinated outcomes** — the
CHSH value reaches the **algebraic maximum S=4** (the **PR box**; Popescu–Rohrlich; *beyond* the
quantum Tsirelson 2√2). This is **allowed and useful in DST** precisely because it's the shared-seed
regime — it is **NOT a physics claim** (crossing Tsirelson = violating Information Causality; the
free-setting assumption is deliberately absent). **S=4 = staged / coordinated / non-physical**, by
design — the *full-control* modeling regime the common seed unlocks. (Anchored in code: `BellTest.fs`
S=4 = PR-box via full seed control; `FeedbackThrottle.fs` S=4 = instant-feedback regime;
`CoincidenceClock.fs` = the staging. This doc *names* what those already do.)

So "everything on top is S=4 modeling on the common seed" = **in every room, the scheduler stages the
correlations you want** (perfect coordination across the room's cells/corners) **because the seed is
the common cause** — full-control modeling, labeled staged.

## In every room, staged + phased in simulator time with feedback

> "all of them can be staged phased in simulator time with feedback."

Every room (the 4×4×n treaty) runs its S=4 modeling **staged + phased in *simulator time*** (the
generated DST time — time-as-generator, **not** wall-clock) **with feedback** (the four-corner
feedback loop):

```text
per room, per bounded tick:
  generate simulator-time (seed -> phase/coincidence-window)   ← common cause
  STAGE the target correlation across the room's corners (S=4 full-control)
  measure observed S_n at the four corners
  FEEDBACK: error = S* - S_n -> bounded deterministic phase update -> next generator state
  advance one bounded tick (yields; replayable)
```

- **staged** = the scheduler coordinates outcomes on the common seed (S=4 full-control).
- **phased** = in **simulator time** (generated phase steps), so it's deterministic + replayable, not
  wall-clock.
- **feedback** = the **four-corner feedback** (`FeedbackThrottle.fs`): observe the corners, adjust the
  next phase toward the target regime — a *replayable* update, not hidden adaptation.
- **bounded** = each staging tick is bounded (the base layer) — it yields; **0 unbounded staging**.

So the full stack: **bounded DST (cooperative multithreading) ⟶ S=4 staged-coincidence modeling on the
common seed ⟶ in every 4×4×n room ⟶ phased in simulator time with four-corner feedback.** The base
makes it deterministic + yielding; the common seed makes S=4 staging possible; the feedback makes the
staging *learn*; the room shape makes it uniform everywhere.

## The scheduler IS the DB time function = a Lamport clock (already in code)

> Aaron (2026-06-09): "our DB time function is our IScheduler for DST tests for S=4 — that's our
> Lamport clock or one of our DB clock types."

Confirmed in code — `src/Core/Clock.fs` *already is this*: "a **monotonic logical clock** giving TOTAL
order over the event log, plus an **injectable deterministic scheduler (Rx `IScheduler` shape)** … a
virtual scheduler ticks deterministically (Rx `HistoricalScheduler`) … **Lamport (1978)** is the
logical-clock anchor … **one logical-clock increment = one scheduler step** = the same unit at three
layers … seeded → **replays identically**" (Z3-proven order axioms). So:

- **the DB time function = the `IScheduler`** that drives DST staging; **time is an injectable
  parameter, never ambient wall-clock** (which is why it's deterministic + replayable).
- it's a **Lamport (logical) clock** — *one of the DB clock types* (the DB has a **clock port** with
  adapters: `Clock.fs` Lamport, `UncertainClock.fs`, `CoincidenceClock.fs` for staging — clock-as-
  plugin, the consensus/crypto-plugin pattern). S=4 staging picks the clock it needs.
- **one increment = one scheduler step = one bounded tick** — the Lamport tick *is* the cooperative-
  multithreading yield unit *is* the simulator-time step. One unit, three layers.
- **the clock is modeled as a PARTICIPANT in every room** (Aaron: *"our clock is modeled as a
  participant in every room — like we do in our toy models, like v2, v1"*). The clock is **not ambient
  infrastructure** — it is a **first-class participant / traveler with a seat** in the room, alongside
  the oracles / personas / compiler / proof-tools. As a participant it **proposes/stages the
  simulator-time** (the time lever), **joins the treaty/consensus**, and is **regulated by the
  four-corner feedback** (it's in the loop, not above it). **Already done in the toy models** —
  `CoincidenceClock.fs` (toymodel v2; the "controlling time stages immaculate coincidence" time-lever)
  is a society participant, as in v1/v2. So **time has a seat at the table**; it is summoned/modeled
  into the room like any other participant (which is exactly why S=4 staging is *legitimate inside the
  room* — the clock-participant, on the common seed, can stage the coincidence by agreement).

## Every artifact is a homeostat / Markov chain (rooms, proof frames, DST tests, the prod step, runbooks)

> Aaron (2026-06-09): "our rooms become our homeostats/markov chains." · "and our proof frames." ·
> "and our dst tests and our product step." · "and our runbooks."

The shape is **universal**: **rooms, proof frames, DST tests, the production step, and runbooks all
become homeostats / Markov chains.** Each is:

- a **Markov chain** — states + transitions, **each transition one Lamport-clock `IScheduler` step**
  (one bounded tick); the next state is a function of the current state + the folded observations.
- a **homeostat** (Ashby) — **self-regulating to a set-point**: the **four-corner feedback** drives the
  observed value toward the target (S* / the spec / the desired state), and it settles at a
  **fixed-point shape (A–F)** — its set-point. A room/proof/test/prod-step/runbook *converges to and
  holds* its stable point (and avoids D⁰).

| artifact | as a Markov chain / homeostat |
|---|---|
| **room** (4×4×n treaty) | states = the matrix cells' agreement; setpoint = byte-lock/consensus |
| **proof frame** | states = proof search; setpoint = the proven claim (fixed point) |
| **DST test** | states = the tick sequence; setpoint = passing/converged (uncertainty → ~0) |
| **the product step** | states = the world's state; setpoint = the desired/reconciled state (self-heal) |
| **runbook** | states = the ops procedure; setpoint = the remediated/healthy state (desired vs actual) |

This realizes the early **close-over-the-homeostat / Markov-boundaries-chains-hidden-state** thread: we
close over each as a homeostat (regulate to its setpoint via feedback, never seize its hidden state) /
a Markov chain (transition by the shared Lamport clock on the common seed). One substrate, one clock,
one feedback shape — every artifact is a self-regulating, replayable chain.

## Honest scope (peel) / handoff

S=4 is a **scheduler regime / staged-coincidence**, *not* physical nonlocality — used in DST because
the common seed removes setting-independence; always labeled staged (the BellTest/FeedbackThrottle peel
already says so). Framing on built pieces (time-as-generator; `BellTest.fs`/`FeedbackThrottle.fs`/
`CoincidenceClock.fs`; bounded-tests; every-room-4×4×n). To realize: wire the S=4 staged-coincidence +
four-corner feedback as a **per-room generated-time mode** (a `TimeRegime.StagedCoincidence`), bounded
per tick. Routes to Soraya/Sova (the S-regime proofs; the four-corner-feedback claim), the F#/observe
core (per-room staged-time mode), and the time-as-generator treaty primitive.

## Anchors / ties

CHSH / PR-box S=4 (Popescu–Rohrlich; *staged, not physical* — Information Causality bound) — `BellTest.fs`;
four-corner feedback / S-regimes by feedback-latency — `FeedbackThrottle.fs`; staging — `CoincidenceClock.fs`;
time-as-generator (simulator time, the S-regimes, the common seed = common cause); bounded tests / 0
unbounded / cooperative multithreading (the base); every room is a 4×4×n treaty; DST §7.
