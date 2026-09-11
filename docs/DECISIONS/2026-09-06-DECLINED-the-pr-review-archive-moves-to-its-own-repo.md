# DECLINED — the PR-review archive moves to its own repo

**Status: DECLINED, 2026-09-11, by Aaron. Nothing moved. The archive stays in Zeta.**

> *"pr reviews seem to belong in the same repo, since that's what they are against, and it does
> not cost many bytes — and we can fix file/folder sprawl with dated folders. in a perfect world
> it's one file per merge to main."*

Three reasons, and the third is why this document is closed rather than deferred:

1. **Colocation is the point.** The records are *about* this repo's PRs. Splitting them puts the
   evidence in a different place from the thing it is evidence for.
2. **The cost is small at the current rate** — see the correction below.
3. **The sprawl this document was reacting to has been fixed by other means.** PRs #17283/#17285
   bucketed `docs/history/pr-reviews/` by `merged_at` into `YYYY/MM/DD/` — 119 day directories,
   median 93 files, max 522. The flat 14,378-file directory that motivated the split is gone.

## THE MEASUREMENT BELOW EXPIRED BEFORE IT WAS ACTED ON

The "64% of accretion" figure was measured over a 30-day window ending 2026-09-06. **That window
is almost entirely BEFORE the 2026-08-29 batch disable of the cadence workflows**, and the rate
changed by more than an order of magnitude on that date:

| window | files/day into the two archive trees |
|---|---:|
| 2026-08-12 → 08-29 (before the pause) | **1,974** |
| 2026-08-29 → 09-11 (after) | **120** |

So the document is not wrong — it accurately described a regime that ended a week before anyone
read it. Re-measure before reviving any part of this; the premise is dated, not false.

A second correction, from the growth register work the same day: **rewrite count is a poor proxy
for on-disk cost.** `data/tick-history.json` has 1,090 committed versions summing to 189.3 MB raw
and occupies **241 KB on disk** — 805×, because git delta-compresses canonically-ordered appends.
Size arguments in this document that reason from counts or raw sums overstate the case. The
**file count** (28,757 across both trees) is the part that survives, and it is a tree/scan cost
rather than a byte cost.

## What remains true and worth keeping

