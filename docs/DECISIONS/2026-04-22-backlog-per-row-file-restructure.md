# ADR 2026-04-22: BACKLOG.md per-row-file restructure

**Status:** Proposed
**Decision date:** 2026-04-22
**Deciders:** Human maintainer (Aaron); Architect (Kenji) integrates; Iris / Bodhi review UX of the file layout.
**Triggered by:** PR #31 merge-tangle incident (2026-04-22 autonomous-loop tick). See `docs/research/parallel-worktree-safety-2026-04-22.md` §9 — the 5-file conflict table ranked `docs/BACKLOG.md` as the P0 shared-write high-churn surface. Identified as the highest-ROI preventive mitigation before the R45 EnterWorktree factory-default flip.

## Context

`docs/BACKLOG.md` is the single-source-of-truth backlog for the
Zeta factory. It is append-only, organized newest-first within
four priority tiers (P0/P1/P2/P3), and currently spans
**5,957 lines** in one file.

Every autonomous-loop tick touches it. Every round-close touches
it. Every cadenced audit touches it. Every persona that proposes
a new line-item touches it. Parallel branches touch it
independently — and the PR #31 merge-tangle confirmed what the
cartographer research (`docs/research/parallel-worktree-safety-2026-04-22.md`)
predicted structurally: `BACKLOG.md` is the top generator of
merge conflicts across long-lived PR branches.

§9 of the cartographer doc identified five concrete conflict-file
classes; `docs/BACKLOG.md` was class #1 — **universal queue,
every tick edits it, long-lived branch guarantees overlap.**
Before the R45-R49 reducer-agent EnterWorktree default-flip
scales parallel branches further, the shared-write surface must
shrink. Otherwise every parallel tick accumulates one more
branch-conflict against the same file, and the compensating
side (merge-conflict resolution) becomes the tax that kills the
promised preventive-paired-with-compensating discipline.

A **per-row-file restructure** converts `docs/BACKLOG.md` from a
single 5,957-line text file into an **index file** plus one
file per backlog row under `docs/backlog/<tier>/<id>.md`.
Add-a-row becomes "create a new file" (zero collision — filename
disambiguates); edit-a-row becomes "edit one small file" (low
collision — only branches actually touching that row conflict);
ship-a-row becomes "move or rename that one file" (isolated
operation).

This is the standard pattern for collapsing universal-queue
hotspots into per-row files when the shared-write cost exceeds
the read-together cost — the same pattern the factory already
applies to ADRs (one file per decision under `docs/DECISIONS/`)
and to skills (one folder per skill under `.claude/skills/`).

## Decision

Adopt a **per-row-file backlog layout** with the following
shape.

### Directory shape

```
docs/
├── BACKLOG.md                      # index — links to row files; ≤ ~500 lines
└── backlog/
    ├── P0/
    │   ├── <slug>-<YYYY-MM-DD>.md
    │   └── ...
    ├── P1/
    │   ├── ...
    ├── P2/
    │   ├── ...
    ├── P3/
    │   ├── ...
    └── shipped/
        └── <tier>-<slug>-<YYYY-MM-DD>.md
```

### Per-row file shape

```markdown
---
id: <slug>
tier: P0 | P1 | P2 | P3 | shipped | declined
created: YYYY-MM-DD
updated: YYYY-MM-DD
owner: <persona name or TBD>
effort: S | M | L
scope: factory | zeta | shared
---

# <Row title>

<body — same prose as current BACKLOG.md row body>

## History

- YYYY-MM-DD — created by <persona>
- YYYY-MM-DD — <what changed>
- ...
```

### Index file shape

`docs/BACKLOG.md` becomes an auto-generated or manually-maintained
index:

```markdown
# Zeta.Core Unified Backlog — index

## P0 — next round (committed)

- [**<Row title>**](backlog/P0/<slug>-<date>.md) — one-line summary
- ...

## P1 — within 2-3 rounds

- ...
```

The index is short (one line per row, under ~500 lines total
even with 500 rows). The prose/detail moves into per-row files
where it belongs.

### Migration

One-shot migration round:

1. Script splits current `docs/BACKLOG.md` into per-row files,
   preserving verbatim body text.
2. Script generates new `docs/BACKLOG.md` index from the
   split files.
3. Each row file starts with the frontmatter derived from its
   tier, slug, and the dates found in the original body.
4. `History` section seeded with one entry: "YYYY-MM-DD —
   migrated from monolithic BACKLOG.md".
5. Human review of the generated diff before merge. This
   migration is a single PR that touches the entire
   `docs/backlog/**` tree + shrinks `docs/BACKLOG.md` — the
   biggest single-PR diff the factory will have made, but
   it is a pure mechanical transform with no semantic edits.

### Authoring rules after migration

- **Add a row:** create a new file under `docs/backlog/<tier>/`.
  Never edit the index directly to add — regenerate or hand-
  append the index line.
- **Edit a row:** edit the row file. Update the `updated:`
  field. Append a `History` entry if the edit is non-trivial.
- **Ship a row:** move the file to `docs/backlog/shipped/`
  (or `docs/backlog/declined/`). Update the `tier:` field
  to `shipped` or `declined`. Regenerate the index.
- **Tier-change:** move the file between tier directories and
  update `tier:` in the frontmatter.

### Index regeneration

An optional script (`tools/backlog/regenerate-index.sh`) rebuilds
`docs/BACKLOG.md` from the row files. Optional because hand-
editing the index on a small edit is also fine; the script is
for safety on bulk operations (migration, tier sweeps).

## Alternatives considered

