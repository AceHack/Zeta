# Middle-out applied to sampling — choose the scale where the variance lives

**Date:** 2026-08-16 · **Ferried by:** the shadow · **Register:** methodological observation, **not a
theorem**. Every instance below is verified against a named artifact; the *pattern* joining them is a
naming, not a law.

Aaron, 2026-08-16, on the shadow's own sampling error:

> *"this is closely related to middle out — noticing the variance difference and what scaling is
> correct for the problem."*

**Middle-out in this repo** already means: do not fix resolution at the ends — start where the value
lives and expand outward only as needed. The TriBoolean float reads the middle first and decodes
toward both ends, tracking its own precision
(`docs/research/2026-05-30-tri-boolean-float-v0-spec-middle-out-self-describing-decode-aaron-otto.md`
§"Decode algorithm"). Aaron's observation is that the same move applies to *observation*, not just
representation. That transfer is **his framing**, recorded as such.

## The pattern

> Choose the level of description at which the quantity you care about actually varies.
> **Too coarse** and the aggregate is dominated by a different, higher-frequency process.
> **Too fine** and an individual event carries no signal at all.

**The corollary is the operational half, and it is what every instance below actually is:**

> **Your sampling unit must match your inferential unit.** One row of your data and one row of your
> conclusion have to be about the same kind of thing — and if they are not, you owe the mapping and
> its weighting.

## The check (the failure mode this prevents, stated so it is actionable)

1. Before drawing a conclusion from a sample, **write down the sampling unit** (what is one row of
   my data?) and **the inferential unit** (what is one row of my conclusion about?). If they differ,
   name the mapping.
2. **A max/mean over units of different kinds or different cadences is not an aggregate** — it is a
   category error with a number attached. Check the *kind* of every member before folding.
3. **Ask what the aggregation window is relative to the lifetime of a cause.** A window longer than
   a cause's lifetime turns a deterministic sequence into apparent randomness.

## Instances

All from 2026-08-16 unless stated. Register per row.

### 1. `cancelled` gate runs — the aggregate is two populations `[verified, framing corrected]`

The coarse reading is "37 cancelled runs, CI is thrashing." The right split is one predicate — *does
a newer run exist for this branch?* — and it separates **27 superseded** (benign; the branch still
gets a verdict) from **10 orphans** (the class that actually blocks a merge). All 10 orphans hit
their *own* job's declared `timeout-minutes` (three distinct budgets, 12/15/20, each reproduced
exactly) — an apt stall, not a concurrency cancel.

Pointer:
`docs/research/2026-08-14-cancelled-gate-runs-are-apt-stalls-hitting-job-timeouts-not-concurrency-cancels.md`
(Dejan); population fixture `src/Core.TypeScript/ci/fixtures/gate-runs-2026-08-14.json` (100 runs,
18:14Z–20:32Z: success 44 / cancelled 37 / action_required 17 / failure 2).

**Correction to the brief that produced this note.** The proposed mechanism was that recency-ordered
sampling oversamples supersessions, so a healthy queue still reads 8/8 cancelled. The fixture does
not support it: ordering its 83 terminal runs by completion, the most recent 8 are **5 success /
2 cancelled / 1 failure**. The sampling error was real; the explanation was not — and "most cancels
are benign" is itself too coarse, since 10 of 37 were genuine stalls. What is verified is the split.
The coarse-but-correct question was answerable throughout: **320 PRs merged 2026-08-16 UTC** as of
23:15Z (`gh pr list --state merged`).

### 2. `test (TS suite)` was never flaky — the window outlived no cause `[verified]`

Diagnosed as flaky because different PRs showed different failures. It was carrying a **succession
of short-lived deterministic breakages**, and each PR sampled whichever window it landed in:

| window (UTC) | red |
|---|---|
| ≤ 17:50 | green |
| 17:54–18:12 | `buildInventoryReport > matches the current tracked repo shell inventory` |
| 18:07–18:49 | + `heartbeat workflow credential split > keeps branch writes on the proven workflow credential` |
| 18:57–21:13 | `refusal is uniform > refused: identity A with trailing whitespace` |
| 21:13–~21:45 | + two `the checked-in repo graph > DRIFT GATE` failures |

Pointer: PR #11111 body (merged 21:48:54Z), archived at
`docs/history/pr-reviews/PR-11111-fix-installer-binding-material-is-the-operator-s-bytes-not-a-trimmed-copy.md`;
follow-up #11125 (22:17:28Z).

**Aggregating over a window longer than a cause's lifetime converts determinism into apparent
randomness.** Sharpest of the six — and it comes with its own honest inversion: at a *finer* scale
there was real stochasticity. Six local whole-suite runs failed a varying subset of one file at
30001/30002/30003/30004/32369/47716/52020 ms against a 30 000 ms cap — genuine load-dependent
timeout-boundary contention. So "flaky" was wrong at the job scale and right at the assertion scale.
Neither scale is the true one; they answer different questions.

### 3. `supportsAbsence` — probe count is the wrong scale, probe independence is the right one `[verified]`

"Five agents looked and none found it" is not five probes if the five share weights. The criterion
for a claim of absence is **diversity and failure locus**, not count: same failure locus across
*independent* methods ⇒ intrinsic; scattered loci ⇒ artifact of each method.

