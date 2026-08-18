# Cross-repo resource planner — what is actually scarce, measured before designing

**Date:** 2026-08-18 · **Status:** measurement complete; planner shipped for the one class
measured to bind; three classes documented with their verdicts.
**Code:** `src/Core.TypeScript/resource-planner/{resource-class,cadence-planner}.ts` (+ tests)

> **Framing (Aaron, 2026-08-18):** *"Time sharing between its tick source and repos — some
> sort of resource management. We have Zeta scheduler and ferry throttler for within a tick
> of a tick source, but this is more like being able to plan based on resource usage."*

The brief also carried the guard that turned out to matter most: *"Different resources have
different conservation laws and a planner that conflates them will misallocate"*, and
*"do not build a scheduler if the honest answer is that we do not yet know what resource is
scarce."* This document is what happened when that guard was taken literally and the
measurement was run **before** the design.

---

## 0. The headline

**The obvious build — a runner-minute allocator across repos — would have rationed an
abundant resource and left the actual constraint untouched.**

Runner minutes are free here. The repo is public, so GitHub Actions is unmetered, and
`docs/budget-history/snapshots.jsonl` has recorded `billable_ubuntu_ms: 0` in **all 17
snapshots since 2026-04-21**. There is nothing to allocate.

What *is* binding is not a budget at all, and it does not behave like one:

> **A ref whose push interval is shorter than its own job duration can never finish that
> job — at any capacity.** Adding runners does not help. Adding minutes does not help.
> The work is destroyed by the lane's own next push.

Over a 2h41m window on 2026-08-18, the `gate` workflow — the **only** required check in the
`CI Gate` ruleset — produced **42 cancelled, 18 running, and zero conclusions**. Not one
pass, not one fail. That is the congestion, and it is a race, not a shortage.

---

## 1. Four resource classes, four conservation laws

The taxonomy is the design, because the conservation law decides what a planner is even
allowed to promise. Shipped as a closed DU in `resource-class.ts`.

| class | conservation law | bankable? | allocatable? |
|---|---|---|---|
| **stock** | `remaining = cap − Σ consumed`; refills on a cycle | yes | **yes** |
| **flow** | occupied then released; Little's law `L = λW` | no | no |
| **mutex** | `holders ≤ 1`; holding does not consume it | no | no |
| **window** | **not conserved** — won or lost, never refunded | no | no |

The load-bearing consequence, and the reason the shipped module is a *pacer* rather than an
*allocator*:

> **You can allocate a stock. You can only pace a window.**

`isAllocatable(c) === RESOURCE_REGISTER[c].bankable` is pinned by a test. Offering an
"allocation" of a non-bankable resource is offering a plan the resource cannot honour —
there is no unused window to carry forward and hand to anyone.

---

## 2. The measurements, and what each settles

Every verdict below is carried in the code as an `evidence` string that names a
re-runnable measurement. A `binding` claim with an empty evidence field is refused by
`verdictIsWitnessed` — the vacuity guard, tested.

### stock — NOT BINDING

`docs/budget-history/snapshots.jsonl`, 17 snapshots, 2026-04-21 → 2026-08-09:
`billable_ubuntu_ms`, `billable_macos_ms`, `billable_windows_ms` are **`0` in every row.**
The repo is public; Actions is unmetered for public repos. Corroborating: nothing in the
tree reads a minute balance to gate work, so there is no allocator that could starve.

*Note on a real defect found in passing:* `playwright/github-ui/billing-reader.ts` scrapes
the billing page and **defaults to `{ minutesUsed: 0 }` on any parse miss**, so a scrape
failure is indistinguishable from zero usage. Nothing currently depends on it, which is the
only reason this is not already a live wrong number.

### flow — NOT BINDING

100 runs over a 10-minute window, 2026-08-18, via `gh run list`:

| metric | value |
|---|---|
| queue delay (`startedAt − createdAt`) | p50 **0s**, p90 **0s**, max **0s** |
| concurrent `in_progress` at sample time | **30** |
| throughput | 10 runs/min |

