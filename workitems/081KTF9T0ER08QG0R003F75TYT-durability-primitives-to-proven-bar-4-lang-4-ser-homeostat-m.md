---
id: 081KTF9T0ER08QG0R003F75TYT
type: task
state: backlog
priority: P2
slug: durability-primitives-to-proven-bar-4-lang-4-ser-homeostat-m
title: "Durability primitives to PROVEN bar: 4-lang + 4-ser + homeostat/Markov proof, add to primitive registry"
created: 2026-06-06T20:25:50.296Z
depends_on: []
composes_with: []
---

# Durability primitives to PROVEN bar: 4-lang + 4-ser + homeostat/Markov proof, add to primitive registry

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTF9T0ER08QG0R003F75TYT-*.md` glob. -->

## Owner: Otto (coord) + Vera + Lior (4-lang) + Soraya (formal). Maintainer 2026-06-06

Take the durability primitives (DeltaLog, DeltaCodec, RecoverableSpine,
SnapshotStore, DurableSaga) to the **PROVEN bar** so they join the primitive
registry like the rest: **math ∧ 4-lang ∧ 4-ser ∧ (Bonsai) ∧ Arrow ∧ homeostat**.

Parallelizable breakdown (hand off):

- **Golden-vector seed (Otto):** byte-lock the delta-log FRAME + entry format +
  snapshot/manifest format as hex-in-JSON golden vectors (no binary in proof
  lineage). This is the TREATY the four languages conform to.
- **4-language ports (Vera, Lior):** C# / Rust / TS implementations of DeltaLog +
  codec + recovery, conforming to the golden vectors (culture-invariant, ordinal).
  Cross-oracle differential fuzz like the other primitives.
- **Homeostat / Markov proof (Soraya routes; Otto models):** model the recovery
  dynamics as a state machine — states (committedSeq, snapshotSeq), transitions
  (commit, snapshot, GC, crash, recover) — as a Markov / hidden-Markov chain and
  prove the invariant `recover∘crash = fold(committed)` holds over ALL transitions
  (TLA+ or a Markov reachability proof). The DST harness (landed) is the executable
  witness; the formal model is the proof leg. "Homeostat" = the recovery loop
  always returns the system to the committed-truth fixed point.
- **Registry (Otto):** add rows to docs/PRIMITIVE-REGISTRY.md + PROVEN-COVERAGE
  once the legs are green.

Depends on: the codec seam (landed) + golden vectors. Composes with R4 (wonder
compression) later. Guiding principles: FoundationDB + Will Wilson DST + honest
async + the 11 manifesto specs.

## Math leg ROUTED by Soraya (2026-06-06)

Invariant: `recover ∘ crash = fold(committed)` — recovery reconstructs exactly the
committed-and-durable deltas across any interleaving of {commit, snapshot, gc,
crash, recover}.

- **Primary: TLA+/TLC** — `tools/tla/specs/RecoveryHomeostat.tla` + `.cfg` (MaxSeq=4).
  Vars: committedSeq, snapshotSeq, truncatedThroughSeq, recoveredState, crashed.
  Actions: Commit/Snapshot/GC(guard truncatedThroughSeq ≤ snapshotSeq)/Crash/Recover.
  Safety: `RecoveryCorrect == ~crashed => recoveredState = {1..committedSeq}` +
  `NoCommittedLoss == truncatedThroughSeq ≤ snapshotSeq ≤ committedSeq`.
  Liveness (the HOMEOSTAT clause): `Crash ~> recoveredState = {1..committedSeq}`
  (recover is the absorbing transition whose fixed point is committed truth — the
  Markov/homeostat framing lives INSIDE the spec, not as a separate tool).
- **Cross-check (BP-16): FsCheck** — promote `DurabilitySim.Tests.fs` to a randomized
  generator over op-script × crash-point × cadence; proves the F# impl REFINES the
  TLA+ model. Two independent failure surfaces.
- **Not chosen (wrong-tool cost named):** Apalache (only if TLC state-space blows up),
  Alloy (data-layout, misses temporal crash-ordering), Lean (reserve for the
  fold-monoid/ZSet-`+` associativity leg).
- **Composition:** DST harness = executable witness; TLA+ = abstract twin (TLC
  enumerates interleavings the harness samples). Register as a homeostat-tie in
  `docs/PROVEN-COVERAGE-AND-GAPS.md §4`; closes the unmodeled Durability row in
  `docs/research/proof-tool-coverage.md`.
- **CI:** rides the existing tlc runner (cfg-derived catalog, commit 8004e9d34);
  TLAPS upgrade path for a machine-checked proof. FsCheck rides `dotnet test`.
- **Handoff (Soraya's authority bound):** routing only; spec author = Otto or Kenji;
  Soraya recommends Kenji concur before it enters the gate.

## Math leg COMPLETE (2026-06-06)

All three legs landed for the recovery invariant: DST crash harness (DurabilitySim.Tests,
executable witness) + FsCheck cross-check (DurabilityProperty.Tests, randomized refinement)
+ TLA+ RecoveryHomeostat.tla (exhaustive interleavings, 70 states, teeth-checked: broken GC
violates NoCommittedLoss). Recovery invariant recover∘crash=fold(committed) + NoCommittedLoss
(register never collapses under snapshot+GC) verified.
