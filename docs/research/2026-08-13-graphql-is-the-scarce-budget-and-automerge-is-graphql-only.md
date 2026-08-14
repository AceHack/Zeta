# GraphQL is the scarce budget — and `enablePullRequestAutoMerge` has no REST form

**Ferried** 2026-08-13 from Aaron, on the heartbeat failures:

> we also want to avoid using graphql everywhere possible that's what rate limits us we need to desing
> around this antoher reason for moving away from the PRs asap

Correct, and it is measurable rather than a matter of taste. This records the measurement, the specific
GraphQL-only operation that is causing today's failures, and why it converges with the move off PRs.

## The measurement (CHECKED, 2026-08-13)

```
gh api rate_limit
  core    (REST):    24 used / 5000
  graphql        : 1111 used / 5000   ← 22% of the hourly budget
```

**GraphQL was being consumed ~46× faster than REST.** The two budgets are separate — REST is counted in
*requests*, GraphQL in *points* scaled by query complexity — so a workload can be nowhere near the REST
limit while approaching exhaustion on GraphQL.

Cost of the same information, measured directly:

| call | GraphQL points | returns |
|---|---|---|
| `gh pr view N --json state,mergeStateStatus` | **2** | state, merge state |
| `gh api repos/O/R/pulls/N --jq '{state,mergeable,mergeable_state}'` | **0** | the same three facts |

The REST form is free on the scarce budget and carries the same content. `mergeable_state` is the REST
spelling of `mergeStateStatus` (`clean`/`blocked`/`dirty`/`unknown`).

**Self-implication, stated because it is the largest single contributor found:** the autonomous tick loop
has been polling 4–6 PRs per tick with `gh pr view` *and* `gh pr checks`, both GraphQL, on a ~2-minute
cadence for a full session. At ~2 points per call that is on the order of 16–24 points per tick, and
plausibly most of the 1111 observed. **The monitoring was more expensive than the work it monitored** —
and it was invisible because REST looked idle.

## Which `gh` surfaces are GraphQL vs REST

**GraphQL (expensive):** `gh pr view --json`, `gh pr checks`, `gh pr list --json`, and
`gh pr merge --auto` (the `enablePullRequestAutoMerge` mutation).

**REST (free on that budget):** `gh api repos/…`, `gh run list` / `gh run view` (the Actions API is
REST), and `gh pr merge --squash` *without* `--auto` (`PUT /repos/{owner}/{repo}/pulls/{n}/merge`).

## The structural point — auto-merge arming is GraphQL-only, so it cannot be made cheap

This is the part that turns a cost observation into a design argument.

**`enablePullRequestAutoMerge` exists only as a GraphQL mutation. There is no REST endpoint for it.** So
"arm auto-merge" cannot be optimised onto the cheap budget — the only way to avoid its cost is to not do
it.

Which produces an unexpected convergence with today's failures. The `society-heartbeat` workflow fails
**every run** with:

```
flush-via-staging: arm auto-merge failed (PR #10397 reused):
  GraphQL: Resource not accessible by personal access token (enablePullRequestAutoMerge)
exit code 3
```

So the *same operation* is (a) the one the scoped PAT cannot perform, (b) GraphQL-only and therefore
un-cheapenable, and (c) not actually load-bearing — the flush has already succeeded by the time arming is
attempted. **Three independent reasons to remove the same call**, which is about as strong a signal as a
design gets.

## Why this is another argument for moving off PRs

Aaron has wanted the move off PRs for other reasons — heartbeats should be close to free, gate as little
as possible, hand off to the next reviewer rather than blocking. This adds a mechanical one:

**A PR is a GraphQL-shaped object.** Creating it, checking its state, checking its checks, and arming its
merge are all on the expensive budget, and the most useful of those has no cheap form at all. A telemetry
flush that pushes to an **ungated branch** needs *no* PR, and therefore no GraphQL: it is a git push plus,
at most, a REST merge.

`heartbeat/*` is already ungated (deletion rule only) and already used this way. So the cheap path exists
today; the expensive path is being taken out of habit and because the gate on `main` forced it once.

## What to do, cheapest first

1. **Stop arming auto-merge in the heartbeat flush.** It is failing, it is GraphQL-only, and the flush
   does not need it. Warn and exit 0 — but do *not* silently queue: a PR created and never merged
   accumulates telemetry invisibly, which is how #10397 came to sit open. Either merge via REST when
   checks pass, or say loudly that a PR is waiting.
2. **Move the monitoring loop to REST.** `gh api repos/O/R/pulls/N` for state,
   `gh api repos/O/R/commits/SHA/check-runs` for checks, `gh run list` is already REST. Zero behaviour
   change, ~all of the observed GraphQL consumption removed.