The open question this document framed correctly is *where data should live*, and the answer for
the archive is "here, bucketed." The tiering discipline it gestures at is now recorded as a
general rule — bounded vs unbounded growth, a cost model per unbounded path, and DV2.0 satellite
depth as the tier — in `registry/unbounded-growth-register.json` and its audit (PR #17286).

The original draft follows, unedited, as the record of the analysis.

---

**Original draft, unedited (Status at the time: DRAFT, not authorised).**
Written on Aaron's 2026-09-06 request — *"draft the archive repo split"* — after the
measurement in `081M1TRJ3X5087G0R0032TNP8H`. The decision is his; this is the shape of it,
with the costs named rather than discovered later.

## Why

Aaron, 2026-09-06: *"we are trying to limit our size increase on zeta and make the growth
happen on other repos, zeta is trying to stay small … if you can make other repos grow
instead that's okay but also we want to reduce size too."*

Measured, 30 days:

| | files / 30d | |
|---|---:|---|
| whole repo | 53,944 | |
| **the two archive trees** | **34,339** | **64%**, ~44.2 MB |

Two-thirds of Zeta's accretion is one mechanism. It is not sprawl — it is the deliberate
per-PR archive, and its README calls it *"the project's most valuable data"*. So the
question was never whether to delete it. It is **where it should live.**

## What moves

| path | today | role |
|---|---:|---|
| `docs/history/pr-reviews/` | 13,983 files, 91,932 KB | the **content** — description, outcome, every review comment and thread |
| `docs/github/prs/` | 13,983 files, 63,460 KB | the **index** — ~10 JSON fields per PR, sharded, plus `manifest.jsonl` |

Both, together. Splitting them would leave an index in one repo pointing at content in
another, which is worse than either arrangement.

**Proposed home:** `Lucent-Financial-Group/zeta-pr-archive`, public, matching Zeta's own
visibility so nothing that is readable today becomes unreadable.

## What stays behind, and why it is not just a link

`docs/history/pr-reviews/README.md` stays, rewritten to say where the archive went and how
to get it. It keeps the *"why this is protected"* section verbatim, because that section is
the reason the data exists and it is addressed to whoever is holding the archive next.

A **one-line pointer file** — `docs/history/pr-reviews/ARCHIVE-MOVED.json` — carries the
repo, the ref, and the commit at which the move happened, so a reader lands on the exact
state Zeta last saw rather than on a moving target.

## `clone-at-tag-stays-sufficient` — the rule this must satisfy

`.claude/rules/clone-at-tag-stays-sufficient.md`: the tree must stay **buildable and
checkable from `git clone` at a pinned tag, with no package manager present, permanently**.

This split satisfies it, and the reason is worth stating precisely rather than asserting:

- **The archive is not on the build or check path.** Nothing compiles it, and no gate leg
  reads it to decide a verdict. `git clone && dotnet build && dotnet test` is unchanged.
- **What the rule actually forbids is a mandatory hub.** A reader who wants the review
  record does `git clone <archive repo>` — plain git, no `ace`, no package manager, no
  credential beyond what Zeta itself needs. That is an oracle they chose, not a hub they
  must route through.

**A submodule is NOT proposed.** A submodule would make the archive a *dependency of the
clone*, which is the opposite of what this is for, and it would put a second repo's
availability on Zeta's checkout path.

## Consumers that must move with it — enumerated, not estimated

Counted on `main` at draft time:

| class | count | disposition |
|---|---:|---|
| TypeScript files naming either path | **41** | the producer/reader set. Most are `src/Core.TypeScript/forge-host/github/*` and their tests |
| workflows naming either path | **5** | `pr-archive-on-merge.yml` (the producer, `pull_request: [closed]`), `pr-manifest-integrity.yml`, `archive-strand-alarm.yml`, `agent-reviewer.yml`, `agent-heartbeat.yml` |
| docs / rules / prose naming either path | **948** | prose. Correct opportunistically; nothing breaks |

**The producer is the load-bearing one.** `pr-archive-on-merge.yml` fires on
`pull_request: [closed]` and writes into Zeta. After the split it must write into the
archive repo instead, which needs a token scoped to that repo — and that is the one genuinely
new piece of machinery this change requires.

**Three of the five workflows are `disabled_manually` today** (`archive-strand-alarm`,
`agent-heartbeat`, and the heartbeat cadences beside them), which lowers the migration cost
and is worth knowing before anyone budgets for it.

## What this buys, and what it does NOT

**Buys:** 64% of file growth and ~44.2 MB/month stop landing in Zeta. Growth continues — in
the repo built to hold it, which is the stated strategy.

**Does NOT buy a smaller `.git`.** Zeta's pack is **285.8 MiB / 247,058 objects** and moving
files forward does not remove their history. Shrinking that requires a **history rewrite**,
which is a gated, non-reversible action only the maintainer authorises, and it invalidates
every existing clone and every commit SHA that names one. **Stopping growth and shrinking
the past are two decisions.** This draft is only the first.

## Order of operations

1. Create the archive repo, public, empty.
2. `git subtree split` / `filter-repo` the two paths into it **with history**, so blame and
   dates survive the move. Push to the new repo. Zeta is untouched at this point.
3. Verify the new repo independently: file counts match (13,983 + 13,983), a sampled PR's
   markdown and its shard both resolve, `derive-pr-manifest.ts` regenerates a manifest that
   agrees with the shards.
4. Repoint `pr-archive-on-merge.yml` at the new repo, with a scoped token. **Watch one real
   merge land there before step 5.**
5. Only then remove the two trees from Zeta, leaving the README and the pointer file.
6. Migrate the 41 TS consumers; correct prose opportunistically.

Step 5 last, and step 4 proven by a live archive write, so there is never a window where a
merged PR's review record is written nowhere.

## The correctness bug that should be fixed BEFORE the move, not during

`docs/github/prs/manifest.jsonl` is **stale**: 13,592 records against 13,982 shards, with
**390 shards absent from it** and 117 more where the shard is newer. Measured, not inferred.

`derive-pr-manifest.ts` already exists, so the manifest is *derivable* — which means the
honest options are to regenerate it or to stop committing it and derive on demand. Either
way, **do it while the data is still in one repo.** Carrying a known-stale index across a
repo boundary is how a small drift becomes an argument about which side is authoritative.

## Open, and Aaron's to answer

1. **Repo name and owner** — `Lucent-Financial-Group/zeta-pr-archive`, or under a different
   org if the archive is meant to outlive this one.
2. **Does the fine-tuning consumer follow it?** The archive's stated purpose is fuel for the
   GitOps training signal. If that pipeline reads from Zeta today, it moves too.
3. **History rewrite, separately.** Whether Zeta's existing 285.8 MiB is ever reclaimed is a
   different decision with a different blast radius, and this draft deliberately does not
   ask for it.
4. **The other growth sources**, unaddressed here and much smaller: `docs/observe-events`
   (+1,295 files/14d), `docs/drift-events` (+930), `workitems` (+1,072). Same shape, one
   file per event. Worth the same question later; not worth bundling into this move.

## Pointers

- `081M1TRJ3X5087G0R0032TNP8H` — the measurement this draft rests on.
- `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md` — the existing split
  decision. This would be a **fourth** repo and a different kind: that split is by
  dependency closure, this one is by change rate (DV2.0 — the archive is a pure satellite,
  append-only, never read by the build).
- `.claude/rules/clone-at-tag-stays-sufficient.md` — the rule §"clone-at-tag" above satisfies.
- `docs/history/pr-reviews/README.md` — the *read-not-refactor* protection and the
  maintainer's own statement of why this data matters.
