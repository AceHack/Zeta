---
id: 081M08MVPR9087G0R000NCF8PV
type: bug
state: in-progress
priority: P2
slug: pr-review-archive-under-reports-threads-on-merge-fetch-races
title: "PR-review archive under-reports threads: on-merge fetch races the post-merge reviewers (21/100 sampled zero-thread docs are wrong)"
created: 2026-08-17T19:58:30.153Z
depends_on: []
composes_with: []
---

# PR-review archive under-reports threads: on-merge fetch races the post-merge reviewers (21/100 sampled zero-thread docs are wrong)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M08MVPR9087G0R000NCF8PV-*.md` glob. -->

## The defect

`.github/workflows/pr-archive-on-merge.yml` fires on `pull_request: closed` and
`archive-pr-reviews.ts` fetches `reviewThreads` immediately. The repo's automated reviewers
(`copilot-pull-request-reviewer`, `chatgpt-codex-connector`) post their threads **after** the
merge event. The archive job finishes ~40 s after the event; the reviewers land at a median
of **+109 s**. The archiver wins that race, records the count it saw, and nothing ever
revisits — so the snapshot is frozen wrong.

The zero case is the dangerous one because it is **indistinguishable in the artifact**:
`| Total threads | 0 |` reads identically whether it means "there were none" or "we fetched
before they existed". That is the vacuity class — a check that did not run looking like one
that passed.

## Measurement (2026-08-17, `audit-review-archive-thread-capture.ts`)

Sample sizes chosen ex ante from the rule of three (Hanley & Lippman-Hand 1983): an all-clean
n=100 would have bounded the rate at ≤3% (95%), i.e. ≤183 of 6,097 docs.

| population | n | seed | UNDER-REPORT | OVER-REPORT | FETCH-FAILED |
|---|---|---|---|---|---|
| recorded `Total threads = 0` (6,097 docs) | 100 | 4 | **21** | 0 | 0 |
| recorded `Total threads > 0` (1,978 docs) | 40 | 4 | **8** | 0 | 0 |

21/100 → 95% CI **14.2%–30.0%** (Wilson) ⇒ **864–1,828** of the 6,097 zero-docs misreport.
The non-zero arm at 8/40 (20%, CI 10.5%–34.8%) is statistically indistinguishable, and
**never once** does the archive over-report (0 of 140). So this is not "the zeros are fake" — it is a uniform
early-snapshot truncation; the zero class is merely where truncation is total and invisible.

## Mechanism: race, confirmed — not pagination, permission, or parsing

For all 22 discrepant PRs examined, `first_thread_comment_at − merged_at` is **positive**:
min +22 s, median +109 s, max +78 min. **Zero negatives** — no thread that existed before the
close event was ever dropped. Excluded alternatives: counts are 1–15 (no 50/100 page
boundary); the same credential fetches the threads fine now (no permission gap); 1,978 docs
carry non-zero counts (the parser works).

