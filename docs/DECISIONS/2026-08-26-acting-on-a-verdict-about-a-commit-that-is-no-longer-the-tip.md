# Acting on a verdict about a commit that is no longer the tip

**Date:** 2026-08-26 · **Status:** proposed — nothing decided; every action below is
gated-class and none has been taken. The PR carrying this document changes no workflow, no
ruleset, and no repository setting.

**Question asked** (Aaron, 2026-08-26): *"at ~194 merges/day, main advances faster than a
platform build completes — can we work around this without cancelling current builds?"*

> **Filed under `docs/DECISIONS/` deliberately.** `.markdownlint-cli2.jsonc` ignores
> `docs/research/2026-*-*.md`, so a green lint on a doc filed there would be a check that
> did not run. This one is linted.

## 0. Read the companion first

[`docs/research/2026-08-26-three-verdict-loss-mechanisms-on-main-only-one-is-concurrency-and-the-largest-is-invisible-to-both-designs.md`](../research/2026-08-26-three-verdict-loss-mechanisms-on-main-only-one-is-concurrency-and-the-largest-is-invisible-to-both-designs.md)
answers the **production** half — why verdicts go missing, and what to do about it. It is
thorough, its measurements replicate, and this document does not repeat it.

The two halves are genuinely different questions:

| | question | document |
|---|---|---|
| **production** | does a verdict about commit N ever get *made*? | the companion |
| **consumption** | once made, does anything *read* it when the tip is N+3? | this one |

Aaron's question is the second. The companion's §2.3 names the boundary and stops at it:
*"what is lost is the post-merge verdict."* Below that line there is no design, and — as §2
measures — no consumer either.

## 1. Method, and one premise of the brief that is now stale

All figures measured 2026-08-26 against `Lucent-Financial-Group/Zeta` via the REST Actions
API. Window `2026-08-25T22:16Z → 2026-08-26T22:16Z` unless stated. Where a number rests on a
sample, the sample size is inline; where I could not verify something it is in §6.

**The brief quoted `gate.yml` L106-108 as keying concurrency on `github.ref`. It does not,
as of 09:55Z today.** Commit `d492415d` — *"fix(ci): main gate runs share one concurrency
group, so commits lose verdicts"* — changed it to `github.sha`. That is the companion's
Design A, and it **landed** while the companion was still recommending it be deferred behind
the cache work.

The effect is measured and complete:

| window | gate runs on `main` | cancelled | rate |
|---|---|---|---|
| last 300 runs (from 2026-08-25T05:00Z) | 299 | 152 | **50.8%** |
| last 100 runs (from 08:17Z today) | 99 | 24 | 24.2% |
| **every hour from 10:00Z today** | **66** | **0** | **0.0%** |

Cancellation through 09:00Z ran 73-82% per hour; since 10:00Z it is zero across 66 runs.
**The displaced-verdict class is closed.** The brief's framing — *"can we do this without
cancelling current builds"* — describes a problem that no longer exists on `main`, and the
companion's §1.1 already showed that even before the fix nothing in-flight was being
cancelled: all 83 displaced runs had *zero jobs ever created*. Nothing was ever interrupted.
Runs that had not started were dropped.

**What has not changed is the bot-merge class.** Replicated independently here on a fresh
83-commit sample:

| merged by | gate push run created |
|---|---|
| `github-actions[bot]` | **0 of 41** |
| `AceHack` | 41 of 42 |

Verified by mechanism, not inferred: `actions/runs?head_sha=<sha>` returns zero runs with
`event: push` for bot-merged commits — every run attributed to them is `schedule`,
`workflow_run`, or `dynamic`. Across the full 24h window, **131 of 235 commits (55.7%) got a
gate run; 104 (44.3%) got none.** Hourly coverage swings between 0% and 100%.

So the companion's §7 step 1 remains the largest open item, and this document does not
compete with it. **Sequencing note that matters:** every consumption design below is
worthless on a commit that produced no verdict. Fixing production first is not merely
higher-value, it is a *precondition*.

## 2. The measured gap: there is no consumer

