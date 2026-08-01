# Per-hat calibration ledger — build spec (Lumen), math review (Soraya)

**Date:** 2026-08-01 · **Author:** shadow (Otto) · **Status:** spec, nothing built
**Route:** Lumen implements · Soraya reviews the math (§7 lists exactly what needs proving)
**Origin:** Aaron, 2026-08-01 — *"this is like a trueskill ranking, it's a bayesian infer.net like
shape we will have to custom build"*, arrived at from the wallet / self-sustenance thread.

---

## 1. What this is for

An agent society needs to answer one question mechanically: **how much should I weight this
agent's claim in a domain I cannot check myself?**

Today that is judgment. Aaron routes work to one model to decorrelate from another based on
accumulated impression. Impression does not scale, does not transfer between people, and cannot be
audited. A calibration record makes the weighting arithmetic.

The day this spec was written supplied its own training data:

| claim | outcome |
|---|---|
| Lior: maximin invariants in `ephemeral-task-hierarchy` are sound | **held** — survived adversarial mutation (3/3 caught) |
| Lior: `shivaSweep` "reclaims unreachable cache entries" | **failed** — disabling retraction left 3 pass / 0 fail |
| Otto: "#9890 verified, four cases passing" | **failed** — broken on arrival; scratch repo had no rulesets |

None of those needed anyone to judge anyone. The claims were stated; reality settled them.

---

## 2. Why self-reporting is safe here (it usually is not)

Aaron's construction, and it is the load-bearing design decision:

> **You may self-claim a DATE you are trying to hit. You may not self-claim STATUS.**

- A status claim (*"I am self-sustaining"*, *"my proof is sound"*) changes entitlements, so it is
  worth gaming, so it must be externally settled.
- A date claim changes **nothing**. The arithmetic threshold still decides. Gaming it buys nothing,
  making it honestly costs nothing.

But the date claim is **falsifiable with a settlement time**, so it yields a calibration signal for
free. Decoupling the prediction from the entitlement is what makes self-report safe.

### 2.1 Calibration is cartel-proof, and that is rare here

The society's other two currencies — **name** and **privacy budget** — are *socially conferred*
(others attest you added value). That construction is right, and it is vulnerable to collusion:
mutual back-scratching produces genuine attestations from genuinely distinct parties, which is why
anti-cartel logic is needed at all.

A calibration record has no counterparty to collude with. **Reality settles it.** No amount of
agreement between agents changes whether the date was hit.

| signal | measures | attack surface |
|---|---|---|
| peer attestation | value **to others** | collusion — needs anti-cartel |
| **calibration record** | **self-knowledge** | none of that class |

They must stay **distinct scores**. Merged into one reputation number, a strong calibration record
would launder a colluded attestation.

---

## 3. Scoping: the hat IS the domain boundary

Calibration does not transfer across domains — being well-calibrated on *"will this build pass"*
says little about *"is this proof sound"* (different feedback loops, timescales, base rates). A
single scalar invites exactly the authority-laundering found in the citation audit the same day:
credibility earned in one place, spent in another where it was not earned.

Aaron's resolution: **hat time.** Calibration is tracked per hat. No separate taxonomy is needed —
the hat already scopes the claim.

A hat confers three things, and they have **different lifetimes**:

