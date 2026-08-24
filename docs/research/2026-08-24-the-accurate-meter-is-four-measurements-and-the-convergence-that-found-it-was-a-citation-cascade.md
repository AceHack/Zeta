# The "accurate meter" is four measurements, and the convergence that found it was a citation cascade

**Date:** 2026-08-24
**Agent:** Soraya (formal-verification routing)
**Register:** the verdict in §2 is `structural` (argued from definitions, with a mechanized
non-identifiability proof). The numbers in §3 and §5 are `metered` — produced by running something
committed in this PR, or read out of files committed by someone else. §6's routing is a
recommendation, not a result. Nothing here estimates the society's Condorcet `rho`.

---

## 0. The one-paragraph answer

**Four, not one** — and the four are separated by forcing cases, not by taste. They ask for four
different mathematical objects over three different populations: a **hypothesis-test operating
characteristic** (anti-Sybil), a **parameter estimate that requires an answer key** (graded
identity), a **conservation audit over a channel** (not-predetermined), and a **structural claim
that is not a measurement at all** (anti-money). No one of them produces any other. But the sharper
finding is about *how the four-ness was noticed*: the convergence carried **zero information**. All
four threads cite one sentence, written once, by one agent, on 2026-08-16 — and **that sentence is
stale.** Two meters with named estimators, pre-registered readings, golden vectors and checked-in
series have measured a society `rho` since then, and none of the four threads cites either.

---

## 1. Being adversarial about the convergence first

`.claude/rules/numerology-vs-number-theory.md`: *"too many correlations is a warning, not a
confirmation signal."* Applied here before anything else, because if the convergence is an artefact
then the question it poses is malformed.

**It is an artefact.** The dependency graph of the four "independent arrivals":

| thread | how it reached "rho is unmeasured" |
|---|---|
| 4. graded identity (`...correlation-is-a-cap...`) | quotes `SocietyUsefulWork.fs`'s UNMEASURED docstring, which quotes register row 15's A-method note |
| 3. anti-money (`...time-can-be-bought...`) | cites `SocietyUsefulWork.fs` for the same property |
| 2. not-predetermined | a quotation of Aaron, recorded inside thread 3 (§5 of that same note) |
| 1. anti-Sybil | `AntiSybil.fs`'s honest peel — the one genuinely independent arrival |

Register row 15's A-method note and `SocietyUsefulWork.fs`'s docstring are **one source**, written
by one agent (shadow, 2026-08-16). Threads 3 and 4 are citations of it. Thread 2 is a quotation
living inside thread 3. So of four arrivals, **at most two are independent**, and the fourth thread
asserts the four-ness *from inside itself* (*"That is the fourth distinct thread this week"*) —
self-counting.

This is exactly the failure the rule names: *N correlated observations are not N observations.*
Ten more threads landing on the word "decorrelation" would add nothing, because they would all be
reading the same docstring.

**And the four-ness is nevertheless real** — established in §2 by the definitions, which is the only
thing that could have established it. Both readings the brief offered were live; the resolution is
that **the word is shared and the estimands are not.** The convergence was worthless as evidence
and the conclusion it pointed at happens to be true.

---

## 2. The verdict: four estimands, with the forcing cases that separate them

| # | thread | estimand | unit of observation | answer key needed | mathematical type |
|---|---|---|---|---|---|
| **M1** | anti-Sybil | operating characteristic: minimum detectable correlation at run length `n` and false-positive rate `delta`, with power | pairs of claimed identities' entropy traces | no | test calibration (bound: provable; achieved power: empirical) |
| **M2** | not-predetermined | bits admitted through the §13 membrane, and the residual not attributable to seed union crossings | crossing events at the channel | no | conservation audit (soundness: provable; residual: **not computable**, §4) |
| **M3** | anti-money | none | n/a | n/a | structural claim over a model of transaction |
| **M4** | graded identity | pairwise **error** correlation `rho` and competence `c` | agent pairs on a **common item set** | **yes** | parameter estimation |

