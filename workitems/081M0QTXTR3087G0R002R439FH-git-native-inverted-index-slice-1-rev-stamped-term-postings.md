---
id: 081M0QTXTR3087G0R002R439FH
type: task
state: in-progress
priority: P1
slug: git-native-inverted-index-slice-1-rev-stamped-term-postings
title: "Git-native inverted index slice 1 — rev-stamped term postings, stale-refusing query CLI, 6h cadence"
created: 2026-08-23T00:00:00.000Z
depends_on: []
composes_with: []
---

# Git-native inverted index — slice 1

## The ask

Aaron 2026-08-22:

> _"lets send a background agent to do some sort of reverse indexing that stores
> the index and git and updates maybe once every 6 hours or so, then our search
> interface can just use the reverse index, we can have our own slim version of
> lucene like reverse indexing and yes for this index we will ignore stop words,
> **stop words need a completely different kind of indexing**."_

## The motivating failure

A search for `landauer` reported **0 files**. The true answer at `origin/main`
was **447**, one of them a rule mentioning it **32 times**. `grep -r` ran over a
shared checkout **336 commits behind** `origin/main` and answered correctly
about the corpus it was given. Nothing was broken; the defect is that **a stale
answer and a true answer are indistinguishable at the call site**.

## Shipped

`src/Core.TypeScript/search/inverted/` — extends the existing `search/` home
rather than starting a second one.

- `tokenize.ts` — ASCII-pinned case fold, pinned non-ASCII separator table,
  Lucene-style compound decomposition, the small hand stop list.
- `format.ts` — artifact shape, corpus policy with **dated measurements** per
  exclusion, the df cap and the table behind it, content-derived doc ids.
- `git-corpus.ts` — reads the corpus **from a git rev** via `ls-tree` /
  `cat-file --batch`, never from a working tree.
- `build.ts` — `--rev` defaults to `origin/main`, never `HEAD`, never the tree.
- `query.ts` — freshness classification, changed-set repair, four exit codes.
- `inverted-index.test.ts` — 25 falsifiers, each proven to discriminate.
- `.github/workflows/search-index-cadence.yml` — every 6 h, publishes via the
  `heartbeat/`-style staging branch + PR lane, with in-production assertions.
- `db/search-index/inverted/` — the committed artifact.

## Acceptance

- [x] Built from an **explicit git rev**, recorded in `manifest.json`.
- [x] Query **refuses (exit 3)** rather than answering from a corpus that moved;
      `1` (no matches) and `3` (cannot answer) are distinct and both are used.
- [x] Rebuild at a rev is **byte-identical**; no timestamp in the artifact.
- [x] Stop words dropped; phrase queries **refused with the reason**, and the
      positional index they need filed separately (081M0QWDDDV087G0R003HM0KYX).
- [x] Culture-invariant ordering, asserted to **diverge** from `localeCompare`.
- [x] Text (JSONL), not binary; the size decision recorded with measurements.
- [x] 6-hourly cadence that cannot push to `main` and cannot fail silently.
- [x] Beats `git grep` on the motivating case: **~0.07 s vs ~0.8 s**, with the
      26-file coverage difference **fully accounted for** and 0 unexplained.

## Deliberately NOT built (filed, not half-done)

- Phrase / proximity / positional indexing — **081M0QWDDDV087G0R003HM0KYX**.
- BM25 ranking, trigram regex accelerator, incremental segment merge —
  **081M0QWDDF3087G0R000V7T6BV**.

## Two defects this work found in itself

Both were the _same failure the work-item exists to remove_, reproduced inside
the fix, and both were found by **diffing the index's coverage against
`git grep` and accounting for every missing file** rather than accepting close
totals:

1. `verifyLandauer` — camelCase welded into one token; 20 files missing.
2. `Landauer–Bennett` — a **U+2013 EN DASH** treated as a word character.

And one design error caught by measurement: a df cap of 100, chosen off the size
table, **refused `landauer`** (447 files) — the very query this exists to answer.
A cap tuned only against size has no opinion about what anyone searches for.