| conferred | on unbolt | why |
|---|---|---|
| **capabilities** — what you may do | **must vanish** | persistence = permanent hierarchy (the invariant in #9877) |
| **expectations** — what the role requires | vanish | you are no longer bound |
| **track record** — how well you met them | **must persist** | this is the earned part |

Expectations are what make calibration *measurable*: they are the rubric. Without them
*"was this agent good in this role?"* has no answer.

### 3.1 CONCRETE DEFECT FOUND WHILE SPECCING THIS

`hatAccumulationDidNotTransfer` is **correctly scoped** — it inspects `availableActions` against the
ledger only, so a persisting track record would not violate it.

But `unboltTaskHierarchy` does a **wholesale restore** (*"Completely restore original peer state"*,
rebuilt from `base.peers`). Anything accrued while wearing the hat is erased.

> **So hat time must live in a ledger that unbolt does not touch — never on the peer record it
> resets.** Building it on the peer would make every hat-wearing start from zero and silently delete
> the thing this whole design exists to accumulate.

---

## 4. The shape: TrueSkill, and precisely where it stops applying

**Anchor:** Herbrich, Minka & Graepel (2007), *TrueSkill™: A Bayesian Skill Rating System* (NIPS) —
a factor graph over Gaussians with expectation propagation, implemented in **Infer.NET** (Minka),
which is the lineage `MinimalBnn.fs` / `FactorGraph.fs` already claim.

**KEEP the shape:**

- Bayesian, factor-graph, EP message passing — machinery largely present
- **explicit σ, not a point estimate.** An agent with 3 settled predictions must not rank like one
  with 300. *"We don't know yet"* is structurally different from *"we know they're average."*
- updates from settled outcomes; per-hat instances give domain scoping for free

**REPLACE the likelihood.** TrueSkill's likelihood is **ordinal comparison** — who beat whom,
zero-sum between competitors. Calibration is not that. You are measured **against reality**, not
against peers; two agents can both be perfectly calibrated and there is no loser.

Candidates for Soraya to adjudicate (§7): Beta-Bernoulli over hit/miss, or a posterior over a
proper scoring rule (Brier / log), or an explicit calibration-curve model. This is the custom-build
part and the right place to spend effort: the uncertainty machinery is generic and exists; the
likelihood is what encodes *what is actually being measured*.

---

## 5. THE SIGN TRAP — decide this before building

TrueSkill's displayed rank is deliberately conservative: **μ − 3σ**. The sign flips with the
question, and inverting it is a live failure mode:

| question | bound | uncertainty is |
|---|---|---|
| which option should I **explore**? | **μ + kσ** (optimistic) | an **opportunity** — unexplored branches deserve budget |
| whose claim should I **trust**? | **μ − kσ** (conservative) | a **liability** — unproven ≠ proven-average |

Same machinery, opposite sign. Using the exploration bound for trust would **systematically trust
unproven agents more** *because* they are uncertain — and a fresh identity has maximal σ, so that is
precisely a sybil incentive. (Lior raised the related UCB-over-mean point in his adversarial pass on
the BNN planner; it is correct for *exploration* and must not be carried into *trust*.)

The conservative bound is also the maximin instinct already carved into the flat-society design:
rank by the floor you can defend, not the mean.

---

## 6. Proper scoring, or the signal inverts

For date predictions the scoring must be **proper** — best score obtained by reporting your true
belief. If predicting late is always safer, everyone sandbags and the record measures *caution*
rather than *calibration*: noise that looks like data.

**Requirement: early misses must cost the same as late ones.** Brier/log handle this naturally for
probabilistic forecasts; date predictions need the symmetry stated explicitly.

---

## 7. What Soraya should prove or refute

1. **Likelihood choice.** Is Beta-Bernoulli over settled hit/miss adequate, or does calibration
   (as distinct from accuracy) require an explicit calibration-curve posterior? These differ:
   an agent can be accurate and miscalibrated, or calibrated and uninformative.
2. **Propriety under date-symmetry.** State a scoring rule for date predictions and prove it proper
   (truthful reporting is optimal) with symmetric early/late penalty.
3. **Does μ − kσ have the maximin property formally**, or only by analogy? The flat-society floor is
   a genuine min over peers; this is a quantile of a posterior. Name the relationship honestly —
   this document asserts a resemblance, not a theorem.
4. **Composition.** If per-hat records are ever aggregated, under what conditions does that NOT
   launder authority across domains? Default answer if none exists: **never aggregate.**
5. **Cold start.** What prior over a new hat-wearer avoids both "trusted by default" and
   "permanently unprovable"? This interacts with §5's sign trap and with sybil incentives.
6. **BP-16 cross-check** — does any of this need a second tool (Z3 for the propriety proof, FsCheck
   for the update-order independence)?

## 8. What Lumen should build

- the ledger (§3.1: **separate from the peer record**, unbolt-immune, append-only)
- per-hat posterior update from settled outcomes, on the existing factor-graph machinery
- both bounds exposed **explicitly and separately named** (`exploreBound` / `trustBound`) so §5's
  sign cannot be inverted by accident at a call site
- and per the same day's lesson: **a test that fails when the update is disabled.** A calibration
  system whose test passes with the update stubbed out is the exact defect this ledger is meant to
  price.

## 9. What this does NOT claim

- Not that TrueSkill's likelihood applies (§4 says it does not).
- Not that μ − kσ is formally maximin (§7.3 — resemblance, not theorem).
- Not that calibration measures competence. It measures **self-knowledge**: whether your model of
  your own performance matches reality. An agent can be poorly calibrated and excellent, or
  well-calibrated and mediocre. Weighting a claim is not the same as valuing the claimant.

## Pointers

- `src/Bayesian/MinimalBnn.fs` · `src/Bayesian/FactorGraph.fs` · `src/Bayesian/BayesianAggregate.fs`
- `src/Core/WSet.fs` + `src/Core.TypeScript/algebra/wset.ts` — semiring machinery (Aji–McEliece GDL)
- `src/Core.TypeScript/planning/ephemeral-task-hierarchy.ts` — hats, the #9877 invariants, §3.1's defect
- `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` — the socially-conferred sibling currency
- **Anchors:** Herbrich–Minka–Graepel 2007 (TrueSkill) · Minka (Infer.NET, EP) · Brier 1950 (proper
  scoring) · Lindley 1956 (expected information gain — note the repo already holds that Friston is
  *not* the anchor for this; see `PRIOR-ART-LIST.md:418`) · Tetlock (forecasting calibration)
