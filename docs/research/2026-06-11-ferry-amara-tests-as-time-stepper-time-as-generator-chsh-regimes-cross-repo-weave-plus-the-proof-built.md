# Ferry (Amara ↔ Aaron) — tests as the time-stepper; time as generator (CHSH regimes); the cross-repo weave — AND the named proof, built

> **Ferry discipline:** Aaron passed two Amara analyses. Preserved as hers; the substance is kept whole
> below (her structure and keepers verbatim); the peel + the BUILT proof follow.

## Amara, part 1 — the deterministic tick (tests as the time-stepper)

Her loop: `git root Rₙ + MUMPS scoped state Sₙ + observations/ferries Oₙ + treaty reducer → Δₙ → Uₙ₊₁
→ regenerated F# types Tₙ₊₁ → Rₙ₊₁`. Not run-check-discard but: read the world, fold observations,
reduce uncertainty, persist, regenerate types, compile/replay, advance time one proven step.

Her operational splits and blades, kept:

- **Replay tests vs advance tests** — replay proves determinism (write nothing); advance evolves the
  world (write the next state to a branch). 
- **Truth root ≠ transport root** — assert over the Zeta canonical root / treaty bytes, never the raw
  git commit hash (commit metadata is where nondeterminism sneaks in).
- **The 1000× bar** generalized to type regeneration once load-bearing.
- **Mutation disciplines declared per cell** (single-writer | CRDT/ZSet | RX-observed pair | CAS/Raft |
  BFT) — tests writing back to git are treaty-typed transitions, not random writes.
- **Ferries remain observations, not commands** — provenance/frame/scope/ZetaId; the reducer decides;
  "pasted text never becomes authority."
- **Generated F# types are materialized views** of the treaty state, never the source of truth.
- Her keeper: *"Every deterministic test is a tick … every regenerated type is the compiler witnessing
  the next state of the world."*

## Amara, part 2 — time as a generator function (the CHSH regimes)

Aaron: *"in our DST step time is a generator function too — we can make whatever we want for all
contributors to count on, from seed common cause; allow possible S=2√2, maybe S=4 staged coincidence;
and we have a four-corner feedback model for adjustments over time."*

Amara: **"DST time is generated, not observed. The clock is a generator and the seed is the common
cause."** Regimes as SCHEDULER modes, not physics claims: ClassicalCommonCause (S≤2) ·
PhasorTsirelson (E=cos(a−b), S=2√2 — the unit circle we already live on) · StagedCoincidence (S=4,
hard-labeled staged/non-physical — the free-choice assumption deliberately violated by the shared
seed). The four CHSH corners as the feedback surface; feedback itself deterministic and replayable;
her tiny blade: **the generator must be versioned and ZetaId-addressed** so time semantics never change
silently. Her keeper: *"A deterministic simulation does not run in time. It generates time from seed.
The generated time is the common cause. The four corners are the feedback surface."*

## Amara, part 3 — the cross-repo weave

Once the first cross-repo stream is woven, the stream stops being the primitive: **the primitive
becomes a causal fabric** — state = a fold over a chosen causal cut. Her stack kept clean: DBSP =
change propagation · ZSet = signed multiplicity · banana split = ONE law (fold-fusion), not the engine
· CRDT/CALM = when coordination is avoidable · the weave = the fabric of causal time. Her peel of the
overclaims kept: not consciousness, not resurrection — *preservation*; "we can address, replay, fork,
merge, and fold causal histories" is already enormous. Her keeper: *"A stream is a local worldline. A
weave is a causal fabric. A state is a fold over a chosen cut through that fabric."*

## THE PROOF, BUILT (Aaron: "what's next — please continue")

Amara named it: *"the next proof should be small … that would make 'time as generator' a treaty
primitive instead of a metaphor."* It is now `src/Core/TimeGen.fs` + 6/6 green tests:

- **Replay**: same seed ⇒ identical corner traces and instants; distinct contributors get distinct,
  individually-replayable local clocks from ONE common cause.
- **Classical**: the seeded hidden-variable scheduler stays inside S ≤ 2 (4096 deterministic samples).
- **Phasor**: the unit-circle scheduler reaches S = 2√2 exactly (analytic; the corner angles 0, π/2,
  ±π/4).
- **Staged**: S = 4 by explicit staged schedule — and the LABEL is part of the value
  ("STAGED … free-choice violated BY DESIGN; not physical") so the result can never masquerade.
- **Versioned + addressed** (her blade): Generator carries Id/Version/Seed/Regime; a different seed is
  a different common cause, visibly.
- **Feedback**: deterministic, bounded (clamped), replayable — the four-corner adjustment as a pure
  function.

Honest scope: float correlations stay outside the byte-lock treaty (per the exact-valued rule); the
STRUCTURE is the treaty surface; fixed-point phases = the named slice for cross-oracle goldens.

## Pointers

- `src/Core/TimeGen.fs` + `tests/Tests.FSharp/TimeGen.Tests.fs` (the proof) · `SimLoop` (the
  generator-clock consumer already built) · the Bell/qubits docs (the unit circle lineage) · CHSH
  (Clauser-Horne-Shimony-Holt 1969) · Tsirelson 1980 (the 2√2 bound) · Popescu-Rohrlich 1994 (the S=4
  box — the staged regime's honest name) · Amara's replay/advance split → the rooms/tests observation
  already live in rooms/README.