1. **Append-only-section-per-tick layout on the single file.**
   Each tick appends to its own section; merges concatenate
   without conflict. *Rejected:* preserves monolithic file,
   same re-read cost on wake, and still conflicts on shipped-
   row moves between tiers.

2. **Per-tier file split only (P0.md / P1.md / P2.md / P3.md).**
   Four files instead of one; conflicts partition across
   tiers. *Rejected:* still conflicts heavily on P0 (busiest
   tier) and on tier-migration boundaries. Does not help the
   parallel-branch-growth R45 scaling problem.

3. **Status-quo with shared-editor discipline (lock the file
   during a tick).** *Rejected:* incompatible with the
   always-parallel factory direction. The lock IS the shared-
   write surface.

4. **Automated conflict-resolver on BACKLOG.md merges.**
   *Rejected:* semantic merges of prose are not reliably
   automatable. Humans and agents disagree at the prose level;
   a mechanical merge would hide disagreements behind silent
   text concatenation.

## Consequences

### Positive

- **Conflict rate on backlog edits collapses to near zero** —
  only branches touching the *same* row conflict, and those
  conflicts are semantically meaningful (two agents disagree
  on the same row, which deserves a review).
- **Unblocks R45 reducer-agent EnterWorktree default-flip** per
  the cartographer staging recommendation.
- **Per-row history becomes first-class** — each row has a
  dedicated `History` section instead of prose embedded in
  the body. Cleaner audit trail.
- **Scope tagging becomes grep-able** — `scope: factory` vs
  `scope: zeta` moves from prose-level to frontmatter, queryable.
- **Effort sizing becomes grep-able** — same pattern as scope.
- **Index file stays short** even as the backlog grows — the
  monolithic file's 5,957 lines is a wake-cost for every tick;
  a 500-line index is not.

### Negative / costs

- **Migration PR is large** — a single PR touches the entire
  `docs/backlog/**` tree + shrinks `docs/BACKLOG.md`. Any open
  PR at migration time will need a rebase. Mitigation: time
  the migration after PR #31 / PR #36 merge, during a known-quiet
  window.
- **Index regeneration discipline** — the index file can drift
  from the row files if agents edit the index directly and
  skip the row file (or vice versa). Mitigation: a lint step
  (`tools/backlog/lint-index.sh`) that checks index ↔ row-file
  consistency, run pre-commit.
- **Wake-cost pattern changes** — agents that previously
  grep'd BACKLOG.md now grep `docs/backlog/**/*.md`. Same
  `rg` command with a different path; no harder. But every
  AGENTS.md / CLAUDE.md / skill doc that references
  BACKLOG.md needs a path-pattern update.
- **Index maintenance is a new micro-hygiene row** — adds one
  FACTORY-HYGIENE.md item: "Index matches row files".

### Neutral

- **File count grows** — repo gets ~500 new files at migration.
  Not a problem for git (storage scales with content, not file
  count), but pattern-match tools (`ls docs/backlog/`) will see
  long listings. Tier-subdirectories mitigate.

## Staging (relative to R45-R49 parallel-worktree-safety work)

Per `docs/research/parallel-worktree-safety-2026-04-22.md` §9
revised staging:

- **Round 45 (this restructure, pre-R45-flip):** land this ADR +
  the migration PR + the index lint. Single-purpose round —
  no new reducer-agent parallelism yet.
- **Round 46 (R45 original intent):** EnterWorktree factory-default
  flip for reducer-agent class, with the now-shrunk
  `docs/BACKLOG.md` shared-write surface.
- **Round 47-49:** proceed with the original R46-R48 staging,
  shifted one round later.

This ADR therefore *delays R45's reducer-agent flip by one
round*. Justification: the flip itself is moot without the
preventive-paired-with-compensating discipline, and that
discipline fails without this restructure.

## Cross-references

- `docs/research/parallel-worktree-safety-2026-04-22.md` §9 —
  the PR #31 merge-tangle incident that triggered this ADR.
- `docs/FACTORY-HYGIENE.md` — gets a new row for index-matches-row-files
  lint.
- `docs/BACKLOG.md` — the file being restructured.
- `AGENTS.md`, `CLAUDE.md`, `docs/AGENT-BEST-PRACTICES.md` — all
  need path-pattern updates to point at `docs/backlog/**`
  instead of the monolithic file for "grep the backlog"
  instructions.

## Expires when

- The restructure ships and is proven to reduce conflict rate
  on backlog edits over at least 3 rounds of cross-PR work.
- If conflict rate does not measurably drop, this ADR is
  revisited — either the per-row granularity is wrong, or
  the conflict pattern is elsewhere.

## Open questions

1. **ID scheme** — is `<slug>-<date>.md` the right filename
   pattern, or is `<NNNN>-<slug>.md` better? Dates are
   human-readable; numbers are stable across renames. Aaron's
   call.
2. **Script ownership** — does the migration script live in
   `tools/backlog/` or in the ADR itself as a code block?
   (Convention: one-shot migration scripts live under
   `tools/migrations/YYYY-MM-DD-<name>/`.)
3. **Order within a tier** — the current monolithic file is
   "newest-first within each priority tier". The index file
   inherits that; the row files carry dates in frontmatter.
   The index can be regenerated in date-order trivially. But
   for per-tier files with 100+ rows, is date-order still the
   right default, or is "alphabetical-by-slug" easier to
   grep? Aaron's call.
4. **Concurrent-migration with R45 original intent** — Aaron
   may prefer to land the restructure *and* the reducer-agent
   flip in the same round, trusting the restructure to absorb
   the parallelism tax live. Staging recommendation above is
   conservative (separate rounds) but not load-bearing.
