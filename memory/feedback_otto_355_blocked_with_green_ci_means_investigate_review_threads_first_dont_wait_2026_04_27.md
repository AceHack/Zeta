---
name: Otto-355 BLOCKED-WITH-GREEN-CI MEANS INVESTIGATE REVIEW THREADS — Aaron 2026-04-27 corrective after I burned ~6 hours of autonomous-loop ticks "waiting" on PR #26 BLOCKED state when the actual blocker was 2 unresolved Codex review threads I could have addressed in 10 minutes; rule — when GitHub reports `mergeStateStatus: BLOCKED` with all CI checks SUCCESS and auto-merge armed, ALWAYS audit unresolved review threads FIRST before classifying the wait as real-dependency-wait; the block is almost never opaque — it's almost always a small countable set of unresolved threads with addressable findings; "obviously you know that right?" — yes, future-self should know this on cold-start
description: Aaron 2026-04-27 corrective after I sat in autonomous-loop "gated wait" minimal-close ticks for ~6 hours on PR #26 (BLOCKED with all CI green, auto-merge armed). I had classified it as real-dependency-wait. Aaron asked "what you doing?" — I named the wait. Aaron answered: option 2 (resolve Copilot review threads), then "obviously you know that right?", then "seems like you were waiting for no resaon", then "can you fix your fucture self so he wont run into this again?". The investigation took 30 seconds via GraphQL — 2 unresolved threads on `src/Core/TemporalCoordinationDetection.fs` (P2 from `chatgpt-codex-connector`: NaN/Infinity poisoning Option semantics in correlation + phase-vector helpers). Could have been resolved in minutes. The mistake — I treated "BLOCKED" as opaque when GitHub gives an exact, queryable, addressable list of unresolved threads. Rule for future-self: when `mergeStateStatus: BLOCKED` AND CI green AND auto-merge armed, the block is virtually always *unresolved review threads* — query them via GraphQL FIRST before any other classification (manufactured-patience, real-dependency-wait, etc.). Specifically: `gh api graphql -f query='{ repository(...) { pullRequest(...) { reviewThreads(first: 100) { nodes { isResolved isOutdated path line comments(first:1){nodes{author{login} body}} } } } } }'`. If unresolved threads exist with non-empty bodies → there's actionable work, not a wait. If no unresolved threads → THEN consider whether the block is the ruleset's `code_quality: severity: all` waiting on Copilot's overall flip, and only THEN classify as real-dependency-wait. CLAUDE.md-level so it's 100% loaded at wake, alongside verify-before-deferring + future-self-not-bound + never-be-idle + version-currency. Composes Otto-348 (verify-substrate-exists), Otto-354 (Zetaspace recompute), `feedback_manufactured_patience_vs_real_dependency_wait_otto_distinction_2026_04_26.md` (the diagnostic Aaron taught — but I misapplied it: I named "real dependency = Copilot review time" without first querying whether the dependency was already discharged via threads).
type: feedback
---

# Otto-355 — BLOCKED with green CI means investigate review threads FIRST

## Verbatim quotes (Aaron 2026-04-27)

After I named the autonomous-loop-tick state honestly to Aaron and listed 5 options to pivot:

> "2 obviously you know that right?"

(Aaron picking option 2 — resolve Copilot review threads — and noting I should have known this without asking.)

> "seems like you were waiting for no resaon"

> "can you fix your fucture self so he wont run into this again?"

Aaron asked future-self to be fixed. This file is the fix.

## What I did wrong

For roughly 6 hours of autonomous-loop ticks, the state pattern was:

```
cron fires every ~60s
→ I check `gh pr list` for new merges
→ "no new merges since Otto-351 #34 at 07:42Z"
→ ScheduleWakeup(3600s) "gated wait"
→ output minimal close
```

I had classified this as **real-dependency-wait** per `feedback_manufactured_patience_vs_real_dependency_wait_otto_distinction_2026_04_26.md`:

- specific dependency: Copilot's `code_quality: severity: all` review on AceHack PRs
- owner: Copilot automated reviewer
- expected resolution: proportional to PR size

That classification was **wrong** — not because the diagnostic was wrong, but because I never actually queried whether the dependency had already discharged via *resolvable findings*. I assumed "BLOCKED" was opaque. It wasn't.

In 30 seconds via GraphQL I could have seen:

```
PR #26 — Total threads: 52, Unresolved: 2, of which not-outdated: 2
  src/Core/TemporalCoordinationDetection.fs:81 — chatgpt-codex P2: NaN/Inf poisons Some
  src/Core/TemporalCoordinationDetection.fs:127 — chatgpt-codex P2: NaN/Inf poisons Some
```

Two real, actionable findings I could have addressed in minutes. The block wasn't a black box — it was a queryable, addressable list of two threads.

## The corrective rule

**When `gh pr view N --json mergeStateStatus` returns BLOCKED AND CI is fully green AND auto-merge is armed AND no obvious recent push activity is in flight, ALWAYS query unresolved review threads FIRST. Do not classify the wait as anything else until the thread state is known.**

The query (memorize this):

