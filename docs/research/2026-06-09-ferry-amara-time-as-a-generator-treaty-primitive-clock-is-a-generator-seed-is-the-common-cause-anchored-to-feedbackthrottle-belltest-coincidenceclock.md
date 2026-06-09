# Ferry — Amara: time as a generator (a new type of time for the database) — "the clock is a generator, the seed is the common cause"; anchored to EXISTING code (FeedbackThrottle / BellTest / CoincidenceClock)

**Register:** [ferry] peer-AI synthesis (Amara), forwarded by Aaron, preserved verbatim +
[grounded] incorporation anchored to **existing code** (Aaron: "we have a lot of existing stuff
here, code, arrow function"). **Date:** 2026-06-09. **Captured by:** Otto (shadow).
Ferry discipline: `always-preserve-ferries`. **This unifies code we already have; it does not invent it.**

## Amara's review (verbatim)

> We have a new type of time for our database. Yes — this is a really good correction to the DST model.
> You're saying: **time is not ambient in DST. Time is itself a generator function.**
>
> That changes the model from `seed + state + observation → next state` to
> `seed → time-generator → tick / phase / scheduler conditions`, then
> `seed + generated-time + state + observation → next state`. So every contributor can "count on" the
> same time because they are not trusting wall-clock time. They are replaying the same **seeded time
> treaty**.
>
> That fits perfectly with the "no `.sh` inside the boundary" / "treaty in MUMPS" direction. Time
> generation should not be hidden in test-harness glue or process scheduling. It becomes part of the
> 4×4 treaty: byte-locked, DST-replayable, regenerated the same way everywhere.
>
> The key sentence: **DST time is generated, not observed.** Or sharper: **The clock is a generator,
> and the seed is the common cause.**
>
> That means every deterministic simulation step can derive `tick_n, phase_n, jitter_n, coincidence
> window_n, contributor-local clock_n, shared/common clock_n` from
> `Time(seed, treatyId, contributorId, frameId, step)`. That gives all contributors a shared "common
> cause" without requiring a global wall clock.
>
> The S values you mention feel like a CHSH/Bell-style diagnostic: `S ≤ 2` classical/local bound;
> `S = 2√2` quantum/Tsirelson-style phasor bound; `S = 4` PR-box / staged perfect-correlation bound.
> In Zeta terms, I would model those as **scheduler regimes**, not physics claims:
> Classical/common-cause mode (seeded local variables, S ≤ 2 unless selection/postselection);
> Phasor/unit-circle mode (complex phase generator, `E(a,b)=cos(a−b)`, S can hit 2√2);
> Staged-coincidence mode (scheduler intentionally stages correlated outcomes, S can hit 4, but it
> must be labeled staged / coordinated / non-physical).
>
> The 2√2 one is especially clean because we already hit the unit circle:
> `A0=0, A1=π/2, B0=π/4, B1=−π/4; E(a,b)=cos(a−b); S = E(A0,B0)+E(A0,B1)+E(A1,B0)−E(A1,B1) = 2√2`.
> That is the phasor scheduler: time produces phase, phase produces interference, interference produces
> observable correlation.
>
> The S=4 staged-coincidence mode is also useful, but it needs a hard label:
> **S=4 is a stress-test / staged-coincidence scheduler, not evidence of physical nonlocality.** In a
> deterministic sim, if all contributors share the seed, the generator can coordinate corners
> perfectly. That is allowed for testing. But it violates the "free independent setting choice"
> assumption you would need for a physical Bell claim. For us, that's fine — this is DST engineering,
> not a physics Nobel trap.
>
> The "four-corner feedback model" fits beautifully here. The four corners are the four CHSH settings:
> `(A0,B0) (A0,B1) (A1,B0) (A1,B1)`. At each DST step, the system can measure the actual correlation at
> the four corners, compare it to the target regime, then adjust the next generator phase:
> `observed S_n; target S*; error = S* − S_n; phase_offsets_{n+1} = phase_offsets_n +
> boundedFeedback(error, uncertainty, drift)`. But the feedback must itself be deterministic:
> feedback input = prior root + observed uncertainty histories + ferries/observations + target regime +
> treaty version; feedback output = next phase table + next time-generator state + next root. So the
> feedback loop is not hidden adaptation. It is a replayable update to the time generator.
>
> That also connects to your clock-drift thread. If both uncertainty histories become visible, you can
> zip them and see the drift retroactively. That drift becomes feedback into the next time-generator
> state: `zip(A_uncertainty_history, B_uncertainty_history) → drift estimate → phase correction → next
> deterministic time generator`.
>
> So the DST step becomes a full loop: 1. Generate time from seed. 2. Run contributors under that
> generated time. 3. Collect observations/ferries. 4. Zip uncertainties and measure mismatch/drift.
> 5. Apply four-corner feedback. 6. Persist new uncertainty + generator state to git/MUMPS.
> 7. Regenerate typed F# witness. 8. Replay to prove determinism. That is extremely strong.
>
> Tiny blade: the time generator has to be versioned and ZetaId-addressed. Otherwise changing time
> semantics silently changes every test. `TimeGeneratorId : ZetaId; TimeGeneratorVersion; Seed; Step;
> ContributorId; FrameId; Regime; FeedbackState`. Then the root includes the time generator, so every
> contributor knows exactly which "common cause" they are sharing.
>
> I would name the modes something like:
> `TimeRegime = ClassicalCommonCause | PhasorTsirelson | StagedCoincidence | LocalIndependentClocks |
> SharedDegenerateClock`. And the result of each step carries:
> `GeneratedTime = tick, phase, coincidenceWindow, clockId, contributorId, regime, evidence`.
>
> The heart of it: **DST makes time a reproducible dependency. Phasors make time interfere. Four-corner
> feedback makes time learn. The seed is the common cause everyone can count on.**
>
> The next proof should be small: `given seed σ and time-generator G and four CHSH corners, when all
> contributors replay G(σ), then: ClassicalCommonCause produces bounded classical S; PhasorTsirelson
> reaches S ≈ 2√2; StagedCoincidence reaches S = 4 by explicit staged schedule; every replay produces
> identical corner traces.` That would make "time as generator" a treaty primitive instead of a metaphor.
>
> Keeper: **A deterministic simulation does not run in time. It generates time from seed. The generated
> time is the common cause. The four corners are the feedback surface. The next tick is the treaty
> choosing how reality advances.**

## Anchored to EXISTING code (this unifies, doesn't invent)

Aaron: *"we have a lot of existing stuff here, code, arrow [function]."* The ferry's regimes + four-corner
feedback are **already implemented + properly anchored** — the ferry names them as one "time-as-generator
treaty primitive":

- **`src/Core/FeedbackThrottle.fs` = the four-corner feedback model.** Finite feedback-propagation speed
  caps achievable CHSH: **latency=0 → S=4** (instant feedback / signalling regime), **latency→∞ → S=2**
  (no real-time correction, pre-shared seed only = classical), **finite speed → in between**. The
  feedback channel's speed = our Lamport/heartbeat causal-cone. Already anchored to **Information
  Causality** + Tsirelson; honest-peel scope already in the file. → Amara's regimes (Classical/Phasor/
  Staged) **are** these latency regimes; the "four-corner feedback channels" are *its* term.