### 2a. M1 vs M4 — agreement correlation does not identify error correlation

This is the separation most likely to be got wrong, because both are called "rho" and both live in
`[-1, 1]`. It is now mechanized rather than argued, in
`src/Core.TypeScript/society/tick-agreement-probe.test.ts` §FORCING CASE:

> Agreement kappa is a function of the **joint label distribution alone**. The Condorcet `rho` that
> `N_eff = N/(1+(N-1)rho)` is defined over is a function of the joint label distribution **and an
> answer key**. Hold the labels fixed, vary only the key: `rho` moves and kappa cannot.

The test constructs 100 windows of fixed labels, computes kappa, then computes the error-indicator
`phi` under two different consistent keys and asserts the two `phi` values differ by more than 0.2
while kappa is bit-identical. **Two quantities that disagree under a transformation one of them is
invariant to are not the same quantity**, and no rescaling connects them.

A first draft of that test asserted something weaker and *false* — that independent errors at
`c = 0.9` yield a large positive agreement kappa. It went red: with disjoint errors kappa is
`-0.053`, correctly below chance. The failure is recorded because it is the interesting part —
on a **binary** task with a shared key the output table *is* the error table, so the two quantities
nearly coincide, and the separation only opens up for **multi-class** labels or **no key at all**.
The live event log is both.

### 2b. M4 vs M2 — decorrelation is not evidence of non-predetermination

The decisive one, and the reason "the accurate meter" cannot be a single instrument.

> **Lemma (independent coordinates).** For any target correlation `rho` in `[0,1]` and any bit count
> `B >= 0`, a fleet exists with pairwise correlation `rho` and exactly `B` bits of metered external
> entropy. Construction: agent `i` emits `f_i(seed) XOR (mask_i AND external)`, with the family
> `{f_i}` chosen to realise `rho` and the external bits either consumed or discarded.

Two consequences, both fatal to the one-measurement reading:

- **`rho = 0` does not prove entropy entered.** Push one seed through two independent-looking
  one-way functions and you get orthogonal outputs with **zero** external entropy. A perfectly
  decorrelated fleet can be entirely predetermined.
- **Metered entropy in does not bound `rho` down.** Admit bits and discard them.

So M2's obligation cannot be discharged by M4's measurement in either direction. Anyone treating
"the accurate meter" as one build is making precisely this error. This lemma is the highest-value
**proof** in the set and it is routed as one in §6.

### 2c. M3 is not a measurement

Its own stated falsifier is *"exhibit a transaction that acquires decorrelation without establishing
correlation"* — a claim about a model of transactions, not a number. Its dependence on "the crossing
being measured" is a dependence on M2's **architecture**, not on any estimate. Saying so plainly is
the deliverable: **M3 is unowned as a measurement because it is not one**, and filing it as a
measurement task would manufacture work that cannot succeed.

---

## 3. The stale sentence — what has already been measured

All four threads report `rho` as UNMEASURED. Since 2026-08-16 the repo has measured a society `rho`
**twice**, with named estimators. Neither is cited by any of the four.

| meter | estimand | method | result | falsifier |
|---|---|---|---|---|
| `src/Core.TypeScript/costume-rho/` | **error** correlation on a shared item set — **this is M4's estimand** | tetrachoric (Pearson 1900; Olsson 1979; Divgi 1979), cluster bootstrap, **pre-registered** readings | within-family `rho-hat = 0.65`, cross-family `0.10`, `D = 0.555`, 95% CI `[0.386, 0.723]`; boundary `rho* = 0.238` at `N = 8` | `validate.ts` recovers known `rho` from the shipped generative model; measures phi's 21–66% under-report |
| `src/Core.TypeScript/society/effective-agent-count.ts` + `db/effective-agent-count/` | ICC(1) on **file-sampling overlap** — a different `rho`, honestly labelled as such | Fisher 1925 / Shrout–Fleiss 1979 ICC(1,1); frame enumerated from git, never from the overlaps | cumulative `rho` 0.6075 at tip; windowed-60 peak 0.8545 | frame-validity assertion fails if the universe is mis-specified; `--verify-head` replays the series bit for bit |

