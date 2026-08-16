# Wiring the Condorcet society — measuring `c` and `ρ` on real agents, and the harness as security boundary

**Status:** PLAN. No implementation. No runtime code proposed for this PR.
**Author:** the shadow (routed by Otto), 2026-08-16.
**Authorization:** Aaron, 2026-08-16 — *"we can route to someone to make a plan on how to wire this into
our existing stack and our little free github society and later our full society on our own hardware.
Remember the ultimate plan is no interactions with the outside world that don't go through one of our
transports or CLIs and harnesses, this way all the interactions can be optimized for AI speed and safety
since most CLIs and tool calls today were made kind of haphazardly over the years and have a lot of sharp
corners for compatibility reasons."*

**Register discipline** (`toy-is-free-metered-must-be-earned`): every claim below carries a label.
`metered` = has a falsifier in-tree. `unmetered` = implemented/reasoned, never falsified.
`toy` = play, no falsifier sought. **Every number this plan proposes to measure is `unmeasured`
until measured — a plan to measure is not a measurement.**

**Verification note:** claims marked `[read]` I verified by reading the cited file at the cited lines.
Claims marked `[ran]` I verified by executing a standalone reimplementation of the cited F# functions in
`dotnet fsi` (I did not modify or run repo code). Claims marked `[proposed]` are mine and unverified.

---

## 0. Why a research doc and not a trajectory RESUME

Deliberate choice, per the brief's invitation to justify it.

`docs/trajectories/dogfooding-the-whole-stack/RESUME.md` is an **active lane with a live blocker field and
a "next concrete action"** — fast-changing state, and another agent is diagnosing it concurrently. A RESUME
is the fastest-changing surface we have. This document is the opposite: a fixed-date design artifact with
named anchors and a stable argument. Under DV2.0 (`dv2-data-split-discipline-activated`, §5), those are
different change rates and therefore different storage shapes — **satellite, not hub-state.** Adding a
second RESUME would also fork the dogfooding lane, which is the failure the trajectory system exists to
prevent.

So: research doc, and it **references** the dogfooding ledger without touching it. Rows 1, 3, 4, 8 and 13
of that ledger are load-bearing evidence below and are cited, not edited.

---

## 1. What is actually closed, and what row 15 does and does not say

