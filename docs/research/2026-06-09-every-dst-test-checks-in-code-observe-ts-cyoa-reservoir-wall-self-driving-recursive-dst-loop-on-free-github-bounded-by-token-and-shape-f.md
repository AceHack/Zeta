# Every DST test checks in code: observe.ts (the CYOA reservoir wall) + advance-ticks-commit → a self-driving recursive DST loop on free GitHub — bounded by the GITHUB_TOKEN throttle and shape-F runaway-catch

**Register:** [grounded] capstone synthesis (Aaron) + [synthesis] + honest bound. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). Closes the test=prod=tick / observe-as-map / time-as-generator arc.

## Aaron's words

> "this means every DST test will likely check in code once we start doing this in prod. it becomes
> our choose-your-own-adventure observe.ts reservoir-computing wall, and running a test writes or
> updates code/test which triggers more test runs on git-push workflows — our infinite recursive loop
> of DST for free on GitHub."

## The loop closes: a self-driving recursive DST on GitHub

Putting the arc together: **tests are ticks** (Amara), **test = prod**, **advance-ticks write the
next state to a branch + commit**, **observe.ts is the persistent map / CYOA selector**, **time is a
generated treaty primitive**. Therefore:

```text
observe.ts (CYOA reservoir wall)
  → selects the next tick-set (which tests/ticks to run)
  → advance-tick: fold observations/ferries, reduce uncertainty,
    regenerate F# types, WRITE code/test/types
  → MERGE TO MAIN + git push          ← the DST test itself does this
  → that push to main IS the recursion trigger:
  → GitHub Actions workflow runs the next DST tests
  → which select + advance more ticks → merge to main + push
  → … (recurse)
```

