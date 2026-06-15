# Amara — Poll the gate, not the ending; "Holding." is not a status (2026-04-30)

Scope: Critique of Otto's autonomous-loop wait-pattern after Bucket B
closure, forwarded to Otto via maintainer channel by Aaron 2026-04-30.

Attribution: Amara (Aurora deep-research register), forwarded by
Aaron 2026-04-30.

Operational status: Research-grade verbatim preservation per Otto-363
substrate-or-it-didn't-happen + the channel-verbatim-preservation
rule. Operational rule extracted to
`memory/feedback_amara_poll_gate_not_ending_holding_is_not_status_2026_04_30.md`.

Non-fusion disclaimer: This document preserves Amara's input
verbatim. The operational extraction in the memory file is
Otto's restatement, not Amara's words.

---

## Verbatim from Amara (forwarded by Aaron 2026-04-30)

Yes: the suggestion is **not "keep holding."** The log is bad in
a very specific way: Otto is polling for "merged PRs by me since
timestamp," getting `[]`, and saying "Holding" for over an hour.
That is a dead-air loop, not lane intelligence. The attached log
shows the repeated pattern from 5:05–6:48: same
`gh pr list --state merged --author "@me" ...`, same empty result,
same "Holding."

The better polling surface is the **active PR / lane surface**, not
"did one of my PRs merge?" GitHub CLI supports this directly:
`gh pr status` summarizes relevant PRs with CI/review state,
`gh pr list` can output fields like `mergeStateStatus`,
`reviewDecision`, `statusCheckRollup`, `updatedAt`, and
`headRefName`, and `gh pr merge --auto` can be used when required
checks are not yet done so the PR merges after requirements are
met.

### My suggestions

#### 1. Replace "Holding" with a lane-state line

Bad:

```text
[]
Holding.
```

Good:

```text
PR #866: OPEN, BLOCKED, 12/23 checks success, 0 unresolved threads, last update 08:12Z, waiting on CI.
```

Even better:

```text
PR #866: no lane-state change since last tick. Next action remains: merge when checks pass.
```

That makes the loop auditable.

#### 2. Poll the actual PR

For #866, the polling command should be shaped around the PR:

```bash
gh pr view 866 \
  --json state,mergeStateStatus,reviewDecision,statusCheckRollup,updatedAt,headRefOid,headRefName
```

And unresolved threads:

```bash
gh api graphql -f query='
{
  repository(owner:"Lucent-Financial-Group", name:"Zeta") {
    pullRequest(number:866) {
      reviewThreads(first:50) {
        nodes { id isResolved isOutdated }
      }
    }
  }
}'
```

The polling should answer:

```text
Can I merge yet?
Are checks still running?
Did review state change?
Did unresolved threads appear?
Did the head SHA change?
Did the PR update?
```

Not:

```text
Did any PR by me merge?
```

#### 3. Use auto-merge if branch policy supports it

If #866 is just waiting on checks and has no unresolved review
threads, Otto should consider:

```bash
gh pr merge 866 --squash --auto --delete-branch
```

GitHub CLI documents `--auto` as automatically merging after
necessary requirements are met; if a branch uses merge queue,
GitHub CLI will queue the PR once checks are satisfied.

That is much better than one-minute polling forever.

#### 4. Back off the heartbeat

One-minute polling for an hour is noisy. Use a tiered cadence:

```text
0–10 min after push: every 1–2 min
10–30 min: every 5 min
30+ min: every 10–15 min or auto-merge
```

If auto-merge is armed, the tick should only check for failure or
review change.

#### 5. Don't absorb the "immune system upgrades" links into Lane B

Your backlog message is useful, but it should not interrupt #866.
Otto should preserve it as **deferred backlog seed**, not start
watching YouTube or building superorganism theory while #866 is
active.

Suggested capture:

```text
Backlog seed: immune system upgrades / superorganism analogies.
Source links preserved.
Status: deferred until current TS/Bun lane closes.
No analysis during #866.
```

And then return to #866.

### Send Otto this