3. **Prefer push-to-ungated-branch over PR** for machine-generated content (telemetry, archives,
   heartbeats). Reserve PRs for changes that genuinely want review.
4. **Measure before and after.** `gh api rate_limit` is one REST call and settles the question; this
   document exists because a measurement was cheaper than an argument.

## Honest limits

- **The 1111 figure is a snapshot**, not an attribution. Other agents and sessions share the account's
  budget; the tick loop is the largest *identified* contributor, not a proven majority. A proper
  attribution would need per-caller accounting, which does not exist.
- **REST is not free, only separately budgeted.** Moving everything to REST trades one limit for another;
  at 24/5000 there is enormous headroom today, but a design that assumes REST is unlimited will fail
  later for the same reason.
- **`mergeable_state` is documented as somewhat unstable** and can return `unknown` while GitHub computes
  it — the same is true of the GraphQL field, but a REST-based poller should expect it and retry rather
  than treat `unknown` as a state.

## Pointers

- `src/Core.TypeScript/forge-host/github/flush-via-staging.ts` — the shared flush module behind both
  failing heartbeat workflows
- `.github/workflows/society-heartbeat.yml`, `.github/workflows/agent-heartbeat.yml`
- `docs/design/2026-08-13-agent-verified-merge-replacing-prs.md` — the move off PRs, now with a
  rate-limit argument attached

---

## Addendum — REST is limited too, and the two proposed remedies fix *different* limits (Aaron, 2026-08-13)

> so the rest have a limit too? hmm i thought rest were free, this is another reason we need to start
> splitting out repos and get our own hardware working so we get past all these rate limits, we need to
> try to design around any rate limits

**Yes — REST is limited.** 5000 requests/hour for an authenticated PAT. It *looks* free here only because
we are using 33 of it. The framing "GraphQL is expensive, REST is free" from the body above is
**misleading and is corrected here**: REST is *separately budgeted and currently idle*, which is not the
same as free.

And there is not one limit or two. The full picture, measured:

```
core (REST)        :   33 / 5000     per hour
graphql            : 1147 / 5000     per hour, points not requests
search             :    0 / 30       ← per MINUTE
code_search        :    0 / 10       ← per minute
dependency_snapshots:   0 / 100
code_scanning_autofix: 0 / 10
audit_log          :    0 / 1750
```

**`search` at 30/min and `code_search` at 10/min are far tighter than either headline budget**, and are
the ones an agent doing repo-wide discovery would hit first. They do not appear in the "5000/hour" mental
model at all.

There is also a class that **does not appear in `rate_limit` output**: GitHub's **secondary** rate limits
— roughly 80 content-creating requests per minute and 500 per hour, plus concurrent-request caps. Those
govern creating PRs, comments, and commits, which is exactly what heavy automation does. **The limit most
likely to bite this fleet is one you cannot query.**

### The two remedies fix different things, and one of them does not help at all

This is the part worth getting right before anything is bought or built.

**Splitting repos — helps the Actions budget, does NOT help the PAT budget.**

- A user PAT's 5000/hr is **per account**, shared across every repository it touches. Splitting the repo
  changes nothing for it.
- `GITHUB_TOKEN` inside Actions is **1000/hr per repository**. So *N* repos get *N* × 1000/hr of workflow
  API budget. **That is a real multiplier, and it is the actual rate-limit argument for splitting.**
- So the win is real but specific: it multiplies the *workflow-side* budget, not the *agent-side* one.

**Own hardware — does NOT help API rate limits at all.**

- Self-hosted runners remove the Actions **minutes** quota and the runner **concurrency** cap. Those are
  real constraints and worth removing.
- But a self-hosted runner calls the **same GitHub API with the same tokens** under the **same limits**.
  Compute location has no bearing on API budget.
- **PROPOSED correction, stated plainly because acting on the wrong model is expensive:** if the goal is
  rate-limit relief, hardware buys compute, not API. Expecting API headroom from owning machines would be
  a real misallocation.

### What actually escapes an API rate limit

Only one thing: **not calling the API.**

Which is the direction already named — zetadb over git, and eventually not needing git. Every mechanism
that moves state out of GitHub-as-substrate removes its API calls permanently rather than budgeting them:

- push to an **ungated branch** instead of opening a PR — no PR object, no state polls, no arming
- read state from the **local clone** (`git log`, `git ls-tree`) instead of the API — free, unlimited,
  and usually what we actually wanted
- **derive** rather than query (the `build-graph.ts` pattern) — computed from files already on disk

The general design rule this suggests, and it is stronger than "prefer REST": **treat every API call as a
consumable, and prefer any local computation that answers the same question.** Most of what the tick loop
polls is already present in the local clone or in a file; the API was habit.

### The honest limit on this whole line