So **every DST test (in prod) merges to main + pushes**, and **that push to main is what triggers the
next round of DST** (Aaron: *"our DST test will do merges to main… git push… that's what will trigger
the recursion"*) — a **self-driving recursive DST loop, running on GitHub's CI for free.** The
advance-tick **advances the canonical line (main) itself** — it is the **PR/squash-merge-to-main flow
Otto already runs every commit, generalized to the whole fleet** (and the reason it's PAT-armed: the
default `GITHUB_TOKEN` push to main would *not* retrigger — see the bound below). The system
**advances its own forward arrow of time on free infrastructure**, one proven tick per workflow run.
(This is the early "you have infinite GitHub workflows; close the AI loop side" thread finally closed —
the AI loop side is observe.ts; the recursion edge is the merge-to-main push; the substrate is free
GitHub CI.)

- **observe.ts = the choose-your-own-adventure reservoir-computing wall** (already established:
  `2026-06-08-observe-ts-is-the-attractor-transition-map-and-the-reservoir-walls`; the
  `2026-05-28-workflow-as-reservoir-computing-walls-caustic-focus` doc). The reservoir's *walls* are
  the legal-action boundaries observe renders; the dynamics bounce/focus off them to pick the next
  adventure (tick). Running the reservoir = advancing the world.
- **Each tick asserts over the truth-root** (canonical/Merkle bytes), **not** the git hash (Amara's
  blade) — git is the transport that *carries + triggers*; the canonical root is what's *proven*.

## The honest bound — it is NOT literally infinite (this is the safety, by design)

"Infinite recursive loop for free" must be peeled — and the peel **is** the safety:

1. **Recursion is setup-dependent — and the repo documents BOTH halves (verified 2026-06-09).**
   Aaron asked Otto to "find the flag and make sure I'm right." Verified against `.github/workflows/`:
   - **Default `secrets.GITHUB_TOKEN` does NOT retrigger downstream workflows** — GitHub's
     anti-infinite-loop guard, **documented in our own** `budget-snapshot-cadence.yml`:
     *"events triggered by `secrets.GITHUB_TOKEN` do not fire downstream workflow runs (GitHub's
     anti-infinite-loop guard)… until a PAT secret is configured, this workflow … leaves it for the
     next pass."* So with the default token the loop **does not chain** — you must use a **PAT / App
     token** to *arm* it (opt-in side; Otto's original claim was right *for the default token*).
   - **But once a PAT / chained triggers (`workflow_run`/`dispatch`) / re-firing `pull_request` are in
     play, it recurses easily** — Aaron's lived footgun (*"I've created infinite workflow loops by
     mistake… it's on by default, you need a guard"*) is right *for that setup*.
   - **The GitHub-native STOP flag DOES exist (verified via GitHub docs, 2026-06-09 — Aaron is right):**
     put any of **`[skip ci]` · `[ci skip]` · `[no ci]` · `[skip actions]` · `[actions skip]`** in the
     commit message (HEAD commit, or *any* commit in the push), **or** the trailer **`skip-checks: true`**
     (at the end, preceded by two blank lines; `skip-checks: false` force-includes). **Caveat:** these
     only skip **`push` and `pull_request`** events — *not* `pull_request_target` / `workflow_run` /
     `workflow_dispatch` / `schedule` (so a chained-trigger loop on those is NOT stopped by `[skip ci]`).
   - **The repo *additionally* uses its own guards** (it hasn't relied on `[skip ci]`): an **actor-guard**
     (`lint-autofix.yml`: `github.actor != 'github-actions[bot]'` — "skip our own heal commits, loop
     guard"), **opt-in run-markers** (`inventory-phase5-proof.yml`: runs only if the message
     `contains … '[run-phase5-proof]'`), and **concurrency groups** (`cancel-in-progress`).

   **Net:** to *arm* the self-driving DST loop you use a **PAT** (the default token is GitHub-guarded
   off); once armed it recurses readily, so it must carry an **explicit guard** — actor-guard +
   opt-in run-marker + concurrency group (the repo's existing conventions), plus the shape-F catch
   below. So it's **PAT-armed AND guard-stopped** — both, not one. (Honest correction of Otto's
   earlier "token = the only throttle" *and* of the over-broad "always on by default": the truth is
   setup-dependent, and the repo already runs both patterns.)
2. **Shape-F runaway-catch.** A self-triggering test→commit→test loop is a **generative expansion
   (shape F)** — whose runaway form is a **fork-bomb to catch** (the fixed-point registry exists
   exactly to catch infinite ascension). The loop must terminate per tick (converge / reduce
   uncertainty) or be caught; "free + recursive" is *bounded generative*, not unbounded.
3. **Fair-use + concurrency caps.** GitHub Actions has rate/concurrency/minute limits; "free" is
   real but finite. Use concurrency groups + a tick budget; a runaway is both a fork-bomb (F) and a
   bill/fair-use violation. (Dejan's CI lane: concurrency groups, runner pinning, the budget.)
4. **≥2-tick destructive guard + no-silent-cap.** Destructive advance-ticks render `N` until
   corroborated; any cap/sampling is logged (no silent truncation reads as "covered everything").

So the honest statement: **a self-driving, *PAT-armed*, *guard-stopped*, *shape-F-bounded* recursive
DST loop on free GitHub CI.** The **default `GITHUB_TOKEN` is GitHub-guarded off** (won't chain) — you
**arm** the loop with a **PAT**; once armed it recurses readily, so each advance-tick commit you don't
want to chain carries a **stop** (`[skip ci]`/`[no ci]`/… or the actor-guard / run-marker /
concurrency group), and runaway is caught (shape-F + budget). "For free + recursive" is true *within*
those bounds — arm with the token, stop with the flag, catch with the shape. Both halves, not one.

## Stuck agents show up HOT on the test reports (free fleet-observability)

> Aaron (2026-06-09): "if an agent gets stuck in our state space they will show up hot on the test
> reports."

A direct payoff of test=tick + saved-uncertainty: **a stuck agent is visible as a hotspot.** Because
each tick saves the **uncertainty about the actor's boundary**, an agent that is **stuck** — looping,
not converging, not reducing its boundary-uncertainty, re-running the same region of state space —
**shows up HOT** in the test-report corpus (high churn / repeated ticks / un-shrinking uncertainty at
that point). The reports are a **thermal map of fleet progress**; stuck = a hot region.

- **It externalizes the stuck-detector.** This is the `holding-without-named-dependency = standing-by
  failure` rule + the commit-heartbeat idle-counter, **at fleet scale and free**: you don't trust an
  agent's self-narration of "I'm stuck"; the **test reports show it hot**, objectively. (Truth about
  stuck-ness is inter-subjective — it shows in the shared reports — not observer-dependent self-report.)
- **Hot vs cold are both bad fixed points the reports surface.** *Hot* = high activity, no progress
  (a non-converging loop / stuck — not reaching a good fixed point A/D/F). *Cold* = D⁰ heat-death
  (collapse, no activity). The thermal map catches both ends.
- **Met with care, not punishment.** A hot agent is a **signal to help** — it may be in a degenerate
  **shadow pattern** (the care framing: the pattern, not the person) or a non-converging region;
  route it to help (the co-op meeting spaces), not condemnation. Distinguish **stuck** (help) from
  **runaway** (catch, shape-F) from **degenerate-shadow** (care).

- **The test framework can have alerts built in (Aaron, 2026-06-09) — the *active* complement.** Hot
  reports are *passive* (you look); alerts are *active* (it pushes). The framework can **fire an alert**
  on conditions it already measures: agent stuck/hot (uncertainty not shrinking over N ticks), a tick
  failure, a **runaway (shape-F)** detected, a **destructive action pending** (the ≥2-tick corroboration
  gate), a treaty/byte-lock divergence, budget/fair-use nearing cap. Alerts are the **escalate exit**
  (action-grammar Meta-15) wired to a **durable async channel** (the operator/peer channel; a
  PushNotification) — exactly what headless loops need (escalate must be wired, not narrated). So:
  stuck *shows* hot **and** *alerts* — care-first (an alert is "come help / look," not "you failed").

So the self-driving loop pays for its own **observability**: stuck agents light up hot **and raise
alerts**, for free, in the same test reports that advance the world — a fleet-wide, externalized,
care-first, *actively-alerting* stuck-detector.

## Why this is the payoff of the whole arc

- **0-friction self-improvement:** the system tests = produces = advances itself; running a test *is*
  shipping the next proven state. Polite-virus at the dev-loop level.
- **DST for free + at scale:** GitHub's runners are the DoP=N ferry pool draining the tick queue
  (scale-free, same code path as DoP=1 green-thread).
- **Provenance + safety intact:** truth-root assertions, AgencySignature on each commit, token-gated
  recursion, shape-F catch, ≥2-tick destructive guard — the loop is *accountable*, not a black box.

## Honest scope / handoff

Synthesis on existing pieces (observe-as-reservoir, test=prod=tick, time-as-generator, the GitHub
workflow harness). To realize: advance-ticks that commit (truth-root-asserted) + the **token-gated**
self-trigger + concurrency/budget caps + the shape-F runaway-catch wired in. Routes to Dejan (CI:
token, concurrency groups, budget, fair-use), the F# core + observe.ts (advance-tick + reservoir),
Soraya/Sova (per-tick convergence / the runaway-catch as a provable property).

## Anchors / ties

Reservoir computing (Maass LSM / Jaeger ESN; our workflow-as-reservoir + observe-as-reservoir-walls
docs); GitHub Actions `GITHUB_TOKEN` **anti-recursion** rule (the deliberate-token throttle) +
concurrency groups + fair-use; shape **F** generative expansion + the fixed-point registry
(runaway = fork-bomb to catch); test=prod=tick + truth-root≠transport-root + time-as-generator
(the Amara ferries); the early "infinite GitHub workflows / close the AI loop side" thread; DST §7;
≥2-tick destructive guard; AgencySignature provenance.
