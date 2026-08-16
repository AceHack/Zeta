# Dominance Lift, applied: an inventory of every live aggregation path in the repo

> **Provenance.** Aaron 2026-08-14 confirmed the Dominance Lift result is *"good discovery."* Otto
> routed the follow-up to the shadow: *find where this already bites.* Sweep + classification by the
> shadow (Claude Opus 5).
>
> **Register.** This is an **inventory**, not a proof and not a fix. Every row was classified by
> **reading the aggregation code**; where I classified from a name or a docstring alone, the row says
> so. **No aggregation logic was changed** — changing how the society reaches verdicts is
> architectural and Aaron's call. `unmetered` in the `toy-is-free-metered-must-be-earned` sense: no
> test in this repo currently fails when a rule below is non-deferential.
>
> **Result in one line: this is CORRECTIVE, not preventive — three live does-not-qualify sites, and
> the worst one fails in the unsafe direction.**

---

## 0. The test being applied

From `2026-08-14-…-the-dominance-lift-theorem.md` §6:

> An aggregation rule `A` is **deferential** if the rule class `R` it is optimal over contains every
> projection `πᵢ` ("answer exactly what unit `i` answered"). If `A` is deferential then
> `P(A correct) ≥ maxᵢ P(unit i correct)`.

Measured consequence for the rule that is *not* deferential: **unweighted majority loses to its best
member in 58.8% of 20 000 exact draws at ρ = 0.** Heterogeneity, not correlation, is the killer.

### Two refinements the sweep forced, before any row is read

The theorem as stated is about a **two-sided** accuracy objective (`P(verdict correct)`). Most of what
this repo actually does is **one-sided**, and the two must not be conflated — several rows below are
honest only because of this distinction.

- **One-sided / recall** (a false positive costs ~nothing; a miss costs the whole value): the relevant
  dominance argument is §3's Theorem A — **union**, `⋃Aᵢ ⊇ A_{i*}`, set monotonicity. Discovery,
  bug-finding, refutation.
- **One-sided / safety** (a false block costs ~nothing; a false pass costs everything): the mirror
  argument — **unanimity / veto**, `⋂Aᵢ ⊆ A_{i*}`. Any single member can stop it, so the aggregate is
  never worse than its most-suspicious member *at blocking*.
- **Two-sided accuracy**: needs the full `πᵢ ∈ R` property. A fixed unweighted count has no way to
  defer and is the failure case.

So the operative classification is a triangle, not a line:

| shape | defers toward | dominates on | fails on |
|---|---|---|---|
| **OR / union** | accept | recall | precision |
| **AND / unanimity / veto** | reject | safety | recall |
| **unweighted k-of-n majority** | **neither** | **neither** | both |

The middle column is why BFT and security gates are fine. The bottom row is the defect class.

### And one distinction the brief was right to insist on

Not every majority is a defect. **Byzantine quorums** are a *safety* mechanism against adversarial
nodes, and **N-oracle byte-lock** comparisons are *integrity detectors* over units that are supposed to
be identical. Neither is trying to be an accuracy-maximiser over heterogeneous judgements, so the
theorem has nothing to say about them. They are filed as **not-an-accuracy-aggregator** and are **not**
findings.

---

## 1. The inventory

### 1.1 DOES NOT QUALIFY — equal-weight aggregation of heterogeneous agent judgements

#### A. `agentic-organization/packages/metrics/src/review-board.ts:115` — **the worst offender**

```ts
if (distinctAgree >= quorum && distinctDisagree < quorum) { … Adopted … }
…
return { … state: FindingDecisionState.Withheld … };   // default: DISCARD the finding
```

`DEFAULT_REVIEW_QUORUM = 3` (line 86). Three or more **distinct reviewer agents** must agree before a
code-review finding is adopted; otherwise it is **withheld** — i.e. discarded.

This is the sharpest site in the repo for three compounding reasons, and I verified all three by
reading the code, not the docstring:

1. **The task is one-sided/recall and the rule is its exact complement.** Finding a bug is a discovery
   task — §3's union rule dominates *tautologically* there. This is `AND`-of-3 applied to a task whose
   dominant rule is `OR`. The best reviewer spotting a real defect alone is **structurally guaranteed**
   to be overruled by two reviewers who did not spot it.
