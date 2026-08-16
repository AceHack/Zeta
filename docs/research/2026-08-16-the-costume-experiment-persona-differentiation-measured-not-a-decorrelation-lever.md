# The costume experiment — persona differentiation measured, and it is not a decorrelation lever

**Date:** 2026-08-16
**Agent:** shadow (Claude Code, claude-opus-5)
**Authorized by:** Aaron 2026-08-16 — *"route … the costume experiment (shadow\*)"*
**Executes:** PR #10928 §3c lever (2), named there as *"the single highest-value measurement in the plan"*
**Register:** every number below is `metered` (produced by running something) or explicitly labelled
`[read]` / `[structural]` / `[projected]`. Nothing here is a projection wearing a measurement's name.

---

## 0. The one-paragraph answer

Persona differentiation is a **costume**. On a shared, mechanically-ground-truthed item set, two agents
running **the same weights under different personas** have error correlation **ρ̂ = 0.65** while two
agents running **different model families** have **ρ̂ = 0.10** — a contrast of **D = 0.555, 95% CI
[0.386, 0.723]**, which clears the pre-registered COSTUMES threshold (CI_low > 0.15) by more than a
factor of two and is robust across every panel specification tried. Since the majority-vote boundary is
**ρ\* = 0.238 at N = 8** (`rhoStarAlgebraic`), a same-model persona society sits **far above** the bar
and a distinct-model-family society sits **below** it. **Buying decorrelation requires distinct weights,
and distinct weights require RAM the free tier does not have.** The measurement cost **zero model
spend** — it ran entirely on local ollama.

And a second finding, structural and arguably sharper: **the production free-tier society injects no
persona at all.** `ZETA_AGENT_ID` sets event authorship, never the chooser. So the question "are the
production personas costumes?" has a prior answer — there is nothing in the costume.

---

## 1. What was measured, and what was found instead — the production path injects no persona

The brief pointed at `grok.ts` / `ani.ts` / `riven.ts`; Aaron's correction pointed at the generic
production router. Following the correction, `[read]`:

- `.github/workflows/agent-heartbeat.yml:38` — `matrix.agent: [alexa, otto, soraya]`
- `:85` — `ZETA_AGENT_ID: ${{ matrix.agent }}`
- `:90` — `bun src/Core.TypeScript/observe/run-loop-real.ts --by "$ZETA_AGENT_ID" --participant local-llm`

Following `--participant local-llm` into `run-loop-real.ts`:

```
function resolveParticipant(spec: string): Participant {        // run-loop-real.ts:96
  if (spec === "local-llm") return localLlmParticipant();       // :98  — no agent id passed
  ...
  if (spec.startsWith("cloud:")) return cloudPersonaParticipant(new PersonaSummoner(), persona);
}
```

`resolveParticipant` takes **only the spec string**. `args.by` is used for event filtering (`:201`,
`:253`), sink authorship (`:265`), executor id (`:280`), and the RS buffer path (`:328`) — and is
**never passed to the participant**. `loadWorld({ eventDir, repoRoot })` (`:116`) does not take it
either. `localLlmParticipant` (`participant.ts:57-80`) accepts `{model, host, seed, name}` — **there is
no persona parameter on that path**, and the prompt it builds is
`describeWorldCompact(world) + menu + CHOOSER_INSTRUCTION`, identical for every agent.

**So in production: same weights (`qwen2.5:0.5b`), temperature 0, fixed seed 42, identical prompt.**
`[structural]` ρ = 1 by construction, not by estimation.

**Demonstrated** `metered`: the real production command, three agents, same repo state:

```
ZETA_AGENT_ID=<agent> bun src/Core.TypeScript/observe/run-loop-real.ts --by <agent> \
  --event-dir docs/observe-events --participant local-llm --dry-run
```

alexa, otto, soraya — **identical pick** (`[explore] self-directed making …`) all three times.

> The persona-isolation mechanism Aaron described is real and is in the tree — it is
> `PersonaSummoner.buildPreamble` + `loadContext` (`summon.ts:508-547`), reached via
> `--participant cloud:<persona>`. **The heartbeat does not use it.** Alexa, Otto and Soraya on the
> free tier are not three personas; they are three names on one deterministic function call.