**Median lateness at verdict time** — for the last 20 completed gate runs on `main`, counting
commits that landed between the run's `head_sha` and the tip at run completion:

| sample | p50 behind | p90 | max | commit→verdict p50 |
|---|---|---|---|---|
| last 20 completed | **4.0** | 5.0 | 6 | 16.4 min |
| last 60 non-cancelled | 3.0 | 5.1 | 9 | 15.6 min |

Median inter-commit gap is **2.77 min** (n=234; p10 0.30, p90 14.03; 27% of gaps under one
minute). Median end-to-end gate run is **16.4 min** (p90 19.3). The ratio is the whole
problem: **a verdict costs about six merge intervals to produce.** Aaron's "N+3" is
measured as N+4.

Note the number understates exposure: it counts *commits*, not *unverified* commits. With
44.3% carrying no verdict at all, the count of unverified commits standing between a verdict
and the tip is strictly larger than the table.

**And nothing reads any of it.** The one mechanism designed to is
`src/Core.TypeScript/hygiene/retraction-actuator.ts` — the sovereign edge of the auto-revert
healer, built out of the RFC in `docs/letters/to-roster-auto-revert-healer-design-rfc.md`,
with four roster assents, twelve golden-vector laws, and a live wiring into `drift-sweep.yml`
since 2026-08-22.

> **`docs/drift-events/retraction-episodes.json` does not exist.** The actuator has never
> recorded an episode. It has never fired.

That is not a criticism of the actuator — its trigger requires BD001 open for
`TRIGGER_OPEN_TICKS = 2` consecutive sweeps with no fleet heal in flight, and the fleet has
been faster than that. But it means the entire consumption side of this system is
**unmetered** in the sense of `toy-is-free-metered-must-be-earned.md`: implemented, wired,
proven in simulation, and never once exercised against production traffic.

### 2.1 A third thing that makes a consumed verdict inert

Even a verdict that is produced *and* read may block nothing. `gate.yml` L410:

> *"They carry `continue-on-error: true` permanently and by intent: they are drift checks,
> deliberately observed and deliberately non-blocking."*

— of `windows-2025`, `windows-11-arm` (push-to-main only) and `macos-26`. Aaron authorized
this on 2026-08-19: *"we are moving away from anything that blocks into drift checks."*

This is a deliberate posture and this document does not argue against it. It does mean the
question is not *"how do we block on a late verdict"* — that has already been answered, and
the answer is **we don't**. The question is **which named mechanism acts on it instead**,
and today the answer is: none.

**Today's outage is the whole argument in one incident.** Both Windows legs of `main` were
red on `c3addd47` and `4ca7cc9b` for an upstream reason (`www.gnupg.org:443` unreachable).
The verdicts were produced correctly, on time, on a non-blocking leg. Nothing consumed them.
The break was found by a human asking.

## 3. The five options, priced

### 3.1 Merge queue — the canonical answer, and it does not reach the platforms that break

`merge_group:` is already a trigger on `gate.yml` and `codeql.yml`; the workflow is
queue-ready. The companion's §5 prices throughput (ρ ≈ 0.78 at peak, ~25 min per entry
against a ~20 min flush cadence) and names the disqualifying unknown (whether entries
enqueued by `GITHUB_TOKEN` dispatch `merge_group` runs at all). Both stand; read them there.

**One fact the companion states from the required-checks angle that is worth restating from
the consumption angle**, because it changes what a queue is *for*:

```yaml
# gate.yml, matrix-setup
if [ "${GH_EVENT}" = "pull_request" ] || [ "${GH_EVENT}" = "merge_group" ]; then
  echo 'os=["ubuntu-24.04","ubuntu-24.04-arm","macos-26"]'
else
  echo 'os=[...,"windows-2025","windows-11-arm"]'
fi
```

**A merge queue verifies Linux and macOS. It does not verify Windows, and cannot be made to
without deadlocking** — the companion's §6.5 shows that promoting a Windows leg to required
wedges the queue permanently, because the check can never report on a `merge_group` event.

