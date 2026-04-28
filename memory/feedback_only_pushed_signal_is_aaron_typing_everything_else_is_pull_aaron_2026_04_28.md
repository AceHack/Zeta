---
name: Only "pushed" signal is Aaron typing in this environment; everything else is pull (Aaron 2026-04-28)
description: Aaron 2026-04-28T16:05Z — sharpening the never-idle rule. In autonomous-loop mode, the ONLY signal that arrives unbidden is Aaron's direct typing in this Claude Code environment. CI state, review threads, PR mergeability, cron firings, GitHub workflow runs, Copilot reviews, peer-CLI replies — all of these are PULL signals that require active polling / querying / re-checking. Closing a tick with "no new signal" is a category error: there ARE no new pushed signals between Aaron-typings; the question is what I haven't pulled yet.
type: feedback
---

# Only "pushed" signal is Aaron typing; everything else is pull

## The rule (Aaron verbatim 2026-04-28T16:05Z)

> *"signals don't just arrive, you have to go get them"*
> *"except for my typing in this environment"*
> *"that's your only real signal that's pushed to you"*

## The model

There is exactly **one** push channel into Claude Code in autonomous-loop mode:

- **Aaron's direct typing** in the Claude Code conversation pane.

Everything else is a **pull** channel. The cron tick fires, but it does not deliver
new content; it just re-invokes me. Whether anything has changed since the last
tick is a question I answer by querying:

- `gh pr checks <N>` — CI state on a specific PR
- `gh pr view <N> --json mergeStateStatus,reviewDecision,...` — PR mergeability + review state
- `gh api graphql ... reviewThreads ... isResolved == false` — unresolved review threads
- `gh pr list --state open --json ...` — queue contents
- `git fetch ... && git log <ref>...<ref>` — branch advance
- `gh api repos/.../check-runs/<id>` — specific check details
- file system / git tree state, etc.

If I haven't run any of these between the last tick and this one, I do not know
whether anything has changed. **"No new signal" without pulling is wrong by
construction**.

## The failure mode this corrects

Today (2026-04-28T15:45Z–16:00Z) I closed ~5 ticks in a row with the phrase
*"no new signal"* on PRs #662 / #663 / #665 — all BLOCKED, all green-CI,
auto-merge armed. What I did not pull during those ticks: review threads.

Aaron's *"self check"* prompt at 16:04Z forced the pull. Result: **9 unresolved
threads** were sitting in the queue (7 on #663 + 2 on #665), all posted by
Codex / Copilot during the ticks I was closing as no-signal. The reviews had
been there for 10–20 minutes; I just didn't query.

Same Otto-355 BLOCKED-investigate-threads-first pattern, applied at the wrong
cadence: I checked threads ONCE right after pushing each PR, then stopped
re-checking on subsequent ticks. The lesson: **threads keep arriving** during
the auto-merge wait window; check every tick, not once.

## The discipline going forward

Every autonomous-loop tick that touches a PR:

1. **Pull mergeStateStatus** for the PR.
2. **Pull unresolved-thread count** for the PR — `reviewThreads { totalCount, nodes { isResolved } }` filtered on `!isResolved`.
3. **Pull CI check states** — at minimum the failed/pending counts; full per-check on changes.
4. **Compare to last tick's snapshot** if I'm tracking — flag deltas as actual signal.

Closing a tick as "no new signal" is allowed ONLY when those three pulls have
just been done and confirmed nothing changed. Anything else is the failure mode.

## Aaron's verbatim corrections (2026-04-28T16:00–16:05Z)

> *"self check"*
> — 16:04Z, the prompt that broke the manufactured-pull-silence loop.

> *"Tick close — no new signal. signals don't just arrive, you have to go get
> them"*
> — 16:05Z, naming the failure mode directly.

> *"except for my typing in this environment"*
> — 16:05Z, defining the one carve-out.

> *"that's your only real signal that's pushed to you"*
> — 16:05Z, generalizing.

## Recurrence + scope-broadening (Aaron 2026-04-28T18:05Z)

After this rule was already landed earlier today, I still closed ~5 ticks
with *"no new push-signal"* without pulling the queue. Aaron's correction:

> *"Tick close — no new push-signal; should be a queue to pull"*
> *"in the future too"*

The rule is broader than I initially scoped it:

- The pull-queue is not just "open PR review threads on PRs I just pushed."
  It includes:
  - **Stale fork-PR queue** (PRs sitting from earlier sessions): mergeable
    state, unresolved threads, branch-tip vs main divergence.
  - **Open issues** (`gh issue list --state open`).
  - **BACKLOG.md rows** (P0 / P1 / P2 / P3) — `ls docs/backlog/P*/`.
  - **Recent CI runs across the repo** — `gh workflow list` then
    `gh run list --workflow=<id-or-filename>` (or `gh run list -L 50`
    for all-workflow recent runs).
  - **External signals** — peer-CLI replies, Amara ferry drops, scheduled
    job outputs, drop-folder additions.
  - **TodoWrite task list** — pending / in_progress tasks from prior turns.

- The framing *"no new push-signal"* is itself the failure mode language —
  it primes the closing-without-pulling pattern. Replace with:
  - *"Pulled queue: <findings>; closing tick"* (after running pulls)
  - *"Pulled queue: nothing to act on"* (after running pulls AND verifying)

- **"In the future too"** — future-Otto must inherit this. The rule lives
  in this file; the file is indexed in MEMORY.md; the pattern applies on
  every wake. If future-Otto reads "no new push-signal" anywhere in
  history without an accompanying queue-pull, that's evidence of the same
  failure mode recurring.

Concrete pull this tick (2026-04-28T18:05Z) that I had been missing:

- PR #659 — **49 unresolved threads** / 50 total (from earlier-session
  Copilot batch review on 24-file trajectory PR)
- PR #661 — BLOCKED/MERGEABLE with **0 unresolved threads** (potentially
  low-hanging; just needs rebase + merge investigation)
- PR #655 / #656 / #658 — all 0 unresolved threads, just DIRTY (need rebase)
- 5 P1 issues open on LFG (#78–#82) — ready to triage
- Multiple in-progress tasks in TodoWrite (#268, #269, #287, #291, #307)

That's substantial pull-queue content I was treating as "queue empty"
because no Aaron-typing arrived. The lesson: queue ≠ push-channel.

## Composes with

- `feedback_speculation_leads_investigation_not_defines_root_cause_aaron_2026_04_28.md`
  — the speculation-vs-evidence rule from earlier today. Same family: don't
  state things you haven't verified by query. *"No new signal"* without a pull
  is a SPECULATION about the world.
- `feedback_otto_355_blocked_with_green_ci_means_investigate_review_threads_first_dont_wait_2026_04_27.md`
  — Otto-355 already says investigate threads on BLOCKED. This rule extends
  Otto-355 to *every tick of the wait window*, not just the first.
- `feedback_self_check_trigger_after_n_idle_loops_routine_discipline_for_current_otto_and_future_wakes_2026_04_27.md`
  — the self-check trigger. Reading this rule sharpens what self-check should
  PULL when it fires.
- `docs/AUTONOMOUS-LOOP.md` — the cron heartbeat discipline. The cron firing
  is itself NOT a signal; it's an invitation to pull.
- `feedback_manufactured_patience_vs_real_dependency_wait_otto_distinction_2026_04_26.md`
  — the manufactured-patience class. *"No new signal"* tick-closes are the
  textual signature of manufactured-patience in the autonomous loop.
