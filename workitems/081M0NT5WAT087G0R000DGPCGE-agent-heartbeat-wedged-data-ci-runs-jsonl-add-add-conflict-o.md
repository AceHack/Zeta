---
id: 081M0NT5WAT087G0R000DGPCGE
type: bug
state: backlog
priority: P2
slug: agent-heartbeat-wedged-data-ci-runs-jsonl-add-add-conflict-o
title: "agent-heartbeat wedged: data/ci-runs.jsonl add/add conflict once the file reached main"
created: 2026-08-22T22:41:34.042Z
depends_on: []
composes_with: []
---

# agent-heartbeat wedged: data/ci-runs.jsonl add/add conflict once the file reached main

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0NT5WAT087G0R000DGPCGE-*.md` glob. -->

## What happened

`agent-heartbeat` went red at 22:05:54Z after a long green streak. Runs 32601483043 and
32602358227. All three lanes (`otto`, `alexa`, `soraya`) failed the step **"Accumulate
unflushed heartbeat state over current main"**:

```
prepare-heartbeat-branch: carry unflushed heartbeat state failed: Auto-merging data/ci-runs.jsonl
CONFLICT (add/add): Merge conflict in data/ci-runs.jsonl
```

## What changed

`data/ci-runs.jsonl` reached `main` for the FIRST TIME in the repository's history at
**21:54:47Z** (commit `7fe1ef1bb`, PR #13955) — between the last green tick (21:52:16Z) and
the first red (22:05:54Z). #13935 had just fixed a `git add` with no `git commit`, so the
drift-rate recorder's appends finally landed. Until then the file existed only on the
`heartbeat/*` lanes, where there was nothing on main for it to conflict with.

The preparer does `checkout -B <lane> origin/main` then `merge --squash <previous lane>`.
Both sides had now independently CREATED the file, so the merge base has neither — add/add,
not the content conflict the earlier members of this class produced.

## Two symptoms, one root cause

The second symptom is **not** a credential fault, despite appearances. `flush alexa
heartbeats` failed its **"Fail if a heartbeat PR is old and gate never started"** step:

```
required-check-started: no gate.yml run exists for heartbeat PR(s): #13963, #13962, #13961
```

Measured with `git merge-tree origin/main <pr-head>`: the **only** conflicting path on those
three flush PRs is `data/ci-runs.jsonl`, the same add/add. They are `mergeable: CONFLICTING`
/ `mergeStateStatus: DIRTY`, and GitHub does not build a merge ref for a conflicting PR, so
no `pull_request`-triggered workflow — including `gate.yml` — can ever run on them. The
check then correctly reports that `gate (required)` can never report.

So: **one root cause, two independent failure paths.** (b) is a sibling of (a), not a
consequence of it — proven by the first red run (32601483043), where all three tick jobs
failed and all three flush jobs still passed. (b) only appeared one run later because the
flush PRs had to age past `--min-age-min 20` before the check would consider them.

## Not the diagnosis it looked like

Both strings that read like errors in `gh run view --log-failed` are the workflow's own
script text, echoed by the `##[group]Run` header, and were **never emitted**:

- `fatal: empty ident name` — three occurrences, all inside the step's comment documenting
  the *2026-08-16* outage. The step sets `git config user.name`/`user.email` before the
  preparer today; that fix is present and working.
- `BOTH credentials were refused` — one occurrence, inside the `echo` in the probe's source.
  The probe passed; no `::warning`/`::error` from it appears in the run.

Verified by filtering log lines on the ANSI script-echo prefix: zero occurrences of either
string outside it.

## Fix

Declare `data/ci-runs.jsonl merge=union` in `.gitattributes` — the eighth member of the
heartbeat lane merge-semantics class. Justification measured on the live refs and recorded
inline there. Falsifier: `prepare-heartbeat-branch.test.ts` §"carries a ci-runs log both
sides CREATED, keeping every row exactly once", which fails when the declaration is removed.

The three stuck flush PRs need no manual action: `retire-superseded-flush-prs.ts` closes
them once each lane's next tick opens a replacement.