So a queue closes the *semantic-conflict* class (two PRs green alone, red together) and
leaves the *platform-drift* class exactly where it is: verified after the merge, or not at
all. Today's incident is in the second class. **A merge queue would not have caught it.**

That is not an argument against the queue — it is an argument that the queue and the
consumption problem are answers to different questions, and buying one does not discharge the
other.

### 3.2 Retract-on-red — built, wired, never fired, and today it would have been wrong

The machinery exists and is better than the brief suggested. The RFC went **sovereign** on
2026-08-10 (`open_revert_pr` → `push_retraction`), and the 2026-08-22 rework parks the
retraction on `heartbeat/retraction-<sha>` and lands it through a PR with squash auto-merge —
because a direct push to `main` cannot satisfy `gate (required)` at push time. Twelve laws
hold. Roster conditions (Vera 1-3, Lior 1-2, Soraya a-b, Riven 1-2) are folded in. The
consent bar cleared with the operator's *"lets do it."*

**The crux is not the roster's conditions. It is a predicate none of them asked for.**

The actuator isolates the breaking commit as *"commits between the last green gate push-run
head and the first red one; unique iff exactly one."* Apply it to today:

| | |
|---|---|
| last green push run | `33017133462`, head `d4e39a78`, success 21:49Z |
| first red push run | `33017645569`, head `c3addd47`, both Windows legs failed |
| commits in `d4e39a78..c3addd47` | **exactly one** — `c3addd47` |
| isolation verdict | **unique** |
| actual cause | `www.gnupg.org:443` stopped answering |
| `c3addd47` | #15683, a GraphQL-transport hygiene lint. Touched `gate.yml`'s **hygiene** job, `package.json`, and three new files under `src/Core.TypeScript/hygiene/`. Causally unrelated. |

Had BD001 opened for two consecutive sweeps with no fleet heal in flight, the actuator's
refusal path would **not** have engaged — isolation was unique, so it would have retracted an
innocent commit, confidently, with a correctly-formatted letter to its author.

**The missing predicate:** *is this red attributable to the isolated commit at all?* Every
existing guard is about **uniqueness** (exactly one candidate) and **at-most-once** (one
attempt per episode). None is about **attribution**. Uniqueness is a property of the commit
*graph*; attribution is a property of the *failure*. An infrastructure outage produces a
perfectly unique isolation and a completely wrong answer.

This is the same inference error the Part 1 investigation made and had corrected today:
*it reproduces on consecutive commits, therefore it is deterministic, therefore it is ours.*
**An upstream outage reproduces identically — it is stable while its cause is stable.**
Reproducibility does not separate an internal defect from an external one; only the error
text does.

Cheap candidate predicates, in increasing order of cost:

1. **Refuse when the failing step is not attributable to the diff.** The failing step name is
   already available (`actions/runs/<id>/jobs`). A red whose failing step is the toolchain
   install, on a commit that touched no installer file, is not that commit's red. This is one
   set-intersection and would have refused today.
2. **Refuse when the same failure signature already exists on the previous commit's run.** If
   `N-1` failed the same step the same way, `N` did not cause it.
3. **Reuse `toolchain-install-stall.ts`.** It already classifies install-stall failures for
   the rerun lane; its classifier is the natural home for "this red is infrastructural."

**Recommendation: do not wire the write token until an attribution predicate exists and has a
falsifier.** The at-most-once key bounds the blast radius to one wrong revert per episode,
which is genuinely small — but one wrong revert of someone's landed work, on the day the
mechanism first fires, is the worst possible introduction for the most dangerous healer class
in the fleet, and the RFC itself says so.

### 3.3 Bisect-on-red — cheap, and it answers a question we are not yet asking

At p50 4 commits behind and p90 5-6, a bisect is ~⌈log₂6⌉ = 3 additional runs ≈ **50 min** at
the measured 16.4 min p50, or ~2 runs / 33 min at the median. That is affordable.

But bisect answers *"which of the N commits since is responsible"*, which presupposes that
**one of them is** — the same unexamined assumption as §3.2, and today it would have been
false for every N. Bisect is the right tool once attribution says the red is ours; it is a
more expensive way to be wrong before that.