**Some things genuinely require the API** — merging, creating a PR, reading another party's state. Those
cannot be designed away while GitHub is the coordination point, only reduced. So the ordering is: stop
calling it where a local answer exists, split the workflow budget by splitting repos, and treat the
remaining calls as the real cost of using GitHub as the substrate — which is the cost the move off it is
meant to retire.

### Open

5. Audit which tick-loop questions have a **local** answer (`git`/filesystem) and stop asking GitHub
   those. This is larger than the REST/GraphQL swap and probably removes more calls.
6. Confirm the `GITHUB_TOKEN` per-repo figure against current GitHub documentation before using it to
   justify a repo split — it is cited from standing knowledge here and is the load-bearing number for
   that argument.
7. Instrument the **secondary** limits (content-creation) since they cannot be polled — the only signal
   is a 403 with a `Retry-After`, so the flush paths should log and back off on it rather than failing.

---

## Correction to the correction — self-hosted *substrate* is not self-hosted *runners* (Aaron, 2026-08-13)

> our own hardware help casue we will be using self hosted git and or our own zetadb/fs and wont need
> github at all github will just be a mirror

**My correction above was too narrow and is itself corrected here.** It said "own hardware does NOT help
API rate limits at all," and that is true of exactly one reading — **self-hosted runners** — which I
silently substituted for what Aaron meant.

| what is self-hosted | API effect |
|---|---|
| **runners** (compute for GitHub Actions) | **none** — the runner calls the same API with the same tokens under the same limits. My original point, and it stands *for this case*. |
| **git / zetadb / the substrate itself** | **removes the calls entirely** — there is no API to call, because GitHub is no longer the coordination point. |

So hardware and "stop calling the API" are not alternatives. **Hardware is the enabler of it.** I framed
them as competing remedies when one is the mechanism for the other, and that framing would have argued
against the very thing that fixes the problem.

### Why "GitHub will just be a mirror" is the precise part

A mirror is a **push**: one direction, low frequency, no state polling, no PR objects, no merge arming.
Pushing refs is close to free in API terms.

Every expensive operation catalogued in this document — creating a PR, polling its state, reading its
checks, arming its merge — exists because GitHub is being used as the **coordination point**, not because
it is being used as a **store**. Which yields the general statement:

> **API cost is proportional to how much *coordination* runs through GitHub, not how much *data* is
> stored there.** A mirror stores everything and coordinates nothing, so it costs almost nothing.

That is why the mirror endpoint is not a compromise. It keeps the property GitHub is genuinely good at
(durable, public, widely-reachable storage) and drops the one that is metered (being the arbiter).

### This is the third appearance of one move today

The same shape has now shown up at three levels in a single session, which is some evidence it is a real
principle rather than three coincidences:

1. **PR-archive manifest** — stopped using git's *textual merge* as the concurrency primitive (one shared
   file) and switched to identity-keyed shards. The pairwise-conflict class **disappeared** rather than
   being managed.
2. **The evidence fold** (#10474) — stopped asking the fold to detect its own redundancy and moved
   provenance to the message. The correction became expressible instead of impossible.
3. **This** — stop using GitHub's *coordination* primitives and keep it as a store. The rate limit stops
   being a budget to manage.

In each case the fix was **not** to optimise the expensive operation but to **stop needing it**, and in
each case what remained was the cheap half that was doing the real work all along. Compare the
rung-1 lesson from `BoundJustification` (#10461): *ask which operation the defect required, and remove
it; do not add a field beside it.* Same instruction, applied to infrastructure.

### The honest costs, because self-hosting is not free — only differently costed

- **Availability, backup, and auth become ours.** GitHub was providing those, and the bill arrives as
  operational work rather than as a rate limit. That is a *better* bill for this project, since it is
  under our control and does not throttle, but it is not zero.
- **The mirror still needs a pusher**, and if we continue to want GitHub-hosted CI, those workflows still
  consume the API on GitHub's side. **You escape the API to the degree you stop needing GitHub's
  *decisions*, and keep paying to the degree you still want its *services*.** Deciding which services we
  keep is a real scoping question and is not answered here.
- **Reachability is a service too.** "Public and widely-reachable" is why the mirror exists at all;
  self-hosting the substrate does not replace that, which is exactly why it stays a mirror rather than
  being dropped.

### Open (revised)

6. ~~Confirm the per-repo `GITHUB_TOKEN` figure before using it to justify a repo split~~ — still worth
   confirming, but **de-prioritised**: if coordination moves off GitHub, the workflow-side budget stops
   being the binding constraint and the split should be justified on its own merits (blast radius,
   change-rate partitioning per DV2.0) rather than on rate limits.
8. **Scope which GitHub services survive the mirror transition** — CI? releases? issues? Each retained
   service keeps its API cost, and the answer determines how much of this document remains relevant.
