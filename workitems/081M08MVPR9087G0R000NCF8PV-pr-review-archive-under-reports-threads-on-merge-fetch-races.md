---
id: 081M08MVPR9087G0R000NCF8PV
type: bug
state: backlog
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