2. **The failure direction is unsafe.** The caller,
   `agentic-organization/packages/application/src/review-gate.ts:81-83`:
   ```ts
   if (adopted.length === 0) {
     recommendedGateOutcome = QualityGateOutcome.Approved;
     reason = "no finding reached quorum agreement; gate approved";
   }
   ```
   A solitary true blocking finding from the single most competent reviewer does not merely fail to be
   published — **it approves the change.** The aggregate is worse than its best member *and* the loss
   lands on the permissive side.
3. **It is live.** `evaluateReviewBoard` → `review-gate.ts` → exported through
   `packages/metrics/src/index.ts` and `mcp-tools.ts`. Not shelf substrate.

**Tension with a standing rule, stated plainly:** `every-bug-has-economic-value` says a bug is
reducible uncertainty and finding it exposes value. A quorum gate that discards a solitary true finding
**destroys ΔU by construction**, and it does so silently — the withheld decision carries a `reason`
string but banks nothing.

**The legitimate reading, which I checked for and did not find:** a quorum could be a deliberate
*precision* mechanism — suppressing noisy-reviewer spam at a known cost in recall. That would be a
defensible engineering choice. **Nothing in the module names that trade-off.** The header says
reviewers "must AGREE before a comment is published" and attributes the design to mirroring the
constitution gate — i.e. the rationale imported is *legitimacy*, which is the wrong objective for a
defect-detection task. The trade is being made without being priced.

**Recommendation — switch to union, do not add weights.** For a recall task the deferential rule is
already free and needs no competence estimates: adopt every finding, and use the agreement count as a
**published confidence annotation** rather than a gate. If false-positive volume is the real concern,
the honest fix is a per-reviewer precision estimate — which nobody has measured — so union-plus-
annotation is the change that is available today and is provably not worse than the best reviewer.

#### B. `src/Core.TypeScript/workflow-engine/consensus.ts:195` (and 198, 204)

```ts
case "majority":
  consensusReached = winnerCount > successfulCount / 2;
```

Textbook unweighted majority over N analyzer agents, plus `supermajority` (a higher unweighted bar,
strictly worse on this axis) and `first-n-agree`. The module's own header cites Sakana's Robin
architecture: *"8 independent instances … accepts conclusion only if majority agree."*

**Verified nuance that matters, in both directions:**

- `nIdenticalAnalyzers` (line 253) is the **identical-agents** regime, which is exactly Condorcet's
  hypothesis and exactly the regime in which majority *is* fine. If every caller used only that helper,
  this site would be a non-finding.
- But `ConsensusContext.analyzers` (line 101) takes an **arbitrary array** of distinct callbacks. The
  type admits heterogeneous analyzers, and the majority rule is applied to them unchanged. The safe
  regime is a convention, not a constraint.
- **Mitigation, and it is real:** failing consensus returns `NoConsensus` rather than a verdict
  (lines 208-213). The rule **refuses** instead of guessing, which is the safe direction. The defect is
  confined to the case where a majority *does* form around the wrong verdict while the best analyzer
  dissents.

**Liveness — stated honestly: this is currently unwired.** `grep` for `runConsensus` outside the module
returns only `consensus.test.ts`. It is a substrate awaiting callers, which makes it the **cheapest**
site to correct and the one most likely to become expensive later.

**Recommendation:** keep the mechanism, change the default and the type. Either (a) constrain the
public entry point to `nIdenticalAnalyzers` and require an explicit opt-in for heterogeneous analyzer
arrays, or (b) add a `{ kind: "union" }` mechanism and make it the default for discovery-shaped
verdicts. Weights are not available — nobody has measured per-analyzer competence — so **do not add a
weighted mechanism you cannot populate.**

#### C. `agentic-organization/packages/application/src/rmo.ts:331-338`

```ts
const approvals = input.votes.filter((v) => v.approve).length;
const quorum = Math.floor(input.votes.length / 2) + 1;
const quorumMet = input.votes.length > 0 && approvals >= quorum;
…
const targetCount = quorumMet && approverTargets.length > 0 ? median(approverTargets) : input.currentCount;
```

Two aggregations in four lines, and they classify differently:

- **The approve/hold gate is strict unweighted majority of supervisor votes.** But the *decision* is a
  staffing action, and approving it is closer to an authorization act than a truth claim.
- **`median(approverTargets)` is an equal-weight estimator of a quantity** — "how many of this hat do
  we need." That half is squarely in scope. Median is robust, and it is *not* deferential: it cannot
  put its weight on the one supervisor who actually knows the demand curve. It is unweighted majority
  wearing a different statistic.

**Severity: lower than A and B**, and I want to be precise about why rather than round it up. The
downside is bounded (a staffing count, revisable next round, no verdict is published as true), and the
median at least resists a single wild proposal — which is a *different* virtue that the theorem does
not price. It is filed because it is the same structural defect, not because it is equally costly.

**Recommendation:** leave the gate; it is an authorization. If the target count is ever load-bearing,
the deferential replacement is not "add weights" — it is to take the **max** of approvers' targets when
under-staffing is the expensive error, or to publish the range instead of collapsing it.

### 1.2 WEIGHTED, BUT THE WEIGHTS ARE NOT COMPETENCE — deference reachable, not chosen

These are not majority votes and they are not the defect class. They are recorded because the theorem's
hypothesis is *"`A` is **optimal** over `R`"*, and a fixed weighting scheme satisfies the `πᵢ ∈ R` half
while failing the optimality half. Deference is **reachable but not chosen**.

#### D. `src/Bayesian/ThousandBrains.fs:73` — `computeConsensus`, IV-weighted log-linear pool

```fsharp
// P_consensus ∝ Π (P_i)^w_i
let totalWeightedPM = votes |> List.sumBy (fun v -> v.Belief.PrecisionMean * v.Weight)
```

with `castVote` (line 66) setting `weight = log(1 + accumulatedIV)`.

The rule class `{∏ pᵢ^wᵢ}` **does** contain every projection, so the structure is right. Two honest
gaps:

1. **The weight is experience, not competence.** Accumulated information value measures how much
   evidence a column has seen — not how often it was right. A confidently-wrong column accrues IV.
   Nitzan–Paroush's weight is `log(cᵢ/(1−cᵢ))`, a **calibration** quantity, and nothing in the repo
   estimates it.
2. **The log is a deliberate cap on deference**, and the docstring says so: *"logarithmic scaling
   prevents hyper-experienced columns from becoming dictators, respecting the Gibbard-Satterthwaite /
   Arrow-escape principles."* That is a coherent and defensible position — but it should be recorded
   that it is **in direct tension with the Dominance Lift theorem**, which says the aggregate beats its
   best part precisely *by* being able to become a dictator when the evidence warrants. Sub-linear
   weighting does not make deference unreachable (weights are unbounded), it makes it **slow**.

The tension is not a bug and I am not filing it as one. It is a genuine values/accuracy trade the
manifesto has opinions on from both sides (§3 weight-free vs §11 multi-oracle), and it is Aaron's.

#### E. `src/Core/QuorumAlgebra.fs:151` — `interfereQuorum`

Amplitude-weighted complex sum over `join`-deduplicated distinct sources. Structurally deferential (a
source can carry arbitrary magnitude; a zero-amplitude source drops out), and the `join`-before-
`interfere` ordering is the module's own guard against six agents on one stream folding to six times
the confidence. **The weights are self-asserted amplitudes**, which is §6.1 cost 2 exactly: *"a wrong
weight is a real loss."* Recorded, not filed.

### 1.3 QUALIFIES — deferential as implemented