**Sequence it after the attribution predicate, not instead of it.** Its natural first
consumer is `retraction-actuator.ts`'s currently-sticky refusal on non-unique isolation
(RFC-4): today that refusal hands multi-commit breaks to humans, and bisect is exactly what
would let it hand back a unique answer instead.

### 3.4 Speed — the gap is 6×, and the reachable savings are ~40%

`build-and-test` wall-clock, n=30 runs per platform, all post-fix (19:28-21:57Z today):

| platform | p50 s | p90 s | max s |
|---|---|---|---|
| ubuntu-24.04 | 742 | 818 | 1002 |
| ubuntu-24.04-arm | **405** | 542 | 590 |
| macos-26 | 700 | 797 | 897 |
| windows-2025 | 710 | 895 | 1072 |
| windows-11-arm | 646 | 775 | 832 |

Queue delay is p50 = p90 = **0 s** — runners are not the constraint. End-to-end p50 **981 s**,
p90 1156 s.

**The distribution does not have the shape the brief expected.** Windows is not an outlier —
its p50 (710 s) sits between macOS (700) and Linux x64 (742), and `ubuntu-24.04-arm` at 405 s
is the fastest leg by a wide margin. Today's Windows *failures* took 243-298 s only because
they died early; a healthy Windows leg is ordinary. There is no slow platform to fix.

To land a verdict inside the median 2.77 min merge interval, end-to-end would have to fall
from 16.4 min to under 3 — a **6× improvement**. Nothing on offer is 6×. The companion's §6.3
measures **42% of the gate's runner-seconds as setup overhead** and identifies three class-1
lint jobs paying a full toolchain install to do zero seconds of work; that is real and worth
taking, and it is not 6×.

**Conclusion: speed is a cost-reduction lever, not a solution to lateness.** Pursue it on its
own merits and stop counting it as an answer to this question.

### 3.5 Accept and measure — the honest default, and it is nearly free

Publish the coverage instead of implying it. Today's numbers, all already computable from
data the repo collects:

| quantity | measured |
|---|---|
| commits on `main` per 24h | 235 |
| with a gate run at their own SHA | 131 (**55.7%**) |
| with none | 104 (44.3%) |
| p50 commits behind at verdict | 4 |
| p50 commit→verdict | 16.4 min |
| Windows legs blocking? | no — `continue-on-error: true`, by intent |

`src/Core.TypeScript/ci/verdict-drought.ts` already detects the drought and already reports a
related quantity; the companion §1.2 notes its header misattributes the cause. Extending it
to publish a standing **coverage percentage** — rather than the current blast-radius-since-
last-verdict — is a small change to an existing detector.

This is the option this repo's own doctrine most obviously prefers: *the meter buys the
demarcation, not the claim*, and **a stated 55.7% is worth more than an implied 100%.** It is
also the only option that composes with all the others rather than competing with them —
whatever else is chosen, the coverage number is what tells you whether it worked.

## 4. Recommendation

**Sequenced. The order carries more than the choice, and the first item is not on the
consumption side at all.**

1. **Fix production first (companion §7 steps 1-2).** 44.3% of commits produce no verdict.
   Every design in §3 is a no-op on those commits. This is a precondition, not a competitor.
2. **Publish coverage (§3.5).** Small, additive, reversible, composes with everything, and it
   is what makes step 4 checkable. Do it whether or not anything else is done.
3. **Add an attribution predicate to `retraction-actuator.ts` (§3.2), with a falsifier built
   from today's incident.** Today's run is a ready-made golden vector: unique isolation, red
   on two platforms, cause upstream, correct answer *refuse*. Do not wire the write token
   before this exists.
4. **Then a merge queue if the semantic-conflict class has actually bitten** — the
   companion's §7.1 names this as its highest-value unmeasured fact and I did not measure it
   either. Note it closes the semantic-conflict class only; the platform-drift class stays
   post-merge either way (§3.1).
5. **Bisect-on-red last (§3.3)**, as an upgrade to the actuator's non-unique refusal, once
   attribution exists.
6. **Speed work on its own merits (§3.4)**, never as an answer to lateness.