Runners are granted instantly at 30-way concurrency. The fleet is nowhere near a
concurrent-job ceiling. **Capacity is not the problem**, which is precisely why the
capacity-shaped fix (more runners, self-hosted pool) would have bought nothing.

### mutex — HONESTLY UNMEASURED

16 workflows are repo-wide singletons: a constant `concurrency.group` with
`cancel-in-progress: false` — `agent-heartbeat`, `tick-metrics-flush`, `mirror-to-fork`,
`lockfile-healer`, `drift-sweep`, `society-heartbeat`, `pages`, `mux-swarm-tick`,
`budget-snapshot-cadence`, and others. Each guards a **writer**, and the comments say why
(`lockfile-healer.yml`: *"never cancel a heal mid-push"*).

Nobody has measured wait-for-mutex time. **The register says `unmeasured`, not "fine".**
The measurement that would settle it: for each singleton group, the gap between a run being
queued and the prior holder releasing. Until someone runs it, this class is genuinely
unknown — and the planner therefore does not pretend to plan it, beyond providing a
fair-share ordering for when it is needed.

### window — BINDING

60 `gate` runs over 2h41m, 2026-08-18:

| conclusion | n |
|---|---|
| cancelled | **42** |
| running | 18 |
| **success** | **0** |
| **failure** | **0** |

`gate` duration: p50 **18.7 min**, p90 30.4 min. The mechanism is `gate.yml`:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

Per-ref, so a lane preempts **itself**. The criterion is a ratio of two rates on one ref:

| ref | runs | median push interval | median duration | **ratio** | outcome |
|---|---|---|---|---|---|
| `shadow/second-e8-tower-…` | 8 | 7.2 min | 9.1 min | **0.79** | 7 of 8 cancelled |
| `heartbeat/tick-metrics` | 11 | 15.3 min | 15.6 min | **0.98** | 10 of 11 cancelled |
| `heartbeat/society` | 4 | 31.2 min | 20.3 min | 1.54 | survives |

**Ratio < 1 ⟹ the ref can never conclude.** `heartbeat/tick-metrics` at 0.98 is the
instructive one: "almost enough headroom" is not a milder version of the problem, it is the
same problem.

---

## 3. This updates an existing repo belief, and says so

`docs/research/2026-08-14-cancelled-gate-runs-are-apt-stalls-hitting-job-timeouts-not-concurrency-cancels.md`
(Dejan) measured the same workflow four days earlier and concluded — **correctly, on that
data** — that supersede-cancels were *benign*:

> "**27 superseded.** A newer run replaces them. This is `cancel-in-progress` doing its job,
> and it is benign: the branch still gets a verdict."

That reasoning holds exactly while the branch still gets a verdict, i.e. while ratio > 1. On
2026-08-14 the population contained **44 successes**. On 2026-08-18 it contains **zero**.
The supersede-cancels stopped being benign when push cadence rose to meet gate duration.

So this is not a contradiction of that document; it is the **boundary condition it did not
have to state**, now crossed. The class it dismissed as benign is benign *conditionally*,
and the condition is now measurable and monitored.

---

## 4. The design

### What it is

`cadence-planner.ts` is a **planner, not a dispatcher**. It holds no queue, spawns nothing,
performs no IO, and every function is a pure fold. It sits one level above the existing
substrate and does not duplicate it:

| layer | question | shipped |
|---|---|---|
| `ISoftScheduler<'S>` | what happens on this tick? | `src/Core/SoftScheduler.fs` |
| `PriorityFerryThrottler` | which queued item does a ferry carry next? | `ferry-throttler/` |
| **`cadence-planner`** | **at what cadence may this lane push at all?** | this |

### The lane

`LaneId = { repo, ref }`. **`repo` is an opaque string this module never interprets** —
repo topology, identity and pointers are Kenji's parallel design, consumed here as a name so
the two can land independently.

### The DUs