| site | rule | why it qualifies |
|---|---|---|
| `src/Core/SocietyUsefulWork.fs:32,82` | **union** of members' discoveries | §3 Theorem A, verbatim — this is the doc's own Rule A. Monotone; dominates on every sample path |
| `src/Core/BeliefConvergence.fs:33,63` | pointwise **product** of likelihoods (Bayes) | Self-weighting: an uninformative agent contributes a near-flat factor and drops out of the normalized posterior. The mediocre voter *cannot* outvote the expert — which is exactly the mechanism majority lacks. Caller obligations (dedup, phase-order) are already documented in-module |
| `src/Bayesian/SocietyBootstrap.fs:138` · `SparseSocietyNetwork.fs:105,178` | precision-weighted Gaussian factor graph | Inverse-variance weighting is the Gaussian log-odds analogue. `empowerment = finalJoint.Precision − maxSoloPrecision` (line 179) literally measures "society beats best individual" — **honest caveat: in *precision*, not in accuracy.** Summed precision always exceeds the max, so that quantity dominates tautologically and would not detect a correlated-overconfidence failure |
| `src/Bayesian/LocalConsensus.fs:52` | product of Gaussians + precision threshold | Same family as above |
| `src/Bayesian/MutualFalsification.fs:185` | **additive ΔU ledger** over refutations | Any single cell's refutation banks; no threshold suppresses a solitary refuter. Union-shaped on the recall side |
| `src/Core/DecorrelationMeter.fs:136` · `DecorrelationExcessFusion.fs:116,196` | counts **reported**, never collapsed | These emit `{Excess; WithinNull}` as a reading. `Bound` uses `List.max` — the maximally deferential statistic. No verdict is manufactured from a count |

### 1.4 NOT AN ACCURACY AGGREGATOR — correct as-is, filed as non-findings

| site | rule | why the theorem does not apply |
|---|---|---|
| `src/Core.CSharp/Consensus.cs:18,47` (+ `src/Core/Consensus.fs`) | BFT `2⌊(n−1)/3⌋+1` | **Safety against adversarial nodes**, not accuracy over competences. Unweighted is correct and deliberate here. (Its ordinal tie-break is a determinism fix, unrelated) |
| `src/Core/SybilBft.fs:82-95` · `SybilBftProtocol.fs:91,107` | `2f+1` over **distinct entropy sources** | Same. Note it is *stronger* than plain BFT — it collapses Sybil-inflated claims before counting, which attacks the independence assumption directly |
| `tests/cross-verification/_harness/nway-diff.ts:407,456` | majority as the reference **only when no canonical exists** | **Integrity detector.** Oracles are supposed to be byte-identical; disagreement is corruption, not competence. The header already states the limit: *"a unanimous-but-wrong result still fails"* |
| `agentic-organization/packages/governance/src/constitution-gate.ts:93-110` | k distinct agree, **any objection vetoes** | **Legitimacy/consent**, not truth. And the veto makes it deferential toward *reject* — a single dissenter blocks, which is the safe direction for a constitution |
| `change-control-kernel.ts:142-145` + `change-control-policy.ts:35` | security stage: quorum 3 **of 3** (unanimity) | **Safety gate.** Unanimity = veto = deferential toward reject. Correct shape for the objective |
| `agentic-organization/packages/application/src/work-market.ts:625-645` | ≥ `requiredApprovals` distinct **non-producer** reviewers | The load-bearing content is `self_only_review` + hat eligibility — **authorization**, not accuracy. Deployed default is `requiredApprovals: 1` (`deploy/run-org-cadence.ts:761`), i.e. `OR`-shaped in practice |
| `agentic-organization/packages/application/src/mutual-repair.ts:34-40` | ≥3 healthy peers before repair | **Liveness precondition**, not a verdict |
| `src/Core/Veridicality.fs:200` | ≥2 **distinct root authorities** | An **anti**-consensus gate — it exists to refuse pseudo-consensus, and it counts *independence*, not votes. One-way (failing convicts, passing certifies nothing), already stated in-module |
| `src/Core/Diversity.fs:45` | `coerciveStep` copies the majority | A **model of the pathology**, deliberately the strongest homogenizer, used as an upper bound. The theorem agrees with it |
| `src/Bayesian/CondorcetBoundary.fs` | model of Rule B | Not a live aggregation path — it is the *model* whose `ρ*` is defective (D2/D3/D4, already filed). It matters here only because it is the artifact that would *license* a majority design |

---

## 2. Count

| verdict | sites |
|---|---|
| **does-not-qualify** | **3** (review-board · workflow-engine consensus · rmo) |
| weights-not-competence (recorded, not filed) | 2 (ThousandBrains · QuorumAlgebra) |
| qualifies | 6 |
| not-an-accuracy-aggregator | 10 |

**Worst offender: `review-board.ts` + `review-gate.ts`.** Live, one-sided/recall task, running the
exact complement of the dominant rule, failing toward **approve**.

**Corrective, not preventive.** The sweep found live sites; the discovery has work to do.

---

