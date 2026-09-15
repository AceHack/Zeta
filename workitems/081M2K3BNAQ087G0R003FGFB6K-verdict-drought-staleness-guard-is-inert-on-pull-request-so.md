---
id: 081M2K3BNAQ087G0R003FGFB6K
type: bug
state: backlog
priority: P2
slug: verdict-drought-staleness-guard-is-inert-on-pull-request-so
title: "verdict-drought staleness guard is inert on pull_request so a stale listing reports a false drought"
created: 2026-09-15T17:55:41.015Z
depends_on: []
composes_with: []
---

# verdict-drought staleness guard is inert on pull_request so a stale listing reports a false drought

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M2K3BNAQ087G0R003FGFB6K-*.md` glob. -->

## The false alarm

`drift (loud)` on PR #17414, 2026-09-15T17:44, reported:

```
register                        drought
last COMPLETED verdict          run 33998492679 success 0e79ac0a (2026-09-05T23:40)
time since that verdict         14047 min (threshold 45)
commits on main since           678 (threshold 10)
gate runs since that verdict    0
TRIGGER MAY BE BROKEN: 678 commit(s) landed on main since the last verdict
and ZERO gate runs fired for any of them.
```

**Every claim in that block is false.** Measured against the same API nine minutes later:

| | CI, 17:44 | local, 17:53 |
|---|---|---|
| verdicts in the 60-run window | 60 | 59 |
| still running | 0 | 1 |
| last completed verdict | **2026-09-05** | **2026-09-14T18:18** (run 34877216727) |
| gate runs since that verdict | 0 | 1 |
| register | `drought` | **`ok`** |

`gate.yml` runs on `main` are completing normally — the last 40 are 37 success / 3 failure,
all `event=push`, most recent 2026-09-14T17:51. The detector's own query
(`?branch=main&event=push&per_page=60`) returns those runs when issued by hand.

So CI received a listing whose newest entry was ~10 days old, and folded it into a
confident claim that the trigger is broken.

## Why the guard that exists for this did not fire

`detectStaleWindow` is exactly right in principle — *"A window that cannot see the run it is
being read from is stale"* — and it is gated on `selfIsInsideWindow`:

```ts
return ctx.eventName === "push"
    && ctx.refName === "main"
    && ctx.workflowRef.includes(".github/workflows/gate.yml");
```

Sound reasoning: absence only proves staleness if the caller SHOULD appear in the list.

**But `drift (loud)` runs on `pull_request`.** On that event the predicate is false, the
staleness check returns `null`, and the fold proceeds on whatever the page contained. The
guard is structurally inert on the event the detector most often runs under — which is
precisely when a stale page turns into a false drought.

## Why the obvious fix does not work

Comparing a `per_page=1` read against the `per_page=60` window was tried: both returned the
same newest run (35004053203, 2026-09-15T17:53). Two reads can be stale together, so a
second read of the same endpoint is not an independent witness.

## Why this one matters more than an ordinary flake

This is the detector whose entire job is distinguishing real silence from apparent silence.
A false `drought` is the same defect class as `liveness-ledger` pointed at a repo checkout
printing "holds NO records at all" — a FALSE ALARM in the one check that exists to tell
those apart. And it fails in the expensive direction: it claims 678 commits carry no verdict
and that the trigger is broken, which is alarming, specific, and wrong. A reader who checks
it once and finds it false learns to skim it.

## Candidate directions, none chosen

1. Give the PR-event path its own witness: something the listing MUST contain that is not the
   caller — e.g. the newest `main` commit's own push run, looked up by SHA.
2. Cross-check the window against a different endpoint (commits on `main`), so the two
   sources are genuinely independent rather than the same listing read twice.
3. Report `unmeasured` rather than `drought` whenever the window's newest entry is older than
   the newest `main` commit by more than the gate's median duration — the signature of a
   stale page rather than a dead trigger.

(3) is the smallest and matches the file's existing doctrine that UNKNOWN is a first-class
verdict which never aggregates into green.

**Do not** make this job `continue-on-error`. The file already refuses that for the right
reason, and the defect is a wrong ANSWER, not an inconvenient one.