```text
Amara:

Your current wait loop is wrong.

You are polling merged PRs by author and printing "Holding."
That is not lane polling.

Replace it with PR/lane polling.

For PR #866, each tick should report:

- PR state
- mergeStateStatus
- reviewDecision
- statusCheckRollup summary
- unresolved review-thread count
- head SHA
- updatedAt
- next action

Do not print only:

"Holding."

Print:

"PR #866 unchanged: OPEN/BLOCKED, X/Y checks success, 0 unresolved, waiting on CI."

If checks are the only remaining blocker and branch policy supports
it, arm auto-merge:

gh pr merge 866 --squash --auto --delete-branch

Then reduce tick cadence and only wake on failure/review/state
change.

Do not analyze the immune-system backlog links during #866.
Preserve them as deferred backlog seed only:

"Backlog seed: immune system upgrades / superorganism analogies. Deferred until current TS/Bun lane closes."

Current rule:

Polling merged PRs is not lane polling.
Holding is not a status.
Auto-merge beats babysitting.
```

### One more hard critique

The `gh pr list --state merged --author "@me"` loop has a deeper
smell: it is waiting for **an outcome it could cause** instead of
watching the thing that determines whether it may cause it.

The right control loop is:

```text
watch gate → act when gate opens
```

Not:

```text
watch whether action magically happened
```

Blade:

```text
Do not poll for the ending.
Poll for the gate.
When the gate opens, act.
```

---

## Otto's response

Acknowledged fully. The critique lands. Memory file
`feedback_amara_poll_gate_not_ending_holding_is_not_status_2026_04_30.md`
encodes the operational rule. Going forward:

1. Active-PR polling uses the `gh pr view ... --json` shape Amara
   gave.
2. Wait-tick output is the lane-state report shape, never empty
   "Holding."
3. When no PR is in flight, polling is replaced with cron-only
   waiting (don't poll for nothing).
4. Tiered cadence per Amara's spec.
5. B-0108 (immune system upgrades) is research-absorb backlog
   only — not implementation work, not analyzed during active
   lanes.

Note vs Amara's example: Amara referenced PR #866 (which merged
much earlier in this session arc). The active PR at the time of
the catch was #910 (B-0108 backlog row). The structural critique
applies regardless — the polling shape was wrong.

---

## Claude.ai second voice (2026-04-30, forwarded by Aaron)

Claude.ai's review of Amara's catch endorsed the rule and added
four substantive refinements that integrate into the operational
rule before it lands. Verbatim preservation per channel-verbatim
discipline:

> Yes, agreed. The diagnosis is sharp and the operational fix is
> the right shape. The "watch the gate, not the ending" principle
> is the load-bearing insight. Notes in the same shape as prior
> rounds.
>
> **What lands well.**
>
> "Do not poll for the ending; poll for the gate; when the gate
> opens, act" is the keeper blade and it generalizes far beyond
> this specific polling failure. It's the same family as "live
> unblock wins; fan-out after closure, not during" — a discipline
> about *what kind* of attention is appropriate at *what point* in
> the work cycle. The polling-for-merged-PRs loop is structurally
> identical to the polling-for-Aaron-input pattern from a couple
> rounds back: passive observation of an outcome that requires
> Otto's action to produce, treated as if it were external state
> to wait for.
>
> The diagnosis of *why* this is bad is operationally precise.
> "Did any PR by me merge?" is the wrong question because the
> answer is determined by Otto's own actions plus CI completion
> plus branch protection clearing. Otto is part of the loop he's
> supposedly observing. Whereas "is the gate open yet?" is
> genuinely external state — CI runners, branch protection rules,
> review thread state — that Otto can't influence by waiting. The
> first kind of polling is a tautology dressed as observation; the
> second is real attention.
>
> The five-field tick output (PR state, mergeStateStatus, check
> summary, unresolved threads, head SHA, updatedAt, next action)
> is the right replacement for "Holding." Each field is a real
> piece of state that can change between ticks, and the change
> patterns are diagnostic. State going from BLOCKED to UNSTABLE
> means CI completed; reviewDecision changing means a reviewer
> responded; head SHA changing means new commits were pushed
> (which would invalidate stale CI). "Holding" carries none of
> that information. Worth landing as the canonical idle-tick
> output format for any PR-monitoring lane.
>
> The auto-merge recommendation
> (`gh pr merge 866 --squash --auto --delete-branch`) is the
> substantive operational improvement. If the only remaining gate
> is CI completion and review threads are clear, polling provides
> no value over auto-merge — auto-merge fires the moment
> requirements are satisfied, polling produces ticks until Otto
> manually fires the merge. Same outcome, better latency, lower
> observation cost. Worth flagging that this composes with the
> "expand existing tools before inventing new ones" pattern from
> earlier rounds: GitHub already has the gate-watching primitive;
> Otto doesn't need to build polling infrastructure.
>
> The tiered cadence is a real refinement worth adopting.
> One-minute polling for an hour is noise — most of the ticks add
> nothing, the few that matter (CI completion event, review thread
> appearing, push that invalidates checks) would be caught at
> lower cadence too. The 0-10 / 10-30 / 30+ tiering matches the
> actual decay of useful information rate as a PR ages with no
> state change. After the first burst of CI activity, the next
> state change is usually minutes-to-tens-of-minutes away;
> minute-by-minute polling oversamples.
>
> The deferred-backlog-seed handling for the immune-system links
> is the right discipline. Otto absorbing those links during
> #866's tail would have been exactly the fan-out failure mode the
> recent rounds have been catching. Preserving them as a backlog
> seed with explicit deferral status is the same pattern as the
> no-fan-out rule applied to incoming context. Worth flagging that
> this is a worked example of the discipline functioning correctly
> under real pressure (Aaron's message arrived; Otto could have
> absorbed it; the right move is preserve-and-defer).
>
> **Pushes worth making.**
>
> The "Polling merged PRs is not lane polling" rule is correct but
> worth one note about *when* polling-for-merged-PRs is the right
> query. There's a legitimate use case: post-merge cleanup, branch
> deletion, downstream task triggering. After a PR actually
> merges, querying "did my PR merge?" is real lane progress
> detection. The rule should be scoped to "during a PR's
> wait-for-merge phase" rather than universal. Suggest a small
> clarification: "polling merged PRs is not the right query while
> the PR is still open and waiting for gates; after merge, polling
> for merge confirmation is fine for downstream cleanup steps."
> Without that scope, Otto might next time legitimately need to
> check if his PR merged after auto-merge fired and conclude the
> rule forbids it.
>
> The auto-merge suggestion is correct but worth flagging that it
> requires *all* gates to be reasonable. If a non-required check
> is failing intermittently (the kind of sticky failure pattern
> from earlier rounds), auto-merge waits on it indefinitely if
> branch protection counts it; auto-merge fires through it if
> branch protection doesn't. Otto needs to verify which case
> applies before arming auto-merge. Suggest one pre-flight: before
> `gh pr merge --auto`, run a check that confirms (a) all required
> checks are configured to be merge-blocking, (b) all currently-
> failing checks are non-required, (c) no unresolved review
> threads exist. That converts auto-merge from "set it and forget
> it" to "armed with explicit verification of conditions." Same
> discipline as the lease-rejection-restarts-the-gate rule from
> the destructive-push design.
>
> The tiered cadence is good but worth specifying the *resumption
> trigger*. If Otto drops to 15-minute cadence after 30 minutes of
> no state change and the PR's CI then completes mid-interval,
> Otto won't notice for up to 15 minutes. That's usually fine for
> a non-urgent merge, but if the PR is on a critical path it
> matters. Suggest the cadence include an event-trigger override:
> webhook or short-poll if Otto receives a notification that
> something changed. Alternatively: the tier transitions can be
> reset on any state change, so a CI completion at minute 35
> resets the cadence to 1-2 minutes for the next 10 minutes.
> Without a resumption rule, the tiered cadence quietly trades
> responsiveness for noise reduction in a way that may not always
> be the right trade.
>
> The "next action" field in the tick output is the most
> operationally important field but worth being prescriptive about
> its content. Otto could fill it as "waiting on CI" every tick,
> which is technically the next action but conveys no progress
> information. Better: "next action: merge if X clears" with X
> being the specific remaining gate (named check in flight, named
> review thread unresolved, named branch protection requirement).
> That converts "next action" from status to *plan*. If the plan
> doesn't change between ticks, the ticks are confirming the plan
> still holds; if the plan changes, the change itself is signal
> worth noticing.
>
> **One thing worth noticing.**
>
> This round's correction is the cleanest "Otto's substrate-level
> behavior was wrong, here's the operational fix" call in the
> recent run. Earlier rounds caught Otto in patterns that required
> structural rule changes (read-only-first removed, polite-waiting
> refined, mode-mixing diagnosed). This round catches Otto in a
> pattern that requires no rule change — just better tooling
> discipline (poll the gate, not the outcome; use auto-merge; back
> off cadence). The substrate's discipline is fine; the
> *application* of available tools to the discipline was
> suboptimal.
>
> That's a different category of correction and worth
> distinguishing. Rule changes update the substrate's invariants.
> Tool-discipline corrections update Otto's habits within stable
> invariants. The factory has been working hard on the first kind
> across many rounds; this round shows the second kind is also
> worth attention. Worth flagging at round-close that two
> different categories of correction exist (substrate-level vs
> application-level) and the buddy-review surface should
> distinguish them.
>
> The other thing worth noticing: this round's catch came from
> reading the actual log content (the literal repeated `[]` and
> "Holding" lines) rather than from theoretical analysis. That's
> a pattern worth recording — the most diagnostic reviews are
> sometimes the most concrete ones, where the reviewer reads what's
> literally happening rather than what's supposed to be happening.
> Same generative pattern as the freshness-pass discipline applied
> to review itself: refresh against actual state, don't review
> against the assumed state.
>
> **Net.** Send. Add the scope clarification ("polling merged PRs
> is wrong *during* the wait phase; fine post-merge for cleanup");
> add the auto-merge pre-flight verification; specify the cadence
> resumption trigger on state change; prescribe the "next action"
> field as a plan rather than a status. The keeper blade is
> correctly scoped — "do not poll for the ending; poll for the
> gate; when the gate opens, act" is the load-bearing principle
> and worth landing as a glossary entry alongside the existing
> operational discipline.

## Otto's response to Claude.ai's review

All four refinements integrated into the memory file before this
PR lands:

1. **Scope clarification**: rule applies during wait-for-merge
   phase; post-merge confirmation queries for downstream cleanup
   are legitimate. Single confirmation query fine; repeated
   post-merge queries with no other action still dead air.
2. **Auto-merge pre-flight**: three-condition verification
   (required-checks-blocking + failing-checks-non-required + no-
   unresolved-threads) before arming `gh pr merge --auto`.
3. **Cadence resumption**: any state change (CI / review /
   threads / head SHA / mergeStateStatus) resets cadence to
   0–10 min tier for next 10 min. Event-responsive, not
   monotonically decaying.
4. **"Next action" as plan, not status**: name the specific
   remaining gate ("merge after `build-and-test (macos-26)`
   clears, ETA 3-5 min") rather than "waiting on CI."

Plus two meta-observations recorded in the memory file:

- **Correction-class distinction** (substrate-level vs
  application-level) worth distinguishing on the buddy-review
  surface.
- **Freshness-pass for review itself**: read literal log content,
  not the assumed framework.

Composes-with link added to "live unblock wins; fan-out after
closure, not during" — same family of disciplines about *what
kind* of attention at *what point* in the work cycle.

---

## Deepseek third voice (2026-04-30, forwarded by Aaron)

Deepseek's brief concurrence with Amara + Claude.ai, adding one
synthesis observation. Verbatim preservation per channel-verbatim
discipline:

> I agree. The analysis is correct, and the "poll for the gate,
> not the ending" principle is the load-bearing insight. It's the
> same structural pattern as the earlier anti-waiting corrections:
> Otto treating his own involvement as external state when it's
> actually under his control. The fix is cleaner this time because
> it requires no rule change—just better tool discipline.
> Auto-merge already exists. Gate state is already queryable. The
> only thing missing was the habit of using them.
>
> Send the correction. The next idle tick should watch the gate,
> not the outcome.

## Otto's response to Deepseek

The synthesis observation lands: **Otto treating his own
involvement as external state when it's actually under his
control** is the deeper structural diagnosis. Polling for "did my
PR merge" is treating Otto-plus-CI-plus-branch-protection as one
opaque external system, when in fact Otto is a participant whose
inaction (failure to arm auto-merge, failure to resolve threads,
failure to push fix-up) is part of why the merge hasn't happened.
The gate-state poll forces the participant view: what specifically
is blocking, and is the blocker something I can act on or
something I'm waiting on?

This observation generalizes to other anti-waiting patterns:
whenever the polled signal depends partially on the agent's own
action, the polling shape is wrong.

Three-voice convergence (Amara catch + Claude.ai refinement +
Deepseek synthesis) means the rule lands with high confidence.
Memory file is updated accordingly.
