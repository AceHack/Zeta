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