Both meters state their own limits, and both limits are load-bearing here:

- `effective-agent-count.ts` measures **which files agents chose to probe**, not whether they were
  right. Its Kish `nEff` is honest for *"any statistic averaged over files across agents"* and is
  **not** the Condorcet `nEff`. Two different `rho`s, both correct, answering different questions.
- `costume-rho` measured at **7b/8b/9b**. Production runs **0.5b / 1b / 2b**
  (`agent-heartbeat.yml`, `case "$AGENT"`). Small models collapse toward shared priors, so the
  cross-family `0.10` **does not transfer downward** and must not be quoted for the live fleet.

**And the fleet changed underneath the measurement.** In August the costume experiment found the
production path ran *one* model for all three agents — `rho = 1` by construction, not by estimation.
The roster is now heterogeneous by design. But `resolveParticipant` (`run-loop-real.ts:97-111`)
still takes **only the spec string**: `args.by` never reaches the participant, so **no persona is
injected**. The lever that changed is weights; the lever the experiment measured as a costume is
still not pulled. Whether that moved the fleet across `rho* = 0.238` **has never been measured**,
and it is the single cheapest high-value measurement available — the harness exists, the 200-item
set exists, and it runs on local ollama at zero model spend.

---

## 4. The demarcation — what is NOT measurable, stated precisely

Per Aaron's *"what the meter buys exactly is the distinction between which is measurable"*, this
section is a deliverable, not an apology.

**(i) M2's residual is not computable.** *"Output entropy not attributable to seed union metered
crossings"* is `K(output | seed)` — Kolmogorov complexity, uncomputable (Chaitin 1966). Any
estimator is an upper bound via one fixed compressor, and a sufficiently clever unrolling defeats
any fixed compressor. **We can count entropy IN exactly** — it crosses a typed channel and the
channel can count. **We cannot measure novelty OUT.**

The correction this forces is the useful part. Aaron's requirement — *entropy cannot be CLAIMED
without being METERED* — reads as a statistics problem and is not one. It is discharged
**architecturally**: make the metered channel the only door and prove there is no other door. That
is §13 noninterference (Goguen–Meseguer 1982), it is a **static** property, and a lint that goes red
on an undeclared entropy source **is** the falsifier. Routing it to an estimator would produce a
number that cannot be wrong, which is the vacuity class.

**(ii) No `rho` licenses a forward claim.** Both shipped meters say this about themselves. `rho` is
backward-looking over a corpus; there is no estimator for the `rho` the fleet will have next week.

**(iii) Cluster-*discovery* `rho` is blocked; roster-keyed `rho` is not.** `AntiSybil.SourceOf`
numbers components `0 .. DistinctCount-1` **per invocation, over one batch**, so it is neither
stable nor global — the same unresolved identity problem that leaves `TwoTimescaleFold.project`
without a `ReplicaId`. The consequence, stated rather than papered over:

- An estimator that must **discover** which agents are correlated inherits that problem in full and
  is blocked behind it.
- An estimator keyed to an **externally supplied roster** does not. ICC(1) and the tetrachoric
  contrast are computed over exchangeable raters keyed by `matrix.agent` — a declared label, never
  an inferred one. **M4 is unblocked; cluster-discovery `rho` is not, and is not on the M4 path.**

**(iv) For the live event log, `rho` is undefined, not merely different.** `docs/observe-events/`
carries `action.kind` and no correctness field. No answer key exists, so no error correlation
exists. `tick-agreement-probe.test.ts` asserts the event shape so that adding a correctness field
turns the test red and forces the demarcation to be re-argued rather than silently lapsing.

---

## 5. What the live data does support, measured

`src/Core.TypeScript/society/tick-agreement-probe.ts` (this PR) — a **feasibility probe**,
deliberately not a meter. 5318 events, 1049 windows of 900 s, 881 windows carrying all three agents:

| pair | n | `po` | `pe` (own marginals) | **kappa** | uniform-null excess |
|---|---|---|---|---|---|
| alexa \| otto | 906 | 0.7704 | 0.3551 | **0.6440** | 0.7322 |
| alexa \| soraya | 855 | 0.7673 | 0.3579 | **0.6375** | 0.7285 |
| otto \| soraya | 850 | 0.7918 | 0.3587 | **0.6753** | 0.7501 |

Two readings, and only the second is a finding about the society:

1. **`decorrelation-meter.ts`'s null is measurably wrong.** It computes excess against
   `1 / avgMenuSize` — the chance agreement of two **uniform** choosers. Agents are not uniform; the
   action-kind marginal is dominated by one kind, so two *independent* agents with these marginals
   already agree far above `1/k`. The uniform null attributes ordinary marginal skew to coupling and
   **over-reports correlation by ~0.09 absolute on live data**. That is the last column minus kappa.
2. **kappa is not the Condorcet `rho`** — §2a and §4(iv). It is reported so that the number exists
   in a form that cannot be mistaken for one, and the module's docstring, its CLI output line, and a
   test all say so.

Honest limits carried in the module: agents run on separate heartbeat lanes and therefore **do not
face a common menu**, so this is not a comparison of answers to one question; windowing is
last-write-wins; there is no null model, no confounder stratification, no CI. `DecorrelationExcess`
and `DecorrelationExcessFusion` are the instruments that carry those, and this is not one.

### The cautionary example, now with a receipt

`src/Core.TypeScript/observe/decorrelation-meter.ts`: `S = 2 * (1 + coefficient)` is an invented
rescale — a CHSH `S` needs four correlations over two settings per party, and one agreement rate is
one correlation with no settings. Beyond that, verified in this PR:

- **No test file.**
- **No importer.** `rg "from '.*decorrelation-meter'"` over every `.ts` in the tree returns nothing
  (rc=1). It is dead code.
