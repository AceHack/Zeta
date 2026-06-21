# `workitems/` — ZetaId-keyed work-items (081KSXN940008QG0R002FWR9B2)

Conflict-free, consensus-free work-items. Each is one markdown file whose name is a
**ZetaId** (128-bit, locally crypto-minted — no cross-agent id consensus, so N agents
create items with zero coordination and zero collision; the 081KSXN940008QG0R00171YAZW agent-bus G-Set
property). Supersedes the consensus-allocated `B-NNNN` scheme for **new** items; the
legacy `docs/backlog/P*/B-NNNN-*.md` rows stay as permanent aliases (alias-and-keep,
not big-bang).

## File shape

```
workitems/<zetaid>-<description>.md                 # active (state = open)
workitems/done/YYYY/MM/<zetaid>-<description>.md     # completed (folder = state)
```

- **`<zetaid>`** — canonical Crockford base32 (081KS3X9Y0008QG0R000W00V73): filename-safe + **sort-preserving**
  (version+timestamp are the high bits, so `ls` sorted == chronological creation order;
  "items from a day" is a filename prefix range-scan).
- **`<description>`** — a human-readable slug of the title; rides along for readability.
  **Identity is the ZetaId prefix** — a reword changes only the suffix; resolve any
  cross-reference by the `<zetaid>-*.md` glob (recursive across `done/`).

## Lifecycle = folder

`state` is encoded by the folder: active items live here; completing one **moves** the
file under `workitems/done/YYYY/MM/` (a git rename of a disjoint file → still conflict-free).
Frontmatter `state` mirrors it (fine values: `backlog`/`in-progress`/`blocked`/`done`),
and `type ∈ {task,bug}` is immutable. Completion datetime lives in frontmatter (precise;
DORA lead-time = created→done). A done item is **immutable**, so the done index is
incremental + checked into git (append-only, never stale — DV2.0 zero-change-rate satellite).

## Create one

```
bun src/Core.TypeScript/backlog/new-workitem.ts --type task --title "Do the thing" \
    [--priority P2] [--depends-on 081KSXN940008QG0R002FWR9B2,<zetaid>] [--composes-with ...] [--dry-run]
```

Frontmatter: `id` (zetaid) · `type` · `state` · `priority` · `slug` · `title` ·
`created` · `depends_on` · `composes_with`. The tool mints locally and never emits a
`B-` id.

See `docs/backlog/P1/081KSXN940008QG0R002FWR9B2-*.md` + the design memo
`docs/research/2026-06-06-product-team-review-b0956-*.md`.