This is not a bug report against a workflow another agent is editing — `agent-heartbeat.yml` was read
and not touched. It is the reason the rest of the experiment had to be posed as a **counterfactual**.

---

## 2. The counterfactual actually measured

> *If the production chooser injected the repo's own persona blocks, would they decorrelate?*

**Task** (PR #10928 §2b): mutant-kill prediction. Given a one-line mutation, the surrounding source,
and the body of the suite that will run — will `bun test <suite>` kill it? Ground truth from **running
the suite**: mechanical, binary, agent-independent, unlimited supply.

**Ground truth is not reimplemented.** `build-items.ts` imports `runMutant` from the production
`hygiene/mutation-runner.ts`, so items inherit its baseline-first discipline, its three-valued
`unresolved` readout (dropped, never flattened to a bit), and its restore-in-`finally`.

- **200 items** built from 1919 candidate `(source, test, mutation)` triples, stratified round-robin
  across modules, deterministic seed. **116 killed / 84 survived — base rate 0.580.** Non-degenerate;
  5 `unresolved` dropped. *(The historical corpus in `db/mutation-findings/` sits at 44/64 = 0.69, so
  0.58 is in family.)*
- **150 items** put to every agent (one item per call).

**Agents** = 4 local model families × 4 personas = 16. Persona block built exactly as
`PersonaSummoner` builds it (`buildPreamble(name)` verbatim + `memory/CURRENT-<name>.md` /
`memory/<name>/NOTEBOOK.md`). Judgment made by `chooseIndex` **imported from
`accelerator/local-llm.ts`** — the same primitive `localLlmParticipant` uses, same temperature 0, same
`maxTokens 6`, same parse-and-fallback.

**Cost: zero model spend.** 2550 local ollama calls, 107 minutes wall, on hardware already present.

---

## 3. Why the existing corpus could not be reused — the shortcut checked and refuted

The coordinator asked whether `agent-heartbeat.yml:190`'s in-production mutation step already contains
the data. It does not, for two independent reasons, both `metered` from the 67 records in
`db/mutation-findings/`:

1. **There are no predictions in it.** The workflow invokes the runner **without `--choose`**, so no
   model is ever consulted. Every record is `{source, test, mutation, agent, tick, outcome}` where
   `outcome` is the *ground truth* from running the suite. The step is deliberately zero-judgment —
   *"no model has to be RIGHT about anything"*. So the corpus yields neither ρ **nor** competence `c`.
   (`db/mutation-transcript/otto.jsonl` holds 5 free-text menu choices, all Otto's, none binary-scored.)
2. **Items are near-disjoint, as the workflow comment claims but not by guarantee.** Selection is
   FNV-1a over `(agent, tick)`, so collisions are possible rather than excluded. Measured: over 24 ticks
   with >1 agent, exactly **1 tick** had ≥2 agents on the same room. Room overlap across all ticks:
   alexa/otto 8, alexa/soraya 4, otto/soraya 4 — but at *different* ticks, i.e. different repo states.

**So: the obstacle is confirmed and is worse than stated.** Even a perfectly-colliding tick would give
nothing, because no prediction is recorded anywhere. A paired run was the only option; it was small,
and it cost nothing.

---

## 4. The estimator, and its own falsifier

**Tetrachoric, never phi.** `SocietyUsefulWork.simulateHeterogeneous` (`:69-73`) states the generative
model the theorem was proven under — a one-factor Gaussian copula — so ρ *is* the latent-Gaussian
correlation, which is what the tetrachoric coefficient estimates and phi does not.

`validate.ts` **measures** this rather than asserting it, on 40 replicates × n=1000 draws from that
exact model across a (ρ, c) grid:

| check | result |
|---|---|
| tetrachoric unbiased for ρ | **worst \|bias\| 0.019** across the whole grid |
| phi ≤ tetrachoric | holds at **every** grid point |
| phi attenuation | **under-reports true ρ by 21%–66%, and the size depends on `c`** |

That last row is the load-bearing one: phi is not even a fixed rescaling, so "use phi and adjust" is not
available. Using phi would have biased every verdict toward *"the society clears the bar"* — the vacuity
class at instrument level. **The attenuation is live in our own data too**: on the primary panel,
phi reports within-family 0.465 where tetrachoric reports 0.651.

Two numerical defects were caught by the validator and **fixed rather than tolerated** — recorded
because both were mine:

- The Numerical-Recipes `erfcc` (fractional error ~1.2e-7) failed the ρ=0 factorisation identity at
  9e-9. Replaced with Hart's rational Φ (~1e-15).
- The naive conditioning integral `∫φ(x)Φ((ρx−k)/√(1−ρ²))dx` had **0.010 absolute error at ρ = −1**,
  because the inner Φ becomes a step that fixed-node Gauss-Legendre cannot resolve. That is not a corner
  case here — *"personas are costumes"* is precisely the hypothesis that ρ is near 1, so the estimator
  had to be accurate exactly where the naive form was worst. Replaced with **Genz (2004) BVNU**.

**Uncertainty** is a **cluster bootstrap over 93 item strata** (modules), so content dependence is
respected rather than assumed away. `n_eff` is additionally reported from
`AntiSybil.effectiveSampleSizeHAC` ported to TS: **min 120.7 / median 138.9 of n = 150**. The CHSH
*concentration bound* beside it is **not** reused — a bound on an S-value is not a CI for a coefficient.

---

## 5. The boundary defect, re-verified independently

The brief said to re-verify rather than trust. `validate.ts` reimplements `CondorcetBoundary` from
`[read]` source and exhibits witnesses:

| claim | status |
|---|---|
| the beat-predicate is **non-monotone** in ρ | **confirmed** — witness N=8, c=0.65: FALSE, then TRUE again at ρ=0.048 |
| `findRhoStar` under-reports | **confirmed** — returns **0.0857** at N=8, c=0.65 while **ρ=0.238 still beats** (2.78×); ρ=0.20 beats: true |
| `findRhoStar 16 c` is c-independent | **confirmed** — **0.2889 for every c**, against a docstring (`:41-44`) claiming 0.33 / 0.14 / 0.06 |

All comparisons below therefore use `rhoStarAlgebraic(N) = (N−3)/(3(N−1))`. Reference values:
`ρ*(3) = 0`, `ρ*(6) = 0.200`, `ρ*(8) = 0.238`, `ρ*(12) = 0.273`, `ρ*(21) = 0.300`, `→ 1/3`.

---

## 6. Pre-registered readings — fixed in code before the numbers existed

Written into `estimate-rho.ts` before any agent ran. `W` = mean within-family ρ̂ (same weights,
different persona); `X` = mean cross-family ρ̂ (different weights); `D = W − X`.

| result | reading |
|---|---|
| **CI_low(D) > 0.15** | **COSTUMES** — personas leave a pair materially more correlated than switching model family does |
| **CI(D) ⊂ [−0.10, +0.10]** | **GENUINE** — personas decorrelate about as well as distinct families; phase 2 gets cheap |
| anything else | **INCONCLUSIVE** — say so, and report the n that would settle it |

Overriding degeneracy guards: an agent emitting the same raw option index on >95% of items, or error
variance ≈ 0, measures position bias rather than judgment; `ĉ ≤ 0.5` for most agents fails the Condorcet
precondition before ρ is even relevant.

---

## 7. The result

### 7a. Two of four families emit no judgment — reported, not hidden

`metered`, from the raw-index guard:

| family | modal raw index share | reading |
|---|---|---|
| `gemma2:9b` | 36.7 – 58.0 % | engages |
| `qwen2.5:7b` | 50.0 – 60.7 % | engages |
| `mistral:7b` | 74.7 – 77.3 % | near-constant, below the 95% flag |
| `llama3.1:8b` | **100.0 %** (all four personas) | **constant responder — emits no judgment** |

`llama3.1:8b` answered option index `"1"` on **150/150** items under every persona, producing four
**identical** error vectors and a within-family ρ̂ of 0.9998 that is an artefact, not a finding. It also
produced spurious *cross*-family ρ̂ ≈ 1.0 against `mistral:7b`, because two near-constant responders
sharing a modal index correlate at ~+1 for reasons having nothing to do with weights.

### 7b. Three panels, one verdict

| panel | N | W (within) | X (cross) | **D** | 95% CI(D) | verdict |
|---|---|---|---|---|---|---|
| all 4 families (**contaminated**) | 16 | 0.825 | 0.396 | 0.429 | [0.329, 0.525] | COSTUMES |
| 3 families — guard-licensed (drop only the flagged one) | 12 | 0.767 | 0.246 | 0.521 | [0.398, 0.637] | COSTUMES |
| **2 engaging families — PRIMARY** | 8 | **0.651** [0.575, 0.713] | **0.096** [−0.056, 0.248] | **0.555** | **[0.386, 0.723]** | **COSTUMES** |

The verdict does not depend on which exclusion rule is used. The *contaminated* panel gives the
**smallest** contrast, so the degenerate agents were biasing toward the GENUINE reading, not away from it.

### 7c. Against the boundary

- Within-family (personas on one model) **ρ̂ = 0.651 > 1/3**. `N_eff < 3` **at any N** — adding runners
  cannot fix it. A persona society fails the majority-vote bar structurally.
- Cross-family **ρ̂ = 0.096**, below `ρ*(8) = 0.238`. Its CI `[−0.056, 0.248]` straddles ρ*, so this is
  **"consistent with clearing the bar", not "clears the bar"** — the pre-registered rule that a CI
  straddling ρ* is not a pass.

### 7d. The ceiling and the noise floor, measured

A replicate run of `qwen2.5:7b | otto` over the same 150 items gave **150/150 identical predictions
(100.00%)**. At temperature 0 with a fixed seed the runtime is deterministic, so:

- ρ̂(same model, same persona) = **1.0 exactly** — the measured ceiling.
- **All** measured decorrelation is prompt-induced; **none** is runtime sampling noise.
- And it closes §1 empirically: with no persona injected, production's three agents run byte-identical
  prompts through a deterministic function. ρ = 1 is not an inference, it is the control condition.

Read the numbers as one scale: **1.00** same persona · **0.65** different persona, same weights ·
**0.10** different weights. Persona differentiation buys about **a third** of the distance that changing
the weights buys.

### 7e. Competence — the finding that outranks ρ

| family | ĉ range (±0.076–0.080 at 95%) |
|---|---|
| `gemma2:9b` | 0.533 – 0.567 |
| `qwen2.5:7b` | **0.480** – 0.540 |
| `mistral:7b` | 0.647 – 0.653 |
| `llama3.1:8b` | 0.647 (artefact — constant responder) |

On the two engaging families **every CI straddles 0.5**, and `qwen2.5:7b | riven` is *below* chance.
Condorcet's theorem requires `c > 0.5`; below it, majority voting makes the society **worse** with N.
So the honest ordering is: **at the 7–9B local tier these agents are not demonstrably better than a coin
on this task, which fails the society precondition before correlation is even reached.** ρ̂ remains a
valid measurement of correlation, and the ρ contrast is what the hardware question needed — but nobody
should read §7b as "the society works, just correlated."

---

## 8. Limitations — stated plainly

1. **Cross-family X rests on few family *pairs*.** The primary panel has 16 agent-pairs but only **one
   pair of families** (gemma2 × qwen2.5). The bootstrap resamples *items*, so `CI(X)` contains **no
   between-family variance**. `X = 0.096` should be read as "this family pair, this task", and the
   3-family panel's `X = 0.246` is the honest reminder that family pairs differ.
2. **Local 7–9B models are not the cloud fleet.** Whether Claude/GPT/Gemini/Grok personas behave the
   same way is **not measured here**. That test costs real money and was not authorized.
3. **Counterfactual, not production.** Production injects no persona (§1). This measures what persona
   injection *would* buy.
4. **Harness-induced correlation is differenced, not eliminated.** Every agent sees identical item text
   and instruction — irreducible, since that is what "shared item set" means. That shared floor applies
   to within- and cross-family pairs alike, so it cancels in `D`; the **absolute** levels of `W` and `X`
   remain inflated by it, and only `D` is confounder-controlled. Item order cannot contribute at all
   (one item per call), and option polarity is permuted per item but identically for every agent.
5. **The persona block was capped at 8000 bytes**, not the wrappers' 20000, to fit gemma2:9b's 8k
   context alongside the suite body. That **weakens** the persona treatment, which biases toward
   COSTUMES — declared here because the verdict *is* COSTUMES.
6. **`mistral:7b` was excluded from the primary panel by my judgment, not by the guard** (77% modal is
   below the 95% flag). Both panels are reported for exactly that reason.
7. Truth for an item is the suite's verdict **at this commit**; a later commit can change it.

---

## 9. Power — what a further run would buy

`metered` bootstrap SE(D) = **0.085** at n = 150, N = 8:

| contrast to resolve at 95% | shared items needed | model calls |
|---|---|---|
| 0.30 | 47 | 376 |
| 0.20 | 105 | 840 |
| 0.15 | 186 | 1488 |
| 0.10 | 419 | 3352 |

The observed contrast (0.555) is **far** from the decision boundary, so this was the cheap case PR
#10928 §2d hoped for: n = 150 was more than enough, and **n ≈ 50 would have sufficed**. A future run
should spend its budget on **more model families**, not more items — limitation 1 is now the binding
constraint, and it is a between-family variance that no number of items reduces.

---

## 10. What follows

**Actionable now, no authorization needed:**

- Route free-tier society work to **disjunctive** tasks (find bugs, generate candidates, surface
  possibilities — where one agent succeeding is enough), **not** to majority-vote adjudication. The
  union/discovery model (`SocietyUsefulWork.fs:63-67`) has `expectedGain > 0` for every ρ < 1; the
  majority-vote model has a hard cliff this society is on the wrong side of.
- Treat `rhoStarAlgebraic` as the boundary. `findRhoStar` under-reports by up to 2.8× (§5).

**Needs Aaron:**

- **The phase-2 hardware argument now has a number.** Persona differentiation recovers ~1/3 of the
  decorrelation that distinct weights recover, and leaves ρ̂ = 0.65, far above ρ\* ≈ 0.24–0.33. If the
  society is meant to adjudicate, **distinct model families are the only lever measured to work**, and
  on free-tier runners a second 5GB family does not fit beside `qwen2.5:7b` in 7GB. This is a budget
  question, which is a gated class.
- **Whether to spend real money** measuring the same contrast on the cloud personas (limitation 2).
- **Whether the production `local-llm` path should carry a persona at all** (§1). It currently does
  not; wiring it would be a change to the production chooser, which this experiment deliberately did not
  make.

---

## Pointers

- `docs/research/2026-08-16-wiring-the-condorcet-society-measuring-c-and-rho-on-real-agents-and-the-harness-as-security-boundary.md` — PR #10928, the design this executes
- `src/Core.TypeScript/costume-rho/` — `build-items.ts` · `tetrachoric.ts` · `validate.ts` · `run-agents.ts` · `estimate-rho.ts`
- `db/costume-rho/` — `items.jsonl` (200 labelled items) · `responses.jsonl` (2400) · `replicate.jsonl` (150, the determinism control). Text, diffable, replayable — `no-binary-in-proof-lineage`.
- `src/Core/SocietyUsefulWork.fs:63-73` (union model + the generative model) · `src/Bayesian/CondorcetBoundary.fs:185-220` (`rhoStarAlgebraic`) · `src/Core/AntiSybil.fs:310-326` (`effectiveSampleSizeHAC`)
- `src/Core.TypeScript/observe/participant.ts:57-80` · `run-loop-real.ts:96-110` — the no-persona production path
- `src/Core.TypeScript/peer-call/summon.ts:508-547` — the persona mechanism that exists but is not used by the heartbeat
- Beacon: Pearson 1900 (tetrachoric) · Olsson 1979 (polychoric ML) · Genz 2004 (BVNU) · Hart 1968 (Φ) ·
  Newey & West 1987 (HAC) · Dunnett & Sobel 1955 (correlated binomials) · Condorcet 1785 ·
  Boland 1989 (correlated jury theorem) · Efron 1979 (bootstrap)
