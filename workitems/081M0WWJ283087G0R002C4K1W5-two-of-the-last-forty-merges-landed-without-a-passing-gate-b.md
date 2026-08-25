---
id: 081M0WWJ283087G0R002C4K1W5
type: bug
state: backlog
priority: P2
slug: two-of-the-last-forty-merges-landed-without-a-passing-gate-b
title: "two of the last forty merges landed without a passing gate, because the only required check has an admin bypass every agent inherits"
created: 2026-08-25T16:37:51.491Z
depends_on: []
composes_with: []
---

# two of the last forty merges landed without a passing gate, because the only required check has an admin bypass every agent inherits

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0WWJ283087G0R002C4K1W5-*.md` glob. -->

## The measurement

Last 40 merged PRs (via the **check-runs API**, latest run per name — `statusCheckRollup`
under-reports and would have missed this):

| verdict                                                | count | PRs        |
| ------------------------------------------------------ | ----- | ---------- |
| `gate (required)` completed/success on the merged head | 38    | —          |
| `gate (required)` **never ran on the head**            | 1     | **#15384** |
| `gate (required)` completed/**failure**                | 1     | **#15363** |

Both escapes are the same mechanism, and one of them broke `main` for every other lane.

## What #15384 did, second by second

```
16:28:45  PR created
16:28:53  lint (TS)  -> failure          (a stray `${r.model:}`; the file does not parse)
16:28:53  agencysignature (PR body) -> failure
16:28:57  MERGED                          -- 12 seconds after creation
16:29:19  build-and-test  -> still starting
          gate (required) -> NEVER CREATED for this head SHA
```

`main` then failed `lint (TS)` — a FLOOR job — so `gate (required)` went red on the merge
ref of **every open PR in the repo**. Fixed in #15386. This item is about how it landed,
not about the typo.

## The mechanism — and why "no `--admin`" is not the guard anyone thinks it is

```
$ gh api repos/Lucent-Financial-Group/Zeta/rulesets/16134995 -q '.bypass_actors'
[{"actor_id":5,"actor_type":"RepositoryRole","bypass_mode":"pull_request"}]
```

`CI Gate` requires exactly one check, `gate (required)` — and grants the **admin repository
role a `pull_request` bypass** of it. The whole fleet authenticates as the shared `AceHack`
credential, which holds that role. So:

> **Every agent in the fleet silently holds bypass on the only required check, and a plain
> `gh pr merge --squash` is enough to use it. `--admin` is not involved.**

The standing instruction "no `--admin`" therefore protects nothing here. This is the repo's
own named top obstacle to human-AI trust — _an unenforced exception looks like a guarantee
and carries none_ — sitting on the required check itself.

## What exists, and the exact gap

`src/Core.TypeScript/forge-host/github/required-check-started.ts` already classifies
"the required check never started" — correctly, and with the sharp `stalled` (no run exists)
vs `queued` (run exists, name unpublished) discriminator. **It is scoped to OPEN PRs**: it
answers _"is this PR stuck?"_, never _"did that one land without a gate?"_

Nothing audits **merged** PRs. So an escape produces no signal at all — no failed run to
find, no red check, no error in a log. Invisible by construction, which is the same shape
`audit-pr-archive-coverage.ts` documents for unarchived PRs.

## Proposed fix (two parts; the first is the real one)

1. **Post-hoc coverage audit over merged PRs**, modelled on `audit-pr-archive-coverage.ts`:
   for each PR merged in a window, assert its merged head SHA carried a `completed` /
   `success` `gate (required)` **via the check-runs API**. Report escapes as a named,
   enumerable population — separating _never ran_ from _ran and failed_, because they are
   different defects. Measured baseline to ratchet from: **2 of the last 40**.
   This is the piece that makes the class visible; it does not block anyone.

2. **Then ask whether the bypass should be narrowed** — e.g. an `Integration`/named-actor
   bypass instead of the whole admin role, so a human breaking glass is distinguishable
   from an agent doing it by accident. This is a **maintainer decision about repository
   settings**, deliberately not taken here, and it must not be taken before (1) exists:
   narrowing an escape hatch nobody is measuring is how a fleet gets wedged.

## Falsifier

The audit must be shown to FAIL on today's window (it will: #15384 and #15363), not merely
to pass once the window has rolled past them. A coverage audit that only ever reports zero
is the vacuity class.

## Anchors

- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the escape is measured, not asserted
- `src/Core.TypeScript/hygiene/audit-pr-archive-coverage.ts` — the shape to copy: measure the
  OUTCOME, not the exit code
- `src/Core.TypeScript/forge-host/github/required-check-started.ts` — the open-PR half that
  already exists
- PR #13909 — the same class from the other side: lanes green for never doing their work