Illegal states are unrepresentable rather than merely undocumented:

```ts
type RunOutcome  = concluded | preempted | abandoned
type LaneHealth  = unknown | viable | marginal | livelocked | incoherent
type Admission   = admit | pace | hold
```

Three choices worth defending:

**`Admission` has no `defer` case.** Deferring implies the resource will still be there
later — true of a `stock`, false of a `window`. The taxonomy forbids the case, so the type
does not have it.

**`unknown` is first in `LaneHealth`** and is the honest default. A lane with fewer than
three samples is not viable-by-default. Same for `incoherent`.

**`preempted` is distinguished from `abandoned`** because they differ in what they cost.
This is the cut `SchedulerShedHeat` already makes — *regenerable work is pressure and is
free; annihilated work is loss and pays*. A preempted run produced no verdict and nothing
carries forward, so it is **loss**. Booking it as backpressure is exactly what makes a
livelock look healthy on a dashboard.

### The livelock criterion — two independent signals must agree

1. **rate signal** — median push interval / median duration < 1
2. **outcome signal** — a streak of ≥3 preemptions with no conclusion in the lane's history

Requiring both is deliberate. Either alone produces false positives, and because they are
computed from different fields they can genuinely disagree — which is reported as
`marginal` rather than resolved by preference. Both single-signal cases have a test.

### Units: dimensionless on purpose

`ratio` is ticks/ticks and carries **no unit**, which is the one choice needing no
cross-language treaty (`MassPpm` and `TemperaturePpm` are the only metering units with an
oracle today; a third would ship a number no other oracle could check).

But a dimensionless ratio is only meaningful if both terms come from **one clock**, so
`RunObservation.tickSource` is carried and the fold **refuses** to mix two sources in a
lane, returning `incoherent` and producing no number at all. That is the Mars Climate
Orbiter guard, typed.

---

## 5. The five design questions, answered

**1. What is the resource?** Uninterrupted completion windows on a ref — measured, binding.
The other three classes are named with their verdicts (`stock` not-binding, `flow`
not-binding, `mutex` unmeasured) so nobody has to re-derive the negative result.

**2. What is the plan over, and what does it commit to?** Over (repo × ref). It commits to a
**minimum push interval**, not an allocation — the only thing a non-bankable resource can
promise. When reality diverges, the fold simply re-derives from the new observation set;
there is no plan state to reconcile, because the plan is a pure function of the evidence.

**3. The DU shape.** Above. `admit`/`pace`/`hold` are disjoint by construction, so
"scheduled and cancelled" is not representable.

**4. Fairness and starvation — stated plainly.** `fairShareOrder` gives **selection
fairness** over `mutex`-class turns (Deficit Round Robin, the discipline already in
`drain-scheduler.ts`, lifted to plan altitude; ties break on canonical code-point order, so
it is deterministic without a seed).

> **It does NOT guarantee progress, and this is the honest limitation.** A livelocked lane
> starves no matter how often it is selected, because its work is destroyed by its own next
> push rather than by competition. **Selecting it more often makes things strictly worse** —
> more runs started, still zero concluded, more work annihilated.

