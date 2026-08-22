# The decorrelation meter left its band — and the coordinator is a candidate cause

**Status:** measurement + hypothesis. The measurement is checked; the cause is **not**.
**Found:** 2026-08-22, on `main`, by an agent reporting a failure that was not its own.

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
worth — *n agents finding what one would have found*. The corpus is `db/mutation-findings/`, three
files, three named personas: `soraya.jsonl`, `otto.jsonl`, `alexa.jsonl`.

So the declared band `[0.3, 0.6]` is a **standing claim about how much plurality the society is
actually buying**, and it has been left on the high side.

## Why this is not a broken test

Three properties make it a live instrument rather than a stale fixture:

1. **It is heartbeat-fed.** `git log -- db/mutation-findings/` shows batch merges at 10:41, 10:42,
   10:54, 11:08, 11:08, 11:23 — roughly every ten minutes. The corpus grows continuously.
2. **The band is two-sided and the comment says why:** *"Same order of magnitude and same sign — but
   NOT equal, because it assumes identical agents and these three have unequal draw rates. Reporting
   the gap is the honest form."* It was written to be informative, not to pass.
3. **`rhoFromUnionCoverage` uses no pairwise information at all** — it inverts the shipped union
   formula against observed coverage, so it is an *independent corroboration* of the two pairwise
   estimators beside it, not a restatement.

**Do not widen the bound.** Adjusting a meter to match its reading is the exact move this repo exists
to refuse, and it would delete the only instrument that watches the thing `docs/VISION.md` is about.

## Why it is invisible

`test (TS hermetic)` is **not in the required set**, so `gate (required)` stays green and `main`
reads healthy. The failure was reproduced on a pristine `origin/main` worktree by an agent whose own
change had nothing to do with it, and it was **unowned** — nobody had noticed. That is the same
structural gap that let the live-kind lane stay red for hours: *a check outside the required set can
be red indefinitely without anyone being told.*

## The hypothesis — stated as one, because it is one

Overnight 2026-08-21 → 08-22 the coordinator ran roughly **twelve background agents**, nearly all as
the `shadow` persona, with **heavily templated prompts**. Every one carried substantially the same
paragraphs:

- mutate your own change, `cmp`-verify the mutant applied *before* reading its result
- read exit codes, never grep (both toolchains colorize)
- work in your own clone, never bare `/tmp`
- `LIFTS WHEN:` on every deferral, keyed stably
- both directions or it is half a check

Those instructions are *good*, and they measurably worked — several agents caught defects
specifically because of them. **And homogeneous instructions are a homogenizing pressure.** If the
same finder-discipline is issued to every finder, the findings can be expected to overlap more. That
is the `ρ → 1` cliff described in
[`anti-babel-preserve-reconcilability.md`](../../.claude/rules/anti-babel-preserve-reconcilability.md)
— *"the obvious guard — freeze the vocabulary — is the `ρ → 1` collapse wearing a tidy uniform"* —
arriving from an unexpected direction: not a frozen vocabulary, a frozen **method**.

**What is NOT established**, and must not be reported as if it were:

- that tonight's agents moved this number *at all*. The corpus is persona-keyed
  (`otto` / `soraya` / `alexa`), and no per-commit series of ρ was computed. **A time series is the
  falsifier and it has not been run.**
- the direction of any effect. More `otto` findings could raise ρ (more of the same) or lower it
  (broader coverage under one name). Nobody has looked.
- that 0.6012 vs 0.6 is even a *departure* rather than a boundary that was always marginal. **The
  value at the last green commit is unknown.**

Per [`numerology-vs-number-theory.md`](../../.claude/rules/numerology-vs-number-theory.md): the
coincidence of *"I ran twelve near-identical agents and the correlation meter went high"* is a
**generator**, not a conclusion. It licenses the investigation below and nothing more.

## The falsifier that would settle it

Compute ρ per commit across `db/mutation-findings/`'s history and plot it against the overnight
window. Three outcomes, all informative:

| shape | reading |
|---|---|
| ρ was already ~0.6 and drifting slowly | a threshold finally crossed; the coordinator is not implicated |
| ρ stepped up during the overnight run | the templated-prompt hypothesis survives its first real test |
| ρ moved for an unrelated reason | the corpus changed shape; find what |

Until that runs, the honest statement is the first sentence of this document: **the meter left its
band, and why is unknown.**

## Why this matters more than one red test

`docs/VISION.md`'s two-sided ρ band is the thesis: decorrelation is the product, and a society of
clones prices near one agent's worth. `SocietyUsefulWork`'s aggregation theorem says exactly that —
*"clones produce highly-correlated ΔU and the union is idempotent, so N copies price near one
agent's worth."* This test is that theorem pointed at **us**, continuously, and it is the only
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