`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §A row 15 — Generalized Condorcet / ΔU-aggregation —
is **`metered`**: FsCheck + analytic, 2026-07-03, 11 properties in `CondorcetBoundary.Tests.fs`. This
plan does not restate it, does not weaken it, and does not touch it.

But instantiating it requires noticing something the row's own anchors carry, which is **scoping, not
weakening**: row 15 cites **two files that implement two different aggregation rules, and only one of
them has a ρ threshold at all.**

### 1a. The union / discovery model — `src/Core/SocietyUsefulWork.fs` `[read]`

`expectedGain` (lines 63–67):

```
E[U_society] − E[U_i] = (1 − ρ)(1 − c)(1 − (1 − c)^(n−1)) · Σv
```

`[read]` This is **strictly positive for every ρ < 1, every c ∈ (0,1), every n ≥ 2.** There is no ρ*.
Correlation *attenuates* the society's advantage; it never reverses it. At ρ = 1 the gain is exactly 0
(society ties the individual), never negative. `[ran]` confirmed by evaluating the closed form at
ρ ∈ {0, 0.3, 0.5, 0.9, 0.99, 1.0}.

This is the **disjunctive / OR-aggregation** regime: society = *union of discoveries*. One agent finding
the bug is enough. It is exactly the economy `every-bug-has-economic-value` describes.

### 1b. The majority-vote model — `src/Bayesian/CondorcetBoundary.fs` `[read]`

Here ρ* is real and it is a cliff. `correlatedSocietyBeatsBest` (lines 99–100) is false above ρ*, and
`rhoStarAlgebraic` (lines 217–219) gives

```
ρ*(N) = (N − 3) / (3(N − 1))     →  1/3  as N → ∞
```

This is the **conjunctive / adjudication** regime: society = *majority verdict*. Being outvoted by
correlated peers is a real loss.

### 1c. The consequence that drives everything downstream

> **`[proposed]` Which aggregation rule the society uses determines whether ρ* exists at all. A
> measurement of ρ is only interpretable against a named aggregation rule. Name it before measuring.**

This is not a defect in row 15 — the theorem is proven for both halves. It is the first thing an
instantiation plan has to pin down, and it is the reason this plan can come back with a **split verdict**
(§4) rather than a single pass/fail.

### 1d. The N_eff ceiling and ρ* = 1/3 are the same statement `[ran]`

The brief asked for the cross-check against `effectiveN` (`CondorcetBoundary.fs:84–86`):

```
N_eff = N / (1 + (N−1)ρ)  →  1/ρ   as N → ∞
```

The majority-vote beat condition in the shipped code is `N_eff ≥ 3` (the smallest odd majority — stated
at `CondorcetBoundary.fs:192–200`). So:

```
1/ρ ≥ 3   ⟺   ρ ≤ 1/3
```

**The N_eff ceiling and the ρ* limit are one identity.** That collapses the sizing question into a single
sentence, and it is the sentence that should drive the plan rather than agent count:

> **`[metered, from the cited code]` If measured ρ̂ > 1/3, the society is worth fewer than 3 independent
> voters *no matter how many runners we buy.* Adding agents cannot fix correlation. Only decorrelation can.**

`[ran]` Numerically: at ρ = 0.5, N_eff → 2.00. At ρ = 0.8, N_eff → 1.25. Both below 3 at *any* N.

### 1e. Two defects found in the target itself — flagging, not fixing

Every bug has economic value; these are priced observations, filed here because they change what a
measurement pipeline must compare against. **No fix is proposed in this PR.**

**(i) A stale docstring contradicts the shipped code.** `[ran]` `CondorcetBoundary.fs:41–44` claims a
c-dependent boundary table for N=16 (ρ* ≈ 0.33 at c=0.6, ≈ 0.14 at c=0.7, ≈ 0.06 at c=0.8), from the
formula at line 38. The shipped `findRhoStar 16 c` returns **0.2889 for every c in {0.55 … 0.90}** —
c-independent, exactly as the *algebraic* section at lines 185–214 says it should be. The docstring table
and the code disagree; the algebraic section and the code agree. Anyone sizing a society off lines 41–44
would size it wrong.

**(ii) `findRhoStar` binary-searches a non-monotone predicate.** `[ran]` `correlatedMajorityProbability`
floors `N_eff` to an integer (line 94), and `majorityProbability` is **non-monotone in n for even n**
(`n/2+1` requires a strict supermajority, so ties count as losses): at c=0.65, `majorityProbability` is
0.6500 (n=1), 0.4225 (n=2), 0.7183 (n=3), 0.5630 (n=4), 0.7648 (n=5), 0.6471 (n=6). The floor makes the
beat-predicate **sawtooth in ρ**. Measured at N=8, c=0.65:

| ρ | N_eff | floor | beats best? |
|---|---|---|---|
| 0.0857 | 5.000 | 5 | **true** |
| 0.100 | 4.706 | 4 | false |
| 0.150 | 3.902 | 3 | **true** |
| 0.200 | 3.333 | 3 | **true** |
| 0.250 | 2.909 | 2 | false |

`findRhoStar 8 0.65` returns **0.0857**, but the society demonstrably still beats the best individual at
ρ = 0.20 — a factor-2.3 under-report. Binary search assumes monotonicity the predicate does not have.

> **`[proposed]` Measurement-pipeline consequence: compare ρ̂ against `rhoStarAlgebraic N`
> (lines 217–219), never against `findRhoStar` (lines 107–117).** The algebraic form is exact for the
> effective-N model and free of the flooring artifact. Filing the `findRhoStar` soundness fix is
> separate work and is **not** claimed here.

---

## 2. Deliverable 1 — how `c` and `ρ` actually get measured

The math is `metered`. The instantiation is **`unmeasured`**. Nobody has measured `c` or `ρ` on a Zeta
agent. This section is the experimental design; every number it would produce is unmeasured until produced.

### 2a. What we must NOT reuse, and what already exists

**The existing calibration ledger is not the estimator, and it says so itself.** `[read]`
`src/Core.TypeScript/planning/calibration-ledger.ts:20–23`, design contract point 4:

> *"CALIBRATION ≠ COMPETENCE — this measures self-knowledge: whether an agent's model of its own
> performance matches reality. An agent can be poorly calibrated and excellent, or well-calibrated and
> mediocre."*

That is exactly right and it means `c` is genuinely unmeasured today. What the ledger *does* give us for
free is the **append-only outcome-record substrate** (contract point 2) and a proper scoring discipline
(Gneiting & Raftery 2007 interval score, lines 25–31). A competence ledger should sit **beside** it on the
same append-only shape, never inside it — the same separation contract point 1 already enforces against
`FlatSocietyBase.peers`.

**The CHSH margin is the wrong instrument, twice over.** `[read]` The brief's warning is correct and the
repo is already ahead of it:

- `AntiSybil.chshMargin` (`src/Core/AntiSybil.fs:217–219`) is `sqrt(32 · ln(1/δ) / rounds)` — Hoeffding,
  i.i.d. Its own caveat block (lines 221–230) states it **over-convicts on autocorrelated streams**.
- `chshMarginAutocorr` (lines 321–326) is the sound HAC-corrected replacement (Newey–West bandwidth,
  `effectiveSampleSizeHAC`).

But **neither is reusable for ρ̂**, and the reason is a category error rather than a soundness one: both
are *concentration bounds on a CHSH S-value*, not *confidence intervals for a correlation coefficient*.

> **`[proposed]` What IS reusable is the `effectiveSampleSizeHAC` machinery (AntiSybil.fs:321–326) and
> the stationarity gate `isApproxStationary` (lines 332–341)** — applied to the *error-indicator product
> series* of an agent pair, to convert nominal item count `n` into `n_eff`. The concentration bound is
> not reusable; the effective-sample-size correction is. Take the second, leave the first.

### 2b. The judgment task — this has to exist before anything else does

ρ is *correlation between agents' errors on the same inputs.* That is undefined without a shared,
scored item set. Requirements, and they are restrictive:

1. **Shared** — every agent sees the identical item.
2. **Ground truth obtainable independently of the agents.** No agent-jury ground truth; that is circular
   and would manufacture the correlation it claims to measure.
3. **Non-degenerate difficulty.** If c → 1 or c → 0 for all agents, error variance vanishes and ρ is
   undefined (0/0). This kills the obvious candidates.
4. **Self-generating in-repo.** No external data dependency (see §5 — external data is itself an
   unharnessed channel).

**`[proposed]` Primary task: mutant-kill prediction.**
`src/Core.TypeScript/hygiene/mutation-runner.ts` already generates mutants and already has the notion
that *a test surviving mutation is not a falsifier* (cited in `toy-is-free-metered-must-be-earned`).
The judgment item is: *given this mutant diff and the test file, will the suite kill it?* Ground truth is
obtained by **running the suite** — mechanical, binary, agent-independent, unlimited supply, and the
difficulty is tunable by mutant class. It also produces something the repo wants anyway.

**`[proposed]` Secondary task: seeded-defect adjudication.** Given a diff that either does or does not
contain a seeded defect drawn from the historical bug ledger, is it correct? Ground truth is the seed
record. Harder to keep unbiased (seeded defects have a flavour), so secondary.

**`[proposed]` Explicitly rejected candidates, with reasons — this is where the design earns its keep:**

| candidate | why rejected |
|---|---|
| ARC-AGI via `arc-solver/arc-harness.ts` | `[read]` requires an external `data/ARC-AGI` clone (line 26) — an unharnessed outside channel (§5), and `qwen2.5:0.5b` will score ≈ 0, violating requirement 3 |
| CI `gate` pass/fail prediction | severe class imbalance (nearly all pass) ⇒ c → 1 ⇒ no error variance |
| Golden-vector conformance | mechanically decided; no judgment, so no competence to measure |
| PR-review verdicts | ground truth is settled *by us*, i.e. by the agents — circular, violates requirement 2 |
| Society fitness scores (`society-heartbeat.yml`) | fitness is an internal aggregate, not a scored judgment against external truth |

### 2c. The estimator — and the one choice that decides the answer's direction

Let `e_ij ∈ {0,1}` = 1 iff agent *i* is wrong on item *j*, over a shared item set of size *n*.

- **Competence:** `ĉ_i = 1 − (1/n) Σ_j e_ij`. Plain sample mean. Binomial CI.
- **Correlation:** this is where the design decision lives.

`[read]` `SocietyUsefulWork.simulateHeterogeneous` (lines 69–73) states the generative model the theorem
was proven under, verbatim:

```
V_ij = √ρ · X_j + √(1−ρ) · ε_ij      X_j ~ N(0,1) shared per-item latent
agent i discovers fact j iff V_ij < probit(c_i)
```

That is a **one-factor Gaussian copula / probit model**. Two consequences, and the second is the crux:

1. **ρ is the shared per-item factor loading.** Item difficulty is not a confound to be removed — under
   this model item difficulty *is* ρ. Good: the naive pairwise estimator targets the right quantity.
2. **The correct estimator is the tetrachoric correlation, not the phi coefficient.**

> **`[proposed]` This is the most important line in the plan.** The tetrachoric correlation is the
> latent-Gaussian correlation of a 2×2 table — precisely the ρ of the model above. The Pearson/phi
> coefficient on binary indicators **attenuates toward zero whenever the marginals are skewed**, and our
> marginals *will* be skewed (competence is not 0.5). Phi would therefore report a **lower ρ̂ than the
> truth**, which biases the result toward *"the society clears the bar."*
>
> **Using phi here would be a measurement design that can only confirm the society bet.** That is the
> vacuity class at instrument level. Use tetrachoric; if a phi number is also reported, label it as the
> attenuated lower bound it is.

Anchors (Beacon): Pearson 1900 (tetrachoric correlation); Olsson 1979 (maximum-likelihood estimation of
the polychoric/tetrachoric coefficient); Dunnett & Sobel 1955 (the correlated-binomial approximation the
`effectiveN` docstring at line 83 already names).

Society-level ρ̂ = mean over the `C(N,2)` agent pairs, reported **with the full pairwise matrix, never
only the mean** — a bimodal matrix (tight within-model-family clusters, loose across) is the actual
finding, and averaging destroys it.

### 2d. Sample size — and why it is uncomfortably large `[proposed]`

The decision we need is *"is ρ above or below 1/3?"*, and near the boundary the discrimination is fine.
Pearson SE ≈ (1 − ρ²)/√n; tetrachoric ML is roughly 1.5–2× that for skewed marginals. To resolve
ρ̂ = 0.29 from ρ̂ = 0.33 at ~95% confidence you need SE ≈ 0.02, i.e. **n on the order of 2,000–4,000
scored items per agent pair** — before any dependence correction.

Then apply `effectiveSampleSizeHAC` (§2a): items drawn from the same file/module autocorrelate, so
`n_eff < n` and the true requirement is larger. `[proposed]` Randomising item order across agents does
**not** fix this (the dependence is in item content, not presentation order); the mitigation is stratified
sampling across modules with the stratum recorded per item.

**Honest statement of cost:** at ~30–45 min cron ticks and ~3 agents, a 3,000-item shared set is not a
weekend. `[proposed]` The de-risking move is a **staged sample**: run 200 items first and check only
whether ρ̂ is *far* from 1/3 (say ρ̂ > 0.6 or < 0.15). A far-from-boundary answer needs far less data than
a near-boundary one, and §4 argues the likely answer is far from the boundary — in which case the cheap
run settles it.

### 2e. Where the numbers live, and what re-measures them `[proposed]`

- **Items and per-agent verdicts:** one file per item under an event-sink folder, same shape as
  `docs/observe-events/` (already per-event ZetaId-keyed — `[read]` `society-heartbeat.yml:62–64`  comment). Append-only. `[read]` This is the idempotency requirement (§6): re-scoring an item is an
  upsert on its ZetaId, never a second row.
- **Ground truth:** stored alongside the item, with the *mechanism* that settled it (suite invocation +
  exit code), not just the bit — so a stale truth is detectable.
- **The derived (ĉ, ρ̂) fold:** a checkpoint, recomputed from the full history like the calibration
  ledger's posterior (`[read]` contract point 2). Never mutated in place.
- **Re-measurement trigger:** membership change is the obvious one, but it is not sufficient. `[proposed]`
  ρ̂ must be invalidated by **any of**: an agent added or removed; a base model or model *version* changed;
  a persona/prompt file changed; the tool access of any agent changed. All four are content-addressable —
  key the ρ̂ checkpoint by the hash of `(agent roster × model id × persona file × tool manifest)` and it
  self-invalidates. This is the same content-addressing move `dogfooding` row 4 uses to make staleness
  impossible by construction.

**Prerequisite that does not exist yet — naming it rather than inventing a step:** there is no
per-agent **tool manifest** in-tree to hash. The roster and models are discoverable from
`agent-heartbeat.yml`'s matrix; persona files exist as `CURRENT-*.md`; tool access is currently implicit.
Until a tool manifest exists, the ρ̂ invalidation key is incomplete and must be treated as such.

---

## 3. Deliverable 2 — designing so the answer can be NO

### 3a. The falsification criteria, stated before any data exists

`[proposed]` The plan commits in advance to these readings. Stating them now is what makes the
experiment falsifiable rather than confirmatory.

| measured result | reading |
|---|---|
| **ρ̂ > 1/3** | **The GitHub-Actions society does not clear the majority-vote bar. At any N.** N_eff < 3; more runners cannot help. |
| ρ̂ ∈ (ρ*(N), 1/3] | Fails at the *current* N, could clear it by growing N. Sizing: ρ*(N)=0.2 needs N=6; ρ*(N)=0.3 needs N=21 `[ran]` |
| ρ̂ ≤ ρ*(N) at current N | Clears the bar. Report ρ̂'s CI; a CI straddling ρ*(N) is **not** a pass. |
| ĉ ≤ 0.5 for most agents | **Fails prior to any ρ question.** Below-chance jurors make the majority *worse* with N. Condorcet's theorem runs backwards. |
| error variance ≈ 0 (all agents right, or all wrong) | ρ̂ undefined. The task was degenerate; the *task* failed, not the society. Must be reported as such, never as a pass. |

**One criterion is already met without any measurement, and it is the sharpest thing in this document:**

> `[ran]` `rhoStarAlgebraic 3 = 0`. The free-tier society's agent matrix is `[alexa, otto, soraya]` —
> **N = 3** (`[read]` `agent-heartbeat.yml:38`, matrix). At N = 3 the majority-vote model requires
> **ρ = 0 exactly**. Perfect independence. Three agents sharing one base model is not a jury; it is a
> single juror with three hats.
>
> **The current free-tier society cannot clear the majority-vote bar at any correlation greater than
> zero, for reasons of size alone — before we measure anything.** N ≥ 6 is a precondition for the
> measurement to be *interesting* at all.

### 3b. The likely negative result, and why

`[read]` `agent-heartbeat.yml:8–9, 61–63`: the society runs `qwen2.5:0.5b` (~400MB) for heartbeat and
`qwen2.5:7b` (~5GB) for codegen, with the comment *"fits in 7GB runner"*. **One model family. One set of
weights. Three persona prompts.**

`[proposed]` Predicted ρ̂ is high — plausibly 0.6–0.9 — because the dominant shared factor is *the weights
themselves*. Two instances of the same model given the same item fail on the same items for the same
reasons. This is Aaron's own concern and I think it is correct.

**And the 7GB runner is a hard ceiling on the fix.** `[read]` A second 5GB model family does not fit
alongside `qwen2.5:7b`. So on free-tier runners, model diversity at the 7B tier is **structurally
unavailable**, not merely unfunded. That is a phase-2 blocker discovered in phase 1, which is exactly what
phase 1 is for (§6).

### 3c. Decorrelation levers, honestly ranked

**(1) Distinct base models — real, and the only first-order lever. `[proposed]`**
Different weights, different training data, different failure modes. Blocked on free tier by runner RAM
(§3b). This is the lever, and phase 1 cannot pull it at the 7B tier.

**(2) Same model, distinct prompts/seeds/temperature — correlation wearing a costume, probably. `[proposed]`**
This is precisely the `numerology-vs-number-theory` warning: *too many correlations is a warning, not a
confirmation.* Persona differentiation changes the *style* of the output; whether it changes the *error
set* is an open empirical question and there is no reason a priori to think it does. A persona prompt does
not give a model knowledge it lacks.

> **The repo already contains the natural experiment to settle this, and it costs nothing new.** `[read]`
> `src/Core.TypeScript/peer-call/README.md`: `grok.ts`, `ani.ts` and `riven.ts` all wrap
> `cursor-agent --print --model grok-4-20-thinking` — **same underlying model, three different persona
> preambles.** `codex.ts` and `amara.ts` both wrap `codex exec -s read-only` — same again. Meanwhile
> grok / gemini / codex / claude are **four distinct model families**.
>
> **`[proposed]` Run the same item set through all eight and compare within-family ρ̂ against
> cross-family ρ̂.** If ρ̂(grok, ani) ≈ ρ̂(grok, gemini), persona differentiation is a costume and the
> whole society bet rests on buying distinct weights. If ρ̂(grok, ani) is materially lower, persona
> differentiation is a genuine lever and phase 2 gets cheaper.
>
> **This is the single highest-value measurement in the plan, it needs no new hardware, and it is
> available today.** It also directly de-risks phase 2 (§6).

**(3) Distinct tool access / distinct evidence subsets — real, and cheap. `[proposed]`**
Two agents given genuinely disjoint evidence cannot make the same evidence-driven error. This is real
decorrelation with a real cost: an agent with less evidence has lower `c`. **The trade is explicit and
should be measured, not assumed** — ρ↓ and c↓ move the boundary in opposite directions, and which wins is
an empirical question that this design can answer (measure both under a partitioned-evidence condition).

**(4) Network delay — §A row 19 — `[proposed]` NOT a usable lever in the GitHub-Actions society.**

Row 19 (Delay-Decorrelation, `metered`, `DelayDecorrelation.Tests.fs` DD-1..DD-9) is real, and the
free-tier society has *plenty* of delay: cron ticks at 30–45 min, `flush-via-staging.ts` batching,
`heartbeat/*` refs flushed by PR. So the naive read is "delay is abundant, we're fine."

**I think that read is wrong, and here is the argument.** `[read]`
`DelayDecorrelation.effectiveCorrelation latency = 1/(1+latency)` (lines 38–41) models the correlation
carried by the **fast feedback channel** — *"how much of the agent's belief is shared via the fast feedback
channel vs. independently derived."* Delay decorrelates the part of a belief that was going to be
**exchanged**.

In the free-tier society, the dominant correlation is not exchanged. It is **shared at t=0**: identical
base weights, identical fresh checkout of `main`, identical repo context. Every runner starts from the
same prior. **No amount of delay touches a correlation that was present before any message was sent.**

> `[proposed]` **Delay is abundant and irrelevant here.** It is a lever against *convergence-through-
> communication*, and our problem is *convergence-through-common-origin*. Answering the brief's question
> directly: everything is effectively synchronous in the sense that matters, because the agents are
> synchronised by construction rather than by messaging.

Also worth recording: the module's own honest-scope note (lines 27–31) says the `1/(1+latency)`
interpolation is a **modeling choice** — only the boundary conditions and monotonicity are load-bearing.
So the quantitative delay→ρ map is `toy`; the monotone direction is `metered`. Do not read a specific
latency off it.

### 3d. The split verdict this design can produce `[proposed]`

Because of §1c, a negative result is not the end of the society bet:

> If ρ̂ > 1/3, the free-tier society **fails the majority-vote (adjudication) bar** and **still wins on
> the union/discovery bar**, where `expectedGain > 0` for all ρ < 1.
>
> **Design consequence, actionable regardless of which way the number lands:** route free-tier society
> work to **disjunctive** tasks — find bugs, generate candidates, surface possibilities, where one agent
> succeeding is enough — and **not** to majority-vote adjudication. High ρ costs us throughput on the
> first and correctness on the second.

That is the shape of a plan that can come back negative and still be useful.

---

## 4. Deliverable 3 — the outside-world boundary is a security boundary

Aaron: *"no interactions with the outside world that don't go through one of our transports or CLIs and
harnesses."* This is **§13 noninterference (entropy quarantine) at the system boundary** — influence
enters only through declared, metered channels — and it is the same mechanism as the **closed command
set**, the portable half of the Itron design (`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`):
*the far side may **name** a command but can never **define** one.*

A harness is therefore a **security boundary, not an ergonomics layer.** Aaron's stated motive — existing
CLIs "have a lot of sharp corners for compatibility reasons" — is the *occasion*, not the purpose.

### 4a. The three-tier refusal shape (Aaron, 2026-08-16)

> *"they're a security boundary, which means each one must be able to refuse — we want to try to design
> so they never have to refuse cause the safe thing is the only option many time but where we can't yes
> they should be able to refuse and be required to teach during the refusal and send back feedback and
> and possible a new generator function to reduce heat and irreversibility, refusal with no feedback
> force erasure over reversability"*

| tier | shape | status |
|---|---|---|
| **0** | The unsafe action is **inexpressible** — absent from the grammar, not discouraged or validated-then-rejected. *"the safe thing is the only option."* | **preferred** |
| **1** | Refusal **carries payload**: it must **teach**, **return feedback**, and where possible **return a new generator function** producing admissible requests. | **required where Tier 0 is impossible** |
| **2** | Bare refusal — a "no" with no payload. | **forbidden** |

### 4b. Why the last clause is literal — and it is already proven in-tree

**This is not a metaphor and it is not new work.** `src/Core.Lean4/Lean4/LandauerFloor.lean` formalizes a
two-ledger model (state/uncertainty + heat/environment) and proves four properties. `[read]`

- **Theorem 3, Bennett reversibility** (`LandauerFloor.lean:153–175`): `branches_zero_heat`,
  `observations_zero_heat`, `adj_only_zero_heat` — *a sequence of ONLY Adj operations (branch + observe
  + permutation) pays **zero** heat.*
- **`measure(k)`** (line 96) is the non-Adj operation: it transfers `k` bits from state to heat.
  `measure_heat_grows` (line 131): heat grows by exactly `k`.

> **`[metered — the Lean file is the falsifier]` Aaron's refusal design is Theorem 3.**
> A **refusal-with-feedback is an Adj operation** — the caller's assembled state is preserved and
> *transformed*; nothing is erased; **zero heat in the ledger model.** A **bare refusal is a `measure`** —
> the caller learns one bit and loses the work, which must be re-derived. **The erasure is structural, not
> stylistic.**

**And it is the substrate's own algebra.** A refusal-with-feedback is a **Z-set retraction (−1) —
correction, not destruction**, which is Aaron's "Lucifer, forgiven" reading (redeemed by precedence and by
future-as-facts). A bare refusal is a **delete**. Returning a **new generator** is the strongest form,
because `only-the-irreducible-is-primitive-generate-the-rest` holds that the highest-value generator **is
an error-correcting code**: you do not return "no", you return the thing that *generates admissible
requests*. The refusal then *corrects* the caller's request rather than discarding it — generation and
error-correction are dual, and a corrective refusal is that duality at the boundary.

**Theorem 4 gives a design consequence, and it is a real one.** `[read]`
`larger_window_less_excess` and `quasistatic_limit` (`LandauerFloor.lean:177–202`): the finite-time excess
above the floor is `L²/τ`, and it → 0 as the erasure window τ grows. **The more *predictable* the erasure,
the closer to free.**

> **`[proposed, on a metered theorem]` A harness should publish, in advance, what it will refuse.**
> An anticipated refusal is cheaper than a surprising one — the caller can stretch τ, i.e. shape the
> request before assembling state it would have to discard. Publishing the refusal surface up front is
> not ergonomics; it is on the thermodynamic gradient. This is also what makes Tier 0 reachable at all:
> you cannot make a hazard inexpressible without first enumerating it.

**The guard I must not violate — and the correction it forces on my own phrasing.** `[read]`
`src/Core.TypeScript/algebra/key-erasure-meter.ts` keeps accounting and physical measurement in **disjoint
types**: `LedgerBits` (bookkeeping, no instrument), `MeasuredDissipation` (joules at temperature T,
instrument I, ±u), and `LandauerFloorJoules` as a **third** type — a *bound*, i.e. a claim about what a
measurement would have to exceed. Its own words (line 22): *"there is no function anywhere that turns bits
into a measurement."* Line 40: *no part of this repository has measured a joule.*

> **So, stated correctly: the *floor* is literal; the *dissipation* is `unmeasured`.** Everything above
> is `LedgerBits` accounting. **This plan does not claim our refusals dissipate any joules** — that would
> be exactly the physics-as-metaphor failure the metering test exists to catch. Bare refusal erases
> **bits in the ledger model**; whether any device got warmer is a question no one here has instrumented.

### 4c. Two limits, recorded because they are permanent

**(1) Tier 0 has a hard ceiling.** Unsafe can be made inexpressible only for hazards **enumerable in the
grammar or type in advance**. Novel hazards cannot be designed out ahead of time. **Tier 1 is permanently
necessary, not a temporary shortfall**, and a roadmap implying Tier 0 eventually absorbs everything would
be wrong.

**(2) A teaching refusal is an oracle.** Informative errors leak the guard's shape. Between consenting
peers under mutual empowerment that is correct and desirable; against the bad actors the society guard
exists to catch, it is free reconnaissance. These want different verbosity.

> `[proposed]` **The verbosity split must be a recorded design decision, not a discovery.** Concretely:
> refusal payload verbosity is a function of the caller's standing, and the *default for an unrecognised
> caller is the low-verbosity form.* This is `dual-use-detection-is-neutral-oracle-decides` again — the
> refusal mechanism is neutral; the caller's oracle decides the reading. Note the honest tension with
> §4b: the low-verbosity form is *closer to a bare refusal*, i.e. we pay erasure to deny reconnaissance.
> That is a real trade and should be named as one rather than resolved by wishing.

### 4d. Inventory of outside-world interactions, classified by achievable tier

`[read]` unless noted. Tier column is `[proposed]`.

| # | Outside interaction | Current path | Harnessed? | Achievable tier | Note |
|---|---|---|---|---|---|
| 1 | GitHub API (PR, issue, merge) | `forge-host/` behind the `ForgeHost` contract | ✅ real harness | **Tier 1** (today **Tier 2**) | `ForgeErrorKind` (`forge-host/types.ts:20–28`) has 8 refusal kinds and a `message` string — **no generator, no teaching**. This is the clearest bare-refusal site in-tree and the most tractable Tier-1 lift. |
| 2 | `gh` CLI invoked directly | ad hoc in workflows/agents | ❌ ambient | Tier 1 | bypasses `ForgeHost` entirely — an unwrapped path to the same outside system we already harnessed |
| 3 | git push / fetch | direct; `flush-via-staging.ts` harnesses the write path | ◐ partial | **Tier 0 for writes** | dogfooding ledger row 4: *"staleness impossible by construction (branch reset from main)"* — that is a Tier-0 existence proof: the stale push is not rejected, it is **unexpressible** |
| 4 | Peer model CLIs | `peer-call/*.ts` (8 wrappers) | ✅ harnessed | **mixed** | `codex exec -s read-only` is Tier 0 for writes (write is inexpressible). `kiro-cli chat --no-interactive --trust-all-tools` is **Tier-none** — the flag name is the finding |
| 5 | Local model (Ollama HTTP) | `accelerator/local-llm.ts` | ◐ | Tier 1 | |
| 6 | **`curl -fsSL https://ollama.com/install.sh \| sh`** | raw, `agent-heartbeat.yml:57` | ❌ **fully ambient** | Tier 0 achievable | **pipes remote code straight to a shell on every tick.** The sharpest §13 violation in the inventory. Tier 0 is reachable — a hash-pinned realizer makes "run whatever the URL serves today" unexpressible; dogfooding row 8 (17 ACE realizer classes) is the existing machinery, and row `081KZKV16YF` (from-installer hash pin) is the existing pattern |
| 7 | Package managers (npm/bun/brew/apt/uv/dotnet) | `ace/setup-realize.ts`, 17 realizer classes | ✅ dogfooded (row 8) | Tier 0/1 | the best-harnessed channel we have; the model for the rest |
| 8 | External dataset clone (`data/ARC-AGI`) | manual, `arc-solver/arc-harness.ts:26` | ❌ ambient | Tier 0 | content-address the dataset and the unpinned clone becomes unexpressible |
| 9 | Realtime WebSocket push | `ZETA_REALTIME_URL` | ✅ **declared** | Tier 1 | `society-heartbeat.yml:71` comment literally reads *"§13 declared channel"* — the good example; this is what the rest should look like |
| 10 | Remote ACE registry | `ace/registry-remote.ts` | ◐ | Tier 1 | |

**The Tier-0 anchor already in-tree:** `[read]` `src/Core.TypeScript/observe/grammar-16.ts` — a
**16-slot fixed universal action grammar** where *"the 16 DIRECTIONS are FIXED"* and per-slot availability
is a tri-boolean, so a forbidden action renders as `F` (lines 10, 17–18). **This is the closed command set,
already built:** the caller names a slot; the caller cannot define one; an unavailable action is not
offered. Whatever a general harness contract looks like, this is the shape it should take.

### 4e. How ambient paths get found and closed

`[proposed]` The repo has a strong mechanical-lint tradition (`lint-no-new-bnnnn.ts`,
`lint-discharge-certificate-consistency.ts`, `audit-agencysignature-main-tip.ts`, and ~15 `lint-*`
workflows). The same shape applies:

- An **egress-inventory lint** that flags `fetch(`, `curl`, `wget`, bare `https://` fetches, and
  `exec`/`spawn` of known external CLIs occurring **outside an allowlisted harness directory**, and fails
  the gate on any *new* unwrapped site. Ratchet, not big-bang: the existing 10 rows above are the
  baseline; the lint's job is that row 11 cannot appear silently.
- Anything not on the allowlist is by definition an **ambient channel** and therefore a §13 violation.

**Prerequisite that does not exist yet — naming it rather than inventing a step:** there is **no general
harness contract in-tree.** `ForgeHost` is a per-domain interface; `grammar-16` is a per-surface grammar;
`peer-call` is a set of wrappers with a shared flag surface but no shared type. There is no `IHarness`
with refusal-payload obligations, and **no type currently makes a Tier-2 bare refusal a compile error.**
Designing that contract is the prerequisite for the lint to have an allowlist to check against, and it is
downstream work this plan does not attempt.

### 4f. No mediating hub, ever

§1 scale-free plus the Itron IP boundary: **peer-to-peer, no appointed broker.** Concentration is
acceptable only where **exit** exists — *hubs are enforced, oracles are chosen* (Aaron 2026-08-09;
Hirschman 1970). A harness is not a hub: it is a boundary each peer holds on **its own** outside edge, not
a node others must route through. `[proposed]` The design test: if removing a harness would stop other
peers from acting, it has become a hub and must be split. A harness constrains *its own* peer's egress
only.

---

## 5. The measurement design is itself subject to §13

`[proposed]` Worth stating because it is easy to miss: the ρ̂ experiment **is** an outside-world
interaction — it invokes model APIs (peer-call, row 4) and downloads model weights (row 6). So the
measurement must run through the harnesses it is measuring, or it becomes the eleventh ambient channel.
Practically: the peer-call natural experiment (§3c) is already harnessed and is therefore the right place
to *start* the measurement, independent of its scientific value.

---

## 6. Deliverable 4 — phasing

### Phase 1 — free GitHub-Actions society

**Measurable now, no new hardware:**

1. **The costume question (§3c).** ρ̂ within-model-family (grok/ani/riven; codex/amara) vs cross-family
   (grok/gemini/codex/claude), via existing `peer-call` wrappers. **Highest value in the plan.** Settles
   whether persona differentiation is a real decorrelation lever or correlation wearing a costume.
2. **ĉ per persona** on the mutant-kill task — the first competence numbers this repo has ever had.
3. **ρ̂ for the qwen2.5-only free-tier trio** — the number Aaron is worried about.
4. **N_eff** as a single reported figure, with the ρ ≤ 1/3 identity (§1d) as its interpretation.
5. **The delay question (§3c-4)** — empirically: compare ρ̂ within a tick against ρ̂ across ticks. If
   they are indistinguishable, delay is confirmed irrelevant here and the row-19 lever is off the table
   for phase 1.
6. **The egress inventory and its lint** — entirely mechanical, needs no models at all, and is the
   cheapest item in the plan.

**Learnable in phase 1 that de-risks phase 2:** if the costume question comes back "costume", phase 2
**must** buy genuine model diversity in hardware and the budget follows from item 1, not from a guess.
If it comes back "real lever", phase 2 is materially cheaper. Either way phase 1 converts a budget
argument into a measurement.

**Structurally NOT learnable until hardware exists — and these are limits, not to-dos:**

- **ρ̂ across distinct base-model families at the 7B tier.** `[read]` `agent-heartbeat.yml:61–63`: a 5GB
  model *"fits in 7GB runner"* — a second one does not. Free-tier model diversity at that tier is
  structurally unavailable.
- **Whether decorrelation via model diversity is *sufficient* to cross ρ = 1/3.** Needs the diversity to
  exist before it can be measured.
- **N > ~10 concurrent agents.** Runner concurrency bounds N, and §3a shows N is a first-order constraint
  (N=3 ⇒ ρ*=0).
- **Reticulum as the live transport** and therefore any *genuine* delay-decorrelation effect. `[read]`
  dogfooding row 13: `ReticulumLink.fs` exists; *"not the live transport."* Until it is, row 19 stays a
  theorem about a network we do not yet run.

### Phase 2 — full society on Aaron's own hardware

Carries the levers phase 1 cannot pull: distinct model families concurrently resident, N beyond runner
limits, Reticulum as real transport. `[proposed]` Phase 2's ρ̂ measurement is **the same estimator, the
same item set, the same ledger shape** — that is deliberate. If the design is right, the phase-1 numbers
and phase-2 numbers are directly comparable, and the *delta* is the measured value of the hardware.

**Coordination:** `docs/trajectories/dogfooding-the-whole-stack/RESUME.md` rows 1, 3, 4, 6, 7, 8, 13 are
the phase-1/phase-2 substrate. Another agent is diagnosing that lane concurrently; **this document
references it and does not touch it.**

---

## 7. Open questions for Aaron

1. **Which aggregation rule does the society actually use for which work?** (§1c) The union model has no
   ρ threshold; the majority-vote model has a cliff at 1/3. This is the one answer that determines whether
   a high ρ̂ is fatal or merely expensive, and it is a design choice, not a measurement.
2. **Is N=3 a fixed constraint or a current setting?** (§3a) At N=3 the majority-vote bar requires ρ=0
   exactly. Below N=6 the measurement cannot come back positive under *any* correlation.
3. **How much data is the measurement worth?** (§2d) Near-boundary discrimination needs thousands of
   scored items; a far-from-boundary answer needs hundreds. The staged-sample proposal assumes the latter
   is likely — worth confirming that a coarse answer is acceptable first.
4. **The teaching-refusal verbosity split** (§4c-2) — who counts as a peer entitled to a full teaching
   refusal, and what does an unrecognised caller get? Recommendation is low-verbosity by default, which
   *costs erasure* to deny reconnaissance. That trade is a values call.
5. **Is `curl | sh` on every heartbeat tick (§4d row 6) acceptable in the interim?** It is the most direct
   §13 violation found and it runs on a cron. Hash-pinning it is small, tractable work.

---

## 8. What this plan does not do

- Does not restate, weaken, or re-scope §A row 15. The theorem is `metered`; only its instantiation is open.
- Does not attempt the KS-entropy / Lyapunov discharge (separately routed, in flight).
- Does not fix the two `CondorcetBoundary.fs` defects in §1e; it files them and routes around them.
- Does not introduce runtime code, credentials, keys, or live-cluster interaction.
- Does not claim any joules were measured (§4b). No part of this repository has measured a joule.

## Pointers

- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §A rows 15, 16 (Landauer/small-rooms), 19 (delay-decorrelation)
- `src/Core/SocietyUsefulWork.fs:54–73` · `src/Bayesian/CondorcetBoundary.fs:84–86, 107–117, 185–219`
- `src/Core/DelayDecorrelation.fs:27–41` (honest-scope note + the ρ(latency) model)
- `src/Core/AntiSybil.fs:217–230, 321–341` (chshMargin caveat; the reusable HAC machinery)
- `src/Core.Lean4/Lean4/LandauerFloor.lean:153–202` (Bennett reversibility; predictive advantage)
- `src/Core.TypeScript/algebra/key-erasure-meter.ts:16–40, 88–130` (bits ≠ joules; the type separation)
- `src/Core.TypeScript/planning/calibration-ledger.ts:20–31` (calibration ≠ competence)
- `src/Core.TypeScript/observe/grammar-16.ts` (the closed command set, already built)
- `src/Core.TypeScript/forge-host/types.ts:20–33` (the bare-refusal site)
- `src/Core.TypeScript/peer-call/README.md` (the within/cross model-family natural experiment)
- `.github/workflows/agent-heartbeat.yml:8–9, 38, 57, 61–63` · `society-heartbeat.yml:62–64, 71`
- `docs/trajectories/dogfooding-the-whole-stack/RESUME.md` (referenced, not modified)
- `docs/research/2026-08-13-attested-key-erasure-makes-frozen-assertable-not-merely-observed.md`
- `docs/research/2026-08-13-canon-is-decided-by-write-keys-and-disagreement-forks-rather-than-votes.md`
- Rules: `dv2-data-split-discipline-activated` §7 · `itron-hub-patent-boundary-p2p-is-the-upgrade` ·
  `toy-is-free-metered-must-be-earned` · `numerology-vs-number-theory` ·
  `dual-use-detection-is-neutral-oracle-decides` · `only-the-irreducible-is-primitive-generate-the-rest`
- Beacon anchors: Condorcet 1785 · Pearson 1900 (tetrachoric) · Olsson 1979 (polychoric ML) ·
  Dunnett & Sobel 1955 · Newey & West 1987 · Landauer 1961 · Bennett 1973 · Gneiting & Raftery 2007 ·
  Barabási & Albert 1999 · Hirschman 1970
