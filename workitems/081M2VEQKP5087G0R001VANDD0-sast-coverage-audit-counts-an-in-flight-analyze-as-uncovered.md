---
id: 081M2VEQKP5087G0R001VANDD0
type: bug
state: backlog
priority: P2
slug: sast-coverage-audit-counts-an-in-flight-analyze-as-uncovered
title: "SAST coverage audit counts an in-flight Analyze as uncovered, so a commit landing mid-run is a false premise violation"
created: 2026-09-18T23:48:22.341Z
depends_on: []
composes_with: []
---

# SAST coverage audit counts an in-flight Analyze as uncovered, so a commit landing mid-run is a false premise violation

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M2VEQKP5087G0R001VANDD0-*.md` glob. -->

## The false alarm

`drift (loud)` on `main` run **35404883426**, 2026-09-18, failed at step 7
(`SAST covers every commit that landed on main`). main's gate had been green for
the previous **ten** consecutive push runs.

The audit reads main's **live** newest-30 commits, so it samples commits that
land *while the very run executing it is still going*. Its own job window was
23:34:25 → 23:38:33. Commit `4ad5d300e` landed at **23:37:49** — inside that
window — and was reported as a premise violation for carrying no successful
`Analyze` run **twelve seconds** after being pushed. No commit could have
satisfied that.

Re-run by hand at 23:40 against the same API: `rc=0`, all 30 covered. The
condition was not a hole in `main`; it was the clock.

## Why the audit could not tell

`CheckRunsPage` declared only `{ name, conclusion }` and `scanCommit` folded

```ts
if (r.conclusion === "success") ok += 1;
else bad += 1;
```

`status` was never read, so an Analyze that was **still running** was
indistinguishable from one that **never ran** — both landed in the `else`. This
is the repository's central failure class in its mirror form: not a check that
did not run looking like one that passed, but a check that **has not finished**
looking like one that **failed**. It fails in the expensive direction too — it
claims the premise under the Scorecard #24 dismissal no longer holds, which is
alarming, specific, and wrong, and a reader who checks it once and finds it
false learns to skim it.

## The fix, and the guard that keeps it from being a hole

Three-way classification (`classifyAnalyzeRun`, lifted out pure for the same
reason `judge` is — the network half cannot be tested without a token):

| run | counts as |
|---|---|
| `conclusion === "success"` | coverage |
| `status` present and not `completed` | **pending — undecided, neither way** |
| anything else | unsuccessful |

"Treat pending as fine" is exactly how a guard goes vacuous, so the property
that stops it is explicit and tested: **a commit whose Analyze never RAN has
zero Analyze check runs — nothing pending, nothing successful — so it is still
`unscanned` and still fails.** Only an actively-running analysis is excused, and
that excuse expires by itself: the run concludes either success (covered) or
non-success (uncovered). Pending can never persist and hide a hole.

Two further edges are pinned because they are where a careless version of this
fix would leak: `status` decides pending and **not** a null conclusion (a
*completed* run can carry a null conclusion, and excusing those would hide real
holes behind the fix), and an absent `status` on an old `--json` fixture reads as
completed, which fails closed.

Witnessed by mutation: collapsing `pending` back into `unscanned` turns 3 tests
red; making `classifyAnalyzeRun` read `conclusion` instead of `status` turns 2
red. 16 pass restored.
