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

Per-tick uniqueness eliminates the **EOF-append collision class**
that the legacy single-table format suffered. See "Scope of
conflict-elimination claim" below for the residual conflict
classes that shard transport does NOT eliminate (same-timestamp
filename collisions, README/schema edits, generator output
conflicts).

## Shard file schema

Copy-paste-ready scaffold: see [`../tick-shard-TEMPLATE.md`](../tick-shard-TEMPLATE.md)
(lives outside this walked directory so it doesn't trip the schema
validator; carries the path-depth + schema + filename-regex reference
inline as a comment block).

Each shard's first non-empty line MUST be a 6-column pipe-row
matching the validator at
[`check-tick-history-shard-schema.ts`](../../../src/Core.TypeScript/hygiene/check-tick-history-shard-schema.ts):

```
| <ISO 8601 UTC timestamp> | <model id> | <cron sentinel> | <body> | <PR ref> | <observation> |
```

Same column structure as the legacy single-table format. The ISO
timestamp's date + hour + minute MUST match the shard's path
(`YYYY/MM/DD`) and filename. Three filename forms are accepted by
the validator:

- `HHMMZ` (e.g., `0215Z.md`) — bare per-minute name
- `HHMMZ-<hex>` (e.g., `0215Z-01.md`) — same-minute disambiguation
  suffix (see "Naming" below)
- `HHMMSSZ-<hex>` (e.g., `021501Z-abc.md`) — content-hash form
  for high-concurrency multi-agent writes

The validator does not enforce seconds equality, so both `HH:MMZ`
and `HH:MM:SSZ` forms are accepted in the timestamp column.

### Hybrid format (preferred for rich shards)

Per the 081KRMEXM0008QG0R002HBY56V Recommendation (Option 3 "hybrid"), the canonical
shard shape is **the pipe-row first line followed by an H1-rich
Markdown body**. The pipe-row gives machine-parseable metadata
(satisfies the validator + future shard-collation projector); the
body below carries the substantive content (headline H1,
sub-sections, prose, links).

```markdown
| 2026-05-17T00:12Z | opus-4-7 / autonomous-loop | <cron-id> | <body summary> | #3990 | <observation> |

# Tick 2026-05-17 0012Z — <headline>

## Surface

<rich body content here>
```

The validator only inspects the first non-empty line; the body's
content is unconstrained markdown. For retrofit of older
H1-first-only shards, the
[`add-pipe-row-header.ts`](../../../src/Core.TypeScript/hygiene/add-pipe-row-header.ts)
tool prepends a placeholder pipe-row above the existing body,
preserving substantive content while satisfying the validator.

A generator script (follow-up work) collates shards into the
legacy table on cadence; until that lands, the legacy table is
the authoritative read surface and shards are the authoritative
write surface — both are canonical.

### Optional body metadata (081KR2E4K0008QG0R002S3FDXN and related)

The pipe-row remains canonical and MUST be the first non-empty
line; the validator inspects only that line. Optional structured
metadata MAY appear inside the H1 body — NOT as file-head YAML
frontmatter (file-head frontmatter would push `---` to the first
non-empty line and fail the validator). A common shape is a YAML
block placed below the pipe-row and H1:

````markdown
| <ISO 8601 UTC timestamp> | <model id> | <cron sentinel> | <body summary> | <PR ref> | <observation> |

# Tick <YYYY-MM-DD> <HHMMZ> — <headline>

```yaml
tick: "<ISO 8601 UTC timestamp>"
agent: otto        # or vera, kenji, etc.
mode: autonomous   # or interactive
operative-authorization: "<source> <date>: \"<raw>\""  # 081KR2E4K0008QG0R002S3FDXN
```

<rich body content here>
````

The `operative-authorization` field (081KR2E4K0008QG0R002S3FDXN) is populated by
`bun tools/authorization/check-authorization.ts` at tick start.
Format: `formatShardField()` output from that tool. If the
check is not available, use `"none — never-idle default"`.
These fields are informational; the validator does not inspect
them and they do not gate any work.

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

**Unique-filename rule** (fail-closed-OR-idempotent): if the
target shard path already exists when a new shard is being
written, the write MUST either (a) succeed silently if the
new content is byte-identical to the existing content
(idempotent re-write — common under retry / replay
conditions), OR (b) fail closed and a unique-suffix path MUST
be chosen. Silent *overwrites* (different content, same path)
are forbidden — they would erase prior liveness evidence and
re-introduce the failure mode shard transport was designed to
eliminate. The `HHMMSSZ-<short-content-hash>.md` form makes
collisions extremely rare in the first place; the fail-closed
rule is the safety net for the remaining cases (same-timestamp
with different content, or filename collisions when the
simpler `HHMMZ.md` form is used).

**Mixed-format-sort caveat** (per the 2026-04-30 hardening
review): the recommended `HHMMSSZ-<short-content-hash>.md`
form sorts lexicographically *before* same-minute `HHMMZ.md`
entries (e.g., `0210Z.md` vs `021001Z-abc.md` — the longer
form sorts earlier despite being later in real time). Two
mitigations: (1) the generator (when it lands per task #276)
SHOULD parse the timestamp prefix instead of relying on raw
filename sort; (2) within a single repo, prefer one form
consistently — pick `HHMMZ.md` for low-concurrency contexts,
`HHMMSSZ-<short-content-hash>.md` for high-concurrency, do
not mix.

**Scope of conflict-elimination claim** (per the deep-research
external-AI's hardening review): shard transport eliminates the
*old EOF-append collision class* for new tick rows. It does NOT
eliminate all conflict classes — same-timestamp filename
collisions, README/schema edits, generator output conflicts,
and directory/index conflicts remain possible. Engineering
hardening (the content-hash naming, the unique-filename rule
above, and the generator cadence discipline below) addresses
the residual classes.

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
  2. Sort by parsed timestamp prefix (HHMMZ or HHMMSSZ-...).
     Raw filename sort is incorrect when both forms coexist
     in a single day (HHMMSSZ-... sorts before same-minute
     HHMMZ.md lexicographically, despite being later).
  3. Format as legacy-table rows
  4. Append to docs/hygiene-history/loop-tick-history.md
  5. Optionally retire shards older than N days to a compressed archive
```

The generator is follow-up work tracked under task #276.

**Generator cadence rule** (the danger to avoid): if the
generator regenerates the legacy table on EVERY shard PR, the
EOF append-hotspot returns as generated-output contention. The
generator MUST run on a separate cadence (post-merge cron OR
single scheduled PR daily/weekly), NOT on every tick PR.

```text
Shard files are the canonical WRITE surface (per-tick).
Generated table is a READ surface (cadenced).
The hotspot returns iff the read surface tries to be a write surface.
```

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

## Composition with divergence shards

When two concurrent agent loops disagree on a substrate-class commitment,
a **divergence shard** is written to `docs/hygiene-history/divergences/`
in addition to (not instead of) the normal tick shard here.

- **Tick shard** (this directory): records what a loop DID.
- **Divergence shard** (divergences/): records a CONFLICT between two loops.

Both surfaces are canonical write surfaces; neither replaces the other.
See: `docs/hygiene-history/divergences/README.md` for the divergence shard
schema and reconciliation protocol (081KQJZR90008QG0R002GJAJ19 AC #4, 2026-05-10).

## Migration of historical content

The legacy table at `docs/hygiene-history/loop-tick-history.md`
is NOT migrated to shard files. Pre-2026-04-29-shard ticks stay
in the legacy table. Post-shard ticks go in shards. The
generator (follow-up) collates shards into the legacy table to
preserve the single-table read experience.
