# The smallest surface that would have caught the collapse is the commit subject line

**Daya / agent-experience.** **Date:** 2026-08-21 · Answering Aaron's *"i'm really hoping to get this
all observable."* **Society/agent-loop lane only** — the cluster/OTel chain is a separate audit, no
overlap.

## 1. The answer, before the design

> **The commit subject line. One string interpolation. No new file, no new lane, no dashboard.**

The society tick already lands a commit on `main` every 30 minutes. Its subject is
`society: evolution tick <timestamp>` — **a clock, not a measurement.** It carries zero bits about the
thing it announces. And the body is *worse* than empty: it advertises *"score → select → crossover →
mutate → replace"* when **only two of those five executed, for 202 consecutive ticks.** That is the
vacuity class **in the announcement itself.**

Measured traffic: **378 commits on `main` in 24h, 34 of them society ticks.** `git log --oneline` is
**the single highest-traffic human surface in this repo.** Appending nine words:

```
society: evolution tick 2026-08-20T23:41:40Z  pop=1 div=0.000 gen=1 [POPULATION-COLLAPSE]
```

would have changed visibly on **2026-08-16T13:43Z — the first tick after the collapse** — and then
stayed wrong in front of a human **202 more times.**

### The harder half, said out loud: a dashboard would have been WORSE than nothing

Not neutral — **worse.** A surface nobody opens *looks* like observability, so it **retires the
question without answering it.** And the repo already contains that exact failure: `data/monitor.html`
exists, `data/tick-latest.json` is regenerated **51 times a day**, and throughout the entire 106-hour
collapse it read **`"agents_active": 3`** — **reassuring, and wrong.** Adding a second dashboard would
have added a second wrong number.

> **The design rule that follows: render into surfaces that already have a reader. Do not manufacture
> readers.**

## 2. Inventory

**Read by humans:** `git log` (378 commits/24h) — **carries zero society state.** The
`heartbeat-liveness` auto-issue — watches the `agent-heartbeat` lane only, and **is a *liveness*
watchdog: it answers "did the run happen", never "did the run mean anything."** *A society of 1
succeeds every time.* And the **GH Actions step summary** — which appears **exactly once** in each of
two workflows, **both inside the degraded-credential branch**. Every healthy run produces a blank
summary.

> That last one is **the cheapest unclaimed surface in the repo**: a free, per-run, human-readable
> panel that exists, is wired, and is currently used only to report that a PAT was denied.

**Written every tick, read by nothing:** `heatReadout` (**the source says so at
`society-heat-readout.ts:97-99`** — *"nothing parses `heatReadout` back out"*; 3 distinct values across
400 events) · `priorHints` (receiver formats a log string and absorbs a constant severity) ·
`db/uncertainty/` (**`competence-attribution.ts:127` explicitly excludes it**) · `dora-metrics.ts`
(**zero occurrences in `.github/workflows/`**) · `geneticDiversity` / `meanFitness` / population
(**no audit, gate or workflow references any of the three**).

### 2c. The unexpected finding: two population counts that disagree, and neither checks the other

`data/tick-latest.json` — regenerated 51×/day and the only thing `monitor.html` fetches — reads
**`"agents_active": 3`**. That is `new Set(recent.map(e => e.by)).size` over the **observe-envelope**
half of `docs/observe-events/`. The society loop's population is computed over the **`society-*`**
half of *the same directory*. **3,510 files; 400 society events; 3,089 envelopes. Disjoint halves, two
population numbers — `3` and `1` — and nothing anywhere compares them.**

> **So the one number a human could have glanced at during the collapse was the reassuring one.**

This is **not a bug in either producer.** It is two honest counts of two different things wearing the
same word. **It is worth a name in the glossary before it is worth a fix.**

## 3. The design — four tiers, cheapest first; only tier 0's renderer is built

**Tier 0 — the commit subject.** `renderReadoutLine(...)` interpolated into the tick's commit message.
One line of YAML. **This is the whole intervention; the rest is optional.** *Not applied here — that
file was in flight in #13022.*

