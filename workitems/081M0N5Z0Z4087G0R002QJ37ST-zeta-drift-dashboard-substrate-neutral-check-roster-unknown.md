---
id: 081M0N5Z0Z4087G0R002QJ37ST
type: task
state: in-progress
priority: P2
slug: zeta-drift-dashboard-substrate-neutral-check-roster-unknown
title: "Zeta drift dashboard — substrate-neutral check roster, Unknown as first-class verdict, coverage as a red condition"
created: 2026-08-22T16:48:17.892Z
depends_on: []
composes_with: []
---

# Zeta drift dashboard — substrate-neutral check roster, Unknown as first-class verdict, coverage as a red condition

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0N5Z0Z4087G0R002QJ37ST-*.md` glob. -->

## The occasion (measured, 2026-08-22)

`gh run list --branch main --limit 200` — the query the fleet had been reporting
"main is clean" from — contained runs from only **22 of 81 active workflows**.
Heartbeat traffic saturates the window; its oldest run was from 15:25 the same day.
A window sample is not a slow instrument, it is a **structurally blind** one, and its
blindness renders as green.

Latest-run-per-workflow surfaced four workflows failing unseen (one red since 08-16,
weekly, so it sat red for six days). Those four are being fixed elsewhere; this item
is the instrument that would have caught them on day one.

## What shipped

**Producer layer — the existing forge-host plugin contract, extended in place.**
GitHub is *a* forge host, never *the* forge host; the destination is **sovereign mode**
(no centralized forge host, author/verifier agent attestations in place of forge gates).
So the dashboard consumes `src/Core.TypeScript/forge-host/`, and what it needed and did
not find there was added there:

- `CheckObservationSource` (in `forge-host.ts`) — `listCheckDefinitions` (the ROSTER,
  i.e. the denominator) + `listLatestCheckObservations` (latest per check, never a
  window). `ForgeHost extends CheckObservationSource`.
- Host-agnostic vocabulary in `src/Core.TypeScript/forge-host/types.ts`: `CheckId`, `Verdict`,
  `UnknownReason`, `CheckExpectation`, `TriggerClass`, `CheckDefinition`,
  `CheckObservation`, `CheckObservationFailure`, `CheckObservationPass`.
- `src/Core.TypeScript/forge-host/github/check-observations.ts` implements it; `gitlab` returns `not-supported`
  (an empty roster would render "0 of 0 observed" and go green — worse than an error).
- **The future author/verifier producer is an INTERFACE ONLY.** Interfaces are free,
  a class must be earned; a stub emitting invented attestations would be exactly the
  vacuity this surface refuses.

**Core — `src/Core.TypeScript/drift-dashboard/`.** Pure fold over
(roster, observations, failures, `now`). It imports types from the plugin contract and
nothing else — no adapter, no registry, no `gh`. `--offline` runs the whole pipeline
with NO producer present.

**DV2.0 partition:** hub = CheckId + Verdict + Expectation (stable, substrate-independent);
satellite = `sourceDetail` (run id, url, conclusion string — carried for humans, never
folded on).

## Unknown is first-class, and mechanical

Aaron 2026-08-22: *"Unknown is a first-class verdict that can never aggregate into green
yes this would be Ideal, this is what most humans and AI are not good at keeping in
their head the unknowns they forgot about lol, so the more mechanical the better."*

- **Persisted roster** (`db/drift-dashboard/roster.json`, text, diffable). A check that
  stops reporting keeps its slot and keeps counting against coverage. A vanished check
  is marked `declaredNow: false` and does **not** shrink the denominator. Retirement is
  written by hand with a reason; no code path sets it.
- **Five unknown reasons, non-interchangeable:** `never-observed` ·
  `not-observed-this-pass` (today's bug wears this one's clothes) ·
  `registered-but-absent` · `expectation-unknown` · `source-error`.
- **Aged and ranked**: unknowns sort by longest silence first, never-observed sorting as
  infinite silence. "Not observed for 6 days" reads louder than "not observed since the
  last pass". An unknown displayed but not distinguished has not been surfaced.
- **Coverage is in the headline**, and any shortfall is red. Unknowns never count toward
  coverage, so `shortfall == unknown count` holds by construction.

## Expected-absent vs unexpectedly-absent

Derived from the substrate's own declaration, never assumed:

| declaration | silence means |
|---|---|
| `periodic` (a cron) | **RED** — it should have run |
| `on-change` (push to the ref) | unknown, ranked high |
| `on-demand` (PR / dispatch / workflow_run) | **correct** — `not-applicable`, and not called green |
| `unknown` (underivable) | unknown, loud — never defaulted to the convenient case |

Plus two red conditions a last-run-only model cannot see:
- **staleness** — a periodic check whose newest verdict is green but ancient did not run;
- **the declared trigger has NEVER fired** — `chart-version-refresh` declares
  `7 17 * * 0` and every run in its history is `event=pull_request`. The adapter asks
  the declared trigger directly (`?event=schedule`) rather than asking what ran last.

## First real pass

80-check roster: **RED 8 · UNKNOWN 4 · coverage 62/66 · green 56 · 14 on-demand.**
Found the four known reds, plus `tlaps-proof`, `gate`, `k8s-lane-partition`, and
`chart-version-refresh` (never-fired schedule). The 4 unknowns are all
`registered-but-absent`: active on the forge host, no file in the repository.

## Open (named, not implied)

1. **The cadence lane does not commit back.** `drift-dashboard-cadence.yml` fails the
   run and writes the dashboard to the job summary; refreshing the committed artifact
   needs the `heartbeat/*` park-and-flush path. Not built here.
2. **Not wired as a blocking gate.** Making it block is a workflow-enforcement policy
   call, the same class as 081M05E28P5087G0R003JAXC2W — left for Aaron.
3. **`chart-version-refresh`'s dead cron is reported, not fixed.**
4. **The 4 `registered-but-absent` workflows** are reported, not adjudicated.

## The seven-mode taxonomy — every one measured in this repo on 2026-08-22

Each is a distinct way *a check that did not run looks like one that passed*, and none
is detectable by "read the latest run's conclusion."

| # | mode | how it hides | state in this model |
|---|---|---|---|
| 1 | **Sampling** | a 200-run window held 22 of 81 workflows | roster + latest-per-check; a window is never sampled |
| 2 | **Frozen roster** | a cached workflow list cannot grow, so new checks are invisible | the roster is re-derived every pass and merged; the denominator grows |
| 3 | **In-progress masking** | `gate`'s newest run was `in_progress`, so its last concluded `failure` did not show | the last **concluded** verdict is displayed; a running run **annotates** (`recheckInFlight`), never overwrites |
| 4 | **Cancelled-as-clean** | a killed run reads as an absence of failure | `cancelled` ⇒ `unknown`, never satisfies a check, never counts toward coverage; repeated cancellation is its own red (**dark lane**) |
| 5 | **Registered-but-absent** | active on the forge host, no file in the repository — invisible to a run check *and* a file check | `unknown{registered-but-absent}` |
| 6 | **Never-fired trigger** | a declared cron that has never produced a scheduled run | the producer asks the declared trigger directly (`?event=schedule`); red **only once the trigger has had an opportunity** |
| 7 | **Green-but-never-exercised** | `lockfile-healer` / `zetadb-scheduled-node` are green because they **no-op before the forbidden `git push origin HEAD:main`** | **NOT MODELLED — see below** |

### Why mode 7 is named and not modelled

`lockfile-healer.yml` and `zetadb-scheduled-node.yml` both still contain
`git push origin HEAD:main`, which the ruleset now forbids (`gate (required)`,
`bypass_actors: []`, evaluated at push time). Both are green **only because they exit
before reaching the push** — one prints `No new database events to checkpoint.`, the
other has had no lockfile drift since 08-09. They will fail the first time they have
work to land.

I am not adding a verdict case for this, and the refusal is the point. **A model slot
no producer can fill and no test can falsify is the vacuity class wearing a taxonomy
entry** — it would read as coverage and constrain nothing, which is the exact defect
this whole surface exists to refuse. Detecting it needs *path coverage inside a run*
(did the branch that does the real work execute?), which is a different instrument
from a verdict roster.

Recorded as the strongest open, with its two live instances named, so it is a gap
someone can pick up rather than a gap nobody knows about.

### Both directions of error are real, and I made one of each

- **Unknown rendered as green** hides a failure. That is the whole occasion for this work.
- **Unknown rendered as red** burns the alarm's credibility until someone mutes it —
  worse than not having the alarm. `chart-version-refresh` was reported as a never-fired
  weekly cron; it landed on `main` on Friday, its cron is Sunday, and the report was
  written on Saturday. The run history was consistent with both stories and the
  alarming one got reported.

Hence `not-yet-due` as **its own state**, gated on the definition's age rather than on
the dashboard's. The computation is *one full period since the definition landed*, not
*a matching cron instant has occurred* — a sound over-approximation that never raises a
false alarm and at worst delays a true one by under one period. An unknown definition
age **declines to alarm**, deliberately.

### The dark-lane discriminator is SPAN, not count

`tlaps-proof` over its last 40 runs: 33 cancelled, 7 failure, **last success
2026-07-01** — seven weeks of a gated proof lane switched off, rendering as "not
failing" everywhere. That fact was already written down in
`apt-job-timings.measured.json` and sat on no surface anyone looked at, which is this
dashboard's whole reason to exist.

But `gate` is cancelled by its own concurrency group on ~88% of pushes (265 of 300
measured in `platform-drift-report.ts`) and is perfectly alive. A **count** threshold
calls `gate` dark and gets muted within a day; a **span** threshold — inconclusive
attempts newer than the last verdict spanning more than 6h — catches only the lane that
has actually stopped concluding anything.

`runsPerCheck` is 20, not 5, for the same reason: `gate`'s last real verdict sat behind
four inconclusive runs, and `tlaps-proof` behind far more.

## The first user could not use it — measured, and the diagnosis was not what anyone guessed

The first person to reach for this tool instead of their hand-rolled scan got a
**400s timeout on the default** and **540s on `--dop 8`**, and went back to their scan.
That is the identical dynamic that killed `src/Core.TypeScript/search/grep.ts`, which
was correct, existed for exactly the incident it was meant to prevent, and produced no
output in 300s:

> **A guard slower than the unsafe path selects for the unsafe path.**

Being correct does not exempt a tool from being reached for.

### Measured with a counting shim on PATH, not inferred

The reported diagnosis was *"5% CPU over nine minutes means it is network-bound — far
more requests per check than one."* The measurement says otherwise, and the difference
matters because cutting API calls would have bought nothing:

| | before | after |
|---|---|---|
| `gh` subprocesses | 87 | **87** — 1.06 per check, already near-optimal |
| `git` subprocesses | **73** | **1** |
| total subprocesses | **160** | **88** |
| wall, this host | ~48s at DoP=8 | **6.9s at DoP=16** |

The cost was **73 serialised `git log --diff-filter=A --follow` spawns**, one per
workflow, inside `listGitHubCheckDefinitions` — a phase with **no DoP knob at all**.
One such call costs ~0.22s here; the bulk call that replaced all 73 costs ~0.22s for
every path at once. On a loaded host with on-access AV scanning each spawn, 73 serial
subprocesses is exactly where nine minutes goes.

The `?event=schedule` probe was suspected and is vindicated: 29 schedule probes + 57
branch queries = 86 for 80 checks, because the probe **replaces** the branch call for
the 23 periodic checks whose cron fires. It costs ~6 extra calls total, not a multiple.

### What changed

1. **One `git log` for every path** (`definitionSinceForPaths`), replacing 73.
2. **Default DoP 1 → 16.** Measured on the live repo: 19.4s serial-equivalent, 9.3s at
   8, 4.6s at 16, 3.9s at 24 — and **cumulative gh time is flat** across all of them
   (60.6 / 60.7 / 60.8s), so parallelism buys real overlap and provokes no rate-limit
   penalty. 16 is the knee. The async rule wants the knob to **degrade** to 1, not
   **default** to 1; `--dop 1` remains the deterministic single loop, and DoP=1 vs
   DoP=16 was **re-checked** against the live repo (82 rows, byte-identical), not
   carried over from the earlier claim.
3. **`--timing`**, permanent. This tool's thesis is that an unmeasured thing gets
   guessed at, and its first perf report guessed. It should hand you the number.

**Roster caching was suggested and is declined, with a reason:** re-deriving the roster
every pass is where mode-2 (frozen roster) protection comes from, and it now costs
1 API call + 1 subprocess. Caching would trade a real guarantee for ~0.4s.

### And the perf work found a correctness bug

Timing `--offline` on a fresh checkout produced
`OK — RED 0 · UNKNOWN 0 · coverage 0/0 · green 0`. **An empty roster rendered green** —
"0 of 0 observed" is the exact vacuity this surface refuses everywhere else, and the
stated reason `GitLabAdapter` returns `not-supported` rather than an empty roster. A
dashboard that knows of no checks has not passed; it has never enumerated anything.
`ok` now requires `coverage.known > 0`, and the headline says
*"the roster is EMPTY … uninitialised, not clean"*.

Offline against a populated roster is unchanged and correct:
`NOT OK — RED 0 · UNKNOWN 65 · coverage 0/65 (SHORTFALL 65) · green 0`, `rc=1`, in 0.04s.

### Falsifiers for the cost shape

Performance regressions of this class deserve tests, not promises, so
`definitionSinceForPaths` takes an injected runner and five tests hold it to **one
subprocess regardless of check count** (and none for zero paths). `parseFirstAddDates`
is pinned separately, including that a re-added path keeps its **oldest** date —
getting that backwards would make an established check look brand new, and a brand-new
periodic check is `not-yet-due`, so the alarm would silently switch off.

## Two instruments disagreed, and both were right

The dashboard and a hand-rolled scanner reported different colours for the same repo at
the same time. Adjudicated by measurement; **neither was lying, and both mechanisms
were defects in how the disagreement was presented, not in either verdict.**

### `build-ai-cluster-iso` — mode 8, FLAPPING

Its concluded runs on `main` that afternoon: success 21:53, failure 21:18, success
20:37, success 20:03, failure 19:07. A latest-verdict reader sampling at 21:55 says
green; one sampling at 21:20 says red. **Both read the truth**; the lane simply has no
colour, because its next verdict is a coin flip.

So `flapping` is its own verdict, ranked directly under red. Green would launder a 90%
claim as a 100% one; red would make an oscillating lane permanently red until the alarm
is muted.

**The first live pass then forced a second split.** One band lumped `pr-manifest-integrity`
(15 of 20 concluded runs failed) with `agencysignature-enforcement` (2 of 20). Those are
not the same claim: when a MAJORITY of concluded runs fail, the newest passing run is
the **outlier**, and the lane is broken rather than flaky. Majority-failing is now RED
with `MOSTLY FAILING: n of m`, and the red list is actionable again.

That split immediately surfaced something worth its own attention: **`gate` — the
required check — failed 7 of its last 11 concluded runs.**

### The three cadence lanes — superseding evidence

`budget-snapshot-cadence`, `manifesto-citation-snapshot-cadence` and
`context-cost-trend-cadence` were reported RED off their last SCHEDULED run, while a
`workflow_dispatch` after the #13808 fix had come back green. The producer queried
`?event=schedule` and never saw the dispatch, so the dispatch could not appear — and the
`detail` column read like a plain latest-verdict.

**The design intent is kept, because the alternative is a snooze button**: a hand-run
proves the code, not the cadence, and letting a manual dispatch clear a scheduled lane's
red is a button anyone could press. So the scheduled verdict remains the verdict.

**What was wrong was suppressing the contrary evidence.** The producer now fetches both
paths and attaches the newer, different-trigger verdict as `supersededBy`, rendered as:

> **awaiting scheduled confirmation** — a later workflow_dispatch run concluded 'green'
> at …, NEWER than the verdict above. The verdict reports the DECLARED (scheduled)
> path, which is the stronger claim: a hand-run proves the code, not the cadence. This
> row clears when the next scheduled run passes.

Both instruments' answers are now visible in one row, and the row says what would clear
it.

## Spawn count is the cost, and it is now 2

The first user's host, after the 160→88 cut: **142.5s wall, 63.2s cumulative API,
9% CPU.** The missing 79s was not network — it was 88 process creations, each paying an
on-access AV authorisation.

`gh api` calls now go through **`fetch`**, with the token resolved once (env first, else
one `gh auth token`). Same credential, same endpoint, same auth semantics —
`gh auth token` is exactly what `gh api` would have used. The subprocess path remains as
a fallback whenever a token cannot be resolved, so nothing that worked stops working.

| | original | after 160→88 | now |
|---|---|---|---|
| subprocesses | 160 | 88 | **2** |
| API calls | 87 | 87 | 114 (periodic checks fetch both paths) |
| wall, this host | ~48s | 6.9s | **4.2s** |

The transport recognises only the exact `gh api <path>` shape; anything with a flag,
method or body keeps the subprocess. A transport swap that quietly changed the semantics
of another call would be a worse bug than the latency it saved.

## The rate rule shipped time-blind, and produced two false positives on day one

`MOSTLY FAILING` counted the last N concluded runs with **no bound on the span they
cover**. For a high-frequency lane 20 runs is an hour and the rate means what it says;
for a rarely-run one 20 runs can be a quarter, and a single old incident then dominates
the verdict **permanently** — passing runs arrive too slowly to dilute the window before
someone stops trusting the dashboard.

| check | reported | actually |
|---|---|---|
| `vocab-hygiene` | RED, "12 of 20 concluded runs failed" | **every failure from June**; fixed, and passing every run since 2026-06-10 |
| `agent-proposal-gated-commit` | RED, "2 of 3 failed", "red for 5d" | its **entire history** is failure, failure, success inside about an hour on 08-17 — a fix landing |

This is `not-yet-due` on the other axis. That one refuses to call a trigger dead before
it has had an opportunity to fire; this one refuses to call a lane broken off evidence
that has stopped describing it.

### The bound

1. **Time-bounded window.** The rate is over concluded runs inside `rateWindowSeconds`
   (7d), not "the last N whenever they happened".
2. **Insufficient data is not a verdict.** Below `minConcludedForRate` (5) concluded
   runs inside the window there is a small sample, not a rate — reported as no rate
   claim, never as a clean bill of health. The row keeps its own latest verdict.
3. **Recency can clear it.** `recoveryPassStreak` (5) consecutive passes since the last
   failure clears a rate finding: a lane that broke, was fixed, and has passed that many
   times running has earned its way out.
4. **The window is printed in the row**, the way coverage is:
   `MOSTLY FAILING over 7d (15 of 20 concluded runs failed, 2026-08-18T00:36Z .. 2026-08-22T18:3…, 0 consecutive pass(es) since the last failure)`.

The producer now reports **timestamped outcomes** (`concluded: {at, passed}[]`) rather
than bare counts, and the fold owns all the windowing. That is the right split: the
producer says what it saw, the policy decides what counts as recent.

### An error inside the fix

My first `recovered` definition was *"every failure predates the newest pass"* — which
is true of **any** lane whose most recent run passed, and since the rate rules only run
when the newest verdict is green, that definition **nullified the entire rule**. Four of
its own tests went red and caught it. Recovery is now a **streak**, which is what was
actually meant.

### Verified against the live repo

Both false positives cleared, both real findings survive:

| check | before | after |
|---|---|---|
| `vocab-hygiene` | RED | **green** |
| `agent-proposal-gated-commit` | RED | **green** |
| `pr-manifest-integrity` | RED | **RED**, window printed |
| `gate` | RED | **RED** |
| `build-ai-cluster-iso` | flapping | **flapping**, 3 of 17, window printed |
| `tlaps-proof` | RED | **RED** |

Totals moved RED 9→7, FLAPPING 9→6, green 45→50.
