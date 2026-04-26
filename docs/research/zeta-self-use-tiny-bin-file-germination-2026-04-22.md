# Zeta self-use — tiny-bin-file germination step

**Date:** 2026-04-22
**Status:** Research sketch — not a design commitment
**Triggered by:** Aaron auto-loop-39 directive
**Composes with:** `memory/project_zeta_self_use_local_native_tiny_bin_file_db_no_cloud_germination_2026_04_22.md`

## Framing

Aaron, 2026-04-22 auto-loop-39:

> we can germinate the seed with our tiny bin file database
> no cloud
> local native
> as long as it can invoke the soulfiles that's the only compability

Three hard constraints, one soft compatibility bar:

- **No cloud.** Local only. No SQLite/LMDB/DuckDB dependencies
  that would pull us toward a foreign substrate.
- **Local native.** The DB runs in-process, reads and writes
  directly on the user's filesystem, and produces files the user
  can look at with `file`, `xxd`, or a hex editor.
- **Germinate don't transplant.** Start small. Do not attempt
  to replace `git+markdown` overnight; grow the substrate
  alongside, let the factory pick what moves when moving is
  cheap.
- **Soulfile invocation is the compat bar.** The only ingress /
  egress contract the seed must honour is the soulfile invocation
  protocol (see `docs/BACKLOG.md` row #241 — soulsnap / SVF).

## What we already ship that composes

Zeta already has the pieces a tiny-bin-file DB needs; the
germination work is an integration seed, not new-primitive work.

| Piece | Location | Role in the seed |
|---|---|---|
| `ZSet<'K>` | `src/Core/ZSet.fs` | The fundamental record set. |
| `ArrowSerializer` | `src/Core/ArrowSerializer.fs` | Arrow IPC round-trip for a `ZSet` → `byte[]`. |
| Generic `Serializer` surface | `src/Core/Serializer.fs` | Abstract serializer interface the seed plugs into. |
| `DiskBackingStore` | `src/Core/DiskSpine.fs` | Existing on-disk spine — a Spine IS already a local-native bin file. |
| `BalancedSpine` | `src/Core/BalancedSpine.fs` | In-memory spine with size-doubling levels. |
| FastCDC | `src/Core/FastCdc.fs` | Content-defined chunking for deduplication across snapshots. |
| Merkle | `src/Core/Merkle.fs` | Integrity verification over bin-file spans. |

The seed is not "write a new database". The seed is "compose the
pieces we have, with one narrow public API (soulfile invocation),
and call that the factory's first self-used store."

## First germination step (proposed, not yet committed)

A single F# module `src/Core/SoulStore.fs` that exposes:

```fsharp
module Zeta.Core.SoulStore

/// Store a named soulfile keyed by `name`, overwriting any prior
/// record with the same name. Returns `Result<unit, StoreError>`.
val put : directory:string -> name:string -> payload:ReadOnlySpan<byte> -> Result<unit, StoreError>

/// Retrieve a soulfile by name. Returns `Ok None` if absent,
/// `Ok (Some bytes)` if present, `Error` on integrity failure.
val get : directory:string -> name:string -> Result<byte[] option, StoreError>

/// List known soulfile names in insertion order (retractions
/// reflected — a retracted name is absent).
val list : directory:string -> Result<string seq, StoreError>

/// Delete (retract) a soulfile by name. Idempotent.
val delete : directory:string -> name:string -> Result<unit, StoreError>
```

Backing layout on disk, all under a single directory:

- `soul.bin` — append-only log of Arrow-IPC-serialized
  `ZSet<struct (string * byte[])>` deltas. Each record pair
  (name, payload) is `struct (string, byte[])` to keep the key
  primitive-typed and the value opaque.
- `soul.manifest` — small manifest record (schema version,
  delta count, last-compaction timestamp, Merkle root of the
  log). Written atomically via temp-file + rename.
- `soul.index` — optional, materialised on read of `soul.bin`;
  not source-of-truth. Can be rebuilt from the log alone.

Reads replay the log into a `ZSet`, integrate it to get the
current snapshot, look up by name. Writes append one delta
record; if the log exceeds a threshold (e.g. 1 MiB), a
compaction pass rewrites `soul.bin` from the current snapshot
and bumps the manifest.

## What this is NOT

- **Not a general-purpose key-value store.** `SoulStore` is
  scoped to soulfile invocation only. Other uses (factory
  state, round history, memory files) do not plug into this
  module until their own soulfile-shaped contract is named.
- **Not a replacement for `DiskBackingStore`.** `DiskBackingStore`
  is the internal on-disk spine for `ZSet`-of-huge-key-spaces.
  `SoulStore` is a tiny public wrapper for the
  soulfile-invocation contract specifically.
- **Not committed to this implementation.** This doc is a
  sketch. A real implementation lands with tests, allocation
  benchmarks, and a formal spec (TLA+ or OpenSpec capability).
- **Not a claim the factory's in-repo memory moves to this
  store.** That's a different decision — `memory/*.md` stays
  in git + markdown as the cross-substrate-readable format
  per `memory/project_zeta_is_agent_coherence_substrate_all_physics_in_one_db_stabilization_goal_2026_04_22.md`.
  `SoulStore` is for the algebraic-operations layer the factory
  invokes programmatically.

## Open questions for Aaron's next review

1. **Is `SoulStore` the right name?** The term "soulfile" is
   Aaron's vocabulary; capturing it in module name honours
   it. But "Soul" as a type prefix across a ZSet codebase may
   read as mystical rather than technical. Alternatives:
   `Zeta.Core.SoulfileStore`, `Zeta.Core.InvocationStore`,
   `Zeta.Core.TinyBinStore`. Aaron's call.
2. **Arrow-IPC vs TLV vs FsPickler for the on-disk format?**
   Arrow gives cross-language readability (C#, Python, Rust
   tooling) for free. TLV is the existing internal format for
   `Spine`-to-disk. FsPickler gives F# type-roundtrip without
   schema work. Leaning Arrow for the public-contract property.
3. **Delta-log compaction policy.** Size threshold (1 MiB?
   10 MiB?), time threshold, generation count — each has a
   different operational shape. Default proposal: 1 MiB or
   10k deltas, whichever comes first.
4. **Crash-safety guarantee.** fsync(soul.bin) per delta vs
   batched fsync on manifest update. Batched is faster; per-delta
   is stronger durability. The Durability module
   (`src/Core/Durability.fs`) already encodes this trade-off —
   reuse its modes rather than re-litigating.
5. **Germination scope.** Does the first-landed SoulStore
   handle a single soulfile, or ten? If ten, what is the
   concrete soulfile set the factory germinates with?

## Proposed next-round sequencing

1. Aaron answers the five open questions (or delegates).
2. Architect (Kenji) drafts an OpenSpec capability for
   `soul-store` or equivalent name.
3. Viktor adversarial-audits the capability (can I rebuild
   this from the spec alone?).
4. Land `src/Core/SoulStore.fs` + allocation-property tests
   + round-trip tests.
5. First real usage: one factory-state soulfile (candidates:
   tick-history index, BACKLOG row-index, round-close ledger).

Effort: M for the module + tests; spec + adversarial audit
adds another M. Not an overnight-ship.

## Composes with

- `memory/project_zeta_self_use_local_native_tiny_bin_file_db_no_cloud_germination_2026_04_22.md`
- `memory/project_zeta_is_agent_coherence_substrate_all_physics_in_one_db_stabilization_goal_2026_04_22.md`
- `memory/project_zeta_db_is_the_model_custom_built_differently_regime_reframe_2026_04_22.md`
- `docs/BACKLOG.md` row #241 (soulsnap / SVF)
- `src/Core/DiskSpine.fs`, `src/Core/ArrowSerializer.fs`,
  `src/Core/Durability.fs`, `src/Core/FastCdc.fs`,
  `src/Core/Merkle.fs`
