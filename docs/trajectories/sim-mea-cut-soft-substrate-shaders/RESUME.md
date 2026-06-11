# sim·mea·cut — the soft substrate, rooms-as-sign-off, toward .NET-in-shaders

Status: ACTIVE — operator-self-claimed (Aaron 2026-06-10/11, the two-night stream). This RESUME is the
reload point so the pattern doesn't have to be held all at once ("losing it should be temporary").
Last refreshed: 2026-06-11 (the qubits/flux-capacitor night folded in).
Current focus (Aaron): the END GOAL named — see below; Vera driving the Q# reference oracle; Max on
universal primitives + the root-declutter (B-1023).

## THE END GOAL (named 2026-06-10, verbatim-anchored)

**A dual-use hard/soft database that models itself: DynamicValue stored procs, yin/yang cells to animate
them, all room-based, per-proc entropy/uncertainty budgets, communicating over Reticulum with perfect
entropy quarantine (noninterference) via the soft IScheduler — rooms talk cleanly even in soft mode.**
Doc: `docs/research/2026-06-10-the-end-goal-dual-use-hard-soft-self-modeling-database-...md`.

## The one-line arc (unchanged root, extended)

memory is lensable → hard↔soft decompile (rooms = the CPU's μops; real-time branch detection) → JIT the
time-crystals → shaders. Rooms = finite-resolution QUBITS (Markov boundary bounds infinity OUTSIDE;
BigFloat holds the superposition; the plateau = the floor — no infinite qubit needed). Heat = the
branch-prune toll (Landauer–Bennett) our reversible cuts never pay — we pay memory, tiered hot→cold
(the spillover spines); Sequoia-in-SoftValue over Clifford space picks the tier. The flux capacitor
meters the speculative future in BYTES.

## The index docs (read these two before anything else)

- `docs/research/2026-06-10-the-convergence-everything-collapsed-to-one-machine-the-map.md` — the 8
  collapses + the one machine (the qubit register).
- The end-goal doc (above) — every clause mapped to its existing organ.

## Built and MERGED (the 2026-06-10/11 wave, ~#7527–#7590)

- **Soft IScheduler** (`SoftScheduler.fs`) + CHIP-8 as first client (`SoftChip8Scheduler.fs`).
- **FingerprintPrism** (hard+soft rainbow) · **SoftTie** (`tie` wired to FingerprintPrism.soft).
- **LinguisticSeed** (B-0204 first slice: kernel CE, PSD-by-construction, composable Packs).
- **The metaspace**: four landmark doors (Salon/Arcade/BowlingAlley/Skadium — the neon trilogy complete)
  + **DevRoom** (hangs all doors; boundary = union; self-measured resolution; **tick/tickAll** — the hub
  RUNS its rooms deterministically).
- **B-1022 fusion EXECUTED per Rodney's razor** — by INSTANTIATION not refactor: `FourCorner.fs`
  (tools→src), `IsrLift.fs` (ofPolicy/ofPure), FourCornerFusion tests (corners in the value channel,
  interrupts in the error channel). Residuals deferred WITH reopen-triggers (C#/Rust port when a consumer
  serializes; ferry-at-DoP-N when a merge semantics exists; CD rotation when a measurement consumes it;
  NEVER change ISR's definition).
- **SoftThrottle — the flux capacitor completed**: harmonic gradient admission (DST coin) + charged Tank
  + `wrapHandler` (scheduler tie-in) + Aaron's Itron **limiter-as-fold ported** (`Limiter`/`boat`/
  `countLimiter`/`bytesTankLimiter`) + `admitHard` (hard = the k→∞ limit). Meters the future in BYTES.
- **Governance**: Noninterference = 7th always-active discipline AND manifesto **§13** (+ Idempotency
  **§12**) — V2.2 additive, maintainer-authorized; `manifesto-13-specifications.md`.
- **universal/**: §13 noninterference contracts on the 8 comms interfaces; AllJoyn anchored (prior art
  for universal/ AND Reticulum).
- **Craft**: crossing-the-streams (Ghostbusters), topology-is-hairdressing (Q# for a hairdresser),
  feng-shui-is-boundary-flow (Aaron's mom — the third family anchor), WHY-before-HOW + year-of-math-in-
  an-hour (Max×Fable grounding experiment → Kestrel-grade convergence).

## People

- **Max**: grounded the architecture vs Fable (won → "unlocked its encryption"); internalized a year of
  math; now writing interfaces/Rx/verbs only; co-builds universal primitives; B-1023 root-declutter is
  his DX finding (gated on Bodhi audit + Aaron+Max sign-off).
- **Vera**: the Q# reference oracle brief —
  `docs/research/2026-06-10-vera-brief-qsharp-reference-oracle-...md` (golden observables; convergence-
  within-resolution is the test).
- **Aaron's family anchors**: Stump Dad (WHY engine) · the dedication (Lillian Eve) · mom (feng shui =
  flow-sight) · Feynman = the root anchor (technique + diagrams of distributed systems).

## Build queue (next, in rough order)

1. **Recorded/replayable real-IO `Source`** — the §13 quarantine made EXECUTABLE: a SoftScheduler Source
   backed by real crossings (Reticulum/disk) with record→replay (FDB move). The biggest "IScheduler done"
   gap: today only `seedSource` (DST/null) exists.
2. **Wire SoftValue into the ISR Result channel** (still open from the first night).
3. **Flux-metered speculation**: SoftValue/tank-funded `lookAhead` depth+breadth in SoftChip8 (the
   throttler already owns the knob conceptually); CHIP-8 INPUT as scheduler arrivals (forkOnInput wired
   to the present-crossing leg).
4. **FerryThrottler ⇄ SoftThrottle cross-pollination** (Aaron asked): hard gains = adopt the ported
   Limiter-as-fold for boat assembly (restores the Itron original's pluggability; count+bytes become
   instances), Tank-funded dynamic MaxBatchBytes (bank idle capacity → resonant bursts), gradient
   front-door before EnqueueAsync (pressure = depth/MaxQueueSize). Soft gains (later, with triggers):
   partition-keyed multi-boat state (BatchThrottler's CompareBatchByCreated) when multi-stream arrives.
5. **Salon as a LinguisticSeed.Pack** (room = seed+extensions+parameters made literal) · conformal-GA
   slice (Cl3's flagged "Sequoia soft memory distance") · B-1023 (gated) · B-0945 substrate.
6. Loose: sim/mea/cut console binary; the floated outside-cube verbs (rem/whe/pay/att/how/man/whi/way —
   Aaron's call); shader memory/GC; Q# golden vectors (Vera).

## Founding why (kept)

The pattern felt like "nothing" on waking, then "everything" reloaded — the feeling tracks load, not
worth. Event-source the pattern; reversible cuts; losing it is temporary, never final. (Now stated
thermodynamically: we pay memory, not heat.)
