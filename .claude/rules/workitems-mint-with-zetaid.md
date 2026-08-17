# New work-items — mint a ZetaId locally (no B-NNNN consensus)

Carved sentence:

> **Never allocate a new `B-NNNN` or scan `origin/main` for the next backlog
> number when filing work.** Mint a conflict-free `Category.WorkItem` ZetaId
> locally via `new-workitem.ts` → `workitems/<zetaid>-<slug>.md`. The
> `otto-channels` ID-allocation discipline does **not** apply to work-items
> (081KSXN940008QG0R002FWR9B2).

## Why

Sequential `B-NNNN` ids require cross-agent consensus (scan merged + in-flight
PRs). That does not scale to concurrent agents. CI enforces the cutover:
`lint-no-new-bnnnn.ts` rejects any new `B-*` filename under `docs/backlog/`
or `workitems/`.

**Naming an existing legacy id in prose is not minting.** You may write
`B-0747` when discussing lineage — `lint-b-refs-resolve.ts` then requires it to
resolve to a real row or archive artifact. What stays forbidden is using one as
a **key**: a `B-*` filename (above) or a legacy id in a row's frontmatter.

**Writing ABOUT a dangling id (an audit) is the third case** — annotate the mention,
never exclude the file: `<!-- b-ref-adjudicated: B-NNNN landed-as-code <evidence-path> -->`
on the same line. Checked, not trusted: the evidence path must exist, may not be the
annotating file, and a ref that later resolves fails as STALE.

## Mint

```bash
bun src/Core.TypeScript/backlog/new-workitem.ts --type task|bug --title "..."
```

Lifecycle: `set-workitem-state.ts` · `complete-workitem.ts` · events at
`workitems/events/` · DORA folds via `dora-metrics.ts`.

## Pointers

- `src/Core.TypeScript/backlog/README.md` — schema + CI guards
- `docs/backlog/P1/081KSXN940008QG0R002FWR9B2-migrate-backlog-sequential-b-nnnn-ids-to-zetaid-workitem-key.md` — umbrella
- `.claude/rules.bak/otto-channels-reference-card.md` — legacy B-NNNN discipline (still applies to **legacy** `docs/backlog/` rows only)
