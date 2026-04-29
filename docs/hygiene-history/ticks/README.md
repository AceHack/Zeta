# Tick-history shard files

This directory holds **per-tick shard files** for autonomous-loop
liveness evidence. One shard per autonomous-loop tick.

## Why shards exist

The single end-of-file table at
`docs/hygiene-history/loop-tick-history.md` produced an "Append-
Hotspot Merge Friction" failure mode (named by the deep-research
external-AI reviewer 2026-04-29): every tick-history PR added a
row to the same EOF surface, and parallel in-flight PRs
conflicted with each other, generating recursive maintenance work.

## External lineage — Git-native CQRS / Event Sourcing

The shard transport maps cleanly onto well-established
software architecture patterns (per the multi-AI convergence
2026-04-29):

- **Shard files = write model / event store.** Each shard is
  an immutable per-tick event. High-concurrency writes are
  collision-free because each event is a unique file.
- **Aggregate table = read model / projection.** The legacy
  `docs/hygiene-history/loop-tick-history.md` is a
  materialized view derived from the event stream.
- **Generator = projector.** Updates the read model from the
  event store on a separate cadence — NEVER inside a shard PR
  (or the EOF-collision returns at the projection layer).

External anchors: Microsoft's CQRS guidance describes
separating read and write models; Event Sourcing literature
treats the event store as the source of truth with read models
generated on demand. The Git-native version replaces the SQL
event store with timestamped Markdown files in this directory.

Per task #276 architectural choice (per-tick shard files —
"Option B"), each tick now writes a unique shard file at:

```
docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md
```

Per-tick uniqueness eliminates the conflict surface entirely.

## Shard file schema

Each shard is a single-row Markdown file. Required first line:

```
| <ISO 8601 UTC timestamp> | <model id> | <cron sentinel> | <body> | <PR ref> | <observation> |
```

Same column structure as the legacy single-table format. A
generator script (follow-up work) collates shards into the
legacy table on cadence; until that lands, the legacy table is
the authoritative read surface and shards are the authoritative
write surface — both are canonical.

## Naming

```
docs/hygiene-history/ticks/2026/04/29/0210Z.md
docs/hygiene-history/ticks/2026/04/29/0215Z.md
docs/hygiene-history/ticks/2026/04/30/0900Z.md
```

- Year / month / day are zero-padded numeric folders.
- Filename is HHMMZ (zero-padded hour + minute, UTC, with `Z`
  suffix).
- Extension `.md` so each shard is independently grep-able and
  rendered by the docs viewer.

If a tick lands within the same minute as a prior tick (rare —
the autonomous-loop cron is `* * * * *`), append `-01`, `-02`,
... to disambiguate: `0215Z-01.md`, `0215Z-02.md`.

**Recommended naming for multi-agent / high-concurrency**
(per the 2026-04-29 multi-AI hardening review):

```text
docs/hygiene-history/ticks/YYYY/MM/DD/HHMMSSZ-<short-content-hash>.md
```

Why content-hash:

- **Idempotent**: same content + same second = same path; the
  Git tree naturally deduplicates.
- **Collision-discriminating**: different content + same second
  = different path automatically.
- **No coordination required** between concurrent writers.

Either form (`HHMMZ.md` or `HHMMSSZ-<short-content-hash>.md`)
is valid; the second is preferred when concurrency pressure is
expected.

## What goes in a shard

The same content that previously appended as a row to the legacy
table:

- Material state-transition ticks → rich shard (multiple
  paragraphs covering the transitions + observations)
- Pure-maintenance / no-op ticks → minimal shard (one or two
  sentences)

Per the corrected liveness doctrine (see
`docs/AGENT-BEST-PRACTICES.md` operational standing rules
section "Session-closure rule"): every tick gets a shard.
Density depends on whether material state changes happened.

## Composition with the legacy table

For the gap before the generator script lands, the legacy table
at `docs/hygiene-history/loop-tick-history.md` remains the
canonical READ surface for past history, and new shards in this
directory become the canonical WRITE surface for new ticks.

Future generator behavior:

```text
Generator (cadence: post-merge or daily):
  1. Read all shards under docs/hygiene-history/ticks/**/*.md
  2. Sort by filename (chronological by file naming)
  3. Format as legacy-table rows
  4. Append to docs/hygiene-history/loop-tick-history.md
  5. Optionally retire shards older than N days to a compressed archive
```

The generator is follow-up work tracked under task #276.

## Why per-tick rather than per-day or per-PR

- **Per-tick**: each tick writes one file; no collision; no
  generator pressure beyond mere collation; smallest write unit.
- Per-day or per-PR would re-introduce append-hotspot inside the
  bucket. Per-tick removes the hotspot at the file granularity.

The choice was made 2026-04-29 per the converged stance from
the multi-AI synthesis arc + Aaron's explicit delegation
(*"this falls under your call"*).

## What this directory does NOT do

- Does NOT replace the legacy table for past history (that
  remains the canonical READ surface for pre-shard ticks).
- Does NOT change the AUTONOMOUS-LOOP.md liveness invariant —
  every tick still gets canonical evidence.
- Does NOT remove the markdownlint / chronological-order checks
  — those still apply at the shard-file level.
- Does NOT introduce a new tick-history schema — same column
  structure as the legacy table, one row per shard.

## Migration of historical content

The legacy table at `docs/hygiene-history/loop-tick-history.md`
is NOT migrated to shard files. Pre-2026-04-29-shard ticks stay
in the legacy table. Post-shard ticks go in shards. The
generator (follow-up) collates shards into the legacy table to
preserve the single-table read experience.