Fair share is the right tool for `mutex` and the wrong tool for `window`, so the planner
applies it only to the former. For a livelocked lane the answer is `pace`; and if the lane
cannot slow down, the honest report is that **the job must get shorter** — a change no
scheduler can make on the lane's behalf. There is a test (`selection fairness does NOT
rescue a livelocked lane`) whose whole job is to tell a future maintainer this.

**5. DST.** Same evidence set ⇒ same plan, and it is checked three ways: every rotation of
the observation list yields a byte-identical plan, reversal does too, and re-folding is
idempotent. The planner reads no clock — enforced **mechanically**, by a test that reads the
shipped source and fails if `Date.now`, `new Date`, `Math.random` or `performance.now`
appears outside a comment. Wall-clock time is not merely unused; it is not representable in
the input type, so `local-time-never-enters-the-shared-fold` holds at the type level.

---

## 6. Falsifiers

40 tests, all able to fail. Three independent mutations were run against the shipped source
to confirm they are falsifiers rather than decoration:

| mutation | result |
|---|---|
| invert the livelock ratio comparison (`<=` → `>=`) | **5 tests fail** |
| drop the phase-ordering insert (fold becomes arrival-ordered) | **suite fails** |
| drop the mixed-tick-source guard | **2 tests fail** |

Restoring the source returns all 40 to green.

The load-bearing four: **REAL-DATA** (the measured livelock reproduces from the numbers
actually observed), **COMMUTATIVITY**, **UNIT-COHERENCE**, and **NO-CLOCK**.

Register status per `.claude/rules/toy-is-free-metered-must-be-earned.md`: the *criterion*
(ratio < 1 ⟹ cannot conclude) is **metered** — it is structural, and the 2026-08-18
population is its witness. The *thresholds* `marginalRatio = 1.25` and
`preemptionStreak = 3` are **judgement calls attributed in the code** via a
`ThresholdSource` DU mirroring `SimVerb.BudgetSource`, so no bound is a hidden oracle.

---

## 7. What this does not do, and what comes next

- **It does not act.** It emits a plan; nothing consumes it yet. Wiring it to an observation
  source and to the heartbeat lanes is the next step and is deliberately not in this change.
- **It does not measure the `mutex` class.** That measurement is named in the register and
  is the highest-value follow-up, because it is the only class whose verdict is unknown.
- **It does not fix the live livelock.** The measurement says the hot lanes need either a
  longer push interval or a shorter gate. `gate` p50 is 18.7 min against heartbeat pushes
  every ~15 — that gap is a real, currently-red operational problem this design *diagnoses*
  but does not repair.
- **The `window` class may not generalise beyond preemptible CI.** It was derived from one
  mechanism (`cancel-in-progress` on a shared ref). It plausibly covers any
  preempt-on-newer-version scheme, but that is a conjecture, not a measurement.

---

## Anchors (Beacon)

- **Deficit Round Robin** — Shreedhar & Varghese, *Efficient Fair Queueing using Deficit
  Round Robin* (SIGCOMM 1995). The fair-share discipline reused at plan altitude; already
  in-repo at `ferry-throttler/drain-scheduler.ts`.
- **Little's law** — J. D. C. Little, *A Proof for the Queuing Formula L = λW* (Operations
  Research, 1961). The `flow` class's conservation law.
- **Livelock vs starvation** — Coffman, Elphick & Shoshani, *System Deadlocks* (ACM Computing
  Surveys, 1971). The distinction this document turns on: the hot lanes are **not** starved
  of a resource, they are destroying their own progress.
- **Noninterference** — Goguen & Meseguer (1982). Why the tick bound and every threshold
  arrive through a declared, attributed channel rather than a literal.
- **Deterministic simulation** — Zhou et al., *FoundationDB* (SIGMOD 2021); Will Wilson,
  Strange Loop 2014. The DoP=1-replays standard the fold is written to meet.
- **Unit-mismatch failure** — Mars Climate Orbiter MIB (NASA, 1999), lbf·s vs N·s. The
  reason `tickSource` is carried and mixing is refused rather than averaged.

## Pointers

- `src/Core.TypeScript/resource-planner/` — the code and its falsifiers
- `docs/research/2026-08-14-cancelled-gate-runs-are-apt-stalls-hitting-job-timeouts-not-concurrency-cancels.md`
  — the prior measurement this bounds
- `docs/research/2026-08-01-multi-repo-split-design-four-existing-axes-*.md` — argues the
  10GB cache ceiling is the wrong forcing function; this document is the same shape of
  result for runner minutes
- `.claude/rules/toy-is-free-metered-must-be-earned.md` · `.claude/rules/local-time-never-enters-the-shared-fold.md`
  · `.claude/rules/async-all-the-way-truthful-signatures.md` · `.claude/rules/interfaces-free-classes-earned-under-rules.md`
