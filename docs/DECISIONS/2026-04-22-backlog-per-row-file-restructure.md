# ADR 2026-04-22: BACKLOG.md per-row-file restructure — bulk-migration commitment

**Status:** Accepted — bulk-migration commitment to the existing
Otto-181 substrate (Otto 2026-04-25 decision after Aaron
delegated the call: *"i'll leaf it up to you if you want per
row for backlog... it's your ownership so you make the finial
decision"*).
**Decision date:** 2026-04-22 (per-row variant proposed) /
2026-04-25 (substrate acknowledged, schema aligned with
Otto-181, decision finalised in favour of bulk migration).
**Deciders:** Human maintainer (Aaron); Architect (Kenji)
integrates; Iris / Bodhi review UX of the file layout.
**Triggered by:** PR #31 merge-tangle incident (2026-04-22
autonomous-loop tick). See
`docs/research/parallel-worktree-safety-2026-04-22.md` §9 — the
5-file conflict table ranked `docs/BACKLOG.md` as the P0
shared-write high-churn surface. Identified as the highest-ROI
preventive mitigation before the R45 EnterWorktree
factory-default flip.

## Context

`docs/BACKLOG.md` is the single-source-of-truth backlog for the
Zeta factory. It is append-only, organized newest-first within
four priority tiers (P0/P1/P2/P3), and currently spans
**~12,800 lines** (12,781 at time of writing) in one file.

Every autonomous-loop tick touches it. Every round-close
touches it. Every cadenced audit touches it. Every persona that
proposes a new line-item touches it. Parallel branches touch it
independently — and the PR #31 merge-tangle confirmed what the
cartographer research
(`docs/research/parallel-worktree-safety-2026-04-22.md`)
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

## Existing substrate (Otto-181 prior work)

This ADR builds on prior Otto-181 work, **not** a green-field
design. The substrate already in tree:

- **Design spec:** `docs/research/backlog-split-design-otto-181.md`
  — Aaron Otto-181 directive, full 6-question structural review.
- **Index generator:** `tools/backlog/generate-index.sh` —
  walks `docs/backlog/P<tier>/B-<NNNN>-<slug>.md`, parses
  frontmatter, emits sorted index. Has `--check` and
  `--stdout` modes.
- **Tooling README:** `tools/backlog/README.md` — schema
  definition + how-to.
- **Per-row directory tree:** `docs/backlog/P0/`,
  `docs/backlog/P1/`, `docs/backlog/P2/`, `docs/backlog/P3/`,
  with `docs/backlog/README.md` carrying the schema.
- **One example row already migrated:**
  `docs/backlog/P2/B-0001-example-schema-self-reference.md` —
  proves the round-trip works.

What is **not** yet in tree:

- Bulk migration of the remaining ~350 rows from
  `docs/BACKLOG.md` into per-row files.
- A drift-check lint (`tools/backlog/lint-index.sh`) that
  enforces row-files ↔ index parity at pre-commit time.
  *(Note: `generate-index.sh --check` already provides drift
  detection; a wrapper invokable from pre-commit is the gap.)*
- Path-pattern updates in `AGENTS.md`, `CLAUDE.md`,
  `docs/AGENT-BEST-PRACTICES.md`, and skill files that
  currently reference `docs/BACKLOG.md` as a grep target.

## Decision

**Commit to bulk-migrating the remaining ~350 rows from
`docs/BACKLOG.md` into the existing per-row substrate at
`docs/backlog/P<tier>/B-<NNNN>-<slug>.md`.** Adopt the
Otto-181 schema and tooling as-is — this ADR is *not*
proposing a competing design.

### Directory shape (already in tree)

```text
docs/
  BACKLOG.md                          # generated index (DO NOT EDIT)
  backlog/
    README.md                         # schema + how-to
    P0/B-<NNNN>-<slug>.md             # one file per row
    P1/B-<NNNN>-<slug>.md
    P2/B-<NNNN>-<slug>.md
    P3/B-<NNNN>-<slug>.md
tools/
  backlog/
    README.md                         # tooling README (already exists)
    generate-index.sh                 # regenerates docs/BACKLOG.md (already exists)
    new-row.sh                        # row-scaffold helper (Phase 1b — owed)
    lint-index.sh                     # pre-commit drift check (Phase 1c — owed)
```

### Per-row file shape (Otto-181 schema, already in tree)

```markdown
---
id: B-<NNNN>
priority: P0 | P1 | P2 | P3
status: open | shipped | declined
title: <one-line title>
tier: research-grade | shippable | hygiene | spec
effort: S | M | L
directive: <provenance — e.g., "maintainer Otto-180">
created: YYYY-MM-DD
last_updated: YYYY-MM-DD
composes_with:
  - B-<NNNN>
  - B-<NNNN>
tags: [<topic>, <topic>]
---

# <Row title>

<body — same prose as current BACKLOG.md row body>
```

