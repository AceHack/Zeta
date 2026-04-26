# PR #622 drain log — superseded by #623 (clean-reapply pattern, stale-local-main)

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/622>
Branch: `tick-history/2026-04-26T15-55Z`
Outcome class: **CLOSED-NOT-MERGED** (superseded by #623)
Drain session: 2026-04-26 (Otto, autonomous-loop continuation)
Total threads drained: 0 (closed before review activity beyond Codex+Copilot first pass)
Rebase context: DIRTY at PR-open time due to stale-local-main; fix-forward via clean-reapply on fresh main.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): this drain-log captures the
close-not-merged outcome class for substrate preservation /
recovery, even when the PR's diff itself migrated cleanly.

This PR was the first attempt to land the 14:51:40Z + 15:55Z
tick-history burst rows after the manufactured-patience live-lock
correction; it became DIRTY immediately because the local
origin/main pointer was stale by ~50 minutes (the 14:51:40Z row
from #621 had landed but my `git fetch` cache hadn't refreshed
before the `git checkout -b` against `origin/main`).

---

## Outcome

- **Closed at:** 2026-04-26 ~15:57Z
- **Replaced by:** #623 (`tick-history/2026-04-26T15-55Z-v2`)
- **Substrate preservation:** complete. The single tick-history
  row (15:55:00Z) was extracted from the closed branch via
  `git show origin/tick-history/2026-04-26T15-55Z:docs/hygiene-history/loop-tick-history.md | grep "2026-04-26T15:55:00Z"`
  and re-applied on a fresh branch off current `origin/main` +
  `sort-tick-history-canonical.py`. #623 contains identical row
  content, applied cleanly without conflicts.
- **Branch retention:** retained on origin per Otto-238 (visible
  reversal preserved + recovery path preserved). Branch can be
  re-fetched at any time via `git fetch origin pull/622/head`.

---

## Why DIRTY at PR-open time

- 15:53Z: created branch `tick-history/2026-04-26T15-55Z` via
  `git checkout -b tick-history/2026-04-26T15-55Z origin/main`
- Local origin/main was stale by 1 commit (14:51:40Z row from
  #621 which had merged at 15:01Z but my local fetch hadn't
  picked it up since)
- Branch contained: my 14:10:55Z row at end + appended 15:55:00Z
- Real origin/main contained: my 14:10:55Z row + 14:51:40Z row
- Resulting state: my branch was missing 14:51:40Z, present on
  main → conflict in tick-history file

---

## Codex + Copilot reviews

Codex P2 + Copilot P1 (auto-fired on PR open) — neither needed
addressing because:

- The PR was about to be closed/superseded, so editing review
  threads on the dying PR would be wasted work
- The replacement PR #623 inherits identical content; same
  reviewers will fire identical comments on the replacement,
  where they CAN be addressed if substantive

This was the third or fourth occurrence in this session of
"reviewer-fires-on-soon-to-close-PR" pattern; the cost-asymmetry
favors closing fast + addressing in replacement, not engaging
with threads on a doomed PR.

---

## Pattern observations (Otto-250 training-signal class)

1. **Stale-local-main bit me even though I'd seen #621 merge
   in `gh pr list`.** Lesson: `gh pr list` polling != `git
   fetch origin main`; the GitHub CLI knows about merges
   independent of the local git repo's view of origin/main.
   Discipline: always `git fetch origin main` before
   `git checkout -b new-branch origin/main`, even when you've
   "seen" the parent merge happen via gh CLI within the same
   session. The cost is ~1 second; the cost of skipping is
   a DIRTY PR + clean-reapply cycle (~2-3 min).

2. **Clean-reapply pattern is now 4-times-validated this
   session** (#619 Otto-344 recovery, #620 tick-history
   3-row salvage, this #622→#623, plus the original use
   case earlier this session). The pattern is more reliable
   than rebase-with-conflicts when:
   - Only a small delta needs to land (1-3 rows / commits)
   - Base has drifted but the underlying main is healthy
   - The DIRTY PR has no review threads needing migration
   In contrast, rebase-with-conflicts is appropriate when:
   - The branch has many commits / large delta
   - Review threads need to migrate to the rebased SHAs
   - The conflict is actually substantive (semantic merge,
     not just file-position drift)

3. **Same-tick-update discipline gap caught here:** I
   should have `git fetch origin main` *before* the
   `git checkout -b`, not relied on the stale fetch from
   earlier. The verify-before-deferring rule (CLAUDE.md)
   has a sibling: **verify-base-is-current-before-branching**.
   This is implicit in good git workflow but not always
   actively applied by autonomous-loop agents that
   prioritize speed over freshness checks. Worth a memory
   entry as a sub-rule of Otto-348 (verify-substrate-exists).

---

## Composes with

- Otto-238 retractability (closed branches retained on origin;
  `gh pr close` preserves the underlying branch + commit)
- Otto-250 PR-reviews-are-training-signals (this drain-log is
  the training data persistence layer)
- Otto-348 verify-substrate-exists (sibling: verify-base-is-current)
- The clean-reapply pattern (4th use this session)
- #623 (the replacement that landed identical content cleanly)