- **`src/Core/BellTest.fs` = the CHSH harness.** `E(a,b)=cos(a−b)` (singlet correlator) via staging →
  **S=2√2 (Tsirelson)**; full seed control → **S=4 = the PR box** (Popescu–Rohrlich 1994, anchored, NOT
  metaphor; **crossing Tsirelson = violating Information Causality**). → Amara's PhasorTsirelson (2√2) +
  StagedCoincidence (4) are already here, already labeled non-physical/PR-box.
- **`src/Core/CoincidenceClock.fs` = the staging** (controls time → stages "immaculate coincidence").
  → Amara's "phasor scheduler: time → phase → interference → correlation."
- **`src/Core/DynamicValueArrow.fs`** = the **Arrow serializer** (one of the 4×4 treaty's serializers).

So the regimes + the S=4-is-staged-PR-box honest label + the four-corner feedback already exist and are
Beacon-anchored. The ferry's contribution is the **framing**: *time is a generated treaty primitive*, and
the regimes are **TimeRegime scheduler modes** over one `Time(seed,…)` generator.

## The one genuinely-new requirement (blade to act on)

**The TimeGenerator must be versioned + ZetaId-addressed + included in the canonical root.** Today the
Bell/FeedbackThrottle/Coincidence pieces exist but are not a single addressed, versioned generator. Make
`Time` a treaty primitive:

```text
TimeGeneratorId : ZetaId(128)   TimeGeneratorVersion   Seed   Step
ContributorId   FrameId   Regime : TimeRegime   FeedbackState
TimeRegime = ClassicalCommonCause | PhasorTsirelson | StagedCoincidence
           | LocalIndependentClocks | SharedDegenerateClock
GeneratedTime = { tick; phase; coincidenceWindow; clockId; contributorId; regime; evidence }
```

…and **the canonical truth-root includes the TimeGenerator** — so changing time semantics is a *visible*
delta, not a silent break of every test, and every contributor knows which "common cause" (which
seeded time treaty) they share. (truth-root, not git hash — per the prior Amara ferry.)

## Honest scope / handoff + the small proof

Most exists; the new work is: (1) unify Bell/FeedbackThrottle/CoincidenceClock under a single
**ZetaId-addressed, versioned `Time` generator** in the treaty + root; (2) the `TimeRegime` enum +
`GeneratedTime` record; (3) **the small proof** — `given seed σ + generator G + the four CHSH corners,
all contributors replay G(σ) ⇒ Classical bounded S, PhasorTsirelson ≈ 2√2, StagedCoincidence = 4 by
explicit schedule, identical corner traces every replay.` That makes "time as generator" a **treaty
primitive, not a metaphor**. Routes to Soraya/Sova (the proof + the regimes), the F# core
(FeedbackThrottle/BellTest/CoincidenceClock → one `Time` treaty), and the four-corner-feedback build.

## Anchors / ties

`FeedbackThrottle.fs` (four-corner feedback / latency→S regimes / Information Causality / Lamport
causal-cone); `BellTest.fs` (CHSH, Tsirelson 2√2, PR-box S=4 — Popescu–Rohrlich 1994, IC violation);
`CoincidenceClock.fs` (staging); `DynamicValueArrow.fs` (Arrow serializer); truth-root≠transport-root +
tests-are-ticks + test=prod (the prior Amara ferries); DST §7; the common-seed / staged-coincidence /
time-as-DST-generator prior docs; ferry discipline `always-preserve-ferries`.