The schema fields above are **what `tools/backlog/generate-index.sh`
already parses**. This ADR aligns with the existing parser; it
does not introduce new fields. (Earlier draft revisions of this
ADR proposed `tier`, `owner`, `updated`, `scope`, which did not
match the real schema and would have required parser
re-engineering — corrected per copilot review on PR #474.)

### Index file shape (already in tree)

`docs/BACKLOG.md` is a **generated** index — short pointer per
row, sorted by (priority, id). Do not hand-edit; run
`tools/backlog/generate-index.sh` to refresh after row edits.

### Migration

Two-phase migration relative to the existing substrate:

1. **Bulk row split (one big mechanical PR).** A migration
   script walks `docs/BACKLOG.md`, splits by row, derives
   `B-<NNNN>` IDs newest-first within each tier, writes one
   file per row under `docs/backlog/P<tier>/`, then runs
   `generate-index.sh` to rebuild `docs/BACKLOG.md` as the
   index. Row body text is preserved verbatim. Frontmatter is
   inferred from the original row's tier marker, dates in the
   prose, and any `Otto-NNN` provenance tags.
2. **Path-pattern sweep (small follow-up PR).** Update
   `AGENTS.md`, `CLAUDE.md`, `docs/AGENT-BEST-PRACTICES.md`,
   and any skill bodies that reference `docs/BACKLOG.md` as a
   grep target — most should switch to `docs/backlog/**`.

### Authoring rules after migration

- **Add a row:** create a new file under
  `docs/backlog/P<tier>/B-<NNNN>-<slug>.md`. Allocate the
  next free `B-NNNN` ID (the migration script will reserve a
  comfortable gap). Then run
  `tools/backlog/generate-index.sh` to refresh
  `docs/BACKLOG.md`. The index is generator output, not an
  authoring surface.
- **Edit a row:** edit the row file. Bump `last_updated:`.
- **Ship a row:** flip `status:` from `open` to `shipped` or
  `declined`. (Existing tooling does not yet move the file
  between directories on status change; that's a Phase 1b
  refinement if folder-as-status proves desirable.)
- **Tier-change:** move the file between `P<tier>/`
  directories and update `priority:` in the frontmatter.

### Index regeneration

`tools/backlog/generate-index.sh` (already in tree) rebuilds
`docs/BACKLOG.md` from the row files. The `--check` flag exits
non-zero on drift and is suitable for pre-commit. A
`tools/backlog/lint-index.sh` wrapper (Phase 1c, owed) wires
that into the pre-commit toolchain so a row-file edit without
a corresponding index regen is caught.

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

5. **Swim-lane file split (per-domain / per-owner)**, e.g.
   `docs/backlog/security.md`, `docs/backlog/factory-demo.md`,
   `docs/backlog/research.md`, `docs/backlog/ci.md`,
   `docs/backlog/governance.md`, etc. *(Aaron 2026-04-25
   alternative; viable second-best.)*  *Rejected:* same
   shared-write surface within each lane — P0 lane still
   collides; per-row collision-avoidance is strictly better.

6. **Per-row file with `<slug>-<YYYY-MM-DD>` filename and
   path-encoded priority.** *(Earlier ADR-draft variant.)*
   *Rejected:* doesn't match Otto-181's existing
   `B-<NNNN>-<slug>` schema or the parser in
   `tools/backlog/generate-index.sh`. Adopting it would
   require parser re-engineering for no gain — `B-NNNN`
   IDs are stable across renames and priority shifts; dates
   in filenames decay as rows update. Existing scheme wins.

**Trade-off matrix (per-row variants vs swim-lane):**

| Axis | Per-row (Otto-181 schema, adopted) | Swim-lane (~10 files) |
|---|---|---|
| Filename grep-ability | High (`B-<NNNN>-<slug>` topic+id) | Medium (one swim-lane = grep target) |
| File count | ~350 (one per row) | ~10 |
| Collision avoidance | Near-zero (filename disambiguates) | Medium (same swim-lane still collides) |
| Tooling cost | Index script + frontmatter parser (already built) | Minimal (concat-and-scan) |
| Discoverability | Index file + directory walk | Direct filename = topic |

**Note on priority-shift cost** (Aaron 2026-04-25): a file
rename and an in-place edit are the same cost — both are a
single git operation, both are tracked by similarity
detection. The "rename ceremony" objection in earlier ADR
revisions was non-substantive and is dropped. With
`priority` in YAML frontmatter and the file under
`P<tier>/`, a P3→P1 shift is `git mv` + frontmatter edit, same
as any other multi-line edit.

**Decision** (Otto 2026-04-25, owning the call after Aaron
delegated): **adopt Otto-181 substrate as-is, commit to bulk
row migration.** Reasoning:

1. **Pattern consistency.** Every other "many-rows-each-evolves-
   independently" surface in the factory is per-row — memory
   (one file per fact), ADRs (one file per decision), drain
   logs (one file per PR), skills (one folder per skill). The
   holdouts (BACKLOG, ROUND-HISTORY) have different access
   patterns — ROUND-HISTORY is justifiably monolithic
   (chronological / sequential reads), but BACKLOG is
   priority-organized, and the per-row argument that won
   everywhere else applies cleanly here.

2. **Filename-IS-index** at the per-row level. The filename
   `B-<NNNN>-<slug>.md` encodes both stable id and topic
   discoverability natively; no need to scan-and-extract from
   a multi-row file.

3. **Tooling burden is already paid.**
   `tools/backlog/generate-index.sh` exists and works on the
   one example row. The bulk migration is a one-shot
   mechanical transform; no new authoring code is required.

4. **Mark-as-done = move-or-flag-status**, much cleaner than
   "delete a 50-line section from a 1000-line swim-lane
   file" without disturbing surrounding rows or generating
   noisy diffs.

5. **Collision avoidance** is strictly better than swim-lane.
   Post-R45 EnterWorktree default-flip, the parallel-branch
   count grows; per-row keeps each row's edits independent.

Swim-lane is a viable second-best, retained in the
trade-off matrix above as documentation of the alternative
considered. If the per-row tooling investment proves
larger than expected, swim-lane remains an acceptable
fallback.

## Consequences

### Positive

- **Conflict rate on backlog edits collapses to near zero** —
  only branches touching the *same* row conflict, and those
  conflicts are semantically meaningful (two agents disagree
  on the same row, which deserves a review).
- **Unblocks R45 reducer-agent EnterWorktree default-flip** per
  the cartographer staging recommendation.
- **Per-row history becomes first-class** — each row has a
  dedicated `last_updated` field and `directive` provenance
  in frontmatter. Cleaner audit trail.
- **Tier and effort become grep-able** — moves from
  prose-level to frontmatter, queryable by `grep -A2 "^tier:"`
  across `docs/backlog/**`.
- **Index file stays short** even as the backlog grows — the
  monolithic file's ~12,800 lines is a wake-cost for every
  tick; a generated index of ~500 pointers is not.

### Negative / costs

- **Migration PR is large** — a single PR touches the entire
  `docs/backlog/**` tree + shrinks `docs/BACKLOG.md`. Any open
  PR at migration time will need a rebase. Mitigation: time
  the migration after PR #31 / PR #36 merge, during a known-quiet
  window.
- **Index regeneration discipline** — the index file can drift
  from the row files if agents edit the index directly and
  skip the row file (or vice versa). Mitigation:
  `tools/backlog/lint-index.sh` (Phase 1c, owed) — pre-commit
  hook wrapping `generate-index.sh --check`.
- **Wake-cost pattern changes** — agents that previously
  grep'd `docs/BACKLOG.md` now grep `docs/backlog/**/*.md`.
  Same `rg` command with a different path; no harder. But
  every AGENTS.md / CLAUDE.md / skill doc that references
  BACKLOG.md needs a path-pattern update.
- **Index maintenance is a new micro-hygiene row** — adds one
  FACTORY-HYGIENE.md item: "Index matches row files".

### Neutral

- **File count grows** — repo gets ~350 new files at migration.
  Not a problem for git (storage scales with content, not file
  count), but pattern-match tools (`ls docs/backlog/`) will see
  long listings. Tier-subdirectories mitigate.

## Staging (relative to R45-R49 parallel-worktree-safety work)

Per `docs/research/parallel-worktree-safety-2026-04-22.md` §9
revised staging:

- **Round 45 (this restructure, pre-R45-flip):** land this ADR,
  the migration PR, and the index lint. Single-purpose round —
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

- `docs/research/backlog-split-design-otto-181.md` — Otto-181
  design spec; this ADR's substrate.
- `docs/research/parallel-worktree-safety-2026-04-22.md` §9 —
  the PR #31 merge-tangle incident that triggered this ADR.
- `tools/backlog/README.md` — tooling reference; matches the
  schema cited above.
- `docs/backlog/README.md` — per-row schema reference.
- `docs/FACTORY-HYGIENE.md` — gets a new row for
  index-matches-row-files lint.
- `docs/BACKLOG.md` — the file being restructured.
- `AGENTS.md`, `CLAUDE.md`, `docs/AGENT-BEST-PRACTICES.md` —
  all need path-pattern updates to point at
  `docs/backlog/**` instead of the monolithic file for "grep
  the backlog" instructions.

## Expires when

- The restructure ships and is proven to reduce conflict rate
  on backlog edits over at least 3 rounds of cross-PR work.
- If conflict rate does not measurably drop, this ADR is
  revisited — either the per-row granularity is wrong, or
  the conflict pattern is elsewhere.

## Open questions

1. **`B-NNNN` allocation strategy at migration** — newest-first
   within each tier means the ID order matches monolith
   reading order. Should we instead allocate IDs by date
   ascending so older rows get lower numbers? Aaron's call.
   (Default if no answer: newest-first within tier; matches
   the existing single example file `B-0001-...`.)
2. **`scope: factory | zeta | shared`** — was proposed in
   earlier ADR drafts but is *not* in the Otto-181 schema.
   If we want it, file a Phase 1b directive to extend the
   parser; otherwise the existing `tags:` array can carry
   `scope-factory` / `scope-zeta` tag values.

   **Partial-migration revisit (2026-04-26, ~36 of ~350 rows
   migrated):** The current per-row corpus has **240 distinct
   tag values** across 36 rows. **Trigger-formulation
   correction (Codex P2 catch):** the original task #270
   trigger "tag noise grows past ~12 distinct scope values"
   was malformed — a `scope: factory | zeta | shared` enum
   only permits 3 values, so 12 distinct scope values can
   never fire under the proposed schema. The intended
   measurement was **tag-prefix clusters acting AS scope**
   (the implicit scope-like axis already in use). Restated:
   if the tag corpus develops more than ~8 distinct
   scope-like prefix clusters, that's the signal to add a
   first-class `scope:` field. Currently observed: ~6
   clusters (`factory-*` / `aurora-*` / `alignment-*` /
   `substrate-*` / `hygiene-*` / `tooling-*`) — under
   threshold, but trending up. The scope-like axis IS
   implicit in tag prefixes
   (`factory-as-superfluid` / `factory-discipline` /
   `factory-maintenance` cluster, `aurora` / `aurora-ksk`
   cluster, `alignment` / `alignment-foundation` /
   `alignment-substrate` cluster, `substrate-as-mechanism`
   / `substrate-as-revenue-surface` / `substrate-poisoning`
   cluster). The tags-only approach is functioning at
   partial-migration scale — none of the operational
   workflows (PR review, BACKLOG-pickup per Aaron's
   "non-speculative work" rule, hot-file-detector audits)
   have hit the "factory-vs-zeta scope distinction is
   load-bearing for a generated dashboard / report"
   trigger from task #270.

   **Provisional finding:** tags-only approach is **holding**
   at partial-migration scale. Final reflection deferred
   until bulk migration completes (Phase 2 ships all ~350
   rows). At that point: re-check (a) whether any reporting/
   dashboard surface needs scope-as-coarse-filter, and (b)
   whether the ~12-tag threshold meaningfully predicts
   needing a separate field — at 240 tags, the threshold
   may have been off by an order of magnitude. **Math-correctness
   note (Copilot P1 catch):** my prior draft conflated
   "distinct tag values" (union; what 240 measures) with
   "average tags-per-row" (mentions ÷ rows) — different metrics.
   240 is the distinct-union count; average tags-per-row would
   require counting all tag mentions (independent measurement),
   not extrapolating from the union. The 350-row extrapolation
   "350 × 6.7 = 2300 tag-mentions" was unsound and is removed;
   the meaningful prediction is just that distinct-union
   plateaus as Phase 2 lands more rows, not a specific number.
   Tag-corpus grows with row count, but new rows largely reuse
   existing tags. Falsification #1 recalibrates to "distinct
   scope-like prefix clusters past 8" — currently 6 clusters,
   under threshold.

   **Action:** none this round. Phase 2 bulk migration is
   the gating event; reflection completes there. Per
   Otto-283 standing directive (`memory/feedback_decide_track_reflect_revisit_then_talk_with_experience_otto_283_2026_04_25.md`):
   decided, tracked, partially reflected, full revisit when
   bulk migration ships.
3. **Concurrent-migration with R45 original intent** — Aaron
   may prefer to land the restructure *and* the reducer-agent
   flip in the same round, trusting the restructure to absorb
   the parallelism tax live. Staging recommendation above is
   conservative (separate rounds) but not load-bearing.
