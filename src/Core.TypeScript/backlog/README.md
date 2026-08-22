# Legacy backlog tooling — B-row files + generated index

Companion to the legacy `docs/backlog/` B-row stockpile and
the generated `docs/BACKLOG.md` index.

New work-items are not B-NNNN rows. The current backlog/workitem
substrate is ZetaId-keyed files under `workitems/`, minted with:

```bash
bun src/Core.TypeScript/backlog/new-workitem.ts --type task|bug --title "..."
```

The B-NNNN files remain as a grandfathered legacy index so old
references stay readable while the factory migrates to
conflict-free ZetaId workitems.

Origin: maintainer Otto-181 ask to split `docs/BACKLOG.md`
to eliminate the positional-append conflict cascade
documented in Otto-171 queue-saturation memory. Design spec:
`docs/research/backlog-split-design-otto-181.md`.

## Structure

```text
docs/
  BACKLOG.md                     ← generated legacy B-row index (DO NOT EDIT)
  backlog/
    README.md                    ← legacy schema + how-to
    P0/B-<NNNN>-<slug>.md        ← one grandfathered legacy row
    P1/B-<NNNN>-<slug>.md
    P2/B-<NNNN>-<slug>.md
    P3/B-<NNNN>-<slug>.md
workitems/
  <zetaid>-<slug>.md             ← current conflict-free workitem
tools/
  backlog/
    README.md                    ← this file
    generate-index.ts            ← regenerates docs/BACKLOG.md
    new-workitem.ts              ← mints current ZetaId workitems
    lint-no-new-bnnnn.ts         ← rejects new legacy B rows
```

## Legacy B-row file schema

Each legacy row is one markdown file with YAML frontmatter:

```markdown
---
id: 081KQ3HBZ0008QG0R002GDRFS5
priority: P2
status: open
title: Server Meshing and SpacetimeDB deep research
tier: research-grade
effort: L
ask: maintainer Otto-180
created: 2026-04-24
last_updated: 2026-04-24
depends_on: []
decomposition: blob
composes_with:
  - 081KQ3HBZ0008QG0R003B2NAA2
  - 081KQ3HBZ0008QG0R0006NJP4K
tags: [game-industry, sharding, multi-node]
---

# Server Meshing + SpacetimeDB — deep research on cross-shard communication patterns

...full row content as markdown...
```

## Frontmatter fields

| Field          | Required | Type         | Notes |
|----------------|----------|--------------|-------|
| `id`           | yes      | ZetaId       | 128-bit canonical work-item key (Crockford base32). |
| `priority`     | yes      | `P0..P3`     | Directory must match (`P2` row → `docs/backlog/P2/`). |
| `status`       | yes      | enum         | `open` / `closed` / `superseded-by-<zetaid>` / `deferred` / `decomposed` (broken into child rows; stays open until `closed_by` row closes) |
| `title`        | yes      | string       | Short index-display title. |
| `tier`         | no       | string       | Free-form; e.g. `research-grade`, `active-substrate`. |
| `effort`       | no       | `S` / `M` / `L` | Size estimate. |
| `ask`          | no       | string       | Origin reference; e.g. `maintainer Otto-180`, `Amara 18th ferry #4`. Per Otto-293 mutual-alignment language ("ask" not "directive"). |
| `created`      | yes      | YYYY-MM-DD   | First-landing date. |
| `last_updated` | yes      | YYYY-MM-DD   | Updated on every content edit. |
| `depends_on`   | no       | list of ZetaId | Hard prerequisite ordering. |
| `decomposition`| no       | enum         | Optional decomposition marker. `blob` means the row is intentionally too large or fuzzy for a single implement cycle and should be split before pickup. |
| `composes_with`| no       | list of ZetaId | Cross-references to related rows, paths, or rules. |
| `tags`         | no       | list of string | Free-form. Examples: `multi-node`, `dst`, `ui-rename`. |

## Adding new work

**Retired (2026-07):** the `otto-channels` B-NNNN ID-allocation discipline
does **not** apply to new work-items. Do not add
`docs/backlog/P*/B-NNNN-*.md` files and do not scan `origin/main` for the
next sequential id.