Second-order finding: the orphan drains (e.g. #11472) ship archive content **verbatim from
the original merge-time run** — they re-derive *set membership*, not the API content. So a
doc committed months later (PR-9181's landed 2026-08-17) still carries the merge-time zero.
Draining does not heal this; only a re-fetch would.

## Do NOT backfill yet

Rewriting ~6,000 historical documents is a large, hard-to-reverse action on the repo's own
memory (§5 Memory Preservation). Measure-first is done; the remedy is a **human ruling**
(Aaron) on scope. Candidate remedies, unranked and unauthorized:

1. **Forward fix** — re-archive on a delay, or on a second trigger after the reviewers settle;
   make the archive idempotent-by-upsert so a later richer capture wins.
2. **Honest register in the artifact** — record `fetched_at` relative to `merged_at` in the doc
   so a reader can see a zero was taken 12 s after close and distrust it. This alone converts
   the vacuity into a legible uncertainty and costs no history rewrite.
3. **Backfill** — only with a ruling, and only as *addition* (never overwriting a richer capture,
   the rule #11472 already applied to its 42).

## Repro

```bash
bun src/Core.TypeScript/hygiene/audit-review-archive-thread-capture.ts --sample 100 --seed 4
bun src/Core.TypeScript/hygiene/audit-review-archive-thread-capture.ts --population nonzero --sample 40 --seed 4
bun src/Core.TypeScript/hygiene/audit-review-archive-thread-capture.ts --prs 9181   # the one-line proof
```

## Re-measurement 2026-08-18 — the filed rate HOLDS, the filed *reading* of it does not

Re-measured before fixing, because a fix aimed at a stale measurement is worse than none.
New instrument: `src/Core.TypeScript/hygiene/audit-review-archive-capture-window.ts`. It differs
from the original audit in one load-bearing way — it compares each live thread's first-comment
time against the doc's **`fetched_at`** (from the PR shard), not against `merged_at`. `merged_at`
is when the EVENT fired; `fetched_at` is when the archiver LOOKED, and the ~40 s between them is
exactly the interval the original inference could not see.

```bash
bun src/Core.TypeScript/hygiene/audit-review-archive-capture-window.ts --population all  --sample 150 --seed 4
bun src/Core.TypeScript/hygiene/audit-review-archive-capture-window.ts --population zero --sample 100 --seed 4
```

| population | n | seed | AGREE | RACE | LOSS | OVER |
|---|---|---|---|---|---|---|
| all docs (8,229) | 150 | 4 | 120 | **30** | **0** | 0 |
| recorded-zero docs | 100 | 4 | 76 | 23 | **1** | 0 |

**Three rates, and conflating them is the error to avoid:**

| rate | value | what it means |
|---|---|---|
| doc-level under-report | **30/150 = 20.0%** (95% CI 14.4–27.1) | fraction of DOCS that are wrong — this is what "21/100" measured |
| thread-level capture | **191/257 = 74.3%** | of the review threads that now exist, the share the archive holds |
| **fetchable capture** | **191/191 = 100.0%** | of the threads that existed *when the archiver looked*, the share it captured |

The filed 21% reproduces (24/100 on the same population and seed — statistically identical).
But it has been read downstream as "the archiver captures 21 of every 100 reviews". **It does
not: it captures 74.3%, and 100% of what was fetchable.** The 21% is a count of wrong documents,
not of lost reviews. Both numbers are real; only the substitution is wrong.

## Mechanism: race CONFIRMED, and now confirmed against the right clock

`LOSS` — a thread that existed at `fetched_at` and was not recorded — is **0 of 150**. That single
number is what excludes the alternatives, because each would produce losses against what was
fetchable: pagination (the archiver paginates with `--paginate` + `endCursor`), an API cap
(counts run 1–15, nowhere near a page boundary), a permissions gap (the same credential reads
them now), a parse bug (1,978 docs carry non-zero counts).

The one `LOSS` in the zero-arm is **PR 2135**: thread at `21:27:01Z`, `fetched_at` `21:27:02.807Z`
— a **1.8-second** margin. That is GitHub read-replica visibility lag, not a dropped fetch. It is
recorded as LOSS rather than argued away, because the classifier counts an un-timestamped or
before-fetch thread against the archiver *by design* (the conservative side).

## The tail is much shorter than filed — and the fix does not depend on that

Archive-independent scan of the 2,000 most recently created merged PRs:

| | |
|---|---|
| PRs with any review thread | 55 of 1,997 (**2.8%**) |
| post-merge threads | 65, **all** from `copilot-pull-request-reviewer` |
| lag p50 / p90 / **max** | 177 s / 242 s / **283 s** |
| window covering 100% | **300 s** |

The filed max was +78 min, from a period when `chatgpt-codex-connector` also reviewed. Today's
tail is ~5 minutes. **This is exactly why the fix is not a `sleep`**: a fixed wait is correct only
until the reviewer population changes, and when it becomes wrong it is wrong silently. It would
also cost ~165 runner-hours/month to wait on 1,997 merges for the benefit of 55.

## The forward fix (shipped)

`src/Core.TypeScript/forge-host/github/reconcile-review-archive.ts`

- **Repair** — `--write`, wired into `agent-heartbeat.yml` soraya archive duty (`--since-hours 48
  --min-age-minutes 30 --limit 5`, oldest-first, bounded). Re-archives only docs whose live count
  exceeds the recorded count. Idempotent (§12): once they agree it does nothing.
- **One-way guard (§5)** — a re-archive is a whole-file rewrite, so the new count is re-read and
  the previous bytes are **restored** if it went down. This tool cannot lose a thread it had.
- **Guard** — `--check`, wired into `pr-manifest-integrity.yml` (scheduled 4x/day; reports rather
  than fails on `pull_request`, matching the derived-index precedent). Red when any PR merged
  more than 30 min ago still under-reports.
- **Anti-vacuity** — `--check` refuses to render a verdict without a **positive control**: a doc
  with a recorded, nonzero count that still matches GitHub. 97% of merges here never acquire a
  thread, so "everything agrees" is also what a totally broken archiver produces. No control ⇒
  exit 2 INCONCLUSIVE, never 0.
- **Cap-awareness** — `gh pr list` saturation is detected and, critically, is only treated as an
  under-scan when the listing stops *inside* the window (the first live run saturated at 3,000
  rows while covering a 72 h window three times over; a blanket "saturated ⇒ inconclusive" would
  have made the guard permanently mute).

Falsifier: 46 tests, **29/29 mutants killed**, including "regression guard removed", "accepts a
zero-thread control", "a finding downgraded by an incomplete scan", and "a missing PR recorded as
zero threads". Two mutants survived the first sweep and both were genuine holes in the tests, now
closed.

Demonstrated red, not merely asserted: `--check` against a copy of the archive with PR #10367
doctored from `12` threads to `0` exits **1** and names the PR; against the real archive it exits
**0** with an in-window positive control. Both runs printed below in the PR.

## The demonstration found a defect IN THE FIX — worth recording, same family as the bug

The first draft of the reconciler enumerated candidates with `gh pr list --state merged --limit N`
and filtered them by `mergedAt`. Doctoring PR #10367 to record zero and running `--check`
**produced a cheerful PASS**.

Cause: that listing is ordered by **creation**, and the two orders are not the same. PR #10367 was
created 2026-08-13 and merged 2026-08-17 — four days later — so it sat past the end of any bounded
newest-first listing. Worse, the coverage test compared the oldest listed *`mergedAt`* against the
window start and concluded "window fully covered", which is sound only if merge order matched
listing order. **A scan returning success while silently dropping rows is the 250-item-cap family**
— the exact defect class this work item is about, reproduced inside the tool built to catch it. A
guard with that property is worse than no guard, because it certifies.

Fix: enumerate from the repo instead. Candidates are the archive docs joined to their PR shards
(which carry `fetched_at`), which is complete by construction — finite, local, no cap, no ordering
assumption, and zero API requests. The window is measured on **`fetched_at`** rather than
`merged_at` for the same reason the re-measurement did: the race is "did a reviewer post after the
archiver *looked*". This also correctly windows backfilled docs, whose captures are recent even
though their merges are months old.

Measured difference, on the same 72 h window: the listing-based scan saw **0** thread-bearing docs;
the archive-based scan sees **57**.

## Backfill: still NOT done, still needs Aaron's ruling

Scope, re-measured: **20.0% of 8,229 docs (95% CI 14.4–27.1) ⇒ ~1,650 docs, plausible range
1,184–2,231.** (The filed 864–1,828 was computed over the zero-docs subset only.)

Cost, from the per-PR figures already measured on the `--all-merged` sweep (~3 GraphQL points,
~2 REST calls, ~4.4 s/PR): ~2 hours of wall-clock, ~5,000 GraphQL points — the *entire* hourly
budget, so it must be paced. Diff: ~1,650 modified archive documents.

Risk: it is a bulk rewrite of the repo's own memory (§5). The one-way guard above means no
capture can be *lost*, which removes the worst outcome but not the size of the action.

**Recommendation — option (b): a paced drain, not a bulk PR.** Authorize the reconciler to run
over full history at a small per-tick limit through the existing serialised archive duty, so the
backlog drains at a few documents per tick with every batch visible in an ordinary flush, exactly
as the `--all-merged` backfill net already drains its own hole. That keeps blast radius at
`--limit` per tick instead of 1,650 in one action, and any defect costs a handful of docs and
shows up in the first flush. Alternatives: (a) fix forward only and leave history wrong — cheap,
but ~1,650 documents stay silently misleading; (c) one bulk PR — fastest, largest blast radius,
and the least reviewable.

Until a ruling lands, **history remains wrong and is now legible**: the audit tool names exactly
which docs and by how much.