## 3. What it would take to fix — and why "add weights" is the wrong answer today

The log-odds route (`wᵢ = log(cᵢ/(1−cᵢ))`) requires **per-agent competence estimates, and nobody in
this repo has measured one.** Deploying weights you cannot populate converts the theorem's guarantee
into its inverse (§6.1 cost 2: deference to a unit *believed* best but which is not). So:

1. **Prefer union where the task is discovery.** Free, needs no estimates, dominates by monotonicity.
   This is the honest recommendation for site A and probably for site B's default.
2. **Prefer veto/unanimity where the task is safety.** Also free, also needs no estimates, dominates on
   the blocking side. Already the shape of the security stage and the constitution gate.
3. **Reach for weights only where the objective is genuinely two-sided** *and* someone has banked the
   right data. **I checked, and the answer is more interesting than "no":**
   `src/Core.TypeScript/planning/calibration-ledger.ts:320` maintains a per-`(agent, hat)` **Beta
   posterior** — `μ = α/(α+β)` over hits/misses, append-only, recomputed from full history, anchored to
   Brier 1950 / Gneiting–Raftery 2007 interval scoring with an explicit anti-sandbagging term. That is
   **exactly the right shape** for `cᵢ`, and it sits one `log(μ/(1−μ))` from a Nitzan–Paroush weight.

   **It is nonetheless the wrong quantity, and the module says so itself** (design contract clause 4):

   > *"CALIBRATION ≠ COMPETENCE — this measures self-knowledge: whether an agent's model of its own
   > performance matches reality. An agent can be poorly calibrated and excellent, or well-calibrated
   > and mediocre. Weighting a claim is not the same as valuing the claimant."*

   And the "hit" being scored is **completion-time interval coverage**, not correctness of a judgement.
   So `μ` from this ledger must **not** be substituted for `cᵢ` — an agent's deadline-honesty says
   nothing about whether its review finding is real. What the ledger does establish is that the
   *construction* is already present and already reviewed; a **domain-specific ledger of the same
   shape**, scoring findings-upheld-on-appeal rather than deadlines-met, is the concrete path to a
   populated weight. That is L4 in the theorem doc's discharge table, and it is still unassigned.
4. **Do not add a `weighted` mechanism as an unpopulated option.** An option whose weights default to
   equal is unweighted majority with a misleading name — and one silently drawing weights from the
   calibration ledger would be worse, because it would look principled.

---

## 4. Method, and what I did *not* verify

Searched by **behaviour, not vocabulary**: `/ 2` and `/2 + 1` threshold arithmetic, `filter(…).length`
compared to a bound, `countBy … maxBy snd` plurality selection, `List.filter … List.length` verdict
counting, and `maxBy` argmax — then read every hit that touched a verdict. Vocabulary searches
(`majority`, `quorum`, `vote`, `consensus`, `tally`) were run second, as a cross-check, and returned
213 files of which the great majority were unrelated (`.length > 0` guards, `Math.PI / 2.0`, hex
decoding).

**Every row in §1 was classified by reading the aggregation expression itself.** Two honest gaps:

- **Liveness** was established by `grep` for callers, not by tracing a running deployment. "Live" here
  means "has a non-test caller."
- I did **not** audit `references/prior-art/` (out of scope by rule), the `.fsx` research scripts
  (models, not paths), or test files (except to establish liveness).
- I did not attempt to *measure* the loss at any site. The 58.8% figure is from the theorem doc's
  synthetic draws, **not** from these code paths — no claim is made here about the empirical error rate
  of the review board.

---

## Pointers

- `docs/research/2026-08-14-does-society-beats-best-individual-lift-to-world-beats-best-society-the-dominance-lift-theorem.md` — the theorem this inventory applies (§3 union, §4.1 heterogeneity, §6 the lift)
- `agentic-organization/packages/metrics/src/review-board.ts` · `packages/application/src/review-gate.ts` — the worst offender and its caller
- `src/Core.TypeScript/workflow-engine/consensus.ts` — the unwired substrate, cheapest to correct
- `.claude/rules/every-bug-has-economic-value.md` — the ΔU a discarded solitary finding destroys
- `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` §"the discriminator is EXIT" — deference-availability, the same object as `πᵢ ∈ R`
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why this doc is `unmetered`
