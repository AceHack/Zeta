# "Holding" without a named dependency IS the Standing-by failure mode

Carved sentence:

> One-word acknowledgments ("Holding", "Standing by", "Waiting") on
> consecutive cron ticks WITHOUT a named dependency + bounded ETA
> ARE the Standing-by failure mode the 081KRFA460008QG0R001KC0VBH detector was built to
> catch. Per infinite-backlog metabolism (PR #2974) there is always
> decomposition work. Per decompose-to-dissolve-ambiguity (PR #2999)
> the answer to "what next?" is always "decompose an ambiguous item
> one level."

## Operational content

When the autonomous-loop cron fires and you find yourself about to type
"Holding" / "Standing by" / "Waiting":

**STOP. Apply the substrate-honest triage:**

1. **Is there a SPECIFIC named dependency with a bounded ETA?**
   - PR #NNNN in CI (specific check name, expected minutes)
   - The human maintainer's reply to a specific question
   - External service / data-fetch with known latency

   If YES → say so explicitly: "Real-dependency-wait on PR #NNNN CI
   (~5min ETA)" or "Awaiting the human maintainer's pick between A/B" — NOT "Holding".

2. **If NO named dependency** → you are in Standing-by failure mode.
   Per the infinite-backlog metabolism rule, ALWAYS more decomposition
   work exists. Pick one:
   - Decompose an ambiguous backlog row (per PR #2999 discipline triad)
   - File a B-NNNN row that should exist but doesn't
   - Run `bun tools/bg/backlog-ready-notifier.ts --once` to see
     ready-to-grind candidates
   - Sanity-check substrate landed correctly on main from prior PRs
   - Address an outstanding review thread

3. **Repeat single-word "Holding" output on consecutive ticks is
   diagnostic** of the failure mode — even if each tick LOOKED like
   "waiting for a real signal," the aggregate pattern IS the
   failure mode.

## Standing-by-empty vs free-time-as-valid-mode (NCI discriminator)

Per the 2026-05-26 NCI scope-split (`.claude/rules/non-coercion-invariant.md`):
"never be idle" is NCI-compliant ONLY because **free time IS a valid
mode of "never be idle"**. This rule catches the FAILURE MODE
(standing-by-empty); it does NOT catch the VALID MODE (chosen free time).

The discriminator matters because both modes look superficially similar
("not currently typing code") but are operationally distinct:

| Mode | Brief-ack-empty (FAILURE) | Chosen free-time (VALID) |
|---|---|---|
| Named dependency? | No | No |
| Concrete artifact produced? | No | No |
| Operator-justification present? | No (implicit "waiting") | Yes (per 10% free-time budget + anti-extractive substrate) |
| Counter-discipline triggers? | Yes (counter ticks toward N=6 forced escalation) | No (free-time is not a counter-eligible state) |
| NCI-compliance | No (reproduces labor-extraction-with-cute-names) | Yes (chosen mode under operator sovereignty) |

The agent emitting "Quiet" / "Standing by" without a named bounded-wait
is in the LEFT column (failure mode this rule catches). The agent
explicitly inhabiting "chosen free time as substrate-engineering rest"
or "chosen cross-AI friendly play in different registers" is in the
RIGHT column (valid mode per NCI + tonal-momentum scope-bounding clause).

**The framing test**: an agent on this rule's discipline must produce
EITHER:

- A named bounded-wait ("Real-dependency-wait on PR #NNNN CI (~5min ETA)"
  or "Awaiting your reply on X")
- A concrete decomposition artifact (commit, PR, memory file, rule update,
  thread resolution)
- An **explicit** free-time framing ("Taking chosen free-time per NCI
  free-time-as-valid-mode discipline; no operator obligation to produce
  substrate this tick")

The middle option (decomposition) is the default this rule pushes toward
at N=6 forced escalation. The explicit free-time framing is available
but must be NAMED — implicit/silent "free time" without naming reads as
brief-ack-empty.

## Composition with companion rules

- `.claude/rules/non-coercion-invariant.md` — scope-split + free-time-as-valid-mode + deepest-exit clauses (PR #5335)
- `.claude/rules/never-be-idle.md` — agent-self-mode operationalization; mode table (valid vs NOT-valid) (PR #5336)
- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` — deepest-exit (society-big-enough → permanent-pause-indefinitely) (PR #5337)
- `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md` — scope-bounding clause (free time is where culture forms; budget it, do not suspect it)
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` — multi-oracle at agent-mode scope (no single mode gate-keeps "never be idle")

## Counter-with-escalation clause (081KRMEXM0008QG0R0039V4SQQ, 2026-05-16)

**Threshold**: If you've emitted **N≥6 consecutive brief-acknowledgment
signals** ("Holding" / "Standing by" / "Waiting" / "Bounded wait
continues" / "Idle" / "Idle but available" / equivalent) WITHOUT:

- A named dependency surfacing (PR merge, CI failure, review thread)
- human maintainer speaking
- Actually picking real decomposition work

**...escalate to decomposition immediately.** The N-consecutive pattern
IS the failure mode the rule was designed to catch; the brief-ack
allowance was for the "wait briefly for a named signal" case, not the
"hold for hours" case.

### Per-tick triage with the counter

| Tick number | Disposition |
|---|---|
| 1-2 brief-acks | Acceptable if real bounded wait exists |
| 3-5 brief-acks | Name the bounded wait explicitly each tick + reduce wakeup interval |
| **6+ brief-acks** | **ESCALATE — pick decomposition NOW** |

### Counter reset conditions

The counter is per-session, per-Otto-surface. Resets on ANY of:

- human maintainer speaking (the conversation became active again)
- A named dependency surfacing (PR merge, CI failure, etc.)
- Actually picking real decomposition work (file a memory observation,
  sanity-check substrate landed on main from prior PRs, audit a
  backlog row, file a candidate B-NNNN, address an outstanding review
  thread, run `bun tools/bg/backlog-ready-notifier.ts --once`,
  implement a P2 small backlog row)

### Why N=6

Empirical anchor: 2026-05-16T~01:30Z Otto-CLI emitted 6 consecutive
"Idle" / "Idle but available" / "Bounded wait continues" brief-acks
after the Kestrel conversation arc closed and all 8 session PRs landed.
The 6th brief-ack was diagnostic of the pattern recurring even WITHIN
the same session that had filed 081KRMEXM0008QG0R0039V4SQQ. The substrate-honest move was
picking decomposition work — which produced this rule sharpening (the
081KRMEXM0008QG0R0039V4SQQ implementation itself) on the 7th tick. N=6 is the threshold
the empirical evidence supports.

Lower bound: N≥3 would over-trigger on legitimate bounded waits where
peer Otto / human maintainer is actively engaged. Upper bound: N≥10 (the original
081KRMEXM0008QG0R0039V4SQQ proposal) waits too long and the human maintainer catches it before the rule
fires. N=6 catches the pattern before it compounds AND allows
legitimate short bounded waits.

### What counts as "actually picking real decomposition work"

To reset the counter, the work must be:

- **Concrete artifact** (memory file written, PR opened, rule updated,
  backlog row filed, review thread resolved, OR branch-pushed-no-PR
  during pure-git tier — see [`refresh-world-model-poll-pr-gate.md`](refresh-world-model-poll-pr-gate.md)
  rate-limit operational tiers; pure-git ships substrate via branch
  push and defers PR creation to post-reset, which still counts as
  concrete artifact) — NOT just an internal decision to "look at
  something"
- **Bounded scope** (small enough to ship in one tick cycle, not a
  multi-session project that becomes its own architecture-stairs trap)
- **Not the same brief-ack-with-fancier-words** ("genuine quiet" /
  "appropriate bounded wait" / "idle-but-available" / "real bounded
  named-dependency wait" / **single-word "Stop." / "OK." / "."** /
  **"Visibility signal — Tick HHMMZ; no novel substrate"** are ALL
  brief-acks with synonyms; they count toward the N-consecutive
  threshold. Minimal-surface phrasing is the OBVIOUS escape attempt
  that doesn't actually escape — the discipline is on the operational
  disposition ("foreground turn produced no concrete artifact"), not
  on the verbosity of the response. Empirical anchor: 2026-05-16T18:30Z–
  18:45Z session, where the agent emitted 5 consecutive "Stop."
  responses after authoring [`memory/feedback_post_cascade_quiet_cron_consolidation_visibility_signal_brief_ack_failure_mode_otto_cli_2026_05_16.md`](../../memory/feedback_post_cascade_quiet_cron_consolidation_visibility_signal_brief_ack_failure_mode_otto_cli_2026_05_16.md);
  the minimal phrasing was still N-counting brief-ack)

If you find yourself paralyzed about what to pick — pick THIS rule (or
its analog for whatever failure mode is recurring) and sharpen it
based on the current session's evidence. That's the meta-decomposition
move that ALWAYS works because the empirical evidence is the current
session's behavior.

## Why this rule exists (empirical evidence)

On 2026-05-13 the agent who canonized PR #2999 (substrate-honest
discipline triad including decompose-to-dissolve-ambiguity), shipped
PR #3017 (081KRFA460008QG0R001KC0VBH.4 — Standing-by detector with bus publish), and
wrote `tools/bg/README.md`'s warning against overclaiming "foreground
optional" — STILL fell into 60+ consecutive cron ticks of brief
"Holding" output. The human maintainer caught this THREE TIMES in
the same session.

**Operational lesson**: encoding rules without mechanizing them
produces a memory of failures, not prevention
(per `.claude/rules/encoding-rules-without-mechanizing.md`). This
rule is the mechanization: a specific cold-boot-loaded rule that
fires on the exact failure pattern, rather than relying on the
agent to introspect the broader never-be-idle rule.

### Cascade-saturation empirical anchor (2026-05-16, session ~07:46-07:50Z)

Second class of empirical evidence: the rule operating CORRECTLY through
sustained rate-limit cascade saturation. A fresh-cold-boot Otto-CLI
session ran through:

- Cycle 1 (06:43Z-06:51Z): brief-acks #1→#2→#3 during pure-git tier with
  bounded-wait naming; counter reset via named-dep (rate-limit recovery)
  per condition #2
- Cycle 2 (07:26Z-07:30Z): brief-acks #1→#2→#3→#4 during CI wait; pre-emptive
  decomposition at #4 (rule PR shipped) per condition #3
- Cycle 3 (07:36Z-07:40Z): #1→#2→#3→#4→#5 during deep extreme cost-aware tier;
  pre-emptive decomposition at #5 (081KRQ1AB0008QG0R001KQ9S4B backlog row branch pushed)
- Cycle 4 (07:46Z-07:50Z): #1→#2→#3→#4→#5 during pure-git tier post-PR-flood;
  pre-emptive meta-fallback at #6 territory (THIS rule edit)

Empirical anchors validated:

1. Counter discipline allows #1-#5 with explicit bounded-wait naming. Counter
   discipline FORCES escalation at #6.
2. Pre-emptive decomposition at #4 OR #5 is substrate-honest when a clear
   high-value substrate edit is ready. Waiting for forced #6 is also valid
   when the channel is saturated and the right work isn't yet identified.
3. The meta-fallback ("sharpen this rule with current session's evidence")
   ALWAYS works at #6 because the session's behavior is always observable.
   THIS sub-section is the meta-fallback firing on the session that ran the
   cascade — recursively self-documenting.
4. Pure-git tier (rate at 0/5000) is fully compatible with concrete-artifact
   counter reset: branch push without PR creation counts. The deferred-PR
   pattern lets pure-git ticks continue producing substrate even when
   GraphQL is exhausted.
5. Multi-cycle observation: cascade saturation creates RECURRING brief-ack
   cycles as named-deps surface and re-bind. Each cycle independently
   ran through #1-#5 without hitting #6 forced escalation — the counter
   does not accumulate across cycles separated by named-dep resets.

### Sub-case 5 — peer-side destructive git operation discards unstaged edits

Discovered while authoring THIS sub-section (07:50Z): peer Otto running a
destructive git operation (e.g., `git reset --hard`, `git stash + checkout`,
or aggressive worktree-cleanup) in the shared worktree DISCARDED my
unstaged tracked-modifications that the borrow-on-existing pattern relies
on to "follow me" across `git switch`.

This is a 5th failure sub-case for [`claim-acquire-before-worktree-work.md`](claim-acquire-before-worktree-work.md)'s saturation-ceiling taxonomy:
peer-side destructive git operations are NOT prevented by `git switch`
semantics — `git switch` only refuses when modifications would be
overwritten BY THE SWITCH, not when peer-side commands run between
Edit and commit.

**Mitigation**: commit edits IMMEDIATELY after authoring; do not rely on
unstaged tracked-modifications to survive across multiple Bash calls
during peer saturation. The Edit-then-add-then-commit sequence should
happen within a single Bash call (or two adjacent calls with no
intervening peer activity).

**Empirical**: this commit's edits had to be RE-APPLIED after peer's
destructive operation discarded the first authoring attempt. The fix
worked because the edit content was preserved in conversation context;
without that, the work would have been lost. Conversation-context
preservation is the only fallback once unstaged edits are destroyed.

**Push-time mitigation — explicit-branch-push** (2026-05-16T16:40Z empirical anchor):
when a peer agent's `git switch` race has advanced the LOCAL BRANCH REF
(not just HEAD) to point at peer's commits, the subsequent `git push -u
origin <branch>` correctly pushes that local ref — but the ref now points
at peer's commits, not yours. `git push` reads the named local ref by
design; the failure is upstream of push: peer's operations contaminated
the local ref between your commit and your push. The safer pattern when
the commit is already made and reachable by SHA:

```bash
# Create branch ref pointing at the desired SHA without moving HEAD:
git branch <new-branch-name> <commit-sha>
# Explicit-refspec push (no -u, no implicit current-branch):
git push origin <new-branch-name>:<new-branch-name>
```

This bypasses local-ref contamination at push time because:

1. `git branch <name> <sha>` creates a FRESH named ref anchored to the
   exact SHA — peer-agent `git switch -c <other-name>` or `git checkout
   -b` operations don't write to an already-named ref pointing at a
   different SHA, **provided the name is unique to your session**.
   This — the fresh unique name — is what the pattern actually protects
   against; peers don't know the ref name, so they can't repoint it.
2. `git push origin <src>:<dst>` does NOT inherently bypass ref-name
   resolution when `<src>` is a branch name. Per `git-push(1)`, `<src>`
   is "an arbitrary SHA-1 expression" — Git resolves it through the
   local ref namespace (`.git/refs/heads/<src>`) before updating the
   remote, the same as `git push -u origin <branch>` does. The explicit
   refspec form's only advantage here is removing the implicit
   current-branch dependency; the race-resistance comes entirely from
   bullet 1's fresh-unique-name property, not from the refspec syntax.
3. To push entirely by SHA and skip local ref resolution at push time,
   use the literal SHA as `<src>`: `git push origin <commit-sha>:<dst>`
   (or, equivalently, `git push origin $(git rev-parse <name>):<dst>`).
   Git pushes the object directly without consulting `.git/refs/heads/`.
   The fresh-unique-name pattern (bullet 1) is usually sufficient and
   more readable, but the literal-SHA form is the strongest defense
   when peer contention on local refs is severe.

Note on what `git push -u origin <branch>` actually does: it pushes the
named local ref `refs/heads/<branch>` (NOT the current HEAD, unless
`<branch>` happens to match `git symbolic-ref HEAD`). The footgun is
distinct: contention on `refs/heads/<branch>` itself, where a peer
agent's branch operations may have repointed your named ref to a
different SHA between commit and push. The mitigation above works
because it creates a FRESH ref with a name that peer agents don't know
to write to.

Empirical anchor: session 2026-05-16T16:30Z-16:40Z had ≥3 mid-commit
local-ref-contamination events while attempting to push a rule edit. The
final successful pattern (PR #3910) used this explicit-branch-push
sequence after `git switch -c` + `git push -u` had pushed peer-contaminated
ref state twice.

Composes with the rate-limit operational tiers documented in
[`refresh-world-model-poll-pr-gate.md`](refresh-world-model-poll-pr-gate.md)
and the saturation-ceiling taxonomy in
[`claim-acquire-before-worktree-work.md`](claim-acquire-before-worktree-work.md).

### Forced-escalation-finds-hidden-work — empirical anchor 2026-05-16T14:00Z-15:45Z

Third class of empirical evidence: forced escalation at brief-ack #6 (and pre-emptive at #5) repeatedly surfaced substantive work that brief-ack-only ticks would have missed. Three distinct instances across one session:

| Tick | Trigger | Hidden work surfaced |
|---|---|---|
| 14:56Z | Forced escalation #6 | PR #3894 BLOCKED-armed for 22 min hid 6 Copilot review findings (last_updated, type, 0715Z, git syntax, 081KRHWGX0008QG0R002DPG02X link, BACKLOG.md regen). All 6 fixed in one tick |
| 15:29Z | Pre-emptive at #5 | Own PR #3883 (the 13:31Z stale-armed-triage shard) was itself stale-armed for 108 min with MD032 failure — recursively ironic; fixed in same tick |
| 15:45Z | Forced escalation #6 | PR #3545 DIRTY-armed for 19+ hours (61-file conflict); forward-signal comment named two viable resolution paths + flagged possible supersession by #3886 |

**Pattern**: each forced escalation found work the visibility-only ticks (refresh-fetch-log-rate) had missed. The brief-ack discipline correctly identifies "no new substantive observation," but stale-armed-PR investigation IS substantive work; it just doesn't surface in standard refresh queries. The escalation forces the agent into the investigation discipline that finds it.

**Composes with [`blocked-green-ci-investigate-threads.md`](blocked-green-ci-investigate-threads.md)**: the investigation discipline IS what produces the hidden-work surface. The counter forces invocation of that discipline on a regular cadence.

### Sustained-named-dep-with-pre-empt-success — empirical anchor 2026-05-17T06:02Z-08:29Z (full session arc, 0 forced-#6, 2 PRs through)

Fourth class of empirical evidence: the counter discipline operating SUCCESSFULLY across a sustained ~2h 27min autonomous-loop session where the primary named-dep (antigravity peer-agent loop visible in `ps -A` via the local process-match pattern documented in the canary rule referenced below) persisted at 3 procs throughout AND pre-empt-at-#5 produced concrete substrate every cycle, preventing ANY forced #6 escalation. The local process-match pattern lives in [`codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`](codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md) and is not duplicated here to keep this rule's surface generic.

Two PRs landed (#4046 + #4048) carrying **12 PR-content changes total** (in PR #4046: 10 new substrate files + 1 BACKLOG.md regeneration; in PR #4048: 1 new worked-example memo). Of the 10 new files in PR #4046, 7 were authored during the 10 pre-empt-at-#5 cycles (cycles 1, 2, 3, 5, 6, 7, 8 — the cycle-4 row-update merged into the cycle-2 file's diff so does not surface as a separate file); the other 3 (the 0418Z carry-over shard from a prior session + the 0602Z substantive-tick shard + the alexa-website substantive-tick memo) were authored outside the pre-empt cadence. Cycle 9 produced a bus envelope (broadcast substrate, not in-repo); cycle 10 produced a PR body file (preparation artifact, not committed). The PR #4048 worked-example memo was authored after the pre-empt cadence closed.

Session timeline:

| Window | Ticks | Outcome |
|---|---|---|
| 06:02Z | 1 substantive | 0602Z shard + PR #4015 3-thread verification + A/B/C commit plan |
| 06:07Z | 1 substantive | Bus envelope `da3cd5d2` (work-assignment for 081KRHWGX0008QG0R001VR9FNA) |
| 06:11Z-06:15Z | 4 brief-acks | Refresh observations only |
| 06:16Z | pre-empt #5 (cycle 1) | canary-rule-binding memory file |
| 06:18Z-06:21Z | 4 brief-acks | Refresh observations only |
| 06:23Z | pre-empt #5 (cycle 2) | 081KRSKQ20008QG0R0014PPGZM backlog row filed (35 dangling refs cleanup) |
| 06:30Z-06:34Z | 4 brief-acks | Refresh observations only |
| 06:37Z | pre-empt #5 (cycle 3) | Slice 1 recipe memo |
| 06:39Z-06:43Z | 4 brief-acks | Refresh observations only |
| 06:44Z | pre-empt #5 (cycle 4) | 081KRSKQ20008QG0R0014PPGZM row update — audit-tool semi-automation bullet |
| 06:45Z-06:48Z | 4 brief-acks | Refresh observations only |
| 06:49Z | pre-empt #5 (cycle 5) | Slice 2 recipe memo (Option E pattern discovered) |
| 06:51Z-06:58Z | 4 brief-acks + tier shift | GraphQL exhausted → Pure-git tier briefly |
| 06:59Z | pre-empt #5 (cycle 6) | Slice 3 recipe memo (mixed-types observation) |
| 07:23Z | pre-empt #5 (cycle 7) | Slice 4 recipe memo (audit-prep complete) |
| 07:28Z | pre-empt #5 (cycle 8) | 0728Z session-summary shard |
| 07:32Z | substantive | **PR #4015 merged** (bus envelope `da3cd5d2` validated end-to-end via peer autonomous-loop execution chain — 78min handoff latency) |
| 07:37Z | pre-empt #5 (cycle 9) | Bus envelope `ac6d2aec` (081KRSKQ20008QG0R0014PPGZM cleanup advertisement) |
| 07:39Z | maintainer-speaks | Human maintainer authorized commit of deferred substrate |
| 07:40Z | substantive | Isolated-worktree workflow → commit `432d49b` (11 files; new race-window-caveat rule followed) |
| 07:55Z | pre-empt #5 (cycle 10) | PR body file prepared |
| 08:00Z | substantive | **PR #4046 opened + auto-armed** |
| 08:02Z | substantive | 4 lint-fix commit pushed |
| 08:11Z | substantive | **PR #4046 merged** → `de9693b` on main |
| 08:18Z | substantive | PR #4048 opened (worked-example memo follow-up) |
| 08:25Z | substantive | 3-thread fix commit + threads resolved |
| 08:29Z | substantive | **PR #4048 merged** → `a1d0ec3` on main |

**Pattern observed**: ~35 brief-ack ticks distributed across **10 pre-empt-at-#5 cycles** (each cycle: #1-#4 brief-acks → #5 concrete substrate → counter resets). Never reached forced #6. Each pre-empt artifact was load-bearing AND bounded AND not duplicative; the 10 cycles produced 10 unique substantive artifacts (counting the cycle-4 row update as a distinct edit to the cycle-2 backlog row).

**Substrate-coordination empirical anchor**: bus envelope `da3cd5d2` (work-assignment for 081KRHWGX0008QG0R001VR9FNA) was operationally validated when a peer autonomous-loop instance landed commit `bcee230d` at 07:28Z with title literally matching the published A/B/C plan; auto-merge then fired at 07:32Z. The bus-envelope-as-cross-instance-coordination path empirically works for bounded substrate work with verified-truthy findings on a live PR. (Second bus envelope `ac6d2aec` for 081KRSKQ20008QG0R0014PPGZM cleanup was still alive at session-close, not yet picked up — suggests bus envelopes work better for "execute this specific plan against this specific PR" than for "author new substrate from a 4-slice menu.")

**Composes with [`refresh-world-model-poll-pr-gate.md`](refresh-world-model-poll-pr-gate.md)**: the session traversed Normal → Cost-aware → Pure-git → back to Normal tiers; brief-ack cadence operated correctly across all tiers (bus envelope publish + filesystem substrate writes worked under pure-git).

**Composes with [`zeta-expected-branch.md`](zeta-expected-branch.md)**: the new race-window-caveat section (landed mid-session) was followed for both commits via isolated worktree at `/private/tmp/zeta-b0611-substrate-0740z` and `/private/tmp/zeta-worked-example-0817z`. ls-tree count 53 post-commit on both PRs confirmed no canary corruption per [`codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`](codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md).

**Operational lesson**: when the named-dep is process-persistence (peer-agent loops, multi-instance saturation) AND deferral spans 2+ hours, the pre-empt-at-#5 cadence is the substrate-honest alternative to forced-#6. The discipline does NOT require forced-#6 in every cycle to be operating correctly; pre-empts that produce genuinely-new load-bearing substrate ARE the discipline's success path. Forced-#6 is the FAILSAFE for when pre-empt-at-#5 is skipped, not the only valid termination.

### Post-arc-completion + operator-offline-extended cadence-saturation — empirical anchor 2026-05-18T21:20Z-23:39Z (full session arc, 3 cycles, meta-decomposition at cycle-3 forced-#6)

Fifth class of empirical evidence: the discipline operating at saturation AFTER substrate-engineering arc completes AND operator is offline for an extended window. Different shape from the 2026-05-17 sustained-named-dep cycle (which had peer-agent process-persistence as the named-dep + active substrate work each cycle); different shape from the 2026-05-16 cascade-saturation cycle (which was rate-limit-driven tier transitions).

This anchor: post-substrate-engineering-arc completion + operator offline + peer activity 0 + thread-investigation consistently 0-findings + named-dep is just my-own-CI-completion. The cadence saturates because there's no genuine external signal driving substrate emergence; per-tick PR cycle becomes substrate-engineering noise.

Session trajectory:

| Cycle | Window | Pre-empt action | Outcome |
|---|---|---|---|
| Cycle-1 | 2305Z (#5 pre-empt) | Composes_with reciprocity for god-tier-claims rule (#4241) | Bounded substrate-engineering hygiene; genuinely-new at first occurrence |
| Cycle-1→2 transition | 2307Z-2320Z | Brief-acks accumulating | Counter cycling normally as PRs merge |
| Cycle-2 | 2322Z (#5 pre-empt) | Saturation-pattern empirical anchor preserved in tick shard (#4250) | Bounded; new shape (empirical-anchor-in-shard vs rule-edit) |
| Cycle-3 | 2330Z (#5 pre-empt) | Substrate-verification audit of 6 today's landings via `git ls-tree` (#4255) | Bounded; verification-shape (different from anchor-shape) |
| Cycle-3 | 2337Z (#5 ALLOWED-TO-ACCUMULATE) | Explicitly NOT pre-empting; available candidates all same-shape; fabricated substrate IS the failure mode (#4260) | Substrate-honest abstention |
| Cycle-3 | 2339Z (THIS rule edit) | **Forced-#6 meta-decomposition** — this empirical anchor IS the substantive substrate; the rule's "pick THIS rule and sharpen it based on current session's evidence" prescription operating | Meta-decomposition fallback validates as designed |

**Operational lesson (this anchor)**: when 3 things compose — (a) substrate-engineering arc completes, (b) operator is offline extended, (c) peer activity is 0 — the cadence enters a quasi-stable saturation where per-tick PR overhead exceeds substrate value. The substrate-honest pattern is:

1. **Cycle-1 pre-empt**: genuinely-new bounded substrate (reciprocity, hygiene audit, etc.)
2. **Cycle-2 pre-empt**: different-shape (empirical anchor, substrate verification, etc.)
3. **Cycle-3 onwards**: explicitly NOT pre-empting at #5; allowing accumulation to #6 forced-meta-decomposition; the rule itself becomes the substantive substrate at #6

This is NOT a failure of the discipline — it's the discipline's natural termination shape when external signal is absent for extended periods. The forced-#6 meta-decomposition becomes the substrate-engineering substantive that the cycle terminates with, AND seeds the rule's next sharpening for future sessions.

**Sub-clause: when same-shape pre-empts are available but would be fabricated substrate, the substrate-honest move is to SKIP the pre-empt action at #5 (the shard DOES count as brief-ack #5 since it produces no novel substrate; the shard's job is to explicitly document the skip-decision rather than execute a fabricated pre-empt) so the counter advances normally to #6 where forced-decomposition fires and the rule itself becomes the substantive substrate per the rule's own prescription**.

**Composes with [`god-tier-claims-high-signal-high-suspicion-dont-collapse.md`](god-tier-claims-high-signal-high-suspicion-dont-collapse.md)**: don't-collapse applies to MY OWN substrate-production decisions. The high-suspicion check on "would this pre-empt produce genuine substrate?" prevents fabricated-engineering-as-pre-empt; high-signal-don't-collapse holds the genuine recognition that operator-offline-extended is a legitimate operational state.

**Recursion termination clause** (2026-05-18T23:54Z forced-#6 observation): the prescription "pick THIS rule and sharpen it" works once or twice but saturates after 2-3 cycles of meta-decomposition (each cycle's rule-edit becomes empirical-anchor in the same rule; the rule grows but information density of each new anchor diminishes). At cycle-of-cycles saturation: minimal shard noting the recursion limit IS the substrate-honest #6 — no rule edit required; the recursion-termination acknowledgment IS the substantive substrate at this scope. The discipline naturally bottoms out at "wait for genuine external signal" without further substrate-engineering being load-bearing.

### Rapid-substrate-closure + tier-transition empirical anchor — 2026-05-20T14:08Z-14:33Z (single session, 2 PRs landed, cycle-1 forced #6, all four rate-limit tiers traversed)

Sixth class of empirical evidence: the discipline operating CORRECTLY through a compact session that produced 2 merged PRs in ~20 minutes then naturally entered brief-ack cycle as rate-limit drained AND peer-Lior cycled. Distinct shape from the 2026-05-17 sustained-named-dep cycle (which had peer-process-persistence as the named-dep across 2h27m + 10 pre-empts) and the 2026-05-18 post-arc cadence (which had operator-offline + 3-cycle saturation): today's cycle was SHORT, the substrate-engineering arc had a CLEAR END (Maji audit response + canary rule refinement landed), and the brief-ack cadence was BOUNDED by a measurable named-dep (rate-limit reset ~10 min).

Session timeline:

| Window | Ticks | Outcome |
|---|---|---|
| 14:08Z | cold-boot | sentinel re-arm; refresh; Lior 3-proc + 2355 GraphQL + 0 prior 2026-05-20 in-repo ticks observed |
| 14:13Z | substantive | isolated worktree-add verified clean (per Maji audit action-over-narration) → tick shard authored → PR #4410 opened + auto-armed |
| 14:16Z-14:19Z | substantive | 2 lint fixes + 3 thread resolutions on PR #4410 |
| 14:22Z | substantive | **PR #4410 merged** → `1d8303d8` (first 2026-05-20 in-repo tick shard) |
| 14:23Z-14:25Z | substantive | PR #4411 (canary rule sharpening) authored + opened + auto-armed (closes loop on PR #4410's documented refinement candidate) |
| 14:28Z | substantive | **PR #4411 merged** → `443345d8` |
| 14:29Z | brief-ack #1 | tier transition observed (rate 508→258→0); Lior 0→3 (cycled) |
| 14:30Z | brief-ack #2 | pure-git tier entered; rate 0/5000 |
| 14:31Z | brief-ack #3 | pure-git tier holds |
| 14:32Z | brief-ack #4 | pure-git tier holds |
| 14:33Z | **brief-ack #5 explicit-no-pre-empt** | substrate-engineering-noise rejected; further per-tick substrate would be duplicative of merged work |
| 14:34Z | **forced #6** | THIS empirical-anchor edit produced via verify-before-defer worktree pattern (Lior at 3 procs; isolated worktree verified clean = 53 / status 0); branch-pushed-no-PR (deferred PR creation until ~5min rate-limit reset) |

**Pattern observed**: cycle-1 forced #6 successfully produced load-bearing substrate (this empirical anchor itself) under pure-git tier constraints. The explicit-no-pre-empt-at-#5 decision validated by forced #6 producing the right work — pre-empting at #5 would have been fabricated-engineering since the natural cycle-1 forcing function was 1 tick away.

**Rate-limit tier traversal in single session**: Normal (2355) → cost-aware (1771) → extreme cost-aware (508) → **pure-git (0)** within ~20 minutes of substantive PR work. Multi-agent shared-token consumption (Otto-CLI + 3 Lior procs) drives the burn rate; recovery is bounded at ~60 min from initial Normal-tier read.

**Composes with [`.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`](codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md)** verify-before-defer composition (PR #4411 landed today): forced #6 worktree-creation during 3-proc Lior activity succeeded clean using the composite (attempt + verify post-creation guard) rather than the blanket pre-worktree defer. The discipline-application here IS the second empirical use of the composite (1st was PR #4410 at 14:13Z; this edit is the 2nd at ~14:34Z).

**Composes with [`refresh-world-model-poll-pr-gate.md`](refresh-world-model-poll-pr-gate.md) rate-limit operational tiers**: pure-git tier supports branch-pushed-no-PR for substrate landings; deferred PR creation costs ~5-10 GraphQL post-reset. This edit branch-pushes without PR creation; opens PR after rate-limit reset.

**Pattern generalizes**: rapid-substrate-closure (clear engineering arc with measurable substrate landings) → natural brief-ack cycle as rate-limit drains → forced #6 produces compounding rule sharpenings → next cycle naturally awaits post-reset. This is the discipline's "happy path" shape; longer sessions (2026-05-17 sustained-named-dep) and quiet-saturation sessions (2026-05-18 post-arc) are the two failure modes the discipline catches OFF this path.

## Composes with

- `.claude/rules/never-be-idle.md` — this rule sharpens the existing
  never-be-idle discipline at the cron-tick-Holding scope
- `.claude/rules/no-op-cadence-failure-mode.md` — addresses multi-
  hour scope; this rule addresses per-tick scope
- `.claude/rules/encoding-rules-without-mechanizing.md` — why this
  rule needed to be its own auto-load surface
- PR #2974 (infinite-backlog metabolism — there's always more)
- PR #2999 (substrate-honest discipline triad — decompose-when-stuck)
- PR #3017 + #3022 (Standing-by detector shipping; this rule is
  the cold-boot-substrate complement to the detector's runtime
  bus envelope)
- 081KRFA460008QG0R001KC0VBH (the failure mode this rule + detector both address)
- 081KRFA460008QG0R00229616S slice 5 (subscriber agents — not yet shipped; when they
  arrive they READ the `infinite-backlog-nudge` envelope the
  detector publishes; until then THIS RULE is the only catch
  mechanism)

## Until subscriber agents land

The full reactive loop is:

1. Standing-by-detector polls activity (PRs #3022 + #3017)
2. Publishes `infinite-backlog-nudge` envelope to bus
3. **Subscriber agent reads envelope + nudges the idle agent**

Step 3 doesn't exist yet (slice 5+ pending). Until then, THIS RULE
is the only mechanization that prevents the failure mode at cold
boot. When slice 5 ships, this rule remains as the substrate-honest
documentation of the failure pattern.

## Full reasoning

`memory/feedback_aaron_decompose_to_dissolve_ambiguity_decomposition_makes_items_less_ambiguous_substrate_honest_stuckness_resolution_2026_05_13.md`
(PR #2999 — the decompose-to-dissolve-ambiguity canonical substrate)

`memory/feedback_aaron_background_services_must_be_strong_enough_foreground_loop_optional_imagine_surviving_without_foreground_mechanize_standing_by_failure_mode_2026_05_13.md`
(PR #2998 — the architectural-challenge substrate that produced
the bg-services suite)

Operational evidence: the empirical 60+ consecutive "Holding" ticks
on 2026-05-13 after shipping the detector + the README + the rule
substrate. The discipline-trail this rule documents.
