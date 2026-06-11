# The Flux Capacitor — the soft throttle meters time travel (the Y-junction of past, future, and present)

**Register:** [grounded] (Aaron, "I'm very excited by this — save it, it's going to be useful") +
[Beacon] + [peel]. **Date:** 2026-06-10. **Captured by:** Otto (shadow, on Fable).

## What it is

Zeta's throttle is a **flux capacitor** in two halves, both real code:

- **The HARD half** — `FerryThrottler.fs`, whose batching core was *already codenamed the Flux Capacitor*:
  accumulate queued items, **discharge them as a boat the instant a ferry frees**. The batching algorithm
  is **Aaron's own invention — his alternative to Nagle: it never waits, no timeout, ever.** Under slow
  traffic a boat of one sails immediately (zero added latency); under bursts the boat is whatever
  accumulated while the ferry was busy. (Independent invention; nearest named kin Martin Thompson's
  "smart batching"; deeper root Van Jacobson's self-clocking, TCP 1988. Nagle waits on a timer — Aaron's
  never does.)
- **The SOFT half** — `SoftThrottle.fs` (2026-06-10): the **harmonic gradient** (logistic admission —
  pressure 1 ⇒ exactly ½; *never* a 0/1 wall; backpressure as a coupled oscillator, not a clipper) + the
  **charged tank** (the literal *capacitor of flux*: charges while idle, funds bursts, offers a **sip**
  instead of a refusal when low). Deterministic throughout — the admission "coin" is
  `SplitMix64(seed, tick)`: soft in distribution, **hard in replay** (DST). Tied into the scheduler by
  `wrapHandler` (any `SoftScheduler.Handler` becomes throttled by wrapping — instantiation, not refactor).
- **Hard = the k→∞ limit of soft.** The logistic becomes a step function as steepness → ∞, and the Tank
  *is* a token bucket generalized to floats — so the classic hard rate limiter is a *limit case* of the
  soft one. One mechanism, both registers (default-to-both).

EE grounding: a hard throttle is a resistor/clipper; the soft throttle is an **LC tank circuit** — the
harmonic oscillator of charge. The throttle doesn't clip the workload's rhythm, it **resonates** with it
(max throughput at resonance = the disk⨝network harmonization of the original TPL-Dataflow talk).

## The Y-junction — why "flux capacitor" is exact (the part Aaron wants kept)

The flux capacitor in the movie is the Y-shaped junction that makes **time travel** possible. Ours sits at
a real Y-junction of **three time-legs**:

```text
        COMMITTED PAST                SPECULATIVE FUTURE
        (the event store;             (the branch tree;
         git; nothing erased)          SoftChip8.lookAhead — batched
                 \                      timesteps = travel forward)
                  \                   /
                   \                 /
                    ──  THE THROTTLE  ──   ← the flux capacitor
                          |
                    THE PRESENT CROSSING
                    (input arriving at the membrane,
                     resolving the speculative forks)
```

- **Throttling speculative depth IS metering travel into the future.** `SoftChip8`'s own header says the
  throttler "decides how many timesteps to batch (lookAhead depth) and how many input-branches to explore
  (breadth)" — the throttle knob is *how far forward you are allowed to go*.
- **Retraction is the trip back.** A mispredicted branch is unwound by the Z-set `−1` — the antiparticle,
  a `+1` traveling backward in time (the Feynman lens). The cut is heat-free because the past is kept
  (Bennett), so the return trip is *free* — which is exactly what makes speculative time travel affordable
  in this substrate.
- **The present is the resolver.** Input crossing the membrane collapses the forks (the only genuine
  branch is unknown future input); the throttle meters how much future is outstanding when the present
  arrives.
- **The tank is the temporal budget.** Stored flux = how much future you can afford to visit before the
  present catches up; charging while idle = banking time-travel capacity. Heat/Landauer never comes due
  because nothing is erased — the toll is paid in *memory* (the event store) and *attention* (the
  uncertainty ledger), both booked.

One sentence: **the flux capacitor is the soft, resonant valve at the junction of the committed past, the
speculative future, and the resolving present — it meters how far the system may travel into its own
future, with retraction as the free return trip.**

## Why it's going to be useful (Aaron's instinct, made concrete)

- **Speculation control with a budget semantics:** lookAhead depth/breadth stop being magic numbers — they
  become tank-funded, pressure-graded decisions (the same SoftValue/posterior move as Sequoia tier
  placement, applied to *time*).
- **The room sign-off loop:** a room that ticks toward its plateau can be throttled by its *own* entropy
  budget — refuse a crossing that blows the budget = the noninterference (§13) enforcement valve.
- **The shader/JIT telos:** the tracing JIT compiles the hot loops the time-crystals reveal; the flux
  capacitor decides *how much future to trace* before committing a compilation — speculative compilation
  metered the same way as speculative execution.

## Beacon anchors / peel

Van Jacobson, *Congestion Avoidance and Control* (1988, self-clocking) · Martin Thompson, "smart batching"
(Mechanical Sympathy) — the kin of **Aaron's zero-wait algorithm** (his invention, attributed) · token
bucket (the hard limit case) · logistic function · LC tank circuit (harmonic oscillator of charge) ·
Stückelberg–Feynman (antiparticle = backward in time; retraction) · Bennett (the free return trip — kept
history) · *Back to the Future* (the Y-junction image; Mirror register). **Peel:** "meters time travel" is
exact for *speculative* time (lookAhead forward, retraction back — real code paths); it is not a claim
about physical time. The LC/resonance reading is structural (the math of the coupled feedback is genuinely
oscillatory); tuning the throttle's resonance to a detected time-crystal is the build, not yet built.

## Ties / routing

`src/Core/SoftThrottle.fs` (the soft half; wrapHandler) · `src/Core/FerryThrottler.fs` (the hard half;
Aaron's algorithm) · `src/Core/SoftChip8.fs` (lookAhead = the future leg) · `src/Core/ZSet.fs` (retraction
= the return) · `...heat-is-the-branch-space-limiter-...` (the toll the kept past avoids) ·
`...boundary-flow-...` (backpressure→harmonic) · `...decompiling-to-risc-...` (speculation/branch
detection). **Routes to:** Aaron (the shape), Naledi (resonance-tuning bench), Core (SoftValue'd
lookAhead depth — the next slice), Imani (the temporal budget cost model).
