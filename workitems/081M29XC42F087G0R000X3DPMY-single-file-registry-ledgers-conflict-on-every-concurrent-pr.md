---
id: 081M29XC42F087G0R000X3DPMY
type: task
state: backlog
priority: P2
slug: single-file-registry-ledgers-conflict-on-every-concurrent-pr
title: "single-file registry ledgers conflict on every concurrent PR"
created: 2026-09-12T04:17:54.767Z
depends_on: []
composes_with: []
---

# single-file registry ledgers conflict on every concurrent PR

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M29XC42F087G0R000X3DPMY-*.md` glob. -->

## The observation

Reconciling eight concurrent PRs on 2026-09-12 produced **seven merge conflicts**,
and six of them were the same three files:

| file | size | what conflicted |
|---|---|---|
| `registry/unbounded-growth-register.json` | 45.6 KB | 3x — twice "both sides added a DIFFERENT new row in the same array slot", once two independent re-measurements of one row |
| `docs/UNHASHED-DEPENDENCIES.md` | 10.5 KB | 3x — a **derived** file; both sides were measurements taken at different times |
| `src/Core.TypeScript/hygiene/apt-job-timings.measured.json` | 47.7 KB | 1x — both sides added a different new entry in the same array slot |

Not one of these was a real disagreement. Every single one was **two parties appending
independently to a single-file ledger**, which git can only present as a conflict because
the additions land on adjacent lines. The resolution each time was mechanical: keep both,
or regenerate.

## Why this is the shape the repo already rejected

Aaron 2026-09-11, on the refutation ledger:

> *"any ledger that's stored in git should not be a single file, it should use partitioning
> and date based folders like we already described and can also take advantage of our
> zetaid if needed."*

`db/refutations` was built that way — one append-only file per row under
`YYYY/MM/DD/<zetaid>.json`, never rewritten. Two appends there cannot conflict, because
they are different files. The three above predate that principle and are the same ledger
shape it was written for.

Note the second-order cost, which is worse than the merge time: **a hand-resolved append
can silently drop an entry.** It nearly did today — one register conflict was resolved by
splicing two rows apart, and had it been resolved by picking a side, a measured row would
have vanished with nothing to notice. A conflict in `claude-agent.test.ts` the same day
DID truncate a test (it failed loudly only by luck of where the boundary fell).

## What to do

Not a rewrite of the register's content — it is good content. The change is the **storage
shape**, and the two files differ in what they want:

1. **`apt-job-timings.measured.json`** — pure append of per-job measurements, keyed by
   `<workflow>.yml:<job>`. The natural shape is one file per key, which makes concurrent
   appends conflict-free by construction. It already has a refresher
   (`refresh-apt-job-timings.ts`) that would become the writer.
2. **`registry/unbounded-growth-register.json`** — rows keyed by path, but with a ratchet
   that is *meant* to be reviewed. One file per registered path keeps the review property
   and removes the collision.
3. **`docs/UNHASHED-DEPENDENCIES.md`** — already derived and already regenerable; the fix
   here is not partitioning but making the conflict a non-event, e.g. by not committing it
   at all, or by a merge driver that regenerates. Cheapest of the three.

## Falsifier

The check that would prove this fixed: two branches each adding a new entry, merged in
either order, with **no conflict and both entries present**. That test cannot pass today
for (1) and (2), and passes trivially for `db/refutations`, which is the control.

## Measurement to redo before starting

Counted on `main`, last 7 days: register 5 commits, timings 4, UNHASHED 6 — all
single-author, so the *sequential* rate looks harmless. The cost is entirely in
**concurrent branches**, which this count does not show. Anyone re-measuring should count
conflicts across in-flight PRs, not commits on `main`; that is the number that was 6-of-7
today.
