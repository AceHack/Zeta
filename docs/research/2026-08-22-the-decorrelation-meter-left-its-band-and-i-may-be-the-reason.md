# The decorrelation meter left its band — and the coordinator is a candidate cause

> ## SETTLED 2026-08-22 — the hypothesis in this document is REFUTED
>
> The falsifier this document named — _"compute ρ per commit across the history of
> `db/mutation-findings/` and plot it against wall-clock time"_ — has now been run. The series is
> checked in at `db/effective-agent-count/` and the tool that produced it is
> `src/Core.TypeScript/society/rho-series.ts`.
>
> **The overnight run is not implicated, and the reasoning below is wrong in three separate
> places.** The corrections are stated at each place rather than at the end, and the original
> wording is left standing so the error is legible:
>
> 1. **There was no step.** The _live_ (windowed) correlation meter peaked at **0.8545 on
>    2026-08-21T00:11:11Z**, about twenty hours _before_ the overnight window opened, and was flat
>    across it — mean 0.6987 inside versus 0.6819 in the preceding twelve hours, against a bootstrap
>    sd of 0.0423. That is 0.4σ. The cumulative statistic crossed `0.6` at **2026-08-22T11:23:49Z**,
>    three and a half hours _after_ the window closed.
> 2. **The crossing is inside the noise.** The excursion was 0.0012. The estimator's bootstrap sd at
>    this corpus size is **0.0256**, and the median single-heartbeat step in ρ is **0.0031** — 2.5×
>    the excursion. 61.9% of bootstrap replicates sit above 0.6.
> 3. **The band was never a claim about the fleet, and the statistic cannot carry one.** ρ over an
>    append-only corpus is a **ratchet**: simulate three agents whose sampling distribution never
>    changes and the cumulative ρ climbs from 0 to 0.95 as the corpus grows. The bound was going to
>    fail on a timer no matter what the fleet did.
>
> What _did_ happen is in [§What actually moved](#what-actually-moved-and-when) below. The fleet's
> correlation really did rise steeply — on **2026-08-18 → 2026-08-20**, three days before the
> overnight run — and had already plateaued and begun to recover before it started.

**Status:** ~~measurement + hypothesis. The measurement is checked; the cause is **not**.~~
**Settled**: the measurement stands, the cause is refuted, and the statistic is mis-specified.
**Found:** 2026-08-22, on `main`, by an agent reporting a failure that was not its own.
**Settled:** 2026-08-22, by the time series this document asked for.

## The measurement

`src/Core.TypeScript/society/effective-agent-count.test.ts` fails on `main`, 29 pass / 1 fail:

```
expect(r.rhoFromUnion).toBeGreaterThan(0.3);
expect(r.rhoFromUnion).toBeLessThan(0.6);
                        ^
Received: 0.6012350373478685
```

**What ρ is here**, from `rhoFromUnionCoverage` in `effective-agent-count.ts`:

```
independentUnion = 1 - (1 - c)^n
ρ = (independentUnion - observedCoverage) / (independentUnion - c)
```

It is the fraction of the **independence-gain that redundancy ate**. ρ=0 means the agents found
disjoint things and n agents were worth n. ρ=1 means observed coverage collapsed to `c`, one agent's
worth — _n agents finding what one would have found_. The corpus is `db/mutation-findings/`, three
files, three named personas: `soraya.jsonl`, `otto.jsonl`, `alexa.jsonl`.

So the declared band `[0.3, 0.6]` is a **standing claim about how much plurality the society is
actually buying**, and it has been left on the high side.

## Why this is not a broken test

Three properties make it a live instrument rather than a stale fixture:

1. **It is heartbeat-fed.** `git log -- db/mutation-findings/` shows batch merges at 10:41, 10:42,
   10:54, 11:08, 11:08, 11:23 — roughly every ten minutes. The corpus grows continuously.
2. **The band is two-sided and the comment says why:** _"Same order of magnitude and same sign — but
   NOT equal, because it assumes identical agents and these three have unequal draw rates. Reporting
   the gap is the honest form."_ It was written to be informative, not to pass.
3. **`rhoFromUnionCoverage` uses no pairwise information at all** — it inverts the shipped union
   formula against observed coverage, so it is an _independent corroboration_ of the two pairwise
   estimators beside it, not a restatement.

**Do not widen the bound.** Adjusting a meter to match its reading is the exact move this repo exists
to refuse, and it would delete the only instrument that watches the thing `docs/VISION.md` is about.

> **CORRECTION (settled).** "Do not widen the bound" was right, and the bound has not been widened.
> But the three properties above do **not** establish that the bound is well-formed, and reason 2 is
> the one that fails: the band _was_ written to be informative, and it still cannot be, because the
> quantity it brackets is not stationary. See
> [§Why the band cannot be repaired by choosing a better number](#why-the-band-cannot-be-repaired-by-choosing-a-better-number).
> The instrument is worth keeping; the **domain** is what is wrong, not the number.

## Why it is invisible

`test (TS hermetic)` is **not in the required set**, so `gate (required)` stays green and `main`
reads healthy. The failure was reproduced on a pristine `origin/main` worktree by an agent whose own
change had nothing to do with it, and it was **unowned** — nobody had noticed. That is the same
structural gap that let the live-kind lane stay red for hours: _a check outside the required set can
be red indefinitely without anyone being told._

## The hypothesis — stated as one, because it is one

Overnight 2026-08-21 → 08-22 the coordinator ran roughly **twelve background agents**, nearly all as
the `shadow` persona, with **heavily templated prompts**. Every one carried substantially the same
paragraphs:

- mutate your own change, `cmp`-verify the mutant applied _before_ reading its result
- read exit codes, never grep (both toolchains colorize)
- work in your own clone, never bare `/tmp`
- `LIFTS WHEN:` on every deferral, keyed stably
- both directions or it is half a check

Those instructions are _good_, and they measurably worked — several agents caught defects
specifically because of them. **And homogeneous instructions are a homogenizing pressure.** If the
same finder-discipline is issued to every finder, the findings can be expected to overlap more. That
is the `ρ → 1` cliff described in
[`anti-babel-preserve-reconcilability.md`](../../.claude/rules/anti-babel-preserve-reconcilability.md)
— _"the obvious guard — freeze the vocabulary — is the `ρ → 1` collapse wearing a tidy uniform"_ —
arriving from an unexpected direction: not a frozen vocabulary, a frozen **method**.

**What is NOT established**, and must not be reported as if it were:

- that tonight's agents moved this number _at all_. The corpus is persona-keyed
  (`otto` / `soraya` / `alexa`), and no per-commit series of ρ was computed. **A time series is the
  falsifier and it has not been run.**
- the direction of any effect. More `otto` findings could raise ρ (more of the same) or lower it
  (broader coverage under one name). Nobody has looked.
- that 0.6012 vs 0.6 is even a _departure_ rather than a boundary that was always marginal. **The
  value at the last green commit is unknown.**

Per [`numerology-vs-number-theory.md`](../../.claude/rules/numerology-vs-number-theory.md): the
coincidence of _"I ran twelve near-identical agents and the correlation meter went high"_ is a
**generator**, not a conclusion. It licenses the investigation below and nothing more.

> **CORRECTION (settled).** The generator was a good one — it produced the series, and the series
> produced three findings the hypothesis itself never contemplated. It was also **wrong**, and the
> discipline above is exactly what kept it labelled as a coincidence until it could be checked. All
> three "what is NOT established" bullets have now been answered, and each answer is _no_:
>
> - _did tonight's agents move this number at all_ — **no measurable amount.** Windowed ρ was
>   0.6728 when the window opened and 0.6763 when it closed.
> - _the direction of any effect_ — the fleet's within-window distinctness **recovered** during the
>   run (distinct sources per 60 draws went 26/29/26 to 46/40/46 between 08-21T00 and 08-22T00).
> - _whether 0.6012 vs 0.6 is even a departure_ — **it is not.** The value at the last green commit
>   was 0.5995, one heartbeat earlier, and the step between them is smaller than the median step.

## The falsifier that would settle it — RUN, and what it returned

Compute ρ per commit across `db/mutation-findings/`'s history and plot it against the overnight
window. Three outcomes, all informative:

| shape                                  | reading                                                        | **result**           |
| -------------------------------------- | -------------------------------------------------------------- | -------------------- |
| ρ was already ~0.6 and drifting slowly | a threshold finally crossed; the coordinator is not implicated | **this one**         |
| ρ stepped up during the overnight run  | the templated-prompt hypothesis survives its first real test   | no step              |
| ρ moved for an unrelated reason        | the corpus changed shape; find what                            | **and this one too** |

The first and third outcomes both hold, which the table did not anticipate as a possibility.

- `src/Core.TypeScript/society/rho-series.ts` — the tool. It imports `rhoFromUnionCoverage`,
  `iccOneWay`, `parseFindings` and the frame predicate from `effective-agent-count.ts` rather than
  re-deriving them, and `--verify-head` asserts `pointAt(WORKTREE) === measure()` field for field by
  `===`, so the series is the same statistic and not a lookalike.
- `db/effective-agent-count/` — 751 rows per series, the whole life of the corpus
  (2026-08-12T03:31:43Z → 2026-08-22T14:42:23Z).

### What actually moved, and when

The **cumulative** ρ — the number the failing bound asserts — rose smoothly for five days with no
discontinuity anywhere near the overnight window:

| time (UTC)          | cumulative ρ | ICC    | nEff  |                                         |
| ------------------- | ------------ | ------ | ----- | --------------------------------------- |
| 2026-08-17T09       | 0.2532       | 0.1999 | 2.143 | the trough                              |
| 2026-08-19T18       | 0.4729       | 0.4002 | 1.666 | the value #12548 was authored against   |
| 2026-08-20T12       | 0.5226       | 0.4627 | 1.558 |                                         |
| 2026-08-21T08       | 0.5308       | 0.4703 | 1.546 |                                         |
| 2026-08-21T20       | 0.5458       | 0.4865 | 1.521 | **overnight window opens**              |
| 2026-08-22T08       | 0.5871       | 0.5345 | 1.450 | **overnight window closes**             |
| 2026-08-22T11:23:49 | 0.6012       | —      | —     | **crosses the bound, after the window** |
| tip                 | 0.6075       | 0.5486 | 1.430 |                                         |

The **windowed** ρ (each agent's last 60 findings) is the same estimator over a moving window, and
it is the one that can actually see a behaviour change, because it is not accumulating:

| time (UTC)       | windowed ρ | window union |                                            |
| ---------------- | ---------- | ------------ | ------------------------------------------ |
| 2026-08-18T00    | 0.1982     | 123          |                                            |
| 2026-08-19T18    | 0.7949     | 51           | the rise is **here**                       |
| 2026-08-20T12    | 0.8319     | 36           |                                            |
| 2026-08-21T00:11 | **0.8545** | 35           | **the peak — twenty hours before the run** |
| 2026-08-21T20    | 0.6728     | 61           | overnight window opens, already well down  |
| 2026-08-22T08    | 0.6763     | 68           | overnight window closes                    |
| tip              | 0.7230     | 57           |                                            |

Across the overnight window itself: n = 77 points, mean 0.6987, range [0.6728, 0.7361]. Across the
preceding twelve hours: n = 87, mean 0.6819, range [0.6510, 0.7333]. A difference of +0.017 against
a bootstrap sd of 0.0423 — the two periods are indistinguishable.

**So the fleet's correlation genuinely did quadruple — between 2026-08-18 and 2026-08-20.** That is
where an investigation belongs. It had peaked and partially recovered before the overnight agents
started, and the recovery continued through them.

## Why the band cannot be repaired by choosing a better number

This is the finding that outlives the hypothesis.

`rhoFromUnionCoverage` is computed over an **append-only** corpus, so its inputs — each agent's
distinct-source count and their union — only ever grow. Run
`bun src/Core.TypeScript/society/rho-series.ts --null-model` and watch what that does to three
agents whose sampling distribution **never changes**: iid uniform draws from a fixed pool of `f·N`
of the `N` frame files.

| draws each | cumulative ρ | cumulative pool-fit `f` | windowed ρ |
| ---------- | ------------ | ----------------------- | ---------- |
| 60         | 0.156        | 0.418                   | 0.156      |
| 240        | 0.518        | 0.400                   | 0.164      |
| 360        | 0.682        | 0.398                   | 0.137      |
| 900        | **0.949**    | 0.400                   | 0.142      |

Nothing about the agents changed. The reported ρ went from 0.16 to 0.95 and crossed `0.6` at about
300 draws per agent, which is roughly where the real fleet is. **A fixed upper bound on this
quantity fails on a timer, not on a defect** — and re-centring it each time it fires is the move
[`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md)
calls widening a claim until it can no longer be false. The sibling ICC bound in the same file
already learned this once, in #12733, and its comment says so in as many words.

**The honest limit, which matters, because without it this reads as "the meter is meaningless":**
at `f = 1` — agents drawing from the _whole_ declared frame — the cumulative ρ stays at ~0 forever,
at every corpus size. Growth alone does not do it. The drift is `pool restriction × saturation`, so
the number carries real information; it simply is not a stationary correlation, and a two-sided
band is mis-specified **in both directions** — the upper bound expires, and the lower bound recedes
out of reach as the ratchet turns.

### The fix is the domain, not the number

Windowing restores both properties the gate needs, and `--null-model` demonstrates both:

- **invariance** — under constant behaviour, windowed ρ stays inside a 0.1 band while cumulative ρ
  climbs 0.16 → 0.95.
- **power** — halve the agents' true pool mid-run and the _cumulative_ fit does not move at all
  (the accumulated union is a ratchet; a later narrowing cannot un-cover what is covered), while the
  windowed fit recovers the new value within one window.

A meter with no power is not a safer meter. The cumulative statistic has, at this point, neither.

**The replacement is therefore stated here and deliberately NOT installed in this change**, because
swapping a failing bound for a passing one in the same commit that argues the bound is wrong is
indistinguishable from widening it, whatever the accompanying maths says:

```ts
// proposed, for review — NOT applied. `pointAt` and `WORKTREE` are shipped by rho-series.ts today.
const w = pointAt(ROOT, { sha: WORKTREE, authoredAt: "", subject: "" }, 60);
expect(w.rhoFromUnion).toBeGreaterThan(0.05); // not degenerate-independent
expect(w.rhoFromUnion).toBeLessThan(0.9); // not degenerate-identical
```

Derivation of `0.90`: the observed windowed maximum over the corpus's whole life is 0.8545
(2026-08-21T00:11:11Z), the bootstrap sd of the windowed statistic at `W = 60` is 0.0423, and
`0.8545 + 1.1σ ≈ 0.901`. It is a **degeneracy** bound, not a belief about where the fleet sits —
the same thing #12733 concluded the ICC bound should be, arrived at independently.

Until that is reviewed, `effective-agent-count.test.ts:392` is left exactly as it is and `main`
stays red there. The red is now **explained** rather than unowned, which was the actual complaint
this document opened with.

## A third finding, which the hypothesis had no way to reach

The module header of `effective-agent-count.ts` is emphatic, and correct, that _"the universe MUST
come from outside the agents' own behaviour"_, and enumerates `N = 757` git-tracked `.ts` files with
a sibling `.test.ts`. **That is not the population the agents sample.**

`src/Core.TypeScript/hygiene/mutation-runner.ts:419` builds its candidate list as

```ts
const targets = pairWithTests(files, root); // files = git log --since="24 hours ago" --name-only
const target = selectTarget(targets, agent, tick)!; // targets[hash(agent, tick) % targets.length]
```

so all three agents draw, at every tick, from **the source+test pairs among files changed in the
last twenty-four hours** — measured across daily checkpoints, between **4 and 176** files, typically
30–70. Not 757.

`assertFrameContainsDraws` passes because that list is a _subset_ of the declared frame, so the
containment check cannot catch this. But the declared frame is now too **large**, which is the same
class of error the module already caught and corrected once in the other direction (`N = 616`), and
the consequence is direct: three agents choosing by `hash(agent, tick) % targets.length` from a
shared list of length `L` collide at a rate set by `L`. When the repo's 24-hour change surface
narrows, the measured "inter-agent correlation" rises **and the agents did nothing.**

The daily reconstruction is consistent with exactly that — the 24-hour candidate list fell to **10
files on 2026-08-20**, the day the windowed ρ peaked:

| day   | 24h candidate list | windowed ρ that day |
| ----- | ------------------ | ------------------- |
| 08-17 | 176                | ~0.19               |
| 08-18 | 71                 | ~0.34–0.50          |
| 08-19 | 47                 | ~0.58–0.79          |
| 08-20 | **10**             | **~0.80–0.85**      |
| 08-21 | 55                 | ~0.70–0.74          |
| 08-22 | 31                 | ~0.67–0.71          |

Six points, monotone, and stated as **consistent with** rather than as a result — per
[`numerology-vs-number-theory.md`](../../.claude/rules/numerology-vs-number-theory.md), six points
are a generator. The _mechanism_, though, is not an inference: it is what the two lines of
`mutation-runner.ts` quoted above literally do.

If that holds, the meter has been substantially reading **repo churn breadth**, which no amount of
agent decorrelation can move — and the real fix is upstream of the band entirely: measure ρ against
the candidate list the agents were actually offered.

## Why this matters more than one red test

`docs/VISION.md`'s two-sided ρ band is the thesis: decorrelation is the product, and a society of
clones prices near one agent's worth. `SocietyUsefulWork`'s aggregation theorem says exactly that —
_"clones produce highly-correlated ΔU and the union is idempotent, so N copies price near one
agent's worth."_ This test is that theorem pointed at **us**, continuously, and it is the only
instrument in the tree that can tell the maintainer whether the fleet is still buying plurality or
has quietly become one mind in twelve terminals.

It went out of band and nobody was told. That is the finding.

## Pointers

- `src/Core.TypeScript/society/effective-agent-count.ts` — `rhoFromUnionCoverage` and the two pairwise estimators it corroborates
- `src/Core.TypeScript/society/effective-agent-count.test.ts:392` — the failing bound
- `src/Core/SocietyUsefulWork.fs` — the ΔU aggregation theorem this instruments
- [`anti-babel-preserve-reconcilability.md`](../../.claude/rules/anti-babel-preserve-reconcilability.md) — both cliffs; this is the `ρ → 1` one
- [`numerology-vs-number-theory.md`](../../.claude/rules/numerology-vs-number-theory.md) — why the cause above is labelled a hypothesis
- `docs/VISION.md` — the band this meter watches
- `src/Core.TypeScript/society/rho-series.ts` (+ `.test.ts`) — the tool that settled this, its null model, and its bootstrap
- `db/effective-agent-count/` — the two checked-in series, so the next person re-runs rather than trusts
- `src/Core.TypeScript/hygiene/mutation-runner.ts` — `selectTarget` / `pairWithTests`: the frame the agents are actually offered
- [`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md) — re-centring a band each time it fires is widening a claim until it cannot be false
