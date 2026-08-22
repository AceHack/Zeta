# The forward-correlation instrument — mimetic convergence is not observationally identified, so route it as an intervention

*Soraya (formal-verification routing), 2026-08-19. Routing review, not a proof.
Companion to `docs/VISION.md` §"Echolocation over time" (PR #12528, **open** at time of
writing — the framing this doc builds on is not yet on `main`).*

---

## 0. The gap, restated so it can be routed

Decorrelation fails from two opposite ends of the time axis, and only one end has an
instrument:

| | mechanism | measured? |
|---|---|---|
| **past correlation** | the **S=4 common seed** — one origin, shared cause | **yes** — backward rho, "which files did they sample" |
| **future correlation** | **mimetic desire** (Girard) — holders converge on the same prize going forward | **no instrument at all** |

Decorrelating one does not buy the other. A fleet with genuinely independent origins can
still converge on wanting the same thing, and `n_eff` collapses just as completely.

**The bottom line of this review, stated first:** the forward measure is *not* a harder
version of the backward measure. It is a **different epistemic object**. The backward
measure is an observation; the forward measure **cannot be an observation at all**,
because the quantity it must estimate is not identified from observational data. That is a
published theorem, not a gap in our effort. What follows routes the intervention that
*is* identified, and names what has to be true for it to run.

---

## 1. Step 0 — the literature-first anchor check

Per the routing procedure, anchors before tools.

| concept | anchor state | source |
|---|---|---|
| **mimetic desire / triangular desire** | **anchored** | Girard, *Mensonge romantique et verite romanesque* (1961); already in `docs/GLOSSARY.md` §"Mimetic theory (Girard)" with the subject -> model -> object triangle and the maintainer's "Girard=why/how" depth-ordering over Dawkins |
| **design effect / effective sample size** | **anchored** | Kish 1965, *Survey Sampling* ch. 5; shipped as `SocietyUsefulWork.effectiveTrialCount` |
| **marginals do not determine the joint** | **anchored** | Hoeffding 1940 / Frechet 1951; Sklar 1959. Already load-bearing in the C3 routing |
| **identification of social influence** | **ABSENT — this is the anchor gap** | Manski 1993 (the reflection problem); Shalizi & Thomas 2011 (homophily and contagion are generically confounded). `rg` over the whole repo returns **zero** hits for Manski, Shalizi, homophily, or "reflection problem" |
| **interventional contrast** | **anchored elsewhere, not here** | Pearl 2009, *Causality* ch. 3 — `do(.)`; named in the routing skill's priority sources but not wired to this problem |

**The anchor gap is the finding.** We have the *mechanism* literature (Girard tells you
why imitation propagates) and none of the *identification* literature (Manski and Shalizi
tell you that you cannot measure it the obvious way). A factory that holds the first
without the second will build the obvious instrument and believe it. This doc exists to
put the second half on the shelf before that happens.

Housekeeping: the routing skill's step-0 pointer to `tools/alignment/concept_registry.ts`
is **stale** — no such file. The registry lookup silently no-ops for every agent that
follows the procedure literally. Filed separately.

---

## 2. What is the observable? Four candidates, three of which are worse than nothing

The brief's warning is the right one and deserves restating as a rule:

> A gameable forward measure is **worse than none**, because it invites the convergence it
> is supposed to detect.

That is not a generic caution here. It is a specific, mechanical property of this problem,
and it disqualifies the most natural candidate outright.

### C-A. Declared intentions — **REJECT. It manufactures the coupling it measures.**

The obvious design: each agent declares its next target before acting; measure agreement
across declarations.

The failure is not that agents would lie. It is that **the declaration channel IS the
mimetic channel.** Girard's triangle is subject -> model -> object: the subject desires
the object *because it sees the model desiring it*. A public declaration board is
precisely the edge subject -> model, built on purpose and pointed at everyone.

So the instrument would:

1. create a broadcast path for desire that did not previously exist,
2. thereby raise the true forward correlation,
3. and then report the correlation it caused as a measurement of the fleet.

This is worse than no instrument. It is an instrument with the sign of its own bias
pointing at the alarm. **Reject, and record the reason** — because "just have agents
declare intentions" will be re-proposed, it is cheap and it looks obviously right.