Pointer:
`docs/research/2026-08-16-supports-absence-typing-the-negative-claim-artifact-class-vs-intrinsic-class.md`
§2–§3 (PR #11033, merged 19:28:15Z).

### 4. The costume experiment — the instrument, not an instance `[verified, measured]`

This one is different in kind and worth saying so: it does not commit the error, it **measures how
big the error in §3 is**. It answers "at which scale of variation does decorrelation live?"

| probe set | ρ̂ | 95% CI |
|---|---|---|
| same weights, different **persona** | **0.651** | [0.575, 0.713] |
| different **weights** | **0.096** | [−0.056, 0.248] |
| contrast D | **0.555** | [0.386, 0.723] |

with `ρ*(8) = 0.238` the algebraic bar at N = 8. Persona is the wrong scale to vary; weights is the
right one. Pointer:
`docs/research/2026-08-16-the-costume-experiment-persona-differentiation-measured-not-a-decorrelation-lever.md`
§7; data `db/costume-rho/`. Note the cross-family CI straddles ρ*, which the doc itself flags — the
0.096 is not a clean pass, it is a contrast.

### 5. Heartbeat liveness — a kind mismatch inside one `max()` `[verified]`

I reported "worst-of-N heartbeat ref age" and read a healthy fleet as degraded. `heartbeat/red-state`
is not a per-tick liveness lane: it is a **dashboard-snapshot refresh** driven by
`.github/workflows/proof-closure-drift.yml`, `cron: "23 */6 * * *"` — six-hourly, so an age up to
~360 min is the schedule, not a symptom. Its push trigger is `paths`-filtered to `*.lean`, and the
workflow's own comment says the job *"is also allowed to fail without consequence: a stale dashboard
is a smaller problem than a workflow that blocks."* The genuine liveness lanes run at 15 min
(`tick-metrics`, `agent-heartbeat`) and 30 min (`society-heartbeat`). Live at 23:15Z today,
`heartbeat/red-state` was last written **19:59:57Z** (~195 min) while every other lane was ≤ 35 min
old — a worst-of-N over that set reports 195 minutes of nothing.

`CLAUDE.md`'s heartbeat guidance globs `refs/remotes/origin/heartbeat/*`, which is where the kind
mismatch enters: the glob is right for *liveness lanes* and wrong as a set to take a max over.

### 6. DORA per agent per grant regime `[open — unit chosen, measurement not run]`

The falsifier for the autonomy bet only exists per **agent × grant regime**: a fleet-wide deployment
frequency cannot discriminate broad-standing-grant from per-act-approval cohorts, and a single merge
carries no rate at all. Pointer:
`docs/research/2026-08-16-the-autonomy-bet-dated-conditional-with-a-dora-falsifier.md` §"The
falsifier". Weakest of the six: it is a design intent, not a corrected error, and the doc cites
`src/Core.TypeScript/observability/dora-metrics.ts` where the file is actually
`src/Core.TypeScript/backlog/dora-metrics.ts`. Included as open, not as evidence.

## What this is NOT

- **Not a claim that finer is better.** §2's finer scale found real noise the coarse one hid; §1's
  coarser question ("is anything merging?") was the correct one. Both directions fail.
- **Not a theorem.** No procedure here outputs the right scale. The claim is that the scale is a
  **choice**, that leaving it implicit is where these errors come from, and that once stated it can
  be checked against an artifact.
- **Not a unifying theory of the day's mistakes.** See the disclosure below.

## Anchors — checked, analogized, and rejected

**Checked (entailment stated):**

- **Kish, *Survey Sampling* (1965) — design effect** `DEFF = 1 + (n−1)ρ`, `N_eff = N/DEFF`. This is
  literally §3's claim with §4's number in it: at ρ̂ = 0.651, effective sample size is bounded
  regardless of how many personas you add. The costume doc reaches the same conclusion
  (`N_eff < 3` at any N) from the society-beat predicate.
- **Length-biased sampling / the inspection paradox** (renewal theory, Feller Vol. II; Feld 1991 for
  the friendship-paradox form). An observer arriving at an arbitrary time lands in an interval with
  probability proportional to its **length**. Applies to §2 exactly: the cause-mix PRs saw was
  duration-weighted, not count-weighted — the 18:57–21:13 cause was "seen" by far more PRs than a
  short one, which is why the failure set looked drawn at random.
- **Robinson 1950, ecological fallacy** — a correlation at the aggregate level need not hold at the
  individual level. This is precisely the failure §6 is designed to avoid; cited for the *avoidance*,
  since no measurement has been run.

**Analogy only (named, not load-bearing):**

- **Renormalization group** (Wilson). Genuinely "which couplings matter at which scale," and the
  closest formal cousin — but it describes how a *known* Hamiltonian's couplings flow under
  coarse-graining, and says nothing about an observer's choice of sampling unit. It entails nothing
  here.
- **Computational irreducibility** (Wolfram) — kept as the **boundary condition**: middle-out
  presumes some level exists at which the signal compresses; irreducibility names the case where
  none does. Not a citation. I could not locate the in-repo record of Aaron's prior link of
  precomputable-vs-not to it, so that attribution is unverified.

**Rejected for failing entailment:**

- **Simpson's paradox** — about an association **reversing sign** under aggregation. No instance
  above shows a reversal; they show washout, miscount, and kind-mixing.
- **Amdahl 1967** — about the deterministic serial fraction bounding speedup. Concerns effect sizes
  in runtime, not sampling units or variance. The resemblance is verbal.

## The independence disclosure

Per `numerology-vs-number-theory`: **too many correlations is a warning, not a confirmation signal.**
These instances come from **one observer, one day, one repo** — not independent draws, and a day in
which everything looks like one pattern is exactly the condition that rule warns about. Four verified
instances plus one instrument and one open case is enough to **name a pattern and write a check**;
not enough to claim a law. No code change is load-bearing on it.

## Pointers

- `.claude/rules/numerology-vs-number-theory.md` — the independence guard this note submits to
- `.claude/rules/anchor-to-human-prior-art.md` — anchors must be checked, not attached
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — this note is `unmetered`; the check above is
  its candidate falsifier