**Tier 1 — the step summary.** Three lines appending `--markdown` output to `$GITHUB_STEP_SUMMARY` on
**every** run, not only the degraded branch. **Free hosting, already wired, currently wasted.**

**Tier 2 — a committed readout.** Regenerated per tick. **The load-bearing detail: the flatline
counter counts UP**, so during a collapse the file's diff is **strictly non-empty and monotonically
louder** (`flat=1t` … `flat=203t/106.9h`). **A committed readout that goes quiet when the system is
stuck is silence that looks like calm — the failure being fixed, reintroduced one layer up.**

**Tier 3 — a slower digest lane.** Aaron's *"more than one schedule per agent"* fits here. **Genuinely
optional, and the first thing to cut.**

**Explicitly not designed:** SVG badges, a dashboard page, any external service. §1 is the reason.

## 4. What was built

`society-readout.ts` + its test. Against the live event log:

```
pop=1 div=0.000 fit=0.651 gen=1 flat=203t/106.9h [POPULATION-COLLAPSE DIVERSITY-ZERO GENERATION-PINNED FLATLINE]

population  ________________________________
diversity   ________________________________
```

**Measured facts it reproduces**, folded from all 400 events: population went **4 → 3 at
2026-08-16T12:48:24Z, → 2 at 13:15:53Z, → 1 at 13:43:38Z**; `generation` takes the single distinct
value `[1]` across all 400; `meanFitness` takes 3 distinct values across those ticks.

**Two design choices that are the difference between a readout and a decoration:** `nowMs` is an
**injected** parameter, never `Date.now()` — staleness is a local-clock judgement, and an ambient
clock would make the renderer non-replayable, *the same defect one layer down*. And **a constant
series renders as all-`_`**, never normalised to mid-ramp, **so flat looks flat.**

**Tests: 19 pass / 0 fail / 38 expects.** With the three sibling society suites: **58 pass / 0 fail.**

**Mutation deltas — all four bite:**

| mutation | result |
|---|---|
| population guard neutered to `if (false)` | **3 fail** |
| `flatlineTicks++` → `+= 0` (counter frozen) | **4 fail** |
| constant series renders mid-ramp | **1 fail** |
| alarm token renamed | **3 fail** |

**Mutation 1 is the one that matters** — it kills the real-corpus test *and* the discrimination test,
which is the property the whole exercise is about. **Mutation 3 confirms the sparkline cannot silently
flatter a dead series.**

**One real defect found and fixed in the agent's own work:** the two corpus tests re-read 3,510
directory entries each and **timed out at 5 s under parallel load** (43 s wall, 2 failures). Memoised
— 914 ms, green. **Worth stating because it is the same class as everything above: a check that times
out under load is a check that did not run.**

## 5. Register

**Metered:** every count above, reproduced in-worktree; the no-reader claims, by `git grep` **and by
the sources' own admissions**; the readout's ability to discriminate healthy from collapsed, by four
mutations. **Unmetered:** *"the commit subject is the smallest sufficient surface"* is a **design
judgement, not a measurement** — its falsifier is cheap and unrun: put the line in and see whether
anyone notices the next collapse. **Not claimed:** whether the thresholds are right. `minPopulation: 2`
is the only non-arbitrary one — **below it `evolve()` is provably the identity function.**

## 6. Handoffs

- **The one-line change to the tick's commit message** belongs to whoever lands it. The module exports
  `alarms` as a **machine-readable array** so the concurrent population falsifier can consume **the
  same fold** rather than growing a second one.
- **The `agents_active: 3` vs population `1` disagreement** needs **a name, not a patch.**
- **`society-heat-readout.ts:97-99` has been telling us it has no consumers since it was written.**
  The honest options are **a reader or a deletion**; a third tick of it is neither.

### Verification note (Otto, landing this)

Re-run independently at `origin/main`. **The readout reproduces on live data** — and note it now reads
**`flat=203t/106.9h`**, up from the agent's `200t/105.0h`: **the flatline counter is counting up in
real time**, which is the design property working rather than a claim about it. **19 pass / 0 fail /
38 expects** confirmed. **The disagreement is live**: `data/tick-latest.json` still reports
`agents_active = 3` while the society fold reports `pop=1`.