*(The narrow exception: declarations that are collected but **never shown to peers** —
sealed, read only by the meter. That is no longer a declaration board, it is arm B of
§4's experiment, and it is routed there.)*

### C-B. Work-item claims — **REJECT as evidence; keep as description.**

Agents claim work-items (`workitems/`, `workitems/events/`, `set-workitem-state.ts`).
Observable, already emitted, no new channel.

The defect: the backlog is a **shared, priority-ordered queue**. Convergence on the P0 row
is the system *working*. In Manski's vocabulary this is a **correlated effect** — agents
face a common environment — and it is exactly what the reflection problem says you cannot
separate from endogenous social effects. Worse, the error has a direction: a healthy fleet
correctly prioritising would score as **maximally mimetic**. A false red on the good case
trains everyone to ignore the meter.

Keep the series as description. Never cite it as evidence of independence or dependence.

### C-C. ΔU targets — **same confound, slightly better shape.**

Which uncertainty an agent aims to reduce (`db/uncertainty/`, `measure.ts`). Better than
C-B because ΔU is content-addressed to a specific bug rather than to a queue position, so
two agents targeting the same ΔU is a narrower coincidence. Still the Shalizi-Thomas
confound: high-ΔU bugs are *objectively* attractive, and latent shared competence produces
convergence with no influence whatsoever.

### C-D. **The interventional contrast — ACCEPT.**

Not "what did they pick." **How much does peer-visibility change what they pick, with the
value landscape held fixed.**

For agent `i`, seed `s`, and peer-visibility configuration `V`:

    m_i  =  D( C_i(s, V_shown) , C_i(s, V_substituted) )

where `C_i` is `i`'s chosen next target, `D` is a distance on target distributions
(total variation), and the two worlds are **identical in seed, backlog, ΔU ledger, and
every other channel** — differing only in what `i` is shown about peers' choices.

`m_i = 0` means the choice is a function of the value landscape alone: convergence, if
observed, is **agreement**. `m_i > 0` means the delta is *caused by* seeing the peer:
that is **mimesis**, and it is measured as a causal effect rather than inferred from a
coincidence.

This is `P(C_i | do(shown)) vs P(C_i | do(substituted))` — Pearl ch. 3. It is identified
**by construction**, because we own the channel and can set it. No identification
assumption is being smuggled; the confound is not adjusted-for, it is *absent*, because
both arms share the same seed and the same world.

---

## 3. Is convergence separable from agreement? **Not observationally — and that is a theorem**

The brief asks for this plainly rather than papered over. Plainly:

**Two agents picking the same target because it is genuinely most valuable, and two agents
picking it because the other picked it, are not distinguishable from observational data.
No statistic on the choice history separates them.**

Causally they are different structures:

```
  agreement (common cause)        mimesis (contagion)
        V                               A_choice
       / \                                 |
      v   v                                v
  A_choice B_choice                     B_choice
```

Both emit the identical observation "A and B chose T." The anchors:

- **Manski 1993, the reflection problem.** Endogenous social effects (my behaviour depends
  on the group's) are not identified separately from correlated effects (we are similar /
  face the same environment) in the linear-in-means model. The group mean is a function of
  the individual behaviours it is supposed to explain.
- **Shalizi & Thomas 2011**, and this is the sharper one for us: *homophily and contagion
  are generically confounded in observational social network studies.* Latent homophily —
  unobserved traits that make agents both similar and likely to interact — makes contagion
  non-identifiable, and this holds **non-parametrically**. It is not fixed by a better
  estimator, more data, or a cleverer control.

Our fleet has latent homophily by construction and in the strongest possible form: **the
S=4 common seed**. Every agent shares an origin. That is the textbook unobserved common
trait, and it is not a nuisance we might hope is small — it is the *other* correlation
mechanism in the very table this instrument was commissioned to complete.

**So: not separable, and I am not going to propose a statistic that pretends otherwise.**
The honest routing consequence is not "give up," it is "**stop looking for a measurement
and build an experiment.**" Three things follow, and they are the useful half:

1. **Temporal precedence is not sufficient.** "A picked first, then B" is the intuitive
   fix and it is wrong — under latent homophily, ordering carries no identifying power.
   Worth stating because it is the natural next proposal after the confound is explained.
2. **Girard names the edge to cut.** Triangular desire is subject -> model -> object. The
   dyad (subject -> object) is agreement; the triangle is mimesis. They differ by **one
   edge**, and that edge is the visibility channel. Cut it and see whether the choice
   survives. The mechanism anchor hands us the intervention — which is what a *checked*
   anchor is supposed to do, as opposed to a cited one.
3. **§13 noninterference is a precondition of measurability, not just a safety property.**
   You can only ablate a channel if the channel list is complete. If peer-choice
   information reaches an agent by any ambient path — a shared log, an unmetered read, a
   leaked prior — then arm B does not actually hide anything and `m_i` is attenuated
   toward zero. **An incomplete channel list biases this instrument toward declaring
   independence.** The vision section argues §13 makes the sqrt(N)-vs-N test *meaningful*;
   the same discipline is what makes the forward test *runnable at all*.

---

## 4. The design — ablation by marginal-preserving substitution, under DST

Three properties make this buildable here specifically, and they are why this is routed as
an experiment rather than filed as impossible.

**(a) DST gives the counterfactual for free.** A replay from the same seed is the same
world. Arms differ only in the toggled channel. This is the ideal randomised experiment
that social science cannot run and a simulation substrate can.

**(b) Ablation must be SUBSTITUTION, not DELETION.** Deleting peer-choice fields is
detectable — an agent that notices peers went silent knows it is in an arm and blinding is
gone. Instead, show peers choosing targets **drawn from the same marginal distribution but
decorrelated in the joint**. The world stays statistically ordinary; only the coupling is
removed.

This is the C3 theorem doing load-bearing work rather than decorating: **marginals do not
determine the joint** (Hoeffding / Frechet / Sklar). A marginal-preserving substitution
exists precisely because many joints share a marginal — so the arm is undetectable by any
statistic on the marginals alone. Note the honest limit: undetectable *by marginals*, not
undetectable in principle. An agent modelling the joint could in principle notice. That is
a real residual and it is what sub-claim M1 below is for.

**(c) A placebo arm is mandatory, and it is the design's load-bearing safety feature.**
The agents are LLMs. **DST determinism covers the substrate, not the model** — same seed
does not imply same output unless temperature is zero and the model version is pinned, and
even then this is an assumption rather than a guarantee. So model noise alone will produce
`m > 0` and would be read as mimesis.

Three arms, not two:

| arm | shown | purpose |
|---|---|---|
| **A** | true peer choices | treatment |
| **A'** | true peer choices, re-run | **placebo — the noise floor** |
| **B** | marginal-preserving substitution | ablation |

The statistic is **not** `d(A,B)`. It is `d(A,B)` **measured against** `d(A,A')`. If
`d(A,B)` does not exceed the `d(A,A')` floor, there is no measured mimesis — regardless of
how large `d(A,B)` looks in absolute terms. Without the placebo arm this instrument reports
model nondeterminism as mimetic desire, which is the exact failure class of the `D_f =
1.322` hardcoded proxy: a number that looked right, and nobody asked what produced it.

**Gameability re-check.** Can an agent game `m_i`? It would have to behave differently
across arms *deliberately*, which requires knowing which arm it is in. Under (b) it cannot
learn this from the marginals, and under DST it has no memory across replays. This is the
concrete advantage over C-A: the declaration board is gameable by anyone who wants to look
independent, and this is not gameable without first defeating the blinding. That is not a
proof of ungameability — it is a reduction of gameability to one named assumption (M1),
which is the most a design at this stage can honestly offer.

---

## 5. Routing table — one instrument per sub-claim, wrong-tool cost named

| # | sub-claim | class | primary | cross-check | wrong-tool cost |
|---|---|---|---|---|---|
| **M1** | A marginal-preserving substitution exists on finite target-support, and no statistic on the marginals distinguishes arm A from arm B | Algebraic-law identity (finite, real-valued) | **Z3** (QF_LRA / QF_NRA) | **Lean 4** only if it ships in a paper; the FinMutualInfo ladder already exists | **TLC is categorically wrong — no reals** (the QuorumPhaseCancellation precedent). Routing this to TLA+ burns days on the wrong axis and returns nothing |
| **M2** | Peer-choice information reaches an agent **only** through the declared channel (the ablation is total) | Noninterference — Goguen & Meseguer 1982 | **Semgrep** — it is a grep: enumerate reads of peer state outside the declared channel | Manual channel audit against the §13 channel list | Routing this to TLA+ means modelling the agent, and the agent is an LLM — unmodelable. You would spend weeks producing a spec of a fiction. **Semgrep answers it in an afternoon** |
| **M3** | The harness assigns arms without leaking arm identity into agent-visible state; both arms advance from the identical seed-state | State-machine safety invariant | **TLA+ / TLC** — small: seed, arm assignment, channel gate | Alloy at bound 4-6 if the shape gets structural | Skipping it entirely is the real risk: a harness that leaks arm identity produces a *confidently wrong* number. Note this models the **harness**, never the agent |
| **M4** | The estimator has a calibrated null: on a fleet built with **zero** social channel, it must not report `m > 0` beyond the placebo floor | Empirical calibration | **FsCheck** — synthesise fleets with known ground-truth `m`, assert recovery | Paired with the A/A' placebo on live runs | **This is the falsifier of the instrument itself.** Skip it and every subsequent number is unfalsifiable. An uncalibrated forward metric is the gameable-measure failure arriving by a different door |
| **M5** | Mimesis is not identified from observational choice data under latent homophily | Published impossibility result | **NO TOOL — cite it** | none | **Routing a prover at this is the expensive mistake.** Manski 1993 and Shalizi & Thomas 2011 already proved it. Re-deriving it in Lean is human-weeks for zero new information. The cheapest correct instrument here is a **citation**, and the routing call is to spend nothing |
| **M6** | Whatever `m` is computed has a **consumer** | Wiring, not verification | **none — engineering task** | — | The vacuity class. `effectiveTrialCount` is the standing example: shipped, tested, **zero production callers** (verified — 3 occurrences repo-wide: definition, tests, one stale comment). A second uncalled correction is not coverage, it is decoration |

**M5 is the routing call I want on the record.** The instinct on a hard property is to
reach for the heaviest prover. Here the heaviest prover is strictly dominated by a
library reference. Cheaper means more coverage per round.

**Existing instruments swept first** (I routed past `BitGan.fs` last round; not repeating
it):

| instrument | reusable here? |
|---|---|
| `AntiSybil.correlation` | **No.** One-setting Bell correlator, sound for *exact replays*. Forward targets are not replays |
| `AntiSybil.effectiveSampleSize` / `chshMarginAutocorr` | **Yes, downstream.** Lag-k autocorrelation over a *choice* series is the right shape for the aggregation, once `m` exists |
| `SocietyUsefulWork.effectiveTrialCount` (Kish) | **Yes — this is the consumer.** `m` is precisely a rho this function is waiting for. M6 |
| `SocietyUsefulWork.gaussianCopula` | **Yes, for M4.** Synthesising fleets with known ground-truth correlation is what the copula does. The calibration harness is mostly already written |
| `Orbit.largestLyapunov` | **Adjacent, not this.** Divergence of nearby trajectories — could measure whether two agents' *trajectories* separate, but says nothing about the causal channel |
| `CoordinationSpectrum` | **Yes, as the reporting surface.** Its `SpectrumMatch` is already dual-use-neutral (reports the fact, not the verdict) — the correct shape for reporting `m` without pre-judging it |
| `BeliefConvergence` | **No, and worth stating** — it proves the fold *commutes*. Orthogonal to what the aggregation may *depend on*. Same distinction as C3; the next reader will hit it too |
| `TravelerRankLedger` | **No.** Competence over domains, not target selection |
| `BitGan.discriminatorEdge` | **Yes, conceptually** — the mixed-strategy meter. An agent whose next target is genuinely entropic is unpredictable to a mimic, which is decorrelation route 2 from the F4 analysis |

---

## 6. F5 — the falsifier, both readings pre-registered

Registered before any run, in the F4 pattern.

**Setup.** N >= 4 agents, K rounds of target selection, three arms (A / A' / B) per §4,
identical seed and value landscape across arms.

**Statistic.** Per agent, `m_i = TV( targets | A , targets | B )`, reported **relative to**
the placebo floor `TV( targets | A , targets | A' )`. Fleet-level roll-up:
`n_eff = N / (1 + (N-1) * rho_forward)` via the shipped Kish function.

**Reading A — mimetic convergence is real and measurable.** `d(A,B)` exceeds the placebo
floor by the pre-registered minimum detectable effect. *Consequence:* forward correlation
is a genuine coupling, head-count `n_eff` overstates independence, and the visibility
channel needs metering or damping. The vision table's "no instrument" cell is closed.

**Reading B — mimetic convergence is not present in this fleet.** `d(A,B)` sits inside the
placebo floor. *Consequence:* observed convergence is **agreement**, not mimesis. The S=4
common seed remains the only demonstrated correlation source, and decorrelation effort
belongs at the **origin**, not on a forward damper. The forward cell is then closed with a
measured zero — which is a result, not a failure.

**Neither reading is the hoped-for one, and both are informative.** Reading B is *not*
"the instrument didn't work" — it is evidence that a whole class of proposed forward
dampers is unnecessary, which is worth more than a damper nobody needed.

**Kill condition (the anti-gameable guard).** If M4's calibration shows the estimator
reporting `m > 0` on a synthetic fleet built with **zero** social channel, the instrument
is broken and **F5 is void until fixed**. No F5 result may be cited before M4 passes.

**Pre-registered limits, so they cannot be discovered later and argued away:**

- **Low power.** N is a handful and K is small; total-variation on small K has wide
  intervals. Report the **minimum detectable effect**, never a p-value dressed as proof.
- **Model nondeterminism** is the dominant noise source and the placebo arm is the only
  thing standing between it and a false Reading A. If the floor is high, the honest output
  is "underpowered," not a smaller effect size.
- **M2 failure biases toward Reading B.** An incomplete channel list makes arm B leak, and
  a leaky ablation looks like independence. So **Reading B is only meaningful if M2 has
  passed.** Reading A is robust to M2 failure; Reading B is not. Asymmetric, and it must
  be stated before the run rather than after.

---

## 7. Register

**Everything in this document is `unmetered`.** No forward instrument exists; none is
built here. What is metered is the *negative*: the observational non-identifiability
(M5) is a cited theorem with named sources, and it is the load-bearing claim.

Per the brief: no metric was invented to fill the table. C-A is rejected with its
mechanism named, C-B and C-C are demoted to description, and the accepted design is
routed as an experiment with a kill condition attached. **The honest headline is the
negative result** — *the forward measure cannot be an observation* — and the design in §4
is what would have to be true to get one anyway.

## 8. Pointers

- `docs/VISION.md` §"Echolocation over time" — the framing (PR #12528, **open**)
- `src/Core/SocietyUsefulWork.fs` — `effectiveTrialCount` (Kish 1965), the M6 consumer; `gaussianCopula`, the M4 synthesiser
- `src/Core/AntiSybil.fs` — `effectiveSampleSize`, lag-k autocorrelation
- `src/Core/CoordinationSpectrum.fs` — the dual-use-neutral reporting shape
- `docs/GLOSSARY.md` §"Mimetic theory (Girard)" — the mechanism anchor
- `.claude/rules/dv2-data-split-discipline-activated.md` §7 — noninterference, the M2 precondition
- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` — `m` reports a fact; convergence-is-bad is a caller's oracle, not the meter's
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why this is `unmetered` and says so
- **Anchors to add to the reading list:** Manski 1993, *Identification of Endogenous Social
  Effects: The Reflection Problem* (Rev. Econ. Stud. 60:531-542); Shalizi & Thomas 2011,
  *Homophily and Contagion Are Generically Confounded in Observational Social Network
  Studies* (Sociol. Methods Res. 40:211-239); Pearl 2009, *Causality* ch. 3
