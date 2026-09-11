---
id: 081M28KKPTX087G0R002ZACT29
type: task
state: backlog
priority: P2
slug: prove-containment-before-retiring-loop-tick-history-md-and-b
title: "Prove containment before retiring loop-tick-history.md and BACKLOG.md — both stay, and the documented path back to churn is closed"
created: 2026-09-11T16:08:03.165Z
depends_on: []
composes_with: [081KQJZR90008QG0R0025WX5ZJ, 081KQ8P5D0008QG0R001BH93SA, 081KQ8P5D0008QG0R001D8RCZ9, 081M28JYYCC087G0R003423HAP]
---

# Prove containment before retiring loop-tick-history.md and BACKLOG.md — both stay, and the documented path back to churn is closed

## Outcome: BOTH FILES STAY. Nothing was deleted.

Aaron 2026-09-11: *"any time a single file is getting written over and over
and over on some cadence that's a huge smell on github where history is
forever"* — and the shape to prefer is *"one per event ... in dated folders
so we don't end up with too many files in one folder."*

Two files were named for retirement on that smell. Containment was measured
before either was touched, which is the whole discipline: a file whose content
lives nowhere else is not residue however often it was rewritten. Both come
back **keep**, for opposite reasons.

## `docs/hygiene-history/loop-tick-history.md` — NOT contained

696 committed versions, 648 KB, dead since June. Successor found: per-tick
shards at `docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md` (1209 files) —
which is already exactly the one-per-event-in-dated-folders shape.

The shard README claimed historical content was *not* migrated. Nobody had
checked, so it was checked:

| | |
|---|---:|
| legacy rows | 212 |
| rows with a shard at the same UTC minute | **0** |
| rows with any shard on the same day | 21 |
| rows with **no shard at all** | **191** |

The cutover is clean rather than overlapping. Shards begin `2026-04-29T02:30Z`;
the table's rows for that day stop at `01:55Z`. Days 2026-04-21 .. 2026-04-27
exist only in the table. Even the 21 same-day rows are *not* contained — a
different minute is a different tick, so the 21 is an upper bound on
containment and the real figure is zero.

Readers, measured before proposing removal: 13 references in `src/`, one live
CI job (`lint-tick-history-order` in `gate.yml`), 965 in `docs/`. No `db/`
ledger cites it, so no append-only surface is implicated.

**Verdict: keep. Its churn was the defect; its content is not.** The churn
ended in April when shards took over.

## The live defect that WAS found, and fixed here

`docs/hygiene-history/ticks/README.md` specified a future generator whose
step 4 was *"Append to docs/hygiene-history/loop-tick-history.md"* on a
post-merge or daily cadence. That is a documented instruction to restart a
696-version rewrite loop with a cron attached. Its own mitigation —
*"run it on a separate cadence, not on every tick PR"* — only changes how
often the rewrite happens, never that it happens.

Replaced with the sanctioned shapes, which all leave no rewritten file behind:
stdout, a gitignored path, or one dated artifact per run. Two other stale
sentences in the same README that promised the same collation were corrected.
A `FROZEN` header carrying the containment table was added to the table itself,
so the next agent reads the measurement instead of re-deriving it — or worse,
assuming.

## `docs/BACKLOG.md` — TOTALLY contained, and it still stays

800 committed versions, 298 KB. It is an **auto-generated index**
(`src/Core.TypeScript/backlog/generate-index.ts`) over `docs/backlog/P*/**`.

| | |
|---|---:|
| index rows | 1138 |
| rows whose backing file exists | **1138** |
| rows with no backing file | **0** |
| `generate-index.ts --check` | **exit 0, byte-identical** |
| per-row files not linked from the index | 2 (`README.md`, a resume-state doc — correctly not rows) |

The one apparent title mismatch was an artifact of the verifier's YAML
quote-stripping, not a real divergence.

So this is the same shape as `docs/github/prs/manifest.jsonl` (retired in
#17279) with **one decisive difference: manifest.jsonl had no reader.**
`docs/BACKLOG.md` is named in `CLAUDE.md` §3 as the surface you open to pick
work, it has a live drift gate (`backlog-index-integrity.yml`, path-filtered,
not among the 2026-08-29 paused batch), and it is the legacy-and-kept class
that `.claude/rules/workitems-mint-with-zetaid.md` already describes for
`docs/AGENDA.md` and the `B-NNNN` rows.

**And the premise has already expired.** It is no longer cadence-written: three
writes since 2026-07-01 (2026-07-03, 2026-08-01, 2026-09-06), each one an
incidental regeneration after a row closed. The 800 versions are a *closed*
historical hotspot from the pre-migration 17,084-line monolith era, tracked and
closed as `081KQ8P5D0008QG0R001BH93SA`. Deleting it now would remove a live read
surface to fix a problem that stopped three months ago.

**Verdict: keep, unchanged.** Reporting "this should stay" is the correct
outcome for a containment check, and it is the outcome here.

## Not taken — needs a decision that is not mine

`src/Core.TypeScript/hygiene/append-tick-history-row.ts` still appends to the
frozen legacy table. It has **zero callers** (its only in-repo mention is a hint
string in `check-tick-history-order.ts` pointing at a `.sh` that no longer
exists), so it is dormant rather than active — but it is the one mechanism that
could restart the churn by hand.

This is already filed as open P3 row `081KQJZR90008QG0R0025WX5ZJ` (2026-05-02),
which deliberately offers three resolutions — retire / repurpose to write shards
/ deprecate-then-delete — and says it is *"not forcing a particular choice."*
Choosing one inside a containment cleanup would be making someone else's
decision in a PR nobody would think to look in. Left open, and named here so it
is not lost.

## Falsifiers

- `bun src/Core.TypeScript/backlog/generate-index.ts --check` — exit 0 proves
  `docs/BACKLOG.md` is fully derived, today.
- The containment scripts were throwaway and deliberately not committed; their
  numbers are recorded above and in the two files' own headers, where the next
  reader will actually be standing.