## 5. What Aaron must decide

Nothing below has been taken.

1. **Should the retraction actuator's write token be wired at all** — and if so, before or
   after an attribution predicate? Today's incident says after; the counter-argument is that
   at-most-once already bounds the damage to one commit, and a mechanism that never fires is
   never measured.
2. **Is "no consumer" the intended end state?** Drift checks are non-blocking *by your
   authorization*. A red drift check that nothing reads is not drift-and-heal, it is drift.
   If the answer is "a human reads it", say so and this is closed — but then the detector, not
   an actuator, is the deliverable.
3. **Publish the coverage percentage on a public surface?** It is an honest number and it is
   not a flattering one.
4. **The merge-queue call**, which is the companion's §9 item 1 and remains open there.
5. **Does anything ever get retracted automatically without a human in the loop**, given the
   sovereign doctrine (*"we don't want humans to ever look at PRs… err on the side of forward
   motion, corrected based on drift"*)? §3.2 argues for a predicate, not for a human — but the
   predicate is a partial re-introduction of caution and that is a judgement call, not a
   measurement.

## 6. What I could not verify

1. **Whether BD001 would actually have opened on today's break.** Sweep tick 871 (21:48Z) is
   the last recorded and predates the 21:57Z break; the ledger has no entry covering it. The
   §3.2 counterfactual rests on the *isolation arithmetic*, which is verified
   (`d4e39a78..c3addd47` = exactly one commit), not on the trigger having fired.
2. **Whether the cache pressure the companion §4 predicted from Design A has materialised.**
   Design A landed 12 hours ago; I measured cancellations, not cache bytes.
3. **Whether the semantic-conflict class has ever broken `main`.** Same gap the companion
   names in its §8.6. Still unmeasured, and it is what decides the queue.
4. **The bisect cost estimate (§3.3) is arithmetic, not a measurement.** No bisect has been
   run here.
5. **One no-gate commit outside the bot-merge explanation:** `9f59cd12` / PR #15635, merged by
   `AceHack`, dispatched 13 push runs but no `gate`, 4 of them `startup_failure`. A second,
   rarer no-run mode; root cause not determined.
6. **Q3's durations are post-fix only** (all 30 runs from a 2.5-hour window today). Pre-fix
   runs mostly died pending without executing a matrix, so a representative 24h sample does
   not exist.

## Pointers

- [`docs/research/2026-08-26-three-verdict-loss-mechanisms-on-main-only-one-is-concurrency-and-the-largest-is-invisible-to-both-designs.md`](../research/2026-08-26-three-verdict-loss-mechanisms-on-main-only-one-is-concurrency-and-the-largest-is-invisible-to-both-designs.md)
  — the production half; §7 steps 1-2 are step 1 here.
- [`docs/letters/to-roster-auto-revert-healer-design-rfc.md`](../letters/to-roster-auto-revert-healer-design-rfc.md)
  — the RFC, its four assents-with-conditions, and the sovereign addendum.
- `src/Core.TypeScript/hygiene/retraction-actuator.ts` · `episode-protocol.ts`
  (`TRIGGER_OPEN_TICKS = 2`) — the consumer that exists and has never run.
- `src/Core.TypeScript/ci/toolchain-install-stall.ts` — the existing infrastructural-failure
  classifier, and the natural home for §3.2's attribution predicate.
- `src/Core.TypeScript/ci/verdict-drought.ts` — the detector §3.5 would extend.
- `.github/workflows/gate.yml` — `matrix-setup` (the pre-merge matrix excludes Windows),
  L410 (`continue-on-error` on the drift legs), L106-108 (Design A, landed `d492415d`).
- [`.claude/rules/toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md)
  — why §2 calls a wired-but-never-fired actuator *unmetered* rather than *done*.
- [`.claude/rules/never-assume-malice-where-mistake-is-possible.md`](../../.claude/rules/never-assume-malice-where-mistake-is-possible.md)
  — §3.2's attribution predicate is this rule in mechanical form: report the fact (red), not
  the culprit (this commit), until the evidence supports it.