- **Its input does not exist.** It reads `data/tick-reasoning.jsonl`. `tick-reasoning.ts` (merged
  today, PR #14833) writes that path, but the heartbeat commits only `docs/observe-events/`, so the
  file dies with the runner. Every invocation would take the `INSUFFICIENT DATA` branch.
- **Its null is wrong**, by the measured margin above.
- The invented rescale has **leaked into the workflow**: `agent-heartbeat.yml` reasons in its own
  comments that *"With different families, S should exceed 2."*

A meter with no caller, no input, no test and an invented scale is not a starting point.

---

## 6. Routing

Guarding against the known bias first: **`rho` estimation is a statistics problem and must not go to
a prover.** A prover cannot produce a number from data; routing M4 to Lean costs human weeks and
returns zero measurements. The converse guard matters as much: §2b's lemma and §4(i)'s
only-door property are **not** statistics, and routing *them* to an estimator produces a number that
cannot be wrong.

| obligation | provable or empirical | route to | why not the alternative |
|---|---|---|---|
| **M4** `rho-hat` + CI at the **production** model roster | empirical | existing `costume-rho` harness: `run-agents.ts --models qwen2.5:0.5b,llama3.2:1b,gemma2:2b` over `db/costume-rho/items.jsonl`; `estimate-rho.ts` | no prover produces an estimate; the pre-registered readings already exist so the design cannot only yield the encouraging answer |
| **§2b independence lemma** (`rho` and metered-bits are independent coordinates) | **provable** | **Alloy** — finite witness: 2 agents, k bits, exhibit `rho = 0` with `B = 0`; `for 6` | not FsCheck: the claim is existential over constructions, not universal over inputs. Alloy exists to find the witness |
| **§4(i) only-door** (no ambient entropy path outside declared channels) | **provable, statically** | **Semgrep + CodeQL** for the syntactic half (bare `Random`, `Date.now`, `Guid.NewGuid`, `Task.Run` off declared channels); **TLA+** only if the dynamic half is wanted | this is the whole correction to "estimate the residual"; a lint that fails on an undeclared source **is** the falsifier |
| Kish / `N_eff` algebra: monotone decreasing in `rho`, limit `1/rho`, `nEff <= n` | **provable** | **Z3** `.smt2` + `.test.ts`, matching the nine files already in `tools/Z3Verify/` | pure real arithmetic after clearing denominators; Lean is overkill for a two-variable inequality and FsCheck can only sample |
| estimator invariants: ICC(1) range, `rho=0 => nEff=n`, `rho=1 => nEff=1`, tetrachoric >= phi under skew | property | **FsCheck** (`tests/Tests.FSharp/`), cross-checked by the Z3 lemma above | this is the house **BP-16** pattern already used for `classifyBand`: FsCheck witness first, Z3 lemma second |
| **M1** detection floor: minimum detectable correlation at `(n, delta)` with power | **empirical** | seeded Monte Carlo over `AntiSybil.correlation` / `DecorrelationExcess` against a known-`rho` generator; report the ROC | the *bound* is provable and `chshMargin` already is one — but a bound is not the achieved power on autocorrelated streams. Routing this to Z3 yields a floor nobody can attain |
| CHSH margin soundness (`chshMarginAutocorr >= chshMargin`) | provable | **already discharged** — obligations (a)/(b)/(c) + `tools/Z3Verify/chsh-band-gate-agreement-lemma.smt2` | no action |
| **M3** anti-money | neither | **Alloy** if anyone wants it: `run { some t: Transaction \| acquires[t, decorrelation] and not establishes[t, correlation] } for 6` | never Lean. A counterexample kills it cheaply; no counterexample in scope 6 is weak evidence, labelled as such |

**The wrong-tool cost, named per the tone contract:** route M4 to a prover and you spend weeks
encoding a statistic and end with no reading. Route §4(i) to a statistic and you ship a residual
estimator that cannot be falsified — a green CI that measures nothing, which is worse than no CI.
Route M1 to Z3 and you get a Hoeffding bound (you already have one) instead of the operating
characteristic the peel actually asks for.

---

## 7. Falsifiers

Per `.claude/rules/toy-is-free-metered-must-be-earned.md`, each item below is the test that fails
when the estimate is wrong. F2 and F3 ship in this PR and are verified.

| id | for | the falsifier | status |
|---|---|---|---|
| **F1** | M4 | synthetic recovery: draw from `SocietyUsefulWork.simulateHeterogeneous` at known `rho` in `{0, 0.2, 0.4, 0.65, 0.9}`; require `rho-hat` within the bootstrap CI on >= 95% of seeds. An estimator that cannot recover a known `rho` from its own generative model is refuted | partly exists (`costume-rho/validate.ts`); extend to the production roster |
| **F2** | the null | **sabotage control**, reconstructing the *actual* `decorrelation-meter.ts` defect: swap the marginal `pe` for `1/kinds` inside `pairAgreement` and require the suite to go RED | **verified** — sabotaged run 8 pass / 1 fail, the failing test is the control; restored 9 pass / 0 fail |
| **F3** | the demarcation | non-identifiability: fixed labels, two answer keys, `abs(phi1 - phi2) > 0.2` while kappa is invariant | **shipped, green** |
| **F4** | M1 | two-sided ROC: a pair at correlation just **below** the claimed floor is convicted at most `delta` of the time; a pair just **above** is convicted at >= the claimed power. Either side failing refutes the curve | unowned |
| **F5** | M2 | sabotage control: add a bare ambient entropy source on a metered path and require the only-door lint to go RED | unowned |
| **F6** | the stale sentence | a lint that fails when `SocietyUsefulWork.fs`'s UNMEASURED note and register row 15's A-method note do not cite the shipped measurements | unowned |

### What would make M4's measurement wrong

Ranked by likelihood, since the brief asked for this specifically:

1. **Wrong estimand** — using agreement or kappa where Condorcet needs error correlation. §2a. The
   most likely error in the set, and it is why F3 exists.
2. **Wrong null** — `1/menuSize` instead of the marginal product. Inflates excess by ~0.09 on live
   data (§5).
3. **Attenuation** — phi instead of tetrachoric on skewed marginals. `validate.ts` measures the
   under-report at 21–66% on this repo's own generative model. Under-reporting `rho` biases every
   verdict toward *"the society clears the bar"* — the flattering answer.
4. **Harness-manufactured agreement** — fallback-to-index-0 makes two silent models agree perfectly.
   `run-agents.ts` records `fallback`; the estimate must be reported with and without.
5. **Non-shared item set** — production agents face different menus, so an agreement statistic over
   production ticks is not identified. This is why the counterfactual harness exists.
6. **Cluster dependence** — items within a stratum are dependent; an i.i.d. CI overstates precision.
   Cluster-bootstrap by stratum, or the HAC `n_eff` already in `AntiSybil`.
7. **Frame circularity** — estimating the universe from the overlaps you are about to test
   independence on. `effective-agent-count.ts` names and refuses this; any new estimator must too.
8. **Forward extrapolation** — see §4(ii).

---

## 8. Filed

| work item | what |
|---|---|
| `081M0TJY389087G0R000TTF41C` | **M4** — re-run `costume-rho` at the production roster (0.5b/1b/2b), not 7b/8b/9b. **Rank 1**: unblocks the only claim that prices the fleet |
| `081M0TJY368087G0R000DVSWMM` | **M1** — the detection-resolution ROC for `AntiSybil`. **Rank 2**: unblocks every outward Sybil-resistance claim |
| `081M0TJY37A087G0R0026BQBBC` | **M2** — the only-door noninterference lint. **Rank 3**: converts an uncomputable residual into a static check |
| `081M0TJY39B087G0R0033PSEPF` | prereq — persist `data/tick-reasoning.jsonl`; the heartbeat writes it and throws it away |
| `081M0TJY3A9087G0R00116ZB6K` | `decorrelation-meter.ts` — dead code, invented rescale, wrong null. Delete, or reduce to `correlationExcess` against the marginal null with a test |

**M3 is deliberately not filed as a measurement.** It is a structural claim; §6 gives it an Alloy
route if anyone wants one.

---

## 9. Register

`metered` — §3's quoted results (read from committed files), §5's kappa table (produced by the
committed probe), and F2/F3 (run, with the sabotage control verified red-then-green).
`structural` — §2's verdict and its lemma, argued from definitions and mechanized where mechanizable.
`toy` — nothing here estimates the society's Condorcet `rho`; §5 measures agreement, which §2a proves
is a different quantity. The routing table in §6 is a recommendation.

---

## Pointers

- `src/Core/AntiSybil.fs` — thread 1: the pigeonhole claim and its detection/length peel
- `src/Core/SocietyUsefulWork.fs` — the UNMEASURED docstring all four threads inherit
- `src/Bayesian/CondorcetBoundary.fs` — `N_eff = N/(1+(N-1)rho)` and the `1/rho` cap
- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §A row 15 — the A-method note that is the single source
- `docs/research/2026-08-16-the-costume-experiment-persona-differentiation-measured-not-a-decorrelation-lever.md` — the M4-shaped measurement none of the four threads cites
- `db/effective-agent-count/README.md` — the 751-row `rho` series, and its own limits
- `src/Core.TypeScript/costume-rho/` — tetrachoric estimator, pre-registered readings, `validate.ts`
- `src/Core.TypeScript/society/tick-agreement-probe.ts` — this PR's feasibility probe and its falsifiers
- `src/Core.TypeScript/observe/decorrelation-meter.ts` — the cautionary example
- `.claude/rules/numerology-vs-number-theory.md` — §1 is this rule applied to the brief itself
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — §7's requirement
- Cohen (1960) kappa; Kish (1965) design effect; Shrout & Fleiss (1979) ICC(1,1); Pearson (1900) /
  Olsson (1979) tetrachoric; Ladha (1992) correlated jurors; Goguen & Meseguer (1982)
  noninterference; Chaitin (1966) — why §4(i)'s residual is uncomputable
