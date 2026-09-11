# PR-review archive — preserved, read-not-refactor

This directory and its manifest (`docs/github/prs/manifest.jsonl`) are the
**per-PR review archive**: one file per pull request capturing its metadata,
description, outcome, and every review comment and thread.

## Why this is protected

This is **the project's most valuable data** (maintainer, 2026-06-07):

- **Fuel** — the GitOps fine-tuning / training signal for the models (review
  signal per PR, the record of what was caught, argued, resolved).
- **Shadow logs** — the durable, reviewed record of how the autonomous agents
  (the shadow) actually worked.
- It is **rate-limited to refetch** from the GitHub API — for older PRs,
  effectively impossible to regenerate.

It is also the project's founding purpose made concrete: durable **memory
preservation** (the Memory Preservation Guarantee; see
[`docs/DEDICATION.md`](../../DEDICATION.md)) and the retraction-native
discipline applied to the project's own history — corrections are added, the
past is never erased.

## The rule

**Read, do not refactor. Do not delete.** Audits that flag these files, tools
that suggest consolidating or pruning them, agents that draft their removal:
**refuse and escalate.** This is not operational content; it is preserved
substrate. New entries are appended (one `.md` + one manifest line per merged
PR); existing entries are never rewritten or removed.

## Provenance

These 4,200+ archives were rescued (2026-06-07) from ~4,049 orphaned
`automation/pr-archive-*` branches that the `pr-archive-on-merge` workflow
pushed but could not land on `main` (the org blocks Actions from opening PRs),
consolidated losslessly (archive `.md` + manifest line only; integrity-verified
file↔manifest 1:1). The workflow is being fixed so future merges land here
directly and self-clean their branches.

## Layout — one file per PR, in dated `YYYY/MM/DD/` folders

```
docs/history/pr-reviews/<YYYY>/<MM>/<DD>/PR-<number>-<slug>.md
```

The date is the PR's own **`merged_at`**, never the day the archive was
written — a backfill re-archiving an old PR lands it beside its neighbours, and
re-running the archiver is a no-op rather than a move.

**One file per PR is unchanged.** Only the directory changed
(`081M28KF7P5087G0R00046KB5M`). Until 2026-09-11 all 14,378 records sat in this
one flat directory; the sibling index `docs/github/prs/shards/` had been
bucketed since 2026-08-13. Same corpus, one bucketed and one not.

**Why daily and not monthly**, measured over all 14,378 records rather than
extrapolated from the current merge rate:

| layout | dirs | median/dir | p90/dir | max/dir |
|---|---:|---:|---:|---:|
| monthly `YYYY/MM` | 6 | 2,703 | — | **4,871** |
| weekly | 22 | 573 | 1,231 | **2,077** |
| **daily `YYYY/MM/DD`** | **119** | **93** | **265** | **522** |

This repo's busiest day saw **522 merges** (2026-08-17), so monthly would have
put 4,871 files in `2026/08/` — worse fan-out than the flat directory had at its
own busiest month, and six times the sibling shard store's. Daily is also the
layout that satisfies *"rarely more than one directory per day"* by construction:
a day-keyed path creates exactly one new directory per day and cannot create two.

A record whose PR has no `merged_at` — archived while still OPEN, which is true
of PR #1702 — goes to `undated/`. That is a **named** bucket, not a guessed
date: inventing one would make the path assert a merge that did not happen.

### Citing one of these files

Paths that predate 2026-09-11 name the old flat location. **They are not
rewritten** — append-only ledgers under `db/` and prose in `docs/` keep saying
what they said. Readers translate at the read boundary instead:
`resolveArchivePath()` in
[`src/Core.TypeScript/forge-host/github/pr-archive-paths.ts`](../../../src/Core.TypeScript/forge-host/github/pr-archive-paths.ts)
maps any cited path — flat or bucketed, current or stale — to where the bytes are
now, in one shard read.

### Enumerating them

Use `walkArchiveDocs()` from the same module. A flat `readdirSync` over this
directory now returns the year folders and **zero** `.md` files, which reads as
"nothing is archived" — a check that cannot fail. Four consumers were corrected
when the layout changed; a fifth that appears later should use the shared walker
rather than growing a sixth private one.
