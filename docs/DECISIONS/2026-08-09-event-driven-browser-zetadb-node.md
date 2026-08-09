# ADR: Event-Driven Browser ZetaDB Node

Date: 2026-08-09
Status: DECIDED
Author: Aaron (operator) + Vera (OpenAI Codex)

## Decision

ZetaDB is a durable event-sourced state machine, not a continuously resident
browser process. Every browser tab, dedicated or shared worker, service-worker
event, local process, cloud process, and scheduled GitHub Actions run is a
temporary executor of the same bounded database tick:

1. load a durable image;
2. admit a bounded prefix of new signed deltas;
3. consolidate materialized rows;
4. persist the next revision; and
5. return a continuation or exit.

No executor owns the database merely because it remains alive. An open tab may
keep advancing the browser replica, but a terminated tab or worker cannot erase
state already persisted by the database port.

## Browser Topology

Tabs on one origin share an IndexedDB-backed image through
`BrowserCheckpointPort`. Revision-checked writes serialize competing tab wakes;
a losing writer receives typed backpressure and must reload before retrying.

A service worker may run the same finite message handler and use `waitUntil()`
for that event. It is not a continuous database owner. Dedicated and shared
workers are optional execution and coordination adapters, not correctness
requirements.

IndexedDB is a same-browser replica, not global cross-device storage. Git-native
journals and checkpoints provide the first repository-wide exchange surface.
Reticulum, local, and cloud adapters can implement the same `ZetaDbImagePort`
without changing the fold.

## Scheduled Node

`.github/workflows/zetadb-scheduled-node.yml` wakes twice per hour and whenever
the repository journal changes. It folds `data/zetadb/journal.json` through the
same TypeScript kernel and commits `data/zetadb/checkpoint.json` only when the
checkpoint changes. Replaying the same event identifiers is an idempotent no-op.

This scheduled executor improves availability; it is not a leader and does not
change database arithmetic.

## Retention And Backpressure

The first image retains its complete event ledger. It has no compaction or
forgetting policy. Reaching the configured entry or byte budget returns
`database-capacity-exhausted` with the exact next input index. No event is
silently dropped to make room.

Segmented logs, snapshots, and explicitly observable compaction are later
storage adapters. They must preserve restart equivalence before replacing the
bounded full-ledger image.

## Procedure Boundary

The first procedure plug-in owns a byte-in/byte-out WASM ABI:

- `memory`
- `zeta_alloc(length)`
- `zeta_execute(pointer, length)`
- `zeta_result_pointer()`
- `zeta_result_length()`
- optional `zeta_dealloc(pointer, length)`

F#, C#, TypeScript, Rust, Go, Q#, the project IR, parser-generated languages,
and other compilers may eventually target this boundary or another owned
procedure port. That compiler pipeline is not implemented by this ADR.

Native browser WASM does not provide a portable instruction-fuel mechanism.
The current plug-in is therefore explicitly `trusted-cooperative`, enforces
memory and output bounds, and is not wired into automatic database ticks.
Executing untrusted or potentially non-terminating procedures requires a
metered host adapter first. English specifications remain compiler inputs, not
directly executable stored procedures.

## Consequences

- Database state survives when every executor sleeps.
- Any compatible executor can resume the same deterministic fold.
- Browser lifecycle events affect availability, not correctness.
- Cross-device convergence still requires a journal replication adapter.
- The initial full-ledger image is bounded and honest, but not yet suitable for
  an unbounded production history.

## Implemented Surface

- `src/Core.TypeScript/zetadb/zeta-db-node.ts`
- `src/Core.TypeScript/zetadb/scheduled-node.ts`
- `src/Core.TypeScript/zetadb/wasm-procedure-plugin.ts`
- `src/Core.TypeScript/browser-node/browser-zetadb-image-port.ts`
- `src/Core.TypeScript/browser-node/browser-zetadb-wake-runtime.ts`
- `.github/workflows/zetadb-scheduled-node.yml`