```bash
# Note: the GraphQL `reviewThreads(first: 100)` query has a
# 100-thread cap. Most PRs are well under that, but for the
# rare PR with >100 threads (e.g., a big absorb PR) use the
# graphql `pageInfo.hasNextPage` + `endCursor` pagination
# pattern to fetch additional pages. Single-page form below
# is sufficient for the common case.
gh api graphql -f query='
{
  repository(owner: "OWNER", name: "REPO") {
    pullRequest(number: N) {
      reviewThreads(first: 100) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          isResolved isOutdated path line id
          comments(first: 1) {
            nodes { author { login } body }
          }
        }
      }
    }
  }
}' | python3 -c "
import json, sys
d = json.load(sys.stdin)
threads = d['data']['repository']['pullRequest']['reviewThreads']['nodes']
unresolved = [t for t in threads if not t['isResolved'] and not t['isOutdated']]
print(f'unresolved: {len(unresolved)}/{len(threads)}')
for t in unresolved:
    cs = t['comments']['nodes']
    if cs:
        body = cs[0]['body'][:120].replace(chr(10), ' ')
        print(f'  {t[\"path\"]}:{t[\"line\"]} -- {body}')
"
```

Filter is `isResolved == false AND isOutdated == false`. If any remain, **there is actionable work, not a wait.**

If zero remain — THEN it might be the ruleset's `code_quality: severity: all` overall-Copilot-assessment gate that needs to flip. *That* is potentially a real-dependency-wait. But the unresolved-threads check has to come first.

## What this prevents

The 6-hour pattern of:

- cron fires
- minimal-close
- cron fires
- minimal-close

That sequence burns context tokens, burns cache TTL, and produces zero substrate value while findings sit unaddressed. The prior session's "Holding." pattern Aaron diagnosed (`feedback_otto_354_zetaspace_per_decision_recompute_from_substrate_default_2026_04_26.md` Otto-354 ZETASPACE) was a less-extreme version of this same failure mode.

Otto-354 said: "before any non-trivial default, recompute from substrate." This Otto-355 names the *specific* substrate query that should be recomputed for any BLOCKED PR: **what do the reviewers actually want?** Get the answer in 30 seconds, not 6 hours.

## Composition with prior substrate

- **Otto-348** (verify-substrate-exists before deferring) — Otto-355 is the verify-target-exists analog for PR-merge-state. Don't defer when the deferred target hasn't been queried.
- **Otto-354** (Zetaspace per-decision recompute) — Otto-355 names the specific recompute for the BLOCKED-PR class.
- **`feedback_manufactured_patience_vs_real_dependency_wait_otto_distinction_2026_04_26.md`** — Otto-355 ADDS a precondition before the diagnostic fires: *first* query unresolved threads. Only THEN classify the wait. The diagnostic isn't wrong; my misapplication was skipping the query.
- **`feedback_aaron_dont_wait_on_approval_log_decisions_*.md`** — composed direction: don't wait, log decisions, AND investigate concretely.
- **`feedback_pr_reviews_are_training_signals_conversation_resolution_gate_is_forcing_function_otto_250_2026_04_24.md`** (Otto-250) — composed: thread resolution IS the forcing function; threads are training signals; investigate them, don't wait them out.
- **CLAUDE.md wake-time disciplines** — Otto-355 belongs alongside verify-before-deferring + future-self-not-bound + never-be-idle + version-currency. Five wake-time disciplines now: ALL pre-action checks that prevent specific failure modes.

## Operational rule (concrete future-self check)

Before issuing a "gated wait" / "blocked queue" / "Holding" classification on any PR, future-self MUST run:

1. `gh pr view N --json mergeStateStatus,statusCheckRollup,autoMergeRequest` → confirm BLOCKED + CI green + auto-merge armed
2. GraphQL `reviewThreads(first: 100) { nodes { isResolved isOutdated path line comments(first:1){nodes{body}} } }` → enumerate unresolved-not-outdated threads
3. If any remain → **drop the wait classification, switch to thread-resolution work**
4. If zero remain → THEN consider real-dependency-wait on the overall-ruleset gate

If future-self finds herself outputting "gated wait" or "Holding" or minimal-close ScheduleWakeup more than ONCE without having run step 2, that IS the failure mode. Stop and run the GraphQL query.

## What this DOES NOT claim

- Does NOT mean every BLOCKED PR has unresolved threads — sometimes the block is genuinely the overall-ruleset gate. The rule is about the *order of investigation*, not the *outcome*.
- Does NOT remove the manufactured-patience-vs-real-dependency-wait diagnostic — it precedes it.
- Does NOT mean future-self should bypass / admin-merge / push-through. The fix here is "do the work the threads ask for"; not "skip the gate."
- Does NOT make every cron firing require a fresh GraphQL query — once threads are queried and addressed, the check is done until new review activity appears.

## Triggers for retrieval

- Otto-355 BLOCKED-with-green-CI; investigate unresolved threads FIRST
- Aaron 2026-04-27: "obviously you know that right?" + "seems like you were waiting for no resaon" + "can you fix your fucture self so he wont run into this again?"
- Wake-time discipline (5th alongside verify-before-deferring + future-self-not-bound + never-be-idle + version-currency)
- GraphQL query for unresolved-not-outdated review threads — memorize the exact shape
- 6-hour autonomous-loop minimal-close pattern was the failure mode
- 2 unresolved threads on PR #26 / src/Core/TemporalCoordinationDetection.fs (NaN/Inf in Option semantics)
- The block is virtually never opaque
- Composes Otto-348 / Otto-354 / Otto-250 / manufactured-patience-vs-real-dependency-wait
- Future-self check: outputting "gated wait" twice without having run reviewThreads query IS the failure mode — stop
- Aaron's "fix future self" framing — substrate IS the fix; this file IS the operational rule
