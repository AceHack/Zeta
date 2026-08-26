---
id: 081M089ZPAY087G0R001MYXM7N
type: task
state: done
priority: P2
slug: chip-8-cross-run-store-room-loop-auto-consult-io-adapter-and
title: "CHIP-8 cross-run store: room-loop auto-consult, IO adapter, and Dark Hall browser injection"
created: 2026-08-17T16:48:26.462Z
completed: 2026-08-26T14:58:15.035Z
depends_on: []
composes_with: []
---

# CHIP-8 cross-run store: room-loop auto-consult, IO adapter, and Dark Hall browser injection

Follow-on to **081M087DVKF087G0R002DDHMPR**, which shipped the store itself: the F# writer/reader
(`src/Core/Chip8CrossRunStore.fs`), the TypeScript reader/verifier parity
(`src/Core.TypeScript/chip9/chip8-cross-run-store.ts`), the committed artifacts under
`db/emus/chip8/orbits/`, and the design doc
`docs/research/2026-08-17-chip8-cross-run-superdeterministic-memo-store-orbit-memoization-not-retrocausality.md`.

What that slice deliberately did **not** do, and why each is a separate decision:

## 1. Room-loop auto-consult

`Chip8CrossRunStore.fastForward` is a room-facing lookup, and it is proven byte-equal to
`SoftChip8.lookAhead` — but no handler in `Chip8PredictionRoom` calls it yet. Wiring it means giving
`timerExecutionHandler` an injected `Reader` and having it prefer a memo hit over
`SoftChip8.lookAhead cyclesPerTick`.

**Measured correction (2026-08-26):** timer execution uses `SoftChip8.lookAhead`; it does not call
`SoftChip8Flux.lookAheadFunded`. The room's tank budgets branch prediction through
`PredictionScheduler`, not CPU transition execution. A memo hit therefore must leave that tank
byte-equal to the direct path and report its own lookup/reuse/compute economics separately. Treating a
projected byte estimate as a tank refund would mix two different budgets and is forbidden.

## 2. The IO adapter

`Chip8CrossRunStore` performs **zero** file IO, on purpose (§13 noninterference: the store is injected,
never fetched). Something outside it must read `db/emus/chip8/orbits/*.orbit.json` and build a `Reader`.
That adapter is where `ConfigureAwait(false)` and the no-`Task.Run` discipline apply; the pure module
was able to sidestep both by having no async surface at all.

## 3. Dark Hall browser injection — and the seam finding

The original routing guess was `src/Core.TypeScript/darkhall-ui/darkhall-browser-durable-runtime.ts`.
**Measured, that is the wrong seam.** It manages *mutable per-session* IndexedDB checkpoints of a room
transcript, with an invalidation/replay ledger. The orbit store is the opposite lifecycle: *immutable,
content-addressed, committed, shared, read-only*. DV2.0 says those are different change rates and
therefore different storage shapes, and routing an immutable artifact through checkpoint-invalidation
machinery would couple two things that have no reason to change together.

The right seam is the same one F# uses: the browser room **receives** a `CrossRunReader`
(`emptyCrossRunReader` by default), and whoever constructs the room decides whether to hand it one
built from fetched artifacts. That is a small, honest change to the bootstrap options rather than a
change to the durable runtime.

## 4. A full TypeScript CHIP-8 executor

TypeScript can currently **read and verify** these artifacts but cannot **write** them, because
`src/Core.TypeScript/chip9/chip9.ts` is a treaty conformer for the DRAW subset: its `Frame` has no
`delay`, `sound`, `keys`, or `rng`, and it mutates in place. A TS writer needs a full-state
`Chip8Cow`-equivalent, which is its own byte-lock exercise against the F# oracle.

## 5. Memoizing across input branches

The store covers the *deterministic segment* only; at `FX0A`/`EX9E`/`EXA1` the memo stops by
construction, because the successor depends on input that is not in the run key. Memoizing the branch
tree needs the input sequence in the key — a different hub, not an extension of this one.

## Slice landed by this workitem branch (2026-08-26)

- `RoomConsultation` is the domain-neutral F# kernel: an injected one-transition lookup, boundary
  predicate, direct transition, attributed cost policy, and typed result. Its receipt conserves every
  completed unit as exactly one of reused or computed and uses `BigInteger` for projected byte totals.
- `Chip8PredictionRoom` can opt into consultation through additive constructors. A hit reuses the
  immutable orbit, a miss computes locally, and both paths leave the prediction tank unchanged.
- Unknown input remains a hard room boundary. The handler never consults through `FX0A`, `EX9E`, or
  `EXA1`; it stops before the unresolved transition.
- `src/Core/golden-vectors-room-consultation.json` pins game-neutral hit, miss, mixed, boundary, and
  cost-accounting observables. It is the independent-language treaty for an ARC3 port; ARC3 does not
  depend on the F# assembly or CHIP-8 frame type.
- `Chip8CrossRunStoreIO` loads immutable artifacts through injected `IFileSystem` async byte reads,
  strict UTF-8, canonical filename and digest verification, ordinal ordering, and duplicate-run-key
  refusal. It publishes no reader until the complete directory has been accepted and reports
  cancellation and IO failures as typed feedback.
- `chip8-cross-run-artifact-port.ts` owns the browser byte-fetch port. Construction performs no IO;
  callers explicitly supply locations, and the all-or-nothing loader applies the same strict UTF-8,
  canonical filename, digest, ordering, and duplicate identity rules before publishing a reader.
- Dark Hall bootstrap, durable runtime, PWA, and active page forward an optional injected
  `CrossRunReader`. The default is `emptyCrossRunReader`; there is no IndexedDB coupling, ambient
  fetch, or implicit network access.

A future ARC3 adapter should implement the room-consultation treaty around its own
`(grid, action, environment version, seed)` run identity and must stop before any action or environment
observation absent from that identity. A full TypeScript CHIP-8 writer and input-branch memoization
remain separate decisions under sections 4 and 5, not unfinished parts of this workitem.