Do not add a new `docs/backlog/P*/B-NNNN-*.md` file for new
work. B-NNNN allocation is sequential and requires cross-agent
consensus, so it is kept only for the grandfathered legacy stockpile.

Mint current work as a conflict-free ZetaId workitem:

```bash
bun src/Core.TypeScript/backlog/new-workitem.ts --type task --title "Server meshing research"
```

That creates `workitems/<zetaid>-server-meshing-research.md`.
Completion moves the file to `workitems/done/YYYY/MM/` via
`bun src/Core.TypeScript/backlog/complete-workitem.ts`.

If a legacy B-NNNN row genuinely must be added or renumbered,
update `tools/backlog/frozen-bnnnn-ids.json` in the same commit.
That makes the exception explicit and reviewable.

## Regenerating the index

```bash
bun src/Core.TypeScript/backlog/generate-index.ts
```

Walks legacy `docs/backlog/**/*.md`, parses frontmatter, and
emits `docs/BACKLOG.md` sorted by priority and B-row id. The
output is derived from row files; when resolving conflicts, prefer
regenerating with `BACKLOG_WRITE_FORCE=1` over hand-picking either
side of the generated file.

## CI drift check

`.github/workflows/backlog-index-integrity.yml` fails if the
committed `docs/BACKLOG.md` doesn't
match the output of `generate-index.ts` run against the
committed row files. Same pattern as
`memory-index-integrity.yml`.

`tools/backlog/lint-no-new-bnnnn.ts` fails if a new legacy
B-named file appears under `docs/backlog/` or `workitems/`.
Use `new-workitem.ts` for current work instead.

`lint-b-refs-resolve.ts` lets prose NAME a legacy `B-NNNN` and
fails if the reference does not RESOLVE — to a live row via the
frozen alias maps (`b-to-zetaid-map.json`,
`b-id-renumber-aliases.json`), or to a surviving artifact under
`docs/recovered-orphan-branches-2026-05/`. Alias-map presence
alone is not resolution: that map was mined from git history and
carries ids that were never rows. Inspect with `--report`;
bulk-rewrite stragglers to ZetaIds with
`rebuild-legacy-b-id-aliases.ts --write`.

That remedy is **dry-run by default and fails closed on an unrecognised
flag** (exit 2, before any write). It used to infer intent from flag
*absence*, so `--help` — a flag it does not have — read as "go" and started
a ~1,700-file rewrite. Writing is now opted into by name.

It replaced `lint-no-b-refs.ts`, which banned the mention. The ban
could not fail on a *stale* reference because it did not permit any
reference to exist — it bought green by deleting its own subject.
Naming an id is now allowed **and checked**; minting with one is
not: a legacy id in a row's frontmatter fails here, and a B-named
file fails in `lint-no-new-bnnnn.ts`.

## Retirement

Per `CLAUDE.md` "honor those that came before — retired
SKILL.md files retire by plain deletion, recoverable
from git history" discipline: retired rows delete the
file. `git log --diff-filter=D -- docs/backlog/` surfaces
deleted rows for recovery. The `status: superseded-by-B-NNNN`
frontmatter is for legacy rows that are retired-but-still-
referenced; once no live row references the retired ID,
delete the file.

## Phase status

- **Legacy mode:** `docs/backlog/` plus `docs/BACKLOG.md` preserve
  grandfathered B-NNNN rows and old references.
- **Current mode:** `workitems/<zetaid>-*.md` is the backlog/workitem
  substrate for new work.

## Cross-references

- `docs/research/backlog-split-design-otto-181.md` — full
  design spec + 6 open questions the maintainer's call on (some
  answered by reasonable defaults in this phase).
- Hot-file-detector tooling (unmerged at the time of
  this Phase-1a PR; recovery path: `git log
  --diff-filter=A --all -- tools/hygiene/` if it lands
  later) — the detector flagged `docs/BACKLOG.md` as
  the repo's top hotspot and named "BACKLOG-per-swim-
  lane split" as a remediation option. The design
  rationale for this PR does not depend on that
  script being present in tree; the driver was
  maintainer Otto-181 directly.
- `.github/workflows/memory-index-integrity.yml` —
  precedent for the drift-CI pattern.
