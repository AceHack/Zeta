---
id: 081M2NGVGXE087G0R000JN8F2F
type: bug
state: backlog
priority: P2
slug: no-actions-api-index-is-a-reliable-witness-so-a-stale-listin
title: "no Actions API index is a reliable witness so a stale listing still yields a false drought"
created: 2026-09-16T16:30:01.134Z
depends_on: []
composes_with: []
---

# no Actions API index is a reliable witness so a stale listing still yields a false drought

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M2NGVGXE087G0R000JN8F2F-*.md` glob. -->

## The residual, after the witness fix

#17418 added a `head_sha` witness so a stale `?branch=main&event=push` listing reports
`unknown` instead of `drought`. It works **when the witness is positive**. It does not close
the case, and the reason is measured.

**2026-09-16, on PR #17425, the detector again reported `drought`:** last verdict
2026-09-10T23:07, 156 commits since, ZERO gate runs since, "TRIGGER MAY BE BROKEN".

Measured minutes later against the same forge:

```
?branch=main&event=push&per_page=8   ->  720e8f97  success  2026-09-16T15:28  id=35115537452
                                         8d013e64  success  15:22
                                         4035ed39  success  15:15
```

`main` was being checked normally throughout. The window the detector read was ~6 days stale.

## Why the witness did not fire — and this refutes its own premise

`head_sha` was chosen precisely because two reads of `?branch=main&event=push` can be stale
together. That assumption is false in the other direction:

| index | answer for `720e8f97` |
|---|---|
| `?branch=main&event=push` | run **35115537452**, completed success |
| `?head_sha=720e8f97` | **no gate run at all** |

The same run, present in one index and absent from the other, minutes apart. So an absent
witness cannot distinguish "no run fired" from "this index has not caught up", and
`windowIsStaleNotDeadTrigger` correctly declines to reclassify — leaving the false `drought`
standing. **There is no known reliable second index**; both are eventually consistent and
neither dominates.

## What was tried and deliberately REVERTED

Two shapes were implemented and backed out rather than shipped:

1. **Treat an absent witness as proof of staleness.** Converts every `triggerLooksBroken` case
   to `unknown`. Broke 16 existing tests, because small synthetic windows legitimately have
   `runsSinceVerdict === 0` — it swallows real time-based droughts.
2. **Withdraw the "TRIGGER MAY BE BROKEN" sentence unless a positive witness confirms it.**
   Broke 20, including `"commits landing with ZERO runs is named as a broken trigger, not a
   slow gate"` — that naming is a DELIBERATE, PINNED design decision, not an oversight.

Both reverted; the file is back to the merged state at 75 pass / 0 fail. Recorded so the next
attempt does not rediscover two dead ends.

## What would actually decide it

An oracle outside the workflow-runs listing. Candidates, none implemented:

- **`/commits/{sha}/check-runs`** — a different service from the workflow-runs index, so its
  staleness is plausibly uncorrelated. Untested, and the cheapest thing to try next.
- **Poll the same index twice, seconds apart** — a read that changes between two calls proves
  the index is catching up. Costs latency and only proves staleness when it happens to resolve.
- **Accept it**, which is what stands today.

## Cost of leaving it

`drift (loud)` goes red on PRs whose branch is fine, and the red carries a specific false
claim ("156 commits carry no pass and no fail"). That is the muting risk this repo names
directly: a reader who checks the loudest sentence once and finds it false learns to skim it.
